
/**
 * Enhanced route extractor with improved detection of React Router configurations
 */
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { logConversion } from './logger';
import { parseCode } from './analysis/astUtils';
import { timer } from '../helpers';

interface RouteConfig {
  path: string;
  component: string;
  exact?: boolean;
  caseSensitive?: boolean;
  children?: RouteConfig[];
  layout?: string;
}

interface RouteExtractionResult {
  routes: Record<string, string>;
  routeConfigs: RouteConfig[];
  potentialLayoutComponents: string[];
  hasNestedRoutes: boolean;
  conversionComplexity: 'simple' | 'medium' | 'complex';
  isV6Router: boolean;
}

/**
 * Extract routes from React Router configurations with enhanced detection
 */
export const extractRoutesEnhanced = (code: string, filePath: string): RouteExtractionResult => {
  const benchmark = timer();
  const routes: Record<string, string> = {};
  const routeConfigs: RouteConfig[] = [];
  const potentialLayoutComponents: string[] = [];
  let hasNestedRoutes = false;
  let conversionComplexity: 'simple' | 'medium' | 'complex' = 'simple';
  let isV6Router = false;
  
  // Detect React Router version from imports
  const routerV6ImportPattern = /from\s+['"]react-router-dom['"].*?createBrowserRouter|createRoutesFromElements|RouterProvider|createHashRouter|Outlet/;
  isV6Router = routerV6ImportPattern.test(code);
  
  try {
    const ast = parseCode(code);

    // Track variables that hold component references
    const componentVariables: Record<string, string> = {};
    const layoutComponents: Set<string> = new Set();

    // First pass: collect component variable references
    traverse(ast, {
      VariableDeclarator(path) {
        if (t.isIdentifier(path.node.id) && path.node.init) {
          // Handle lazy loading components
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
          // Handle direct imports
          else if (t.isCallExpression(path.node.init) && 
                  t.isIdentifier(path.node.init.callee) && 
                  path.node.init.callee.name === 'require' &&
                  path.node.init.arguments.length > 0 &&
                  t.isStringLiteral(path.node.init.arguments[0])) {
            componentVariables[path.node.id.name] = path.node.init.arguments[0].value;
          }
        }
      },
      
      // Detect layout components that use Outlet
      JSXElement(path) {
        if (t.isJSXIdentifier(path.node.openingElement.name) && 
            path.node.openingElement.name.name === 'Outlet') {
          
          // Find the parent component that contains this Outlet
          let currentPath = path.scope;
          while (currentPath) {
            if (currentPath.block.type === 'FunctionDeclaration' && 
                t.isIdentifier(currentPath.block.id)) {
              layoutComponents.add(currentPath.block.id.name);
              break;
            } else if (currentPath.block.type === 'ArrowFunctionExpression' && 
                       currentPath.path.parent.type === 'VariableDeclarator' &&
                       t.isIdentifier(currentPath.path.parent.id)) {
              layoutComponents.add(currentPath.path.parent.id.name);
              break;
            }
            currentPath = currentPath.parent;
          }
        }
      }
    });

    // Second pass: extract routes
    traverse(ast, {
      JSXElement(path) {
        // Process <Route> elements
        if (t.isJSXIdentifier(path.node.openingElement.name) && 
            path.node.openingElement.name.name === 'Route') {
          let routePath: string | null = null;
          let component: string | null = null;
          let exact: boolean = false;
          let caseSensitive: boolean = false;
          
          // Extract attributes
          path.node.openingElement.attributes.forEach(attr => {
            if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
              // Get path
              if (attr.name.name === 'path' && attr.value) {
                if (t.isStringLiteral(attr.value)) {
                  routePath = attr.value.value;
                } else if (t.isJSXExpressionContainer(attr.value) && 
                          t.isStringLiteral(attr.value.expression)) {
                  routePath = attr.value.expression.value;
                }
              }
              
              // Check for exact prop
              if (attr.name.name === 'exact') {
                exact = true;
              }
              
              // Check for caseSensitive prop
              if (attr.name.name === 'caseSensitive') {
                caseSensitive = true;
              }
              
              // Check for element prop (React Router v6)
              if (attr.name.name === 'element' && attr.value && 
                  t.isJSXExpressionContainer(attr.value)) {
                if (t.isJSXElement(attr.value.expression)) {
                  // Get component name from JSX element
                  const elementName = attr.value.expression.openingElement.name;
                  if (t.isJSXIdentifier(elementName)) {
                    component = elementName.name;
                    
                    // Check if this is a layout component
                    if (layoutComponents.has(component)) {
                      potentialLayoutComponents.push(component);
                    }
                  }
                } else if (t.isIdentifier(attr.value.expression)) {
                  // Handle variables that reference components
                  component = attr.value.expression.name;
                  
                  // Check if this is a layout component
                  if (layoutComponents.has(component)) {
                    potentialLayoutComponents.push(component);
                  }
                }
              }
              
              // Check for component prop (React Router v5 and earlier)
              if (attr.name.name === 'component' && attr.value) {
                if (t.isJSXExpressionContainer(attr.value) && 
                    t.isIdentifier(attr.value.expression)) {
                  component = attr.value.expression.name;
                  
                  // Check if this is a layout component
                  if (layoutComponents.has(component)) {
                    potentialLayoutComponents.push(component);
                  }
                }
              }
            }
          });
          
          // Look for children routes
          if (path.node.children && path.node.children.length > 0) {
            // Detect nested routes structure
            const childRoutes = path.node.children.filter(child => 
              t.isJSXElement(child) && 
              t.isJSXIdentifier(child.openingElement.name) && 
              child.openingElement.name.name === 'Route'
            );
            
            if (childRoutes.length > 0) {
              hasNestedRoutes = true;
              conversionComplexity = 'medium';
            }
            
            // Look for component inside Route children (for layouts or wrapped components)
            if (!component) {
              for (const child of path.node.children) {
                if (t.isJSXElement(child) && 
                    !['Route', 'Switch', 'Routes'].includes(
                      (child.openingElement.name as any).name
                    )) {
                  const elementName = child.openingElement.name;
                  if (t.isJSXIdentifier(elementName)) {
                    component = elementName.name;
                    break;
                  }
                }
              }
            }
          }
          
          if (routePath && component) {
            // Resolve component if it's a variable reference
            if (componentVariables[component]) {
              // Extract component name from path
              const match = componentVariables[component].match(/\/([^/]+)$/);
              if (match) {
                component = match[1].replace(/\.\w+$/, ''); // Remove file extension
              }
            }
            
            routes[routePath] = component;
            routeConfigs.push({ 
              path: routePath, 
              component, 
              exact, 
              caseSensitive,
              // Identify if this component is likely a layout
              layout: layoutComponents.has(component) ? component : undefined
            });
          }
        }
      },
      
      // Detect React Router v6 createBrowserRouter usage
      CallExpression(path) {
        if (t.isIdentifier(path.node.callee) && 
            ['createBrowserRouter', 'createHashRouter', 'createMemoryRouter'].includes(path.node.callee.name)) {
          isV6Router = true;
          conversionComplexity = 'complex';
          
          // Extract routes from the first argument
          if (path.node.arguments.length > 0 && t.isArrayExpression(path.node.arguments[0])) {
            extractRoutesFromArray(path.node.arguments[0].elements, routes, routeConfigs, componentVariables, layoutComponents);
          }
          
          logConversion('info', `Detected React Router v6 createBrowserRouter - complex conversion needed`);
        }
      },
      
      // Handle route array declarations
      VariableDeclarator(path) {
        if (t.isIdentifier(path.node.id) && 
            (path.node.id.name.includes('routes') || path.node.id.name.includes('Routes')) && 
            t.isArrayExpression(path.node.init)) {
          logConversion('info', `Found routes array: ${path.node.id.name}`);
          extractRoutesFromArray(path.node.init.elements, routes, routeConfigs, componentVariables, layoutComponents);
        }
      }
    });
    
    // Check if we found any layout components
    if (potentialLayoutComponents.length > 0) {
      conversionComplexity = 'complex';
    }
    
    const benchmarkResult = benchmark.total();
    logConversion('info', `Route extraction completed in ${benchmarkResult}ms. Found ${Object.keys(routes).length} routes.`);
  } catch (error) {
    logConversion('error', `Error extracting routes: ${(error as Error).message}`);
  }
  
  // If we found no routes, try a regex-based approach
  if (Object.keys(routes).length === 0) {
    logConversion('info', 'Falling back to regex pattern matching for routes');
    
    // React Router v6 element pattern
    const routeV6Matches = code.match(/<Route[^>]*path=["'](.*?)["'][^>]*element=\{.*?((<|{)<([A-Za-z0-9_]+).*|([A-Za-z0-9_]+))/g) || [];
    routeV6Matches.forEach(match => {
      const pathMatch = match.match(/path=["'](.*?)["']/) || [];
      const componentMatch = match.match(/element=\{(?:<([A-Za-z0-9_]+)|([A-Za-z0-9_]+))/) || [];
      
      if (pathMatch[1] && (componentMatch[1] || componentMatch[2])) {
        const path = pathMatch[1];
        const component = componentMatch[1] || componentMatch[2];
        routes[path] = component;
        routeConfigs.push({ path, component });
      }
    });
    
    // React Router v5 component pattern
    const routeV5Matches = code.match(/<Route[^>]*path=["'](.*?)["'][^>]*component=\{([A-Za-z0-9_]+)\}/g) || [];
    routeV5Matches.forEach(match => {
      const pathMatch = match.match(/path=["'](.*?)["']/) || [];
      const componentMatch = match.match(/component=\{([A-Za-z0-9_]+)\}/) || [];
      
      if (pathMatch[1] && componentMatch[1]) {
        const path = pathMatch[1];
        const component = componentMatch[1];
        routes[path] = component;
        routeConfigs.push({ path, component });
      }
    });
    
    logConversion('info', `Extracted ${Object.keys(routes).length} routes using regex fallback`);
  }
  
  return {
    routes,
    routeConfigs,
    potentialLayoutComponents: Array.from(new Set(potentialLayoutComponents)),
    hasNestedRoutes,
    conversionComplexity,
    isV6Router
  };
};

/**
 * Helper function to extract routes from array elements
 */
function extractRoutesFromArray(
  elements: any[], 
  routes: Record<string, string>,
  routeConfigs: RouteConfig[],
  componentVariables: Record<string, string>,
  layoutComponents: Set<string>
) {
  elements.forEach(element => {
    if (t.isObjectExpression(element)) {
      let path: string | null = null;
      let component: string | null = null;
      let exact: boolean = false;
      let caseSensitive: boolean = false;
      let children: any[] = [];
      
      // Extract properties from route object
      element.properties.forEach(prop => {
        if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
          // Extract path
          if (prop.key.name === 'path' && t.isStringLiteral(prop.value)) {
            path = prop.value.value;
          }
          
          // Extract component
          if (prop.key.name === 'component' && t.isIdentifier(prop.value)) {
            component = prop.value.name;
          }
          
          // Extract element (React Router v6)
          if (prop.key.name === 'element') {
            if (t.isIdentifier(prop.value)) {
              component = prop.value.name;
            } else if (t.isJSXElement(prop.value) && 
                      t.isJSXIdentifier(prop.value.openingElement.name)) {
              component = prop.value.openingElement.name.name;
            }
          }
          
          // Extract exact
          if (prop.key.name === 'exact' && t.isBooleanLiteral(prop.value)) {
            exact = prop.value.value;
          }
          
          // Extract caseSensitive
          if (prop.key.name === 'caseSensitive' && t.isBooleanLiteral(prop.value)) {
            caseSensitive = prop.value.value;
          }
          
          // Extract children routes
          if (prop.key.name === 'children' && t.isArrayExpression(prop.value)) {
            children = prop.value.elements;
          }
        }
      });
      
      if (path && component) {
        // Resolve component if it's a variable reference
        if (componentVariables[component]) {
          // Extract component name from path
          const match = componentVariables[component].match(/\/([^/]+)$/);
          if (match) {
            component = match[1].replace(/\.\w+$/, ''); // Remove file extension
          }
        }
        
        // Check if this is a layout component
        const isLayout = layoutComponents.has(component);
        if (isLayout) {
          logConversion('info', `Detected layout component: ${component}`);
        }
        
        routes[path] = component;
        routeConfigs.push({ 
          path, 
          component, 
          exact, 
          caseSensitive,
          layout: isLayout ? component : undefined 
        });
        
        // Process children routes if any
        if (children.length > 0) {
          extractRoutesFromArray(children, routes, routeConfigs, componentVariables, layoutComponents);
        }
      }
    }
  });
}
