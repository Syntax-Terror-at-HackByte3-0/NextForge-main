
/**
 * Enhanced dependency analyzer
 * Provides deep insights into library usage, hooks, and component patterns
 */
import { UploadedFiles } from '@/types/conversion';
import { parseCode } from './astUtils';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { logConversion } from '../logger';

// Categories of dependencies
export type DependencyCategory = 
  | 'state-management'
  | 'routing'
  | 'data-fetching'
  | 'styling'
  | 'ui-component'
  | 'testing'
  | 'utility'
  | 'server-side'
  | 'client-side'
  | 'unknown';

// Structure for library usage details
export interface LibraryUsage {
  name: string;
  version?: string;
  category: DependencyCategory;
  imports: string[];
  usageCount: number;
  requiresClientDirective: boolean;
  files: string[];
}

// Structure for hook usage
export interface HookUsage {
  name: string;
  usageCount: number;
  files: string[];
  requiresClientDirective: boolean;
}

/**
 * Analyze library usage throughout the project
 */
export const analyzeLibraryUsage = (files: UploadedFiles): LibraryUsage[] => {
  const libraries: Record<string, LibraryUsage> = {};
  
  // Extract package.json dependencies
  let packageJson: any = {};
  if (files['package.json']) {
    try {
      packageJson = JSON.parse(files['package.json']);
    } catch (error) {
      logConversion('warning', 'Failed to parse package.json');
    }
  }
  
  const dependencies = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {})
  };
  
  // Known libraries and their categories
  const knownLibraries: Record<string, { category: DependencyCategory, requiresClientDirective: boolean }> = {
    'react': { category: 'ui-component', requiresClientDirective: false },
    'react-dom': { category: 'ui-component', requiresClientDirective: true },
    'react-router': { category: 'routing', requiresClientDirective: true },
    'react-router-dom': { category: 'routing', requiresClientDirective: true },
    'redux': { category: 'state-management', requiresClientDirective: true },
    'react-redux': { category: 'state-management', requiresClientDirective: true },
    '@reduxjs/toolkit': { category: 'state-management', requiresClientDirective: true },
    'zustand': { category: 'state-management', requiresClientDirective: true },
    'jotai': { category: 'state-management', requiresClientDirective: true },
    'recoil': { category: 'state-management', requiresClientDirective: true },
    'swr': { category: 'data-fetching', requiresClientDirective: true },
    'axios': { category: 'data-fetching', requiresClientDirective: false },
    'styled-components': { category: 'styling', requiresClientDirective: true },
    'emotion': { category: 'styling', requiresClientDirective: true },
    '@emotion/react': { category: 'styling', requiresClientDirective: true },
    '@emotion/styled': { category: 'styling', requiresClientDirective: true },
    'tailwindcss': { category: 'styling', requiresClientDirective: false },
    'jest': { category: 'testing', requiresClientDirective: false },
    'testing-library': { category: 'testing', requiresClientDirective: false },
    '@testing-library/react': { category: 'testing', requiresClientDirective: false },
    'cypress': { category: 'testing', requiresClientDirective: false },
    'lodash': { category: 'utility', requiresClientDirective: false },
    'ramda': { category: 'utility', requiresClientDirective: false },
    'date-fns': { category: 'utility', requiresClientDirective: false },
    'moment': { category: 'utility', requiresClientDirective: false },
    'next': { category: 'server-side', requiresClientDirective: false },
    'express': { category: 'server-side', requiresClientDirective: false },
    'koa': { category: 'server-side', requiresClientDirective: false },
  };
  
  // Analyze each file for imports
  Object.entries(files).forEach(([filePath, content]) => {
    if (!/\.(js|jsx|ts|tsx)$/.test(filePath)) return;
    
    try {
      const ast = parseCode(content);
      
      traverse(ast, {
        ImportDeclaration(path) {
          const source = path.node.source.value;
          
          // Skip relative imports
          if (source.startsWith('.') || source.startsWith('/')) return;
          
          // Handle scoped packages and submodules
          const mainPackage = source.startsWith('@') 
            ? source.split('/').slice(0, 2).join('/') 
            : source.split('/')[0];
          
          // Initialize library info if not exists
          if (!libraries[mainPackage]) {
            const version = dependencies[mainPackage] || 'unknown';
            const knownInfo = Object.entries(knownLibraries).find(([lib, _]) => 
              mainPackage === lib || mainPackage.includes(lib)
            );
            
            const category = knownInfo 
              ? knownInfo[1].category 
              : 'unknown';
              
            const requiresClientDirective = knownInfo 
              ? knownInfo[1].requiresClientDirective 
              : false;
            
            libraries[mainPackage] = {
              name: mainPackage,
              version,
              category,
              imports: [],
              usageCount: 0,
              requiresClientDirective,
              files: []
            };
          }
          
          // Track imported items
          path.node.specifiers.forEach(specifier => {
            let importName = '';
            
            if (t.isImportDefaultSpecifier(specifier)) {
              importName = specifier.local.name;
            } else if (t.isImportSpecifier(specifier)) {
              importName = t.isIdentifier(specifier.imported) 
                ? specifier.imported.name 
                : specifier.imported.value;
            } else if (t.isImportNamespaceSpecifier(specifier)) {
              importName = `* as ${specifier.local.name}`;
            }
            
            if (importName && !libraries[mainPackage].imports.includes(importName)) {
              libraries[mainPackage].imports.push(importName);
            }
          });
          
          // Increment usage count
          libraries[mainPackage].usageCount++;
          
          // Add file to the list if not already included
          if (!libraries[mainPackage].files.includes(filePath)) {
            libraries[mainPackage].files.push(filePath);
          }
        }
      });
    } catch (error) {
      logConversion('warning', `Failed to analyze imports in ${filePath}: ${(error as Error).message}`);
    }
  });
  
  return Object.values(libraries);
};

