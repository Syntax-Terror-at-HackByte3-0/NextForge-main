
/**
 * Transforms React Router code to Next.js Router
 */
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { parseCode } from '../analysis/astUtils';
import { logConversion } from '../logger';
import { timer } from '../../helpers';

/**
 * Transforms React Router usage to Next.js router
 */
export const transformReactRouter = (code: string, filePath: string, isV6: boolean = false): string => {
  if (!code.includes('react-router') && !code.includes('useNavigate') && 
      !code.includes('useLocation') && !code.includes('useParams') && 
      !code.includes('useHistory') && !code.includes('<Link') &&
      !code.includes('<Route') && !code.includes('<Routes') &&
      !code.includes('<Switch') && !code.includes('<Router')) {
    return code;
  }
  
  const benchmark = timer();
  logConversion('info', `Transforming React Router in ${filePath}...`);
  
  try {
    const ast = parseCode(code);
    let modified = false;
    let usesNextRouter = false;
    let usesNextLink = false;
    
    // First pass: Transform imports
    traverse(ast, {
      ImportDeclaration(path) {
        if (path.node.source.value.includes('react-router')) {
          const newSpecifiers: Array<t.ImportSpecifier | t.ImportDefaultSpecifier> = [];
          let removedSpecifiers: string[] = [];
          
          // Check each import
          path.node.specifiers.forEach(specifier => {
            if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported)) {
              const name = specifier.imported.name;
              
              // Router hooks that need to be replaced
              if (['useNavigate', 'useLocation', 'useParams', 'useHistory'].includes(name)) {
                usesNextRouter = true;
                removedSpecifiers.push(name);
                modified = true;
              }
              // Link component that needs to be replaced
              else if (name === 'Link') {
                usesNextLink = true;
                removedSpecifiers.push(name);
                modified = true;
              }
              // Router components that need to be removed
              else if (['BrowserRouter', 'Routes', 'Route', 'Router', 'Switch'].includes(name)) {
                removedSpecifiers.push(name);
                modified = true;
              }
              // Keep other imports
              else {
                newSpecifiers.push(specifier);
              }
            } else if (t.isImportDefaultSpecifier(specifier)) {
              // Keep default imports that aren't routing components
              newSpecifiers.push(specifier);
            }
          });
          
          // Remove or update the import
          if (newSpecifiers.length === 0) {
            // Add comment about removed imports
            const comment = t.expressionStatement(
              t.stringLiteral(`React Router import removed: ${removedSpecifiers.join(', ')}`)
            );
            comment.leadingComments = [{
              type: 'CommentBlock',
              value: `
 * Removed React Router imports: ${removedSpecifiers.join(', ')}
 * Next.js uses its own routing system:
 * - useRouter from 'next/router' replaces useNavigate, useLocation, useParams, useHistory
 * - Link from 'next/link' replaces Link from react-router-dom
 `
            }];
            path.replaceWith(comment);
          } else {
            path.node.specifiers = newSpecifiers;
          }
        }
      }
    });
    
    // Second pass: Add Next.js imports if needed
    if (usesNextRouter || usesNextLink) {
      traverse(ast, {
        Program(path) {
          // Add Next.js router import if needed
          if (usesNextRouter) {
            const importNextRouter = t.importDeclaration(
              [t.importSpecifier(t.identifier('useRouter'), t.identifier('useRouter'))],
              t.stringLiteral('next/router')
            );
            path.node.body.unshift(importNextRouter);
          }
          
          // Add Next.js Link import if needed
          if (usesNextLink) {
            const importNextLink = t.importDeclaration(
              [t.importDefaultSpecifier(t.identifier('Link'))],
              t.stringLiteral('next/link')
            );
            path.node.body.unshift(importNextLink);
          }
          
          modified = true;
        }
      });
    }
    
    // Third pass: Transform hook usage
    traverse(ast, {
      // Transform React Router hooks
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
            
            // Add helper comment for this file
            const fnPath = path.getFunctionParent();
            if (fnPath) {
              fnPath.addComment('leading', `
 * Next.js useRouter() replaces React Router's ${hookName}
 * - router.push('/path') replaces navigate('/path')
 * - router.replace('/path') replaces navigate('/path', { replace: true })
 * - router.back() replaces navigate(-1)
 * - router.query contains route parameters
 `);
            }
          } else if (hookName === 'useLocation') {
            // Replace with useRouter()
            path.replaceWith(t.callExpression(t.identifier('useRouter'), []));
            modified = true;
            
            // Add helper comment for this file
            const fnPath = path.getFunctionParent();
            if (fnPath) {
              fnPath.addComment('leading', `
 * Next.js useRouter() replaces React Router's useLocation
 * - router.pathname instead of location.pathname
 * - router.query instead of URLSearchParams
 * - router.asPath for the full URL
 `);
            }
          }
        }
      },
      
      // Transform navigate('/path') to router.push('/path')
      MemberExpression(path) {
        if (t.isIdentifier(path.node.object) && 
            ['navigate', 'history'].includes(path.node.object.name) && 
            t.isIdentifier(path.node.property) && 
            ['push', 'replace'].includes(path.node.property.name)) {
          
          // Get the parent path to check if this is a call expression
          const parentPath = path.parentPath;
          if (parentPath && t.isCallExpression(parentPath.node)) {
            // Replace navigate.push or history.push with router.push
            path.node.object = t.identifier('router');
            modified = true;
          }
        }
      },
      
      // Transform <Link to="/path"> to <Link href="/path">
      JSXOpeningElement(path) {
        if (t.isJSXIdentifier(path.node.name) && path.node.name.name === 'Link') {
          // Transform the 'to' prop to 'href'
          path.node.attributes.forEach(attr => {
            if (t.isJSXAttribute(attr) && 
                t.isJSXIdentifier(attr.name) && 
                attr.name.name === 'to') {
              // Change attribute name from 'to' to 'href'
              attr.name = t.jsxIdentifier('href');
              modified = true;
            }
          });
          
          // Add a comment explaining differences
          const elementPath = path.parentPath;
          if (elementPath) {
            elementPath.addComment('leading', `
 * Next.js Link uses 'href' instead of 'to' and requires <a> as a child in older Next.js versions
 * For active link styling, use router.pathname === '/path' instead of NavLink
 `);
          }
        }
      },
      
      // Remove <BrowserRouter>, <Routes>, and <Switch> with their children
      JSXElement(path) {
        if (t.isJSXIdentifier(path.node.openingElement.name) && 
            ['BrowserRouter', 'Router', 'Routes', 'Switch'].includes(path.node.openingElement.name.name)) {
          
          // If it has only one child, replace with that child
          const jsxChildren = path.node.children.filter(child => 
            t.isJSXElement(child) || t.isJSXFragment(child)
          );
          
          if (jsxChildren.length === 1) {
            path.replaceWith(jsxChildren[0]);
          } 
          // If multiple children, wrap in a fragment
          else if (jsxChildren.length > 1) {
            path.replaceWith(
              t.jsxFragment(
                t.jsxOpeningFragment(),
                t.jsxClosingFragment(),
                jsxChildren
              )
            );
          }
          // Otherwise just remove
          else {
            path.remove();
          }
          
          modified = true;
        }
        
        // Transform Route components to suggest file-based routing
        if (t.isJSXIdentifier(path.node.openingElement.name) && 
            path.node.openingElement.name.name === 'Route') {
          
          let pathValue: string | null = null;
          let componentName: string | null = null;
          
          // Extract path and component
          path.node.openingElement.attributes.forEach(attr => {
            if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
              if (attr.name.name === 'path' && attr.value) {
                if (t.isStringLiteral(attr.value)) {
                  pathValue = attr.value.value;
                } else if (t.isJSXExpressionContainer(attr.value) && 
                          t.isStringLiteral(attr.value.expression)) {
                  pathValue = attr.value.expression.value;
                }
              }
              
              if ((attr.name.name === 'component' || attr.name.name === 'element') && 
                  attr.value && t.isJSXExpressionContainer(attr.value)) {
                if (t.isIdentifier(attr.value.expression)) {
                  componentName = attr.value.expression.name;
                } else if (t.isJSXElement(attr.value.expression) && 
                          t.isJSXIdentifier(attr.value.expression.openingElement.name)) {
                  componentName = attr.value.expression.openingElement.name.name;
                }
              }
            }
          });
          
          // Add comment about file-based routing
          if (pathValue && componentName) {
            path.addComment('leading', `
 * Next.js uses file-based routing instead of <Route> components
 * This route should be converted to a file at pages${pathValue === '/' ? '/index' : pathValue}.js
 * Component: ${componentName}
 `);
          }
          
          // If the Route has a single child element, replace with that
          const jsxChildren = path.node.children.filter(child => 
            t.isJSXElement(child) && 
            !['Route', 'Routes', 'Switch'].includes((child.openingElement.name as any).name)
          );
          
          if (jsxChildren.length === 1) {
            path.replaceWith(jsxChildren[0]);
            modified = true;
          }
        }
      }
    });
    
    // Generate code if modified
    if (modified) {
      const output = generate(ast);
      logConversion('success', `Transformed React Router in ${filePath} in ${benchmark.total()}ms`);
      return output.code;
    }
    
    logConversion('info', `No React Router transformations needed in ${filePath}`);
    return code;
  } catch (error) {
    logConversion('error', `Error transforming React Router in ${filePath}: ${(error as Error).message}`);
    return code;
  }
};
