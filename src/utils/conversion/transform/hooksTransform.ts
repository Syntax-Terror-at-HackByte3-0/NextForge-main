
/**
 * Utilities for transforming React hooks to Next.js compatible hooks
 */
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import { AnalysisResult } from '../analysis/analysisTypes';
import { parseCode } from '../analysis/astUtils';

/**
 * Transform React Router hooks to Next.js compatible hooks
 */
export const transformReactRouterHooks = (code: string): string => {
  if (!code.includes('useParams') && 
      !code.includes('useNavigate') && 
      !code.includes('useLocation') && 
      !code.includes('useHistory')) {
    return code;
  }
  
  try {
    const ast = parseCode(code);
    let modified = false;
    
    // Track import replacements needed
    const hookImportReplacements: Record<string, string> = {
      useParams: 'useRouter',
      useNavigate: 'useRouter',
      useHistory: 'useRouter',
      useLocation: 'useRouter'
    };
    
    let needsNextRouterImport = false;
    
    // First pass: Modify imports
    traverse(ast, {
      ImportDeclaration(path) {
        if (path.node.source.value === 'react-router-dom' || path.node.source.value === 'react-router') {
          const newSpecifiers: t.ImportSpecifier[] = [];
          let hasRouterHooks = false;
          
          // Check each import specifier
          path.node.specifiers.forEach(specifier => {
            if (t.isImportSpecifier(specifier) && 
                t.isIdentifier(specifier.imported) && 
                Object.keys(hookImportReplacements).includes(specifier.imported.name)) {
              hasRouterHooks = true;
              needsNextRouterImport = true;
            } else {
              newSpecifiers.push(specifier as t.ImportSpecifier);
            }
          });
          
          // Modify the import declaration
          if (hasRouterHooks) {
            modified = true;
            if (newSpecifiers.length > 0) {
              path.node.specifiers = newSpecifiers;
            } else {
              path.remove();
            }
          }
        }
      }
    });
    
    // Second pass: Add Next.js router import if needed
    if (needsNextRouterImport) {
      traverse(ast, {
        Program(path) {
          const importNextRouter = t.importDeclaration(
            [t.importSpecifier(t.identifier('useRouter'), t.identifier('useRouter'))],
            t.stringLiteral('next/router')
          );
          
          // Add at the beginning of the file
          path.node.body.unshift(importNextRouter);
          modified = true;
        }
      });
    }
    
    // Third pass: Transform hook usage
    traverse(ast, {
      CallExpression(path) {
        if (t.isIdentifier(path.node.callee)) {
          const hookName = path.node.callee.name;
          
          if (hookName === 'useParams') {
            // Transform useParams() to useRouter().query
            const routerCall = t.callExpression(t.identifier('useRouter'), []);
            const routerQuery = t.memberExpression(routerCall, t.identifier('query'));
            path.replaceWith(routerQuery);
            modified = true;
          } else if (hookName === 'useNavigate' || hookName === 'useHistory') {
            // Replace with useRouter()
            path.replaceWith(t.callExpression(t.identifier('useRouter'), []));
            modified = true;
          } else if (hookName === 'useLocation') {
            // Replace with useRouter()
            path.replaceWith(t.callExpression(t.identifier('useRouter'), []));
            modified = true;
          }
        }
      },
      
      // Transform navigate('/path') to router.push('/path')
      MemberExpression(path) {
        if (t.isIdentifier(path.node.property) && 
            (path.node.property.name === 'push' || path.node.property.name === 'replace') &&
            t.isIdentifier(path.node.object) && 
            (path.node.object.name === 'navigate' || path.node.object.name === 'history')) {
          
          // Get the parent path to check if this is a call expression
          const parentPath = path.parentPath;
          if (parentPath && parentPath.isCallExpression()) {
            // Replace navigate.push or history.push with router.push
            path.node.object = t.identifier('router');
            modified = true;
          }
        }
      }
    });
    
    if (modified) {
      const output = generate(ast);
      return output.code;
    }
    
    return code;
  } catch (error) {
    console.error('Error transforming React Router hooks:', error);
    return code;
  }
};

/**
 * Transform React hooks to Next.js compatible hooks
 */
export const transformReactHooks = (code: string, analysis: AnalysisResult): string => {
  let transformedCode = code;
  
  // Transform React Router hooks
  if (analysis.hasRouting) {
    transformedCode = transformReactRouterHooks(transformedCode);
  }
  
  return transformedCode;
};
