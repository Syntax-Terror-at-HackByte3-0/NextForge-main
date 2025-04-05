
/**
 * This file handles the conversion of React imports to Next.js equivalents
 */
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';

/**
 * Converts React Router imports to Next.js equivalents
 */
export const convertImports = (code: string): string => {
  // Parse the AST
  let ast;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'classProperties', 'decorators-legacy']
    });
  } catch (error) {
    console.error('Error parsing code for import conversion:', error);
    return code; // Return original code if parsing fails
  }
  
  // Track if we need to add next/head
  let needsHeadImport = false;
  
  // Track if we need to add next/router
  let needsRouterImport = false;
  
  // Track if we need to add next/image
  let needsImageImport = false;
  
  // Track if we need to add next/link
  let needsLinkImport = false;
  
  // Track if we've added any imports
  let importsAdded = false;
  
  // Transform the AST
  traverse(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value;
      
      // Handle react-router-dom imports
      if (source === 'react-router-dom' || source.includes('react-router')) {
        const specifiers = path.node.specifiers;
        
        // Check if we need to remove this import entirely
        let shouldRemove = false;
        
        // Check if we're importing routing components
        const routerComponentsImport = specifiers.some(spec => 
          t.isImportSpecifier(spec) && 
          t.isIdentifier(spec.imported) && 
          ['BrowserRouter', 'Routes', 'Route', 'Switch', 'Router'].includes(spec.imported.name)
        );
        
        if (routerComponentsImport) {
          shouldRemove = true;
        }
        
        // Check for navigation hooks that should be replaced with Next.js router
        const needsNextRouter = specifiers.some(spec => 
          t.isImportSpecifier(spec) && 
          t.isIdentifier(spec.imported) && 
          ['useNavigate', 'useLocation', 'useParams', 'useHistory', 'useRouteMatch'].includes(spec.imported.name)
        );
        
        if (needsNextRouter) {
          needsRouterImport = true;
          shouldRemove = true;
        }
        
        // Check if we're importing Link
        const hasLinkImport = specifiers.some(spec => 
          t.isImportSpecifier(spec) && 
          t.isIdentifier(spec.imported) && 
          spec.imported.name === 'Link'
        );
        
        if (hasLinkImport) {
          // Replace with next/link
          needsLinkImport = true;
          shouldRemove = true;
        }
        
        // Check for useOutletContext (needed for layout patterns)
        const hasOutletContext = specifiers.some(spec => 
          t.isImportSpecifier(spec) && 
          t.isIdentifier(spec.imported) && 
          spec.imported.name === 'useOutletContext'
        );
        
        if (hasOutletContext && shouldRemove) {
          // Add a comment about useOutletContext replacement
          const comment = t.expressionStatement(
            t.stringLiteral(
              `
// Next.js doesn't have a direct equivalent to useOutletContext.
// Consider using React Context API or passing props through _app.js instead.
// See: https://nextjs.org/docs/pages/building-your-application/routing/pages-and-layouts
`
            )
          );
          comment.leadingComments = [{
            type: 'CommentBlock',
            value: `
 * Next.js doesn't have a direct equivalent to useOutletContext.
 * Consider using React Context API or passing props through _app.js instead.
 * See: https://nextjs.org/docs/pages/building-your-application/routing/pages-and-layouts
 `
          }];
          path.replaceWith(comment);
        } else if (shouldRemove) {
          // Remove the import
          path.remove();
        }
      }
      
      // Handle image imports for optimization
      if (source.includes('react-bootstrap') || source.includes('@mui/material') || source.includes('reactstrap')) {
        const specifiers = path.node.specifiers;
        
        // Check if Image component is imported
        const hasImageImport = specifiers.some(spec => 
          (t.isImportSpecifier(spec) || t.isImportDefaultSpecifier(spec)) && 
          t.isIdentifier(spec.local) && 
          spec.local.name === 'Image'
        );
        
        if (hasImageImport) {
          needsImageImport = true;
          // Add comment about potential conflict
          path.node.leadingComments = path.node.leadingComments || [];
          path.node.leadingComments.push({
            type: 'CommentBlock',
            value: `
 * Note: This component imports an Image component which might conflict with Next.js Image.
 * Consider renaming the imported component or using Next.js Image with proper configuration.
 * import Image from 'next/image';
 `
          });
        }
      }
    },
    
    JSXElement(path) {
      // Check for <title> tags to determine if we need Head
      if (
        t.isJSXIdentifier(path.node.openingElement.name) && 
        path.node.openingElement.name.name === 'title'
      ) {
        needsHeadImport = true;
      }
      
      // Convert <img> to Next.js Image
      if (
        t.isJSXIdentifier(path.node.openingElement.name) && 
        path.node.openingElement.name.name === 'img' &&
        !code.includes('next/image')
      ) {
        // Add comment for manual optimization
        needsImageImport = true;
        path.addComment('leading', `
 * Consider replacing <img> with Next.js <Image> for automatic optimization:
 * import Image from 'next/image';
 * <Image src={src} alt={alt} width={width} height={height} />
 `);
      }
      
      // Convert react-router Link to Next.js Link
      if (
        t.isJSXIdentifier(path.node.openingElement.name) && 
        path.node.openingElement.name.name === 'Link'
      ) {
        needsLinkImport = true;
        
        // Find the 'to' prop and convert it to 'href'
        path.node.openingElement.attributes.forEach(attr => {
          if (
            t.isJSXAttribute(attr) && 
            t.isJSXIdentifier(attr.name) && 
            attr.name.name === 'to'
          ) {
            // Replace 'to' with 'href'
            attr.name = t.jsxIdentifier('href');
          } else if (
            t.isJSXAttribute(attr) && 
            t.isJSXIdentifier(attr.name) && 
            (attr.name.name === 'activeClassName' || attr.name.name === 'activeStyle')
          ) {
            // Add comment about active links
            path.addComment('leading', `
 * Note: Next.js Link doesn't support activeClassName/activeStyle.
 * Consider using useRouter() to determine active state and apply classes manually.
 * const router = useRouter();
 * const isActive = router.pathname === href;
 * className={isActive ? 'active-class' : ''}
 `);
          }
        });
      }
    },
    
    CallExpression(path) {
      // Convert useNavigate, useLocation, useHistory, useParams
      if (
        t.isIdentifier(path.node.callee) && 
        ['useNavigate', 'useLocation', 'useHistory', 'useParams'].includes(path.node.callee.name)
      ) {
        needsRouterImport = true;
        
        path.replaceWith(
          t.callExpression(
            t.identifier('useRouter'),
            []
          )
        );
        
        // Add helpful comment about converting from react-router to next/router
        path.addComment('leading', `
 * Using Next.js useRouter instead of React Router hooks
 * - useNavigate/useHistory -> router.push, router.replace
 * - useLocation -> router.pathname, router.query, router.asPath
 * - useParams -> router.query
 * See: https://nextjs.org/docs/pages/api-reference/functions/use-router
 `);
      }
      
      // Look for window.location and suggest router usage instead
      if (
        t.isMemberExpression(path.node.callee) &&
        t.isIdentifier(path.node.callee.object) &&
        path.node.callee.object.name === 'window' &&
        t.isIdentifier(path.node.callee.property) &&
        path.node.callee.property.name === 'location'
      ) {
        needsRouterImport = true;
        // Add comment suggesting useRouter
        path.addComment('leading', `
 * Consider using Next.js router instead of window.location for client-side navigation:
 * const router = useRouter();
 * router.push('/path');
 `);
      }
    },
    
    // Convert navigate('/path') to router.push('/path')
    MemberExpression(path) {
      if (
        t.isIdentifier(path.node.object) &&
        path.node.object.name === 'navigate' &&
        path.parent &&
        t.isCallExpression(path.parent) &&
        t.isCallExpression(path.parentPath.parent)
      ) {
        // Find the parent call and replace it
        needsRouterImport = true;
        const callPath = path.parentPath.parentPath;
        if (callPath && t.isCallExpression(callPath.node)) {
          callPath.replaceWith(
            t.callExpression(
              t.memberExpression(
                t.identifier('router'),
                t.identifier('push')
              ),
              callPath.node.arguments
            )
          );
          
          // Add comment about router declaration
          callPath.addComment('leading', `
 * Make sure to add "const router = useRouter();" at the top of your component.
 * import { useRouter } from 'next/router';
 `);
        }
      }
      
      // Convert history.push or history.replace
      if (
        t.isIdentifier(path.node.object) &&
        path.node.object.name === 'history' &&
        t.isIdentifier(path.node.property) &&
        (path.node.property.name === 'push' || path.node.property.name === 'replace') &&
        path.parent &&
        t.isCallExpression(path.parent)
      ) {
        needsRouterImport = true;
        // Replace with router.push or router.replace
        path.replaceWith(
          t.memberExpression(
            t.identifier('router'),
            t.identifier(path.node.property.name)
          )
        );
        
        // Add comment about router declaration
        path.parentPath.addComment('leading', `
 * Make sure to add "const router = useRouter();" at the top of your component.
 * import { useRouter } from 'next/router';
 `);
      }
    }
  });
  
  // Add necessary imports at the top of the file
  if (needsHeadImport && !code.includes('import Head from')) {
    const headImport = t.importDeclaration(
      [t.importDefaultSpecifier(t.identifier('Head'))],
      t.stringLiteral('next/head')
    );
    ast.program.body.unshift(headImport);
    importsAdded = true;
  }
  
  if (needsRouterImport && !code.includes('import { useRouter }')) {
    const routerImport = t.importDeclaration(
      [
        t.importSpecifier(
          t.identifier('useRouter'),
          t.identifier('useRouter')
        )
      ],
      t.stringLiteral('next/router')
    );
    ast.program.body.unshift(routerImport);
    importsAdded = true;
  }
  
  if (needsImageImport && !code.includes('import Image from')) {
    const imageImport = t.importDeclaration(
      [t.importDefaultSpecifier(t.identifier('Image'))],
      t.stringLiteral('next/image')
    );
    ast.program.body.unshift(imageImport);
    importsAdded = true;
    
    // Add comment about Image sizing requirements
    imageImport.leadingComments = [{
      type: 'CommentBlock',
      value: `
 * Next.js Image requires width and height props or layout="fill"
 * See: https://nextjs.org/docs/pages/api-reference/components/image
 `
    }];
  }
  
  if (needsLinkImport && !code.includes('import Link from')) {
    const linkImport = t.importDeclaration(
      [t.importDefaultSpecifier(t.identifier('Link'))],
      t.stringLiteral('next/link')
    );
    ast.program.body.unshift(linkImport);
    importsAdded = true;
  }
  
  // Add a helpful comment if any imports were added
  if (importsAdded) {
    const helpComment = t.expressionStatement(t.stringLiteral(''));
    helpComment.leadingComments = [{
      type: 'CommentBlock',
      value: `
 * NEXT.JS IMPORT CHANGES:
 * - 'next/link' - Used for client-side navigation instead of react-router Link
 * - 'next/router' - Replaces React Router hooks with Next.js router
 * - 'next/head' - Used for adding meta tags, title, etc.
 * - 'next/image' - Optimized image component for Next.js
 *
 * Check the Next.js documentation for more details on these components.
 `
    }];
    
    // Insert comment after all imports
    let lastImportIndex = -1;
    for (let i = 0; i < ast.program.body.length; i++) {
      if (t.isImportDeclaration(ast.program.body[i])) {
        lastImportIndex = i;
      }
    }
    
    if (lastImportIndex >= 0) {
      ast.program.body.splice(lastImportIndex + 1, 0, helpComment);
    }
  }
  
  // Generate code from the modified AST
  try {
    const output = generate(ast);
    return output.code;
  } catch (error) {
    console.error('Error generating code from AST:', error);
    return code; // Return original code if generation fails
  }
};
