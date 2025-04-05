
/**
 * Transform imports to be compatible with Next.js
 */
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { ParserPlugin } from '@babel/parser';

/**
 * Creates parser options for Babel
 */
const createParserOptions = (isTypeScript: boolean) => ({
  sourceType: 'module' as const, // Use 'as const' to narrow the type to "module"
  plugins: [
    isTypeScript ? 'typescript' : 'flow',
    'jsx',
    'classProperties',
    'objectRestSpread',
  ] as ParserPlugin[], // Cast to ParserPlugin[] to satisfy the type checker
});

/**
 * Convert all imports in the code to be Next.js-compatible
 */
export const convertImports = (code: string, isTypeScript: boolean = false): string => {
  try {
    const ast = parse(code, createParserOptions(isTypeScript));
    
    traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value;
        
        // Convert React Router imports to Next.js
        if (source === 'react-router-dom' || source === 'react-router') {
          const nextImports: string[] = [];
          const reactRouterImports: {
            [key: string]: string
          } = {
            Link: 'Link',
            useHistory: 'useRouter',
            useLocation: 'useRouter',
            useParams: 'useRouter',
            useNavigate: 'useRouter',
            useRouteMatch: 'useRouter',
            Switch: 'removed',
            Route: 'removed',
            BrowserRouter: 'removed',
            Router: 'removed',
          };
          
          // Filter imports to keep or convert
          const specsToKeep = path.node.specifiers.filter(spec => {
            if (t.isImportSpecifier(spec)) {
              const importedName = t.isIdentifier(spec.imported) ? spec.imported.name : null;
              return importedName ? !reactRouterImports[importedName] || reactRouterImports[importedName] !== 'removed' : true;
            }
            return true;
          });
          
          // Replace with Next.js imports
          let hasRouterImport = false;
          for (const spec of path.node.specifiers) {
            if (t.isImportSpecifier(spec)) {
              const importedName = t.isIdentifier(spec.imported) ? spec.imported.name : null;
              if (importedName && reactRouterImports[importedName] === 'useRouter' && !hasRouterImport) {
                nextImports.push("import { useRouter } from 'next/router';");
                hasRouterImport = true;
              } else if (importedName && reactRouterImports[importedName] === 'Link') {
                nextImports.push("import Link from 'next/link';");
              }
            }
          }
          
          // Remove the react-router import and add Next.js imports
          if (specsToKeep.length === 0) {
            path.remove();
          }
          
          if (nextImports.length > 0) {
            const importsCode = nextImports.join('\n');
            path.insertBefore(parse(importsCode, { sourceType: 'module' }).program.body);
          }
        }
      }
    });
    
    return generate(ast).code;
  } catch (error) {
    console.error('Error converting imports:', error);
    return code;
  }
};
