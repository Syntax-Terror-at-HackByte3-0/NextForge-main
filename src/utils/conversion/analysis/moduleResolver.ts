/**
 * Enhanced module resolver for import/export analysis
 * Handles aliases, implicit index files, and missing extensions
 */
import * as path from 'path';
import { UploadedFiles } from '@/types/conversion';
import { logConversion } from '../logger';

interface ModuleResolutionOptions {
  aliases?: Record<string, string>;
  extensions?: string[];
}

/**
 * Resolves a module import path based on project configuration
 */
export const resolveModulePath = (
  importPath: string,
  currentFilePath: string,
  files: UploadedFiles,
  options: ModuleResolutionOptions = {}
): string | null => {
  const {
    aliases = {},
    extensions = ['.js', '.jsx', '.ts', '.tsx', '.json']
  } = options;

  // Handle alias paths
  for (const [alias, aliasPath] of Object.entries(aliases)) {
    if (importPath.startsWith(alias)) {
      importPath = importPath.replace(alias, aliasPath);
      break;
    }
  }

  // Convert relative path to absolute
  let absolutePath = importPath;
  if (importPath.startsWith('.')) {
    const currentDir = path.dirname(currentFilePath);
    absolutePath = path.join(currentDir, importPath);
  }

  // Check if the file exists as is
  if (files[absolutePath]) {
    return absolutePath;
  }

  // Try adding extensions
  for (const ext of extensions) {
    if (files[`${absolutePath}${ext}`]) {
      return `${absolutePath}${ext}`;
    }
  }

  // Try with /index
  for (const ext of extensions) {
    if (files[`${absolutePath}/index${ext}`]) {
      return `${absolutePath}/index${ext}`;
    }
  }

  // Not found
  return null;
};

/**
 * Extract aliases from tsconfig.json or webpack.config.js
 */
export const extractAliases = (files: UploadedFiles): Record<string, string> => {
  const aliases: Record<string, string> = {};
  
  // Try to parse tsconfig.json
  if (files['tsconfig.json']) {
    try {
      const tsconfig = JSON.parse(files['tsconfig.json']);
      if (tsconfig.compilerOptions?.paths) {
        const paths = tsconfig.compilerOptions.paths;
        const baseUrl = tsconfig.compilerOptions.baseUrl || '.';
        
        Object.entries(paths).forEach(([key, value]) => {
          // Remove wildcard and get the first path
          const aliasKey = key.replace('/*', '');
          const aliasValue = Array.isArray(value) 
            ? (value[0] as string).replace('/*', '') 
            : (value as string).replace('/*', '');
          
          aliases[aliasKey] = path.join(baseUrl, aliasValue);
        });
        
        logConversion('info', `Extracted ${Object.keys(aliases).length} aliases from tsconfig.json`);
      }
    } catch (error) {
      logConversion('warning', `Failed to parse tsconfig.json: ${(error as Error).message}`);
    }
  }
  
  // Try to parse webpack.config.js (simplified, actual parsing would require eval)
  if (files['webpack.config.js']) {
    const webpackConfig = files['webpack.config.js'];
    
    // Simple regex-based extraction of aliases
    const aliasRegex = /alias\s*:\s*{([^}]*)}/g;
    const aliasMatch = aliasRegex.exec(webpackConfig);
    
    if (aliasMatch && aliasMatch[1]) {
      const aliasBlock = aliasMatch[1];
      const aliasEntries = aliasBlock.match(/'([^']+)'[\s:]+['"]([^'"]+)['"]/g);
      
      if (aliasEntries) {
        aliasEntries.forEach(entry => {
          const [key, value] = entry.split(':').map(part => 
            part.trim().replace(/['"]/g, '')
          );
          
          aliases[key] = value;
        });
        
        logConversion('info', `Extracted ${aliasEntries.length} aliases from webpack.config.js`);
      }
    }
  }
  
  return aliases;
};

/**
 * Transform imports to be compatible with Next.js
 */
export const transformImportPath = (
  originalPath: string,
  currentFile: string,
  targetFile: string
): string => {
  // If it's a node module import, keep it as is
  if (!originalPath.startsWith('.') && !originalPath.startsWith('/')) {
    return originalPath;
  }
  
  // Calculate relative path from target file to the imported module
  const currentDir = path.dirname(currentFile);
  const targetDir = path.dirname(targetFile);
  
  // Resolve the absolute path of the import
  const absoluteImportPath = path.resolve(currentDir, originalPath);
  
  // Calculate the relative path from the target file
  let relativePath = path.relative(targetDir, absoluteImportPath);
  
  // Ensure the path starts with ./ or ../
  if (!relativePath.startsWith('.') && !relativePath.startsWith('/')) {
    relativePath = `./${relativePath}`;
  }
  
  // Handle Windows path separators
  relativePath = relativePath.replace(/\\/g, '/');
  
  return relativePath;
};

/**
 * Analyze imports in the project and build a dependency graph
 */
export const buildProjectDependencyGraph = (
  files: UploadedFiles
): {
  imports: Record<string, string[]>;
  exports: Record<string, string[]>;
  missingImports: Record<string, string[]>;
  circularDependencies: [string, string][];
} => {
  const imports: Record<string, string[]> = {};
  const exports: Record<string, string[]> = {};
  const missingImports: Record<string, string[]> = {};
  const circularDependencies: [string, string][] = [];
  
  // Extract aliases from project config
  const aliases = extractAliases(files);
  
  // First pass: collect imports and exports
  Object.entries(files).forEach(([filePath, content]) => {
    if (!/\.(js|jsx|ts|tsx)$/.test(filePath)) return;
    
    // Extract imports using regex for simplicity
    // In a real implementation, use AST parsing for more accuracy
    const importRegex = /import\s+(?:{[^}]*}|\*\s+as\s+[^;]*|[^;{]*)\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    
    imports[filePath] = [];
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      imports[filePath].push(importPath);
    }
    
    // Extract exports using simple regex
    exports[filePath] = [];
    if (content.includes('export default') || content.includes('export {')) {
      exports[filePath].push('has-exports');
    }
  });
  
  // Second pass: resolve imports and detect missing/circular dependencies
  Object.entries(imports).forEach(([filePath, fileImports]) => {
    const resolvedImports: string[] = [];
    const unresolvedImports: string[] = [];
    
    fileImports.forEach(importPath => {
      // Skip node_module imports
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) return;
      
      const resolved = resolveModulePath(importPath, filePath, files, { aliases });
      
      if (resolved) {
        resolvedImports.push(resolved);
        
        // Check for circular dependencies
        if (imports[resolved]?.includes(filePath)) {
          circularDependencies.push([filePath, resolved]);
        }
      } else {
        unresolvedImports.push(importPath);
      }
    });
    
    // Save unresolved imports
    if (unresolvedImports.length > 0) {
      missingImports[filePath] = unresolvedImports;
    }
  });
  
  return { imports, exports, missingImports, circularDependencies };
};
