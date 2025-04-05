// ---------- Types ----------
interface FileNode {
  name: string;
  path: string;
  type: 'directory' | 'file';
  content?: string;
  children?: FileNode[];
}

interface ConversionResult {
  pages: Record<string, string>;
  components: Record<string, string>;
  api: Record<string, string>;
  styles: Record<string, string>;
  config: Record<string, string>;
  public: Record<string, string>;
  utils: Record<string, string>;
  tests: Record<string, string>;
  fileStructure: FileNode;
  logs: {
    warnings: string[];
    errors: string[];
    info: string[];
  };
  stats: {
    totalFiles: number;
    convertedFiles: number;
    conversionTime: number;
  };
}

type UploadedFiles = Record<string, string>;
type FileType =
  | 'component'
  | 'page'
  | 'layout'
  | 'api'
  | 'config'
  | 'style'
  | 'util'
  | 'hook'
  | 'context'
  | 'reducer'
  | 'store'
  | 'test';

// ---------- Helper Functions ----------
function categorizeFile(fileName: string): FileType {
  if (fileName.includes('/pages/')) return 'page';
  if (fileName.includes('/utils/')) return 'util';
  if (fileName.includes('/tests/') || fileName.includes('/__tests__/')) return 'test';
  if (fileName.endsWith('.css')) return 'style';
  if (fileName.includes('/components/')) return 'component';
  return 'component';
}

// Auto-fix function to add missing export default
function autoFixContent(path: string, content: string): string {
  if (path.includes('/pages/') && !content.includes('export default')) {
    content = `${content}\n\nexport default function Page() { return <div>Auto-generated Page</div>; }`;
    return content;
  }
  return content;
}

// Function to build the file structure tree
function buildFileTree(files: UploadedFiles): FileNode {
  const root: FileNode = { name: 'root', path: '', type: 'directory', children: [] };

  for (const [path, content] of Object.entries(files)) {
    const parts = path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isFile = i === parts.length - 1;

      let existing = current.children!.find(c => c.name === name);
      if (!existing) {
        existing = {
          name,
          path: (current.path ? current.path + '/' : '') + name,
          type: isFile ? 'file' : 'directory',
          ...(isFile ? { content } : { children: [] }),
        };
        current.children!.push(existing);
      }
      current = existing;
    }
  }

  return root;
}

// Function to print the folder structure tree
function printTree(node: FileNode, prefix = ''): string {
  if (node.type === 'file') {
    return `${prefix}└── ${node.name}`;
  }
  const children = node.children || [];
  const lines = children.map((child, i) => {
    const isLast = i === children.length - 1;
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    return (
      `${prefix}${isLast ? '└── ' : '├── '}${child.name}` +
      (child.type === 'directory' ? '\n' + printTree(child, childPrefix) : '')
    );
  });
  return lines.join('\n');
}

// ---------- Main Conversion Logic ----------
function convertFiles(uploadedFiles: UploadedFiles): ConversionResult {
  const result: ConversionResult = {
    pages: {},
    components: {},
    api: {},
    styles: {},
    config: {},
    public: {},
    utils: {},
    tests: {},
    fileStructure: { name: 'root', path: '', type: 'directory', children: [] },
    logs: { warnings: [], errors: [], info: [] },
    stats: { totalFiles: 0, convertedFiles: 0, conversionTime: 0 },
  };

  const start = Date.now();
  const fixedFiles: UploadedFiles = {};

  // Define the desired folder structure
  const desiredStructure = [
    'components/App.jsx',
    'utils/reportWebVitals.js',
    'tests/setupTests.js',
    'pages/_app.tsx',
    'pages/index.tsx',
    'styles/globals.css',
  ];

  for (const path of desiredStructure) {
    const content = uploadedFiles[path] || '// Default content for ' + path;
    const type = categorizeFile(path);
    let fixedContent = autoFixContent(path, content);
    fixedFiles[path] = fixedContent;

    // Log the fixed content
    if (type === 'page' && !content.includes('export default')) {
      result.logs.warnings.push(`${path}: Page component missing export default - automatically fixed`);
    }

    result.stats!.totalFiles++;

    switch (type) {
      case 'page':
        result.pages[path] = fixedContent;
        break;
      case 'component':
        result.components[path] = fixedContent;
        break;
      case 'util':
        result.utils[path] = fixedContent;
        break;
      case 'test':
        result.tests[path] = fixedContent;
        break;
      case 'style':
        result.styles[path] = fixedContent;
        break;
      default:
        result.components[path] = fixedContent;
    }

    result.stats!.convertedFiles++;
  }

  // Build the file structure
  result.fileStructure = buildFileTree(fixedFiles);

  // Track conversion time
  result.stats!.conversionTime = Date.now() - start;

  return result;
}

// ---------- Test the Conversion ----------
const uploadedFiles: UploadedFiles = {
  'components/App.jsx': '// App component code',
  'utils/reportWebVitals.js': '// Report Web Vitals util',
  'tests/setupTests.js': '// Test setup code',
  'pages/_app.tsx': '// Custom App code',
  'pages/index.tsx': '// Homepage code with missing export default', // Will be fixed
  'styles/globals.css': '/* Global styles */',
};

const result = convertFiles(uploadedFiles);
console.log('\n📁 Project File Structure:\n');
console.log(printTree(result.fileStructure));

console.log('\n📋 Conversion Logs:\n');
console.log(result.logs);
