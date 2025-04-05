/**
 * Utility functions for AST manipulation
 */
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

/**
 * Parse code into an AST with appropriate plugins
 */
export const parseCode = (code: string) => {
  return parse(code, {
    sourceType: 'module',
    plugins: [
      'jsx', 
      'typescript', 
      'classProperties', 
      'decorators-legacy',
      'objectRestSpread',
      'dynamicImport'
    ]
  });
};

/**
 * Check if a node is a specific React hook
 */
export const isReactHook = (name: string): boolean => {
  return (
    name === 'useState' || 
    name === 'useEffect' || 
    name === 'useCallback' ||
    name === 'useRef' ||
    name === 'useContext' ||
    name === 'useMemo' ||
    name === 'useReducer' ||
    name === 'useLayoutEffect' ||
    name === 'useImperativeHandle' ||
    name === 'useDebugValue' ||
    name === 'useDeferredValue' ||
    name === 'useTransition' ||
    name === 'useId' ||
    name === 'useSyncExternalStore' ||
    name === 'useInsertionEffect' ||
    (name.startsWith('use') && name[3] && name[3] === name[3].toUpperCase())
  );
};

/**
 * Check if a node is a browser API
 */
export const isBrowserAPI = (name: string): boolean => {
  const browserAPIs = [
    // Window/Document
    'window', 'document', 'navigator', 'location', 'history',
    
    // Storage
    'localStorage', 'sessionStorage', 'cookies',
    
    // DOM APIs
    'addEventListener', 'removeEventListener', 'querySelector', 'querySelectorAll',
    'getElementById', 'getElementsByClassName', 'getElementsByTagName',
    
    // Browser APIs
    'fetch', 'XMLHttpRequest', 'WebSocket', 'Worker', 'Blob', 'File',
    'FileReader', 'URL', 'URLSearchParams', 'performance', 'console',
    
    // Media APIs
    'Audio', 'Image', 'Video', 'MediaStream', 'MediaRecorder', 'HTMLCanvasElement',
    
    // Web APIs
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 
    'requestAnimationFrame', 'cancelAnimationFrame',
    
    // Events
    'MouseEvent', 'KeyboardEvent', 'TouchEvent', 'CustomEvent'
  ];
  
  return browserAPIs.includes(name);
};

/**
 * Check if AST node is a client-side only expression
 */
export const isClientSideExpression = (node: t.Node): boolean => {
  if (t.isMemberExpression(node)) {
    // Check if it's accessing a browser API
    if (t.isIdentifier(node.object) && isBrowserAPI(node.object.name)) {
      return true;
    }
    
    // Check nested expressions
    return isClientSideExpression(node.object);
  }
  
  if (t.isCallExpression(node)) {
    // Check if it's calling a browser API or hook
    if (t.isIdentifier(node.callee) && 
        (isBrowserAPI(node.callee.name) || isReactHook(node.callee.name))) {
      return true;
    }
    
    // Check nested expressions
    if (t.isMemberExpression(node.callee)) {
      return isClientSideExpression(node.callee);
    }
  }
  
  return false;
};

/**
 * Identifies whether a component could be a Server Component
 */
export const couldBeServerComponent = (ast: t.File): boolean => {
  let hasClientSideCode = false;
  
  // Function to check if we found client-side code
  const checkClientSide = (path: any) => {
    if (hasClientSideCode) {
      path.stop(); // Stop traversal if we already found client-side code
    }
  };
  
  traverse(ast, {
    CallExpression(path) {
      // Check for React hooks
      if (t.isIdentifier(path.node.callee) && isReactHook(path.node.callee.name)) {
        hasClientSideCode = true;
        checkClientSide(path);
      }
    },
    
    MemberExpression(path) {
      // Check for browser API access
      if (t.isIdentifier(path.node.object) && isBrowserAPI(path.node.object.name)) {
        hasClientSideCode = true;
        checkClientSide(path);
      }
    },
    
    // Check for event handlers in JSX
    JSXAttribute(path) {
      if (t.isJSXIdentifier(path.node.name) && 
          path.node.name.name.startsWith('on') && 
          path.node.name.name.length > 2 && 
          path.node.name.name[2] === path.node.name.name[2].toUpperCase()) {
        hasClientSideCode = true;
        checkClientSide(path);
      }
    }
  });
  
  return !hasClientSideCode;
};

/**
 * Extract a list of imports from an AST
 */
export const extractImports = (ast: t.File): { source: string, specifiers: string[] }[] => {
  const imports: { source: string, specifiers: string[] }[] = [];
  
  traverse(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value;
      const specifiers: string[] = [];
      
      path.node.specifiers.forEach(specifier => {
        if (t.isImportDefaultSpecifier(specifier)) {
          specifiers.push(`default as ${specifier.local.name}`);
        } else if (t.isImportSpecifier(specifier)) {
          const importedName = t.isIdentifier(specifier.imported) 
            ? specifier.imported.name 
            : specifier.imported.value;
          specifiers.push(importedName);
        } else if (t.isImportNamespaceSpecifier(specifier)) {
          specifiers.push(`* as ${specifier.local.name}`);
        }
      });
      
      imports.push({ source, specifiers });
    }
  });
  
  return imports;
};

/**
 * Extract a list of exports from an AST
 */
