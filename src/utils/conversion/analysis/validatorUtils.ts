/**
 * Code validation utilities
 */
import { parse } from '@babel/parser';
import type { ParserOptions, ParserPlugin } from '@babel/parser';
import { validateSyntax, ValidationResult } from './enhancedSyntaxValidator';
import { analyzeServerComponentCompatibility } from './enhancedServerComponentAnalyzer';

/**
 * Creates parser options with sensible defaults
 */
export const createParserOptions = (options?: {
  allowImportExport?: boolean;
  errorRecovery?: boolean;
}): ParserOptions => {
  return {
    sourceType: 'module',
    plugins: [
      'jsx', 
      'typescript', 
      'classProperties', 
      'decorators-legacy',
      'objectRestSpread',
      'dynamicImport'
    ] as ParserPlugin[],
    allowImportExportEverywhere: options?.allowImportExport || false,
    errorRecovery: options?.errorRecovery || false
  };
};

/**
 * Validates JavaScript/TypeScript code syntax
 * Now uses the enhanced syntax validator
 */
export const validateCodeSyntax = (code: string, filePath: string = 'unknown.ts'): {
  valid: boolean;
  errors: string[];
} => {
  // Use the enhanced validator
  const validationResult = validateSyntax(filePath, code);
  
  // Convert the enhanced validation result to the expected return type
  return {
    valid: validationResult.valid,
    errors: [
      ...validationResult.errors.map(error => error.message),
      ...validationResult.warnings.map(warning => `Warning: ${warning.message}`)
    ]
  };
};

/**
 * Validates CSS syntax
 */
export const validateCssSyntax = (code: string): {
  valid: boolean;
  errors: string[];
} => {
  // Basic CSS validation - in a real implementation, use a CSS parser
  const errors: string[] = [];
  
  // Check for unclosed brackets
  const openBraces = (code.match(/{/g) || []).length;
  const closeBraces = (code.match(/}/g) || []).length;
  
  if (openBraces !== closeBraces) {
    errors.push(`Mismatched braces: ${openBraces} opening vs ${closeBraces} closing`);
  }
  
  // Check for unclosed comments
  if (code.includes('/*') && !code.includes('*/')) {
    errors.push('Unclosed comment block');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validates HTML syntax
 */
export const validateHtmlSyntax = (code: string): {
  valid: boolean;
  errors: string[];
} => {
  // Basic HTML validation - in a real implementation, use an HTML parser
  const errors: string[] = [];
  
  // Check for unclosed tags
  const tagPattern = /<([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
  const closingTagPattern = /<\/([a-zA-Z][a-zA-Z0-9]*)>/g;
  
  const openTags: string[] = [];
  let match;
  
  // Collect opening tags
  while ((match = tagPattern.exec(code)) !== null) {
    const tagName = match[1];
    // Skip self-closing tags
    if (!code.substring(match.index, match.index + match[0].length).includes('/>')) {
      openTags.push(tagName);
    }
  }
  
  // Check closing tags
  while ((match = closingTagPattern.exec(code)) !== null) {
    const tagName = match[1];
    
    if (openTags.length === 0) {
      errors.push(`Closing tag </${tagName}> without matching opening tag`);
    } else if (openTags[openTags.length - 1] !== tagName) {
      errors.push(`Expected closing tag </${openTags[openTags.length - 1]}>, got </${tagName}>`);
    } else {
      openTags.pop();
    }
  }
  
  // Check for remaining open tags
  if (openTags.length > 0) {
    errors.push(`Unclosed tags: ${openTags.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validates JSON syntax
 */
export const validateJsonSyntax = (code: string): {
  valid: boolean;
  errors: string[];
} => {
  try {
    JSON.parse(code);
    return { valid: true, errors: [] };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid JSON';
    return { 
      valid: false, 
      errors: [errorMessage]
    };
  }
};

/**
 * Validates Next.js compatibility for a file
 * Enhanced to provide more detailed compatibility checks
 */
export const validateNextJsCompatibility = (code: string, filePath: string = 'unknown.ts'): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Use the enhanced syntax validator to check for Next.js compatibility issues
  const validationResult = validateSyntax(filePath, code);
  
  // Add warnings from enhanced validator
  warnings.push(...validationResult.warnings.map(warning => warning.message));
  
  // Add errors from enhanced validator
  errors.push(...validationResult.errors.map(error => error.message));
  
  // Additional compatibility checks specific to Next.js
  
  // Check for React Router patterns
  if (code.includes('react-router') || 
      code.includes('<BrowserRouter') || 
      code.includes('<Router') ||
      code.includes('<Routes') ||
      code.includes('<Route') ||
      code.includes('useNavigate') ||
      code.includes('useHistory')) {
    warnings.push('React Router detected - manual conversion to Next.js routing required');
  }
  
  // Check for direct DOM manipulation (if not caught by enhanced validator)
  if (code.includes('document.getElementById') || 
      code.includes('document.querySelector')) {
    warnings.push('Direct DOM manipulation detected - may cause issues in Next.js');
  }
  
  // Check for window usage without checks
  if (code.includes('window.') && !code.includes('typeof window !== "undefined"')) {
    warnings.push('Window object used without checking if it exists - add client-side check');
  }
  
  // Check for React.lazy which doesn't work with SSR (if not caught by enhanced validator)
  if (code.includes('React.lazy') || code.includes('lazy(')) {
    warnings.push('React.lazy detected - use Next.js dynamic imports instead');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Validates Server Component compatibility for Next.js App Router
 * This is a new addition to enhance the validation system
 */
export const validateServerComponentCompatibility = (code: string, filePath: string = 'unknown.tsx'): {
  canBeServerComponent: boolean;
  clientFeatures: string[];
  serverFeatures: string[];
  requiresClientDirective: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
} => {
  // Analyze server component compatibility
  const analysis = analyzeServerComponentCompatibility(code, filePath);
  
  // Extract information from analysis result
  const clientFeatures = analysis.clientFeatures.map(f => `${f.name} (${f.type})`);
  const serverFeatures = analysis.serverFeatures.map(f => `${f.name} (${f.type})`);
  
  // Determine if it can be a server component
  const canBeServerComponent = analysis.compatibility === 'server-only' || analysis.compatibility === 'either';
  
  // Generate errors, warnings, and recommendations
  const errors: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  // Convert analysis issues to validation messages
  analysis.clientFeatures.forEach(feature => {
    if (feature.severity === 'error') {
      errors.push(`${feature.description} at line ${feature.line}`);
    } else if (feature.severity === 'warning') {
      warnings.push(`${feature.description} at line ${feature.line}`);
    }
    
    if (feature.suggestedFix) {
      recommendations.push(feature.suggestedFix);
    }
  });
  
  // Add compatibility issues
  analysis.compatibility_issues.forEach(issue => {
    warnings.push(`${issue.issue} at ${issue.location || 'unknown location'}`);
    if (issue.suggestion) {
      recommendations.push(issue.suggestion);
    }
  });
  
  // Library compatibility
  analysis.libraries
    .filter(lib => !lib.serverCompatible)
    .forEach(lib => {
      warnings.push(`Library "${lib.name}" is not compatible with Server Components${lib.reason ? `: ${lib.reason}` : ''}`);
    });
  
  // Add directive recommendation if needed
  if (analysis.suggestedDirective === 'use client') {
    recommendations.push('Add "use client" directive at the top of the file');
  }
  
  return {
    canBeServerComponent,
    clientFeatures,
    serverFeatures,
    requiresClientDirective: analysis.requirements.clientDirective,
    errors,
    warnings,
    recommendations
  };
};
