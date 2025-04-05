
/**
 * This file is part of the component analysis module
 * It responsible for analyzing React components to determine their nature and dependencies
 */
import { AnalysisResult, FileType, ComponentType, RenderingStrategy, SecurityIssue, PerformanceIssue, AssetOptimizationInfo } from './analysisTypes';
import { parseCode, isBrowserAPI } from './astUtils';
import { detectFileType } from './fileTypeDetector';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

/**
 * Analyze a React component to determine its properties and dependencies
 */
export const analyzeComponent = (code: string, filename: string): AnalysisResult => {
  const fileType = detectFileType(code, filename);
  const isTypescript = filename.endsWith('.ts') || filename.endsWith('.tsx');
  const dependencies: string[] = [];
  const exports: string[] = [];
  let componentType: ComponentType = 'functional';
  let hasClientSideCode = false;
  let hasDataFetching = false;
  let hasRouting = false;
  let usesHooks = false;
  let usesContext = false;
  let hasSEO = false;
  let usesRedux = false;
  const hooks: string[] = [];
  const props: string[] = [];
  const routeComponents: string[] = [];
  let mainComponentName: string | undefined;
  let defaultExport: string | undefined;
  const namedExports: string[] = [];
  const browserAPIs: string[] = [];
  const stateManagementLibraries: string[] = [];
  const thirdPartyDependencies: string[] = [];
  const securityIssues: SecurityIssue[] = [];
  const performanceIssues: PerformanceIssue[] = [];
  const assetOptimizations: AssetOptimizationInfo[] = [];
  
  try {
    const ast = parseCode(code);
    
    // Find imports and exports
    traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value;
        
        // Collect dependencies
        dependencies.push(source);
        
        // Check for special imports
        if (source.includes('react-router')) {
          hasRouting = true;
        }
        
        // Check for Redux
        if (source.includes('react-redux') || source.includes('@reduxjs/toolkit')) {
          usesRedux = true;
          stateManagementLibraries.push('redux');
        }
        
        // Check for other state management libraries
        if (source.includes('recoil')) {
          stateManagementLibraries.push('recoil');
        }
        
        if (source.includes('jotai')) {
          stateManagementLibraries.push('jotai');
        }
        
        if (source.includes('zustand')) {
          stateManagementLibraries.push('zustand');
        }
        
        if (source.includes('valtio')) {
          stateManagementLibraries.push('valtio');
        }
        
        // Check for SEO-related imports
        if (source.includes('next/head') || source.includes('react-helmet')) {
          hasSEO = true;
        }
        
        // Check for Next.js specific imports
        if (source === 'next/image') {
          assetOptimizations.push({
            type: 'image',
            path: filename,
            optimizationStrategy: 'Using Next.js Image component'
          });
        }
        
        if (source === 'next/font') {
          assetOptimizations.push({
            type: 'font',
            path: filename,
            optimizationStrategy: 'Using Next.js Font optimization'
          });
        }
        
        // Check for React import specifically
        if (source === 'react') {
          path.node.specifiers.forEach(specifier => {
            if (t.isImportSpecifier(specifier) && 
                t.isIdentifier(specifier.imported) && 
                specifier.imported.name.startsWith('use')) {
              usesHooks = true;
              hooks.push(specifier.imported.name);
            }
          });
        }
        
        // Check for common third-party libraries
        if (!source.startsWith('.') && !source.startsWith('/') && !source.startsWith('@/') && 
            !source.includes('react') && !source.includes('next')) {
          thirdPartyDependencies.push(source);
          
          // Check for potentially large libraries
          const largeLibraries = ['moment', 'lodash', 'chart.js', 'three.js', 'monaco-editor'];
          if (largeLibraries.some(lib => source.includes(lib))) {
            performanceIssues.push({
              type: 'large-bundle',
              impact: 'medium',
              description: `Using potentially large library: ${source}`,
              location: filename,
              suggestion: 'Consider using a more lightweight alternative or implement code splitting'
            });
          }
        }
      },
      
      // Identify component function declarations
      FunctionDeclaration(path) {
        if (t.isIdentifier(path.node.id)) {
          const name = path.node.id.name;
          // Check if this looks like a component (starts with uppercase)
          if (name[0] === name[0].toUpperCase()) {
            // This is likely a component
            if (!mainComponentName) mainComponentName = name;
          }
        }
      },
      
      // Identify component arrow functions (const X = () => {})
      VariableDeclarator(path) {
        if (t.isIdentifier(path.node.id) && 
            t.isArrowFunctionExpression(path.node.init)) {
          const name = path.node.id.name;
          // Check if this looks like a component (starts with uppercase)
          if (name[0] === name[0].toUpperCase()) {
            // This is likely a component
            if (!mainComponentName) mainComponentName = name;
          }
        }
      },
      
      ExportNamedDeclaration(path) {
        if (path.node.declaration && 
            (t.isFunctionDeclaration(path.node.declaration) || 
             t.isVariableDeclaration(path.node.declaration))) {
          if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
            const name = path.node.declaration.id.name;
            exports.push(name);
            namedExports.push(name);
            
            // Check if this is a component (starts with uppercase)
            if (name[0] === name[0].toUpperCase()) {
              if (!mainComponentName) mainComponentName = name;
            }
            
            // Check if this is a class component
            if (path.node.declaration.body) {
              const returnStatements = path.node.declaration.body.body.filter(
                node => t.isReturnStatement(node)
              );
              
              if (returnStatements.length > 0) {
                const returnValue = returnStatements[0].argument;
                if (t.isJSXElement(returnValue) || t.isJSXFragment(returnValue)) {
                  componentType = 'functional';
                }
              }
            }
          } else if (t.isVariableDeclaration(path.node.declaration)) {
            path.node.declaration.declarations.forEach(declaration => {
              if (t.isIdentifier(declaration.id)) {
                const name = declaration.id.name;
                exports.push(name);
                namedExports.push(name);
                
                // Check if this is a component (starts with uppercase)
                if (name[0] === name[0].toUpperCase()) {
                  if (!mainComponentName) mainComponentName = name;
                }
              }
            });
          }
        } else if (path.node.specifiers && path.node.specifiers.length > 0) {
          path.node.specifiers.forEach(specifier => {
            if (t.isExportSpecifier(specifier) && t.isIdentifier(specifier.exported)) {
              const name = specifier.exported.name;
              exports.push(name);
              namedExports.push(name);
            }
          });
        }
        
        // Check for Next.js data fetching exports
        if (path.node.declaration && 
            t.isFunctionDeclaration(path.node.declaration) && 
            path.node.declaration.id) {
          const functionName = path.node.declaration.id.name;
          if (['getServerSideProps', 'getStaticProps', 'getStaticPaths'].includes(functionName)) {
            hasDataFetching = true;
          }
        }
      },
      
      ExportDefaultDeclaration(path) {
        if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
          const name = path.node.declaration.id.name;
          exports.push(`default: ${name}`);
          defaultExport = name;
          // This is likely the main component
          if (!mainComponentName || name[0] === name[0].toUpperCase()) {
            mainComponentName = name;
          }
        } else if (t.isIdentifier(path.node.declaration)) {
          const name = path.node.declaration.name;
          exports.push(`default: ${name}`);
          defaultExport = name;
        } else if (t.isClassDeclaration(path.node.declaration)) {
          componentType = 'class';
          if (path.node.declaration.id) {
            const name = path.node.declaration.id.name;
            exports.push(`default: ${name}`);
            defaultExport = name;
            // This is likely the main component
            if (!mainComponentName) {
              mainComponentName = name;
            }
          } else {
            exports.push('default: anonymous class');
          }
        } else if (t.isArrowFunctionExpression(path.node.declaration)) {
          // Anonymous arrow function export default
          exports.push('default: arrow function');
          // We can't determine component name
        } else {
          exports.push('default: anonymous');
        }
      },
      
      // Detect props with TypeScript
      TSInterfaceDeclaration(path) {
        if (t.isIdentifier(path.node.id) && path.node.id.name.includes('Props')) {
          path.node.body.body.forEach(prop => {
            if (t.isTSPropertySignature(prop) && t.isIdentifier(prop.key)) {
              props.push(prop.key.name);
            }
          });
        }
      },
      
      // Detect props with PropTypes
      AssignmentExpression(path) {
        if (
          t.isMemberExpression(path.node.left) &&
          t.isIdentifier(path.node.left.property) &&
          path.node.left.property.name === 'propTypes' &&
          t.isObjectExpression(path.node.right)
        ) {
          path.node.right.properties.forEach(prop => {
            if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
              props.push(prop.key.name);
            }
          });
        }
      },
      
      // Find potential security issues
      StringLiteral(path) {
        // Check for potential API keys or secrets in code
        const value = path.node.value;
        if (
          (value.length > 20 && /^[A-Za-z0-9._~-]+$/.test(value)) || // Potential API key format
          value.match(/^(sk|pk|api|key|token|secret|password|auth)_[A-Za-z0-9]+$/i) // Common API key prefixes
        ) {
          securityIssues.push({
            type: 'client-secret',
            severity: 'high',
            description: 'Potential API key or secret found in code',
            location: filename,
            suggestion: 'Move secrets to environment variables on the server side'
          });
        }
      },
      
      // Check for image elements to suggest Next.js Image optimization
      JSXElement(path) {
        const elementName = path.node.openingElement.name;
        if (t.isJSXIdentifier(elementName)) {
          // Detect images that could be optimized
          if (elementName.name === 'img') {
            assetOptimizations.push({
              type: 'image',
              path: filename,
              optimizationStrategy: 'Replace with next/image component',
              potentialSavings: 'Up to 50% on image size with automatic WebP conversion'
            });
          }
          
          // Detect SEO-related tags
          if (elementName.name === 'Head' || elementName.name === 'Helmet') {
            hasSEO = true;
          }
          
          // Detect title and meta tags which indicate SEO
          if (elementName.name === 'title' || 
              (elementName.name === 'meta' && 
               path.node.openingElement.attributes.some(attr => 
                 t.isJSXAttribute(attr) && 
                 t.isJSXIdentifier(attr.name) && 
                 ['description', 'keywords', 'og:title', 'twitter:card'].some(name => 
                   attr.name.name === 'name' || attr.name.name === 'property' && 
                   t.isStringLiteral(attr.value) && 
                   attr.value.value.includes(name)
                 )
               ))) {
            hasSEO = true;
          }
          
          // Check for routing components
          if (['Route', 'Switch', 'Routes'].includes(elementName.name)) {
            hasRouting = true;
            
            // Extract the component being rendered by the Route
            if (elementName.name === 'Route') {
              path.node.openingElement.attributes.forEach(attr => {
                if (t.isJSXAttribute(attr) && 
                    t.isJSXIdentifier(attr.name) && 
                    (attr.name.name === 'component' || attr.name.name === 'element') && 
                    t.isJSXExpressionContainer(attr.value) && 
                    t.isIdentifier(attr.value.expression)) {
                  routeComponents.push(attr.value.expression.name);
                }
              });
            }
          }
          
          // Check for link components to detect navigation patterns
          if (elementName.name === 'Link' || elementName.name === 'a') {
            // Check if it's using client-side navigation
            const hasHref = path.node.openingElement.attributes.some(attr => 
              t.isJSXAttribute(attr) && 
              t.isJSXIdentifier(attr.name) && 
              attr.name.name === 'href' &&
              attr.value
            );
            
            if (hasHref && elementName.name === 'a') {
              // Suggest using Next.js Link component
              performanceIssues.push({
                type: 'unnecessary-client-side',
                impact: 'medium',
                description: 'Using <a> tag for navigation causes full page reload',
                location: filename,
                suggestion: 'Replace with Next.js <Link> component for client-side navigation'
              });
            }
          }
        }
      },
      
      JSXFragment() {
        // Fragments are used in functional components
        // This suggests the file has JSX
      },
      
      ClassDeclaration(path) {
        componentType = 'class';
        
        // Track component name
        if (path.node.id) {
          const name = path.node.id.name;
          if (!mainComponentName) mainComponentName = name;
        }
        
        // Check if this is a React component
        const isReactComponent = 
          path.node.superClass && 
          (t.isIdentifier(path.node.superClass) && 
           (path.node.superClass.name === 'Component' || path.node.superClass.name === 'PureComponent')) ||
          (t.isMemberExpression(path.node.superClass) && 
           t.isIdentifier(path.node.superClass.object) && 
           path.node.superClass.object.name === 'React' && 
           t.isIdentifier(path.node.superClass.property) && 
           (path.node.superClass.property.name === 'Component' || 
            path.node.superClass.property.name === 'PureComponent'));
        
        if (isReactComponent) {
          // Class components are more complex to convert to Server Components
          performanceIssues.push({
            type: 'unnecessary-client-side',
            impact: 'medium',
            description: 'Class component may be harder to optimize in Next.js',
            location: filename,
            suggestion: 'Consider refactoring to functional component with hooks'
          });
        }
      },
      
      CallExpression(path) {
        const callee = path.node.callee;
        
        // Check for data fetching
        if ((t.isIdentifier(callee) && 
             (callee.name === 'fetch' || callee.name === 'axios')) || 
            (t.isMemberExpression(callee) && 
             t.isIdentifier(callee.property) && 
             callee.property.name === 'get')) {
          hasDataFetching = true;
          
          // Check if this is in a useEffect or componentDidMount
          let isInClientSideFetch = false;
          let currentPath = path.parentPath;
          
          while (currentPath) {
            if (currentPath.node.type === 'CallExpression' && 
                t.isIdentifier(currentPath.node.callee) && 
                currentPath.node.callee.name === 'useEffect') {
              isInClientSideFetch = true;
              break;
            }
            if (currentPath.node.type === 'ClassMethod' && 
                t.isIdentifier(currentPath.node.key) && 
                currentPath.node.key.name === 'componentDidMount') {
              isInClientSideFetch = true;
              break;
            }
            currentPath = currentPath.parentPath;
          }
          
          if (isInClientSideFetch) {
            performanceIssues.push({
              type: 'inefficient-data-fetching',
              impact: 'high',
              description: 'Client-side data fetching inside useEffect/componentDidMount',
              location: filename,
              suggestion: 'Move to getServerSideProps/getStaticProps for better performance and SEO'
            });
          }
        }
        
        // Check for hooks
        if (t.isIdentifier(callee) && callee.name.startsWith('use')) {
          usesHooks = true;
          hooks.push(callee.name);
          
          // Check for router hooks
          if (['useParams', 'useNavigate', 'useHistory', 'useLocation', 'useRouteMatch'].includes(callee.name)) {
            hasRouting = true;
          }
          
          // Check for browser-only hooks
          if (['useEffect', 'useLayoutEffect', 'useCallback', 'useMemo'].includes(callee.name)) {
            hasClientSideCode = true;
            
            // Check for large dependencies array in hooks
            if (callee.name === 'useEffect' || callee.name === 'useCallback' || callee.name === 'useMemo') {
              const depsArray = path.node.arguments[1];
              if (t.isArrayExpression(depsArray) && depsArray.elements.length > 5) {
                performanceIssues.push({
                  type: 'render-blocking',
                  impact: 'medium',
                  description: `Hook ${callee.name} has ${depsArray.elements.length} dependencies`,
                  location: filename,
                  suggestion: 'Consider splitting this hook into smaller hooks with fewer dependencies'
                });
              }
            }
          }
          
          // Data fetching hooks
          if (['useFetch', 'useQuery', 'useMutation', 'useSWR'].includes(callee.name)) {
            hasDataFetching = true;
          }
          
          // Context hooks
          if (callee.name === 'useContext') {
            usesContext = true;
          }
          
          // Redux hooks
          if (['useSelector', 'useDispatch', 'useStore'].includes(callee.name)) {
            usesRedux = true;
            stateManagementLibraries.push('redux-hooks');
          }
        }
        
        // Check for higher-order components
        if (t.isCallExpression(path.node) && 
            path.parent && 
            t.isVariableDeclarator(path.parent) && 
            t.isIdentifier(path.parent.id) && 
            (
              path.parent.id.name.startsWith('with') || 
              path.node.arguments.some(arg => 
                t.isIdentifier(arg) && arg.name.match(/[A-Z]/)
              )
            )) {
          componentType = 'hoc';
        }
        
        // Check for context creation
        if (t.isMemberExpression(callee) && 
            t.isIdentifier(callee.object) && 
            callee.object.name === 'React' && 
            t.isIdentifier(callee.property) && 
            callee.property.name === 'createContext') {
          componentType = 'context';
        }
      },
      
      MemberExpression(path) {
        const object = path.node.object;
        const property = path.node.property;
        
        // Check for browser-only APIs
        if (t.isIdentifier(object)) {
          const objectName = object.name;
          
          if (isBrowserAPI(objectName)) {
            hasClientSideCode = true;
            browserAPIs.push(objectName);
            
            // Check for storage APIs that might be better done server-side
            if (objectName === 'localStorage' || objectName === 'sessionStorage') {
              securityIssues.push({
                type: 'client-secret',
                severity: 'medium',
                description: `Using ${objectName} to store potentially sensitive data`,
                location: filename,
                suggestion: 'Consider using server-side storage or cookies with httpOnly flag'
              });
            }
          }
        }
        
        // Check for React Router code
        if (t.isIdentifier(object) && 
            (object.name === 'history' || object.name === 'navigate') && 
            t.isIdentifier(property) && 
            (property.name === 'push' || property.name === 'replace')) {
          hasRouting = true;
        }
        
        // Check for Redux store access
        if (t.isIdentifier(object) && 
            object.name === 'store' && 
            t.isIdentifier(property) && 
            (property.name === 'dispatch' || property.name === 'getState')) {
          usesRedux = true;
          stateManagementLibraries.push('redux-store');
        }
      }
    });
  } catch (error) {
    console.error(`Error analyzing component ${filename}:`, error);
  }
  
  // Determine if using CSS-in-JS
  const usesStyled = dependencies.includes('styled-components') || 
                     dependencies.includes('@emotion/styled') || 
                     code.includes('styled') || 
                     code.includes('css`');
  
  // If no main component name was found but file has JSX, try to derive a name from the filename
  if (!mainComponentName && (code.includes('jsx') || code.includes('<'))) {
    const baseName = filename.split('/').pop()?.replace(/\.(jsx?|tsx?)$/, '') || '';
    // Convert to PascalCase if not already
    if (baseName && baseName[0] !== baseName[0].toUpperCase()) {
      mainComponentName = baseName
        .split(/[-_]/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
    } else {
      mainComponentName = baseName;
    }
  }
  
  // Determine recommended rendering strategy
  let recommendedRenderingStrategy: RenderingStrategy = 'csr';
  
  if (hasDataFetching) {
    // If the component has data fetching that changes frequently, recommend SSR
    if (code.includes('Date.now()') || code.includes('new Date()')) {
      recommendedRenderingStrategy = 'ssr';
    } 
    // If data seems static, recommend SSG
    else if (!hasClientSideCode || browserAPIs.length === 0) {
      recommendedRenderingStrategy = 'ssg';
      
      // If there's pagination or dynamic parameters, suggest ISR
      if (code.includes('page') || code.includes('limit') || code.includes('[id]') || 
          code.includes(':id') || filename.includes('[')) {
        recommendedRenderingStrategy = 'isr';
      }
    } else {
      recommendedRenderingStrategy = 'ssr';
    }
  } else if (!hasClientSideCode && !usesHooks && !usesContext && !usesRedux) {
    // Pure presentational component that doesn't use client features could be a server component
    recommendedRenderingStrategy = 'ssg';
  }
  
  return {
    fileType,
    componentType,
    hasDataFetching,
    hasRouting,
    imports: dependencies,
    exports,
    hasClientSideCode,
    dependencies,
    usesHooks,
    usesContext,
    hooks,
    props,
    isTypescript,
    hasSEO,
    usesRedux,
    importsSass: dependencies.some(dep => dep.endsWith('.scss') || dep.endsWith('.sass')),
    importsCSS: dependencies.some(dep => dep.endsWith('.css')),
    usesStyled,
    routeComponents,
    mainComponentName,
    defaultExport,
    namedExports,
    browserAPIs,
    stateManagementLibraries,
    detectedAssetOptimizations: assetOptimizations,
    securityIssues,
    performanceIssues,
    recommendedRenderingStrategy
  };
};
