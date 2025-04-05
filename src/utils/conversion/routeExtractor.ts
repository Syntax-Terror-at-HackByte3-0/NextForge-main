
/**
 * This file contains functionality to extract routes from React Router configurations
 */
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { logConversion } from './logger';
import { parseCode } from './analysis/astUtils';

interface RouteConfig {
  path: string;
  component: string;
  exact?: boolean;
  children?: RouteConfig[];
}

/**
 * Extracts routes from React Router configuration
 */
export const extractRoutes = (code: string): Record<string, string> => {
  const routes: Record<string, string> = {};
  const routeConfigs: RouteConfig[] = [];
  
  try {
    const ast = parseCode(code);

    // Track variables that hold component references
    const componentVariables: Record<string, string> = {};

    // First pass: collect component variable references
    traverse(ast, {
      VariableDeclarator(path) {
        if (t.isIdentifier(path.node.id) && path.node.init) {
          // Handle import references like: const Home = React.lazy(() => import('./Home'))
          if (t.isCallExpression(path.node.init) && 
              t.isMemberExpression(path.node.init.callee) &&
              t.isIdentifier(path.node.init.callee.object) &&
              path.node.init.callee.object.name === 'React' &&
              t.isIdentifier(path.node.init.callee.property) &&
              path.node.init.callee.property.name === 'lazy') {
            
            // Extract the import path
            if (path.node.init.arguments.length > 0 && 
                t.isArrowFunctionExpression(path.node.init.arguments[0]) &&
                t.isCallExpression(path.node.init.arguments[0].body) &&
                t.isIdentifier(path.node.init.arguments[0].body.callee) &&
                path.node.init.arguments[0].body.callee.name === 'import') {
              
              if (t.isStringLiteral(path.node.init.arguments[0].body.arguments[0])) {
                const importPath = path.node.init.arguments[0].body.arguments[0].value;
                componentVariables[path.node.id.name] = importPath;
              }
            }
          }
          // Handle direct component references
          else if (t.isIdentifier(path.node.init)) {
            componentVariables[path.node.id.name] = path.node.init.name;
          }
          // Handle direct imports: const Home = require('./Home')
          else if (t.isCallExpression(path.node.init) && 
                  t.isIdentifier(path.node.init.callee) && 
                  path.node.init.callee.name === 'require' &&
                  path.node.init.arguments.length > 0 &&
                  t.isStringLiteral(path.node.init.arguments[0])) {
            componentVariables[path.node.id.name] = path.node.init.arguments[0].value;
          }
        }
      }
    });

    // Second pass: extract routes
    traverse(ast, {
      JSXElement(path) {
        // Check for <Route path="..." element={<Component />} /> (React Router v6)
        if (
          t.isJSXIdentifier(path.node.openingElement.name) && 
          path.node.openingElement.name.name === 'Route'
        ) {
          let routePath: string | null = null;
          let component: string | null = null;
          let exact: boolean = false;
          
          // Extract path attribute
          path.node.openingElement.attributes.forEach(attr => {
            if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
              // Get path
              if (attr.name.name === 'path' && attr.value) {
                if (t.isStringLiteral(attr.value)) {
                  routePath = attr.value.value;
                } else if (t.isJSXExpressionContainer(attr.value) && t.isStringLiteral(attr.value.expression)) {
                  routePath = attr.value.expression.value;
                }
              }
              
              // Check for exact prop
              if (attr.name.name === 'exact') {
                exact = true;
              }
              
              // Check for element prop (React Router v6)
              if (attr.name.name === 'element' && attr.value && t.isJSXExpressionContainer(attr.value)) {
                if (t.isJSXElement(attr.value.expression)) {
                  // Fix: Check the type of JSX element name before accessing 'name' property
                  const elementName = attr.value.expression.openingElement.name;
                  if (t.isJSXIdentifier(elementName)) {
                    component = elementName.name;
                  } else if (t.isJSXMemberExpression(elementName)) {
                    // Handle cases like <Namespace.Component />
                    if (t.isJSXIdentifier(elementName.property)) {
                      component = elementName.property.name;
                    }
                  }
                }
              }
              
              // Check for component prop (React Router v5 and earlier)
              if (attr.name.name === 'component' && attr.value) {
                if (t.isJSXExpressionContainer(attr.value) && t.isIdentifier(attr.value.expression)) {
                  component = attr.value.expression.name;
                }
              }
            }
          });
          
          // Look for component inside Route children (React Router v5 and earlier)
          if (!component && path.node.children) {
            for (const child of path.node.children) {
              if (t.isJSXElement(child)) {
                // Fix: Check the type of JSX element name before accessing 'name' property
                const elementName = child.openingElement.name;
                if (t.isJSXIdentifier(elementName)) {
                  component = elementName.name;
                  break;
                } else if (t.isJSXMemberExpression(elementName)) {
                  // Handle cases like <Namespace.Component />
                  if (t.isJSXIdentifier(elementName.property)) {
                    component = elementName.property.name;
                    break;
                  }
                }
              }
            }
          }
          
          if (routePath && component) {
            // Resolve component if it's a variable reference
            if (componentVariables[component]) {
              // Extract just the component name from path
              const match = componentVariables[component].match(/\/([^/]+)$/);
              if (match) {
                component = match[1].replace(/\.\w+$/, ''); // Remove file extension
              }
            }
            
            routes[routePath] = component;
            routeConfigs.push({ path: routePath, component, exact });
          }
        }
      },
      
      // Handle createBrowserRouter/RouteObject configuration (React Router v6.4+)
      ArrayExpression(path) {
        // Check if this array is used in createBrowserRouter or similar
        const isRouteConfig = (
          path.parent && 
          t.isCallExpression(path.parent) && 
          t.isIdentifier(path.parent.callee) && 
          (
            path.parent.callee.name === 'createBrowserRouter' ||
            path.parent.callee.name === 'createRoutesFromElements' ||
            path.parent.callee.name === 'createHashRouter'
          )
        ) || (
          // Or it could be a variable that's clearly for routes
          path.parent && 
          t.isVariableDeclarator(path.parent) && 
          t.isIdentifier(path.parent.id) && 
          (
            path.parent.id.name.includes('routes') ||
            path.parent.id.name.includes('Routes') ||
            path.parent.id.name.includes('router') ||
            path.parent.id.name.includes('Router')
          )
        );
        
        if (isRouteConfig) {
          extractRoutesFromArray(path.node.elements, routes, componentVariables);
        }
      },
      
      // Handle route array declarations
      VariableDeclarator(path) {
        if (
          t.isIdentifier(path.node.id) && 
          (
            path.node.id.name.includes('routes') ||
            path.node.id.name.includes('Routes') ||
            path.node.id.name.includes('router') ||
            path.node.id.name.includes('Router')
          ) && 
          t.isArrayExpression(path.node.init)
        ) {
          extractRoutesFromArray(path.node.init.elements, routes, componentVariables);
        }
      }
    });
    
    logConversion('info', `Extracted ${Object.keys(routes).length} routes from configuration`);
  } catch (error) {
    logConversion('error', `Error extracting routes: ${(error as Error).message}`);
  }
  
  // If AST parsing found no routes, try with regex as fallback
  if (Object.keys(routes).length === 0) {
    logConversion('info', 'Falling back to regex pattern matching for routes');
    
    // React Router v6 pattern: <Route path="/page" element={<Component />} />
    const routeV6Matches = code.match(/<Route[^>]*path=["'](.*?)["'][^>]*element=\{<(.*?)[\s\/>]/g) || [];
    routeV6Matches.forEach(match => {
      const pathMatch = match.match(/path=["'](.*?)["']/) || [];
      const componentMatch = match.match(/element=\{<(.*?)[\s\/>]/) || [];
      
      if (pathMatch[1] && componentMatch[1]) {
        const path = pathMatch[1];
        const component = componentMatch[1].split(' ')[0]; // Get component name without props
        routes[path] = component;
      }
    });
    
    // React Router v5 pattern: <Route path="/page" component={Component} />
    const routeV5Matches = code.match(/<Route[^>]*path=["'](.*?)["'][^>]*component=\{(.*?)\}/g) || [];
    routeV5Matches.forEach(match => {
      const pathMatch = match.match(/path=["'](.*?)["']/) || [];
      const componentMatch = match.match(/component=\{(.*?)\}/) || [];
      
      if (pathMatch[1] && componentMatch[1]) {
        const path = pathMatch[1];
        const component = componentMatch[1].trim();
        routes[path] = component;
      }
    });
    
    // React Router object config pattern: { path: '/page', component: Component }
    const objectRouteMatches = code.match(/\{\s*path:\s*["'](.*?)["'],\s*component:\s*(.*?)[,\s\}]/g) || [];
    objectRouteMatches.forEach(match => {
      const pathMatch = match.match(/path:\s*["'](.*?)["']/) || [];
      const componentMatch = match.match(/component:\s*(.*?)[,\s\}]/) || [];
      
      if (pathMatch[1] && componentMatch[1]) {
        const path = pathMatch[1];
        const component = componentMatch[1].trim();
        routes[path] = component;
      }
    });
    
    logConversion('info', `Extracted ${Object.keys(routes).length} routes using regex fallback`);
  }
  
  return routes;
};

/**
 * Helper function to extract routes from array elements
 */
function extractRoutesFromArray(
  elements: any[], 
  routes: Record<string, string>, 
  componentVariables: Record<string, string>
) {
  elements.forEach(element => {
    if (t.isObjectExpression(element)) {
      let path: string | null = null;
      let component: string | null = null;
      
      // Extract properties from route object
      element.properties.forEach(prop => {
        if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
          // Extract path
          if (prop.key.name === 'path' && t.isStringLiteral(prop.value)) {
            path = prop.value.value;
          }
          
          // Extract component
          if (
            (prop.key.name === 'component' || prop.key.name === 'element') && 
            t.isIdentifier(prop.value)
          ) {
            component = prop.value.name;
          }
          
          // Handle JSX element
          if (
            prop.key.name === 'element' && 
            t.isJSXElement(prop.value)
          ) {
            // Fix: Check the type of JSX element name before accessing 'name' property
            const elementName = prop.value.openingElement.name;
            if (t.isJSXIdentifier(elementName)) {
              component = elementName.name;
            } else if (t.isJSXMemberExpression(elementName)) {
              // Handle cases like <Namespace.Component />
              if (t.isJSXIdentifier(elementName.property)) {
                component = elementName.property.name;
              }
            }
          }
        }
      });
      
      if (path && component) {
        // Resolve component if it's a variable reference
        if (componentVariables[component]) {
          // Extract just the component name from path
          const match = componentVariables[component].match(/\/([^/]+)$/);
          if (match) {
            component = match[1].replace(/\.\w+$/, ''); // Remove file extension
          }
        }
        
        routes[path] = component;
      }
    }
  });
}
