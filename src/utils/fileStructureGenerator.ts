
/**
 * Utility to generate a file map structure from conversion output
 */
import { ConversionOutput } from './conversion/types';
import { FileNode } from '@/types/conversion';

/**
 * Generate a hierarchical file structure from the conversion output
 */
export const generateFileMap = (output: ConversionOutput): FileNode => {
  // Create the root node
  const root: FileNode = {
    name: 'next-app',
    path: '/',
    type: 'directory',
    children: []
  };
  
  // Helper function to add a file to the structure
  const addFile = (filePath: string, content: string, root: FileNode) => {
    // Skip files that come from default templates if they appear to be samples
    if (isDefaultSampleFile(filePath, content)) {
      return;
    }
    
    // Split path into segments
    const segments = filePath.split('/').filter(Boolean);
    const fileName = segments.pop() || '';
    
    // Navigate the directory structure, creating directories as needed
    let currentNode = root;
    
    for (const segment of segments) {
      // Find or create the directory
      let childNode = currentNode.children?.find(
        child => child.type === 'directory' && child.name === segment
      );
      
      if (!childNode) {
        // Create new directory node
        childNode = {
          name: segment,
          path: `${currentNode.path}${segment}/`,
          type: 'directory',
          children: []
        };
        currentNode.children = currentNode.children || [];
        currentNode.children.push(childNode);
      }
      
      currentNode = childNode;
    }
    
    // Add the file to the current directory
    currentNode.children = currentNode.children || [];
    currentNode.children.push({
      name: fileName,
      path: `${currentNode.path}${fileName}`,
      type: 'file',
      content
    });
  };
  
  // Helper function to check if a file is a default sample
  const isDefaultSampleFile = (filePath: string, content: string): boolean => {
    // Check if this is an example API route
    if (filePath.includes('/api/hello.js') && content.includes('export default function handler')) {
      return true;
    }
    
    // Check if this is a default empty page with placeholder text
    if ((filePath.includes('index.js') || filePath.includes('about.js')) && 
        content.includes('This app was converted from React to Next.js') ||
        content.includes('This is an example about page generated during Next.js conversion')) {
      return true;
    }
    
    return false;
  };
  
  // Create standard Next.js directories if they don't exist in the output
  const ensureNextJsDirectories = (root: FileNode) => {
    const standardDirs = ['pages', 'components', 'styles', 'public', 'lib', 'utils'];
    
    for (const dir of standardDirs) {
      if (!root.children?.some(child => child.type === 'directory' && child.name === dir)) {
        root.children = root.children || [];
        root.children.push({
          name: dir,
          path: `/${dir}/`,
          type: 'directory',
          children: []
        });
      }
    }
  };
  
  // Process pages directory
  Object.entries(output.pages).forEach(([fileName, content]) => {
    addFile(`pages/${fileName}`, content, root);
  });
  
  // Process components directory
  Object.entries(output.components).forEach(([fileName, content]) => {
    addFile(`components/${fileName}`, content, root);
  });
  
  // Process API routes
  Object.entries(output.api).forEach(([fileName, content]) => {
    addFile(`pages/api/${fileName}`, content, root);
  });
  
  // Process styles
  Object.entries(output.styles).forEach(([fileName, content]) => {
    addFile(`styles/${fileName}`, content, root);
  });
  
  // Process configuration files
  Object.entries(output.config).forEach(([fileName, content]) => {
    addFile(fileName, content, root);
  });
  
  // Process public files
  Object.entries(output.public).forEach(([fileName, content]) => {
    addFile(`public/${fileName}`, content, root);
  });
  
  // Ensure standard Next.js directories exist
  ensureNextJsDirectories(root);
  
  // Remove empty directories
  const removeEmptyDirs = (node: FileNode): boolean => {
    if (node.type === 'file') {
      return false;
    }
    
    if (node.children) {
      // Filter out empty child directories
      node.children = node.children.filter(child => {
        if (child.type === 'directory') {
          return !removeEmptyDirs(child);
        }
        return true;
      });
      
      // Return true if this directory is now empty
      return node.children.length === 0;
    }
    
    return true;
  };
  
  // Clean up empty directories (except for standard directories)
  removeEmptyDirs(root);
  
  // Sort children alphabetically with directories first
  const sortNode = (node: FileNode) => {
    if (node.children) {
      // Sort directories first, then files, both alphabetically
      node.children.sort((a, b) => {
        if (a.type === 'directory' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });
      
      // Recursively sort all children
      node.children.forEach(sortNode);
    }
  };
  
  // Sort the root node and all children
  sortNode(root);
  
  return root;
};

/**
 * Creates a skeleton Next.js file structure when no files are provided
 */
export const createDefaultFileStructure = (): FileNode => {
  const root: FileNode = {
    name: 'next-app',
    path: '/',
    type: 'directory',
    children: [
      {
        name: 'pages',
        path: '/pages/',
        type: 'directory',
        children: [
          {
            name: 'index.js',
            path: '/pages/index.js',
            type: 'file',
            content: `export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Welcome to Next.js</h1>
      <p>Get started by editing pages/index.js</p>
    </div>
  );
}`
          },
          {
            name: '_app.js',
            path: '/pages/_app.js',
            type: 'file',
            content: `import '../styles/globals.css';

function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}

export default MyApp;`
          },
          {
            name: 'api',
            path: '/pages/api/',
            type: 'directory',
            children: [
              {
                name: 'hello.js',
                path: '/pages/api/hello.js',
                type: 'file',
                content: `export default function handler(req, res) {
  res.status(200).json({ name: 'Next.js API' });
}`
              }
            ]
          }
        ]
      },
      {
        name: 'components',
        path: '/components/',
        type: 'directory',
        children: []
      },
      {
        name: 'styles',
        path: '/styles/',
        type: 'directory',
        children: [
          {
            name: 'globals.css',
            path: '/styles/globals.css',
            type: 'file',
            content: `html,
body {
  padding: 0;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen,
    Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;
}

a {
  color: inherit;
  text-decoration: none;
}

* {
  box-sizing: border-box;
}`
          }
        ]
      },
      {
        name: 'public',
        path: '/public/',
        type: 'directory',
        children: []
      },
      {
        name: 'next.config.js',
        path: '/next.config.js',
        type: 'file',
        content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;`
      },
      {
        name: 'package.json',
        path: '/package.json',
        type: 'file',
        content: `{
  "name": "next-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "latest",
    "react": "latest",
    "react-dom": "latest"
  },
  "devDependencies": {
    "eslint": "latest",
    "eslint-config-next": "latest"
  }
}`
      }
    ]
  };
  
  return root;
};
