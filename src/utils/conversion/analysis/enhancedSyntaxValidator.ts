
/**
 * Enhanced syntax validator for JavaScript/TypeScript code
 * Supports multiple parsers, caching, and detailed error reporting
 */
import { parse } from '@babel/parser';
import type { ParserOptions, ParserPlugin } from '@babel/parser';
import * as types from '@babel/types';
import traverse from '@babel/traverse';

// Define validation result type
export interface ValidationResult {
  valid: boolean;
  errors: Array<{ message: string; line?: number; column?: number; }>;
  warnings: Array<{ message: string; line?: number; column?: number; }>;
  info: Array<{ message: string; line?: number; column?: number; }>;
}

// Cache for validation results
const validationCache = new Map<string, { hash: string; result: ValidationResult }>();

/**
 * Generate a simple hash of the content for caching
 */
const generateContentHash = (content: string): string => {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
};

/**
 * Create parser options based on file type and content
 */
const createParserOptions = (filePath: string, content: string): ParserOptions => {
  const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
  const isJSX = filePath.endsWith('.jsx') || filePath.endsWith('.tsx');
  const isModule = content.includes('import ') || content.includes('export ');
  
  // Determine appropriate plugins
  const plugins: ParserPlugin[] = [];
  
  // Always include these plugins
  plugins.push('classProperties');
  plugins.push('objectRestSpread');
  plugins.push('dynamicImport');
  
  // Add JSX plugin if needed
  if (isJSX || content.includes('JSX') || content.includes('<') && content.includes('/>')) {
    plugins.push('jsx');
  }
  
  // Add TypeScript plugin if needed
  if (isTypeScript) {
    plugins.push('typescript');
    // TypeScript with JSX needs this
    if (isJSX) {
      plugins.push('jsx');
    }
  }
  
  // Check for decorators
  if (content.includes('@')) {
    plugins.push('decorators-legacy');
  }
  
  // Check for class properties
  if (content.includes('class') && content.includes('=')) {
    plugins.push('classProperties');
  }
  
  // Add additional plugins based on specific syntax detection
  if (content.includes('?>') || content.includes('<?')) {
    plugins.push('optionalChaining');
  }
  
  if (content.includes('??')) {
    plugins.push('nullishCoalescingOperator');
  }
  
  return {
    sourceType: isModule ? 'module' : 'script',
    plugins: plugins as ParserPlugin[],
    allowImportExportEverywhere: true,
    errorRecovery: true // Continue parsing even when there are errors
  };
};

/**
 * Detect client-side hooks usage
 */
const detectClientSideFeatures = (ast: types.File): string[] => {
  const clientSideFeatures: string[] = [];
  
  traverse(ast, {
    // Detect React hooks
    CallExpression(path) {
      const callee = path.node.callee;
      if (types.isIdentifier(callee)) {
        // Check for React hooks
        if (callee.name.startsWith('use') && callee.name !== 'useMemo' && callee.name !== 'useCallback') {
          clientSideFeatures.push(`Hook: ${callee.name}`);
        }
        
        // Check for browser APIs
        if (['fetch', 'localStorage', 'sessionStorage', 'setTimeout', 'setInterval'].includes(callee.name)) {
          clientSideFeatures.push(`Browser API: ${callee.name}`);
        }
      }
      
      // Check for document/window usage
      if (types.isMemberExpression(callee) && 
          types.isIdentifier(callee.object) && 
          ['document', 'window', 'navigator'].includes(callee.object.name)) {
        clientSideFeatures.push(`Browser Object: ${callee.object.name}`);
      }
    },
    
    // Detect browser globals
    MemberExpression(path) {
      const object = path.node.object;
      if (types.isIdentifier(object) && 
          ['document', 'window', 'navigator', 'localStorage', 'sessionStorage'].includes(object.name)) {
        clientSideFeatures.push(`Browser Object: ${object.name}`);
      }
    }
  });
  
  return Array.from(new Set(clientSideFeatures)); // Remove duplicates
};

/**
 * Check Next.js compatibility issues
 */
const checkNextJsCompatibility = (ast: types.File, filePath: string): string[] => {
  const compatibilityIssues: string[] = [];
  
  // Checks for React Router usage
  const reactRouterComponents = ['BrowserRouter', 'Router', 'Routes', 'Route', 'useNavigate', 'useHistory'];
  
  traverse(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value;
      
      // Check for React Router imports
      if (source.includes('react-router')) {
        compatibilityIssues.push('React Router detected (replace with Next.js routing)');
      }
      
      // Check for non-Next.js image imports
      if ((source === 'react-image' || source.includes('image')) && 
          !source.includes('next/image')) {
        compatibilityIssues.push('Non-Next.js image library detected (use next/image instead)');
      }
    },
    
    JSXElement(path) {
      const openingElement = path.node.openingElement;
      if (types.isJSXIdentifier(openingElement.name) && 
          reactRouterComponents.includes(openingElement.name.name)) {
        compatibilityIssues.push(`React Router component detected: ${openingElement.name.name}`);
      }
    },
    
    // Detect lazy loading that's not compatible with Next.js
    CallExpression(path) {
      const callee = path.node.callee;
      if (types.isIdentifier(callee) && callee.name === 'lazy') {
        compatibilityIssues.push('React.lazy detected (use next/dynamic instead)');
      }
      
      // Check for direct document manipulation
      if (types.isMemberExpression(callee) && 
          types.isIdentifier(callee.object) && 
          callee.object.name === 'document' &&
          types.isIdentifier(callee.property) &&
          ['getElementById', 'querySelector', 'querySelectorAll'].includes(callee.property.name)) {
        compatibilityIssues.push('Direct DOM manipulation may cause issues in Next.js');
      }
    }
  });
  
  return compatibilityIssues;
};