export const extractExports = (ast: t.File): { name: string, isDefault: boolean }[] => {
  const exports: { name: string, isDefault: boolean }[] = [];
  
  traverse(ast, {
    ExportNamedDeclaration(path) {
      if (path.node.declaration) {
        if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
          exports.push({ name: path.node.declaration.id.name, isDefault: false });
        } else if (t.isVariableDeclaration(path.node.declaration)) {
          path.node.declaration.declarations.forEach(declaration => {
            if (t.isIdentifier(declaration.id)) {
              exports.push({ name: declaration.id.name, isDefault: false });
            }
          });
        }
      } else if (path.node.specifiers) {
        path.node.specifiers.forEach(specifier => {
          if (t.isExportSpecifier(specifier) && t.isIdentifier(specifier.exported)) {
            exports.push({ name: specifier.exported.name, isDefault: false });
          }
        });
      }
    },
    
    ExportDefaultDeclaration(path) {
      if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
        exports.push({ name: path.node.declaration.id.name, isDefault: true });
      } else if (t.isIdentifier(path.node.declaration)) {
        exports.push({ name: path.node.declaration.name, isDefault: true });
      } else {
        exports.push({ name: 'default', isDefault: true });
      }
    }
  });
  
  return exports;
};

/**
 * Analyzes component dependencies to build a dependency graph
 * This helps in understanding the component relationships
 */
export const buildDependencyGraph = (ast: t.File): {
  imports: { source: string, isRelative: boolean }[];
  exports: string[];
  internalDependencies: string[];
} => {
  const imports: { source: string, isRelative: boolean }[] = [];
  const exports: string[] = [];
  const internalDependencies: string[] = [];
  
  traverse(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value;
      const isRelative = source.startsWith('.') || source.startsWith('/');
      
      imports.push({ source, isRelative });
      
      // Track internal dependencies (imports from the same project)
      if (isRelative) {
        path.node.specifiers.forEach(specifier => {
          if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported)) {
            internalDependencies.push(specifier.imported.name);
          } else if (t.isImportDefaultSpecifier(specifier)) {
            internalDependencies.push(specifier.local.name);
          }
        });
      }
    },
    
    ExportNamedDeclaration(path) {
      if (path.node.declaration) {
        if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
          exports.push(path.node.declaration.id.name);
        } else if (t.isVariableDeclaration(path.node.declaration)) {
          path.node.declaration.declarations.forEach(declaration => {
            if (t.isIdentifier(declaration.id)) {
              exports.push(declaration.id.name);
            }
          });
        }
      } else if (path.node.specifiers) {
        path.node.specifiers.forEach(specifier => {
          if (t.isExportSpecifier(specifier) && t.isIdentifier(specifier.exported)) {
            exports.push(specifier.exported.name);
          }
        });
      }
    },
    
    ExportDefaultDeclaration(path) {
      if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
        exports.push(path.node.declaration.id.name);
      } else if (t.isIdentifier(path.node.declaration)) {
        exports.push(path.node.declaration.name);
      } else {
        exports.push('default');
      }
    }
  });
  
  return { imports, exports, internalDependencies };
};

/**
 * Detects React component patterns in code
 */
export const identifyComponentPatterns = (code: string): {
  patterns: string[];
  complexity: 'simple' | 'medium' | 'complex';
  suggestions: string[];
} => {
  const patterns: string[] = [];
  const suggestions: string[] = [];
  
  // Check for common React patterns
  if (code.includes('useState')) patterns.push('state-management');
  if (code.includes('useEffect')) patterns.push('side-effects');
  if (code.includes('useContext')) patterns.push('context-consumer');
  if (code.includes('createContext')) patterns.push('context-provider');
  if (code.includes('useReducer')) patterns.push('reducer-pattern');
  if (code.includes('useMemo') || code.includes('useCallback')) patterns.push('performance-optimization');
  if (code.includes('componentDidMount') || code.includes('componentDidUpdate')) patterns.push('class-lifecycle');
  if (code.includes('getDerivedStateFromProps')) patterns.push('derived-state');
  if (code.includes('render')) patterns.push('class-component');
  if (code.includes('extends React.Component') || code.includes('extends Component')) patterns.push('class-inheritance');
  if (code.includes('children')) patterns.push('composition');
  if (code.includes('props.')) patterns.push('props-usage');
  if (code.includes('mapStateToProps') || code.includes('connect(')) patterns.push('redux-connect');
  if (code.includes('useDispatch') || code.includes('useSelector')) patterns.push('redux-hooks');
  
  // Determine complexity
  let complexity: 'simple' | 'medium' | 'complex' = 'simple';
  if (patterns.length > 3 && patterns.length <= 6) complexity = 'medium';
  if (patterns.length > 6) complexity = 'complex';
  
  // Generate suggestions for Next.js migration
  if (patterns.includes('state-management') && !patterns.includes('context-consumer')) {
    suggestions.push('Consider using React Context or SWR for shared state in Next.js');
  }
  
  if (patterns.includes('side-effects') && code.includes('fetch')) {
    suggestions.push('Replace useEffect data fetching with getServerSideProps or getStaticProps');
  }
  
  if (patterns.includes('class-component')) {
    suggestions.push('Convert class components to functional components with hooks for better Next.js compatibility');
  }
  
  if (patterns.includes('redux-connect')) {
    suggestions.push('Consider using next-redux-wrapper for Redux integration with Next.js');
  }
  
  if (code.includes('react-router')) {
    suggestions.push('Replace React Router with Next.js file-based routing system');
  }
  
  return { patterns, complexity, suggestions };
};