/**
 * Analyze hook usage throughout the project
 */
export const analyzeHookUsage = (files: UploadedFiles): HookUsage[] => {
  const hooks: Record<string, HookUsage> = {};
  
  // Define client-side hooks that require the "use client" directive
  const clientSideHooks = [
    'useState', 'useReducer', 'useEffect', 'useLayoutEffect', 
    'useRef', 'useImperativeHandle', 'useCallback', 'useMemo',
    'useContext', 'useTransition', 'useDeferredValue', 'useId',
    'useInsertionEffect', 'useSyncExternalStore'
  ];
  
  // Analyze each file for hook usage
  Object.entries(files).forEach(([filePath, content]) => {
    if (!/\.(js|jsx|ts|tsx)$/.test(filePath)) return;
    
    try {
      const ast = parseCode(content);
      
      traverse(ast, {
        CallExpression(path) {
          // Check for hook calls (functions starting with "use")
          if (t.isIdentifier(path.node.callee) && 
              path.node.callee.name.startsWith('use')) {
            
            const hookName = path.node.callee.name;
            
            // Initialize hook info if not exists
            if (!hooks[hookName]) {
              hooks[hookName] = {
                name: hookName,
                usageCount: 0,
                files: [],
                requiresClientDirective: clientSideHooks.includes(hookName)
              };
            }
            
            // Increment usage count
            hooks[hookName].usageCount++;
            
            // Add file to the list if not already included
            if (!hooks[hookName].files.includes(filePath)) {
              hooks[hookName].files.push(filePath);
            }
          }
        }
      });
    } catch (error) {
      logConversion('warning', `Failed to analyze hooks in ${filePath}: ${(error as Error).message}`);
    }
  });
  
  return Object.values(hooks);
};

/**
 * Analyze client-side API usage
 * Returns files that need the "use client" directive
 */
export const analyzeClientAPIs = (files: UploadedFiles): string[] => {
  const clientAPIFiles: string[] = [];
  
  const clientAPIs = [
    'window', 'document', 'navigator', 'localStorage', 'sessionStorage',
    'location', 'history', 'addEventListener', 'setTimeout', 'setInterval',
    'requestAnimationFrame', 'fetch', 'XMLHttpRequest'
  ];
  
  Object.entries(files).forEach(([filePath, content]) => {
    if (!/\.(js|jsx|ts|tsx)$/.test(filePath)) return;
    
    // Skip already identified files
    if (clientAPIFiles.includes(filePath)) return;
    
    try {
      const ast = parseCode(content);
      let usesClientAPI = false;
      
      traverse(ast, {
        MemberExpression(path) {
          if (t.isIdentifier(path.node.object) && 
              clientAPIs.includes(path.node.object.name)) {
            usesClientAPI = true;
            path.stop(); // Stop traversal once found
          }
        },
        
        Identifier(path) {
          // Only check identifiers that aren't in import/export statements
          if (path.parent && 
              !t.isImportDeclaration(path.parent) && 
              !t.isExportDeclaration(path.parent) &&
              clientAPIs.includes(path.node.name)) {
            usesClientAPI = true;
            path.stop(); // Stop traversal once found
          }
        }
      });
      
      if (usesClientAPI && !clientAPIFiles.includes(filePath)) {
        clientAPIFiles.push(filePath);
      }
    } catch (error) {
      logConversion('warning', `Failed to analyze client APIs in ${filePath}: ${(error as Error).message}`);
    }
  });
  
  return clientAPIFiles;
};

/**
 * Determine which files need the "use client" directive in Next.js App Router
 */
export const determineClientComponents = (
  files: UploadedFiles,
  libraryUsage: LibraryUsage[],
  hookUsage: HookUsage[]
): string[] => {
  const clientComponents: string[] = [];
  
  // Get files using browser APIs
  const clientAPIFiles = analyzeClientAPIs(files);
  clientComponents.push(...clientAPIFiles);
  
  // Add files using client-side libraries
  libraryUsage
    .filter(lib => lib.requiresClientDirective)
    .forEach(lib => {
      lib.files.forEach(file => {
        if (!clientComponents.includes(file)) {
          clientComponents.push(file);
        }
      });
    });
  
  // Add files using client-side hooks
  hookUsage
    .filter(hook => hook.requiresClientDirective)
    .forEach(hook => {
      hook.files.forEach(file => {
        if (!clientComponents.includes(file)) {
          clientComponents.push(file);
        }
      });
    });
  
  // Analyze for event handlers in JSX
  Object.entries(files).forEach(([filePath, content]) => {
    if (!/\.(js|jsx|ts|tsx)$/.test(filePath)) return;
    
    // Skip already identified files
    if (clientComponents.includes(filePath)) return;
    
    // Check for JSX event handlers
    if (/on[A-Z][a-zA-Z]*\s*=/.test(content)) {
      clientComponents.push(filePath);
    }
  });
  
  return clientComponents;
};