/**
 * Validate syntax for a file
 */
export const validateSyntax = (filePath: string, content: string): ValidationResult => {
  // Skip non-JavaScript/TypeScript files
  if (!/\.(js|jsx|ts|tsx)$/.test(filePath)) {
    return { valid: true, errors: [], warnings: [], info: [] };
  }
  
  // Generate content hash for caching
  const contentHash = generateContentHash(content);
  
  // Check cache first
  const cachedResult = validationCache.get(filePath);
  if (cachedResult && cachedResult.hash === contentHash) {
    return cachedResult.result;
  }
  
  // Initialize result
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    info: []
  };
  
  try {
    // Create parser options based on file type and content
    const parserOptions = createParserOptions(filePath, content);
    
    // Try parsing with the determined options
    const ast = parse(content, parserOptions);
    
    // Check for client-side features
    const clientSideFeatures = detectClientSideFeatures(ast);
    if (clientSideFeatures.length > 0) {
      // If this is an App Router file and has client-side features, we need a 'use client' directive
      if (filePath.includes('/app/') && !content.includes('use client')) {
        result.warnings.push({
          message: `File may need 'use client' directive due to: ${clientSideFeatures.join(', ')}`
        });
      } else {
        result.info.push({
          message: `Contains client-side features: ${clientSideFeatures.join(', ')}`
        });
      }
    }
    
    // Check for Next.js compatibility issues
    const compatibilityIssues = checkNextJsCompatibility(ast, filePath);
    if (compatibilityIssues.length > 0) {
      result.warnings.push(...compatibilityIssues.map(issue => ({
        message: `Next.js compatibility: ${issue}`
      })));
    }
    
  } catch (error) {
    result.valid = false;
    
    // If Babel parsing failed, try with error recovery first
    try {
      // Try again with error recovery
      const recoveryOptions = {
        ...createParserOptions(filePath, content),
        errorRecovery: true
      };
      
      parse(content, recoveryOptions);
      
      // If we get here, there were recoverable errors
      result.errors.push({
        message: `Syntax error (recoverable): ${(error as Error).message}`
      });
    } catch (e) {
      // If even recovery fails, report as a critical error
      result.errors.push({
        message: `Critical syntax error: ${(error as Error).message}`
      });
    }
  }
  
  // Cache the result
  validationCache.set(filePath, { hash: contentHash, result });
  
  return result;
};

/**
 * Batch validate multiple files
 */
export const batchValidate = (files: Record<string, string>): Record<string, ValidationResult> => {
  const results: Record<string, ValidationResult> = {};
  
  for (const [filePath, content] of Object.entries(files)) {
    results[filePath] = validateSyntax(filePath, content);
  }
  
  return results;
};

/**
 * Generate a human-readable validation report
 */
export const generateValidationReport = (validationResults: Record<string, ValidationResult>): string => {
  let report = '# Syntax Validation Report\n\n';
  
  const errorCount = Object.values(validationResults)
    .reduce((count, result) => count + result.errors.length, 0);
  
  const warningCount = Object.values(validationResults)
    .reduce((count, result) => count + result.warnings.length, 0);
  
  report += `Found ${errorCount} errors and ${warningCount} warnings.\n\n`;
  
  // Report files with errors first
  const filesWithErrors = Object.entries(validationResults)
    .filter(([_, result]) => result.errors.length > 0);
  
  if (filesWithErrors.length > 0) {
    report += '## Files with Errors\n\n';
    
    for (const [filePath, result] of filesWithErrors) {
      report += `### ${filePath}\n\n`;
      result.errors.forEach(error => {
        report += `- 🚫 ${error.message}${error.line ? ` (line ${error.line})` : ''}\n`;
      });
      report += '\n';
    }
  }
  
  // Report files with warnings
  const filesWithWarnings = Object.entries(validationResults)
    .filter(([_, result]) => result.warnings.length > 0 && result.errors.length === 0);
  
  if (filesWithWarnings.length > 0) {
    report += '## Files with Warnings\n\n';
    
    for (const [filePath, result] of filesWithWarnings) {
      report += `### ${filePath}\n\n`;
      result.warnings.forEach(warning => {
        report += `- ⚠️ ${warning.message}${warning.line ? ` (line ${warning.line})` : ''}\n`;
      });
      report += '\n';
    }
  }
  
  return report;
};
