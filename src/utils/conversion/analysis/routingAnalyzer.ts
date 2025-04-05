
/**
 * Enhanced router analyzer for detecting and converting React Router patterns
 */
import { UploadedFiles } from '@/types/conversion';
import { parseCode } from './astUtils';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import * as path from 'path';
import { logConversion } from '../logger';

export interface RouteConfig {
  path: string;
  nextPath: string; // The Next.js path equivalent
  component: string;
  componentPath?: string; // Full path to component file
  exact?: boolean;
  params: string[];
  nested?: RouteConfig[];
  layout?: string;
  parentPath?: string;
}

export interface RoutingAnalysis {
  routes: RouteConfig[];
  hasReactRouter: boolean;
  routerVersion?: string;
  hasCustomRouter?: boolean;
  usesNestedRoutes?: boolean;
  usesCodeSplitting?: boolean;
  entryPoint?: string;
  routeComponents: string[];
  routerHooks: string[];
}

/**
 * Analyze routing patterns in the project
 */
export const analyzeRoutingPatterns = (files: UploadedFiles): RoutingAnalysis => {
  const result: RoutingAnalysis = {
    routes: [],
    hasReactRouter: false,
    routeComponents: [],
    routerHooks: []
  };
  
  // First, check for React Router dependencies in package.json
  if (files['package.json']) {
    try {
      const packageJson = JSON.parse(files['package.json']);
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (deps['react-router'] || deps['react-router-dom']) {
        result.hasReactRouter = true;
        
        // Determine React Router version
        const version = deps['react-router-dom'] || deps['react-router'];
        result.routerVersion = version;
        
        // Check if using v6
        const isV6 = version && (
          version.startsWith('6') || 
          version.startsWith('^6') || 
          version.includes('next')
        );
        
        logConversion('info', `Detected React Router ${isV6 ? 'v6' : 'v5 or earlier'}`);
      }
    } catch (error) {
      logConversion('warning', 'Failed to parse package.json');
    }
  }
  
  // Next, look for route configurations
  let routeFileCandidates: string[] = [];
  let routeComponents: Set<string> = new Set();
  let routerHooks: Set<string> = new Set();
  
  // First pass: identify files with route definitions
  Object.entries(files).forEach(([filePath, content]) => {
    if (!/\.(js|jsx|ts|tsx)$/.test(filePath)) return;
    
    // Check for React Router imports
    if (content.includes('react-router') || 
        content.includes('Route') || 
        content.includes('Switch') || 
        content.includes('Router')) {
      
      if (content.includes('<Route') || 
          content.includes('<Switch') || 
          content.includes('createBrowserRouter') ||
          content.includes('createRoutesFromElements') ||
          content.includes('RouteObject')) {
        routeFileCandidates.push(filePath);
      }
    }
    
    // Check for router hooks
    if (content.includes('useNavigate') || 
        content.includes('useParams') || 
        content.includes('useLocation') || 
        content.includes('useHistory') || 
        content.includes('useRouteMatch')) {
      
      // Extract hook names
      const hookMatches = content.match(/use(Navigate|Params|Location|History|RouteMatch)/g);
      if (hookMatches) {
        hookMatches.forEach(hook => routerHooks.add(hook));
      }
    }
  });
  
  result.routerHooks = Array.from(routerHooks);
  
  // Second pass: extract route configurations
  routeFileCandidates.forEach(filePath => {
    try {
      const content = files[filePath];
      const ast = parseCode(content);
      
      let routesFound = false;
      
      // Check for different React Router patterns
      
      // Pattern 1: JSX Route components
      traverse(ast, {
        JSXElement(path) {
          if (t.isJSXIdentifier(path.node.openingElement.name) && 
              path.node.openingElement.name.name === 'Route') {
            
            routesFound = true;
            
            // Extract route props
            const props: Record<string, any> = {};
            path.node.openingElement.attributes.forEach(attr => {
              if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
                const name = attr.name.name;
                
                if (t.isStringLiteral(attr.value)) {
                  props[name] = attr.value.value;
                } else if (t.isJSXExpressionContainer(attr.value)) {
                  if (t.isStringLiteral(attr.value.expression)) {
                    props[name] = attr.value.expression.value;
                  } else if (t.isIdentifier(attr.value.expression)) {
                    props[name] = attr.value.expression.name;
                  } else if (t.isJSXElement(attr.value.expression)) {
                    props[name] = 'JSXElement';
                  }
                }
              }
            });
            
            // Extract route path
            const routePath = props.path || props.to || '*';
            
            // Convert route path to Next.js path
            const nextPath = convertToNextJsPath(routePath);
            
            // Extract params from path
            const params = extractPathParams(routePath);
            
            // Extract component
            const component = props.component || props.element || 'Unknown';
            
            // Add route to the result
            result.routes.push({
              path: routePath,
              nextPath,
              component: typeof component === 'string' ? component : 'JSXElement',
              exact: props.exact === true || props.exact === 'true',
              params
            });
            
            // Track the component
            if (typeof component === 'string' && !component.includes('.') && component !== 'Unknown') {
              routeComponents.add(component);
            }
          }
        }
      });
      
      // Pattern 2: createBrowserRouter (React Router v6.4+)
      traverse(ast, {
        CallExpression(path) {
          if (t.isIdentifier(path.node.callee) && 
              path.node.callee.name === 'createBrowserRouter' && 
              path.node.arguments.length > 0) {
            
            routesFound = true;
            
            // Extract routes array
            const routesArg = path.node.arguments[0];
            
            if (t.isArrayExpression(routesArg)) {
              routesArg.elements.forEach(element => {
                if (t.isObjectExpression(element)) {
                  const routeObj: Record<string, any> = {};
                  
                  element.properties.forEach(prop => {
                    if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
                      const key = prop.key.name;
                      
                      if (t.isStringLiteral(prop.value)) {
                        routeObj[key] = prop.value.value;
                      } else if (t.isIdentifier(prop.value)) {
                        routeObj[key] = prop.value.name;
                      } else if (t.isArrayExpression(prop.value) && key === 'children') {
                        routeObj[key] = 'has-children';
                      }
                    }
                  });
                  
                  // Extract route path
                  const routePath = routeObj.path || '/';
                  
                  // Convert route path to Next.js path
                  const nextPath = convertToNextJsPath(routePath);
                  
                  // Extract params from path
                  const params = extractPathParams(routePath);
                  
                  // Add route to the result
                  result.routes.push({
                    path: routePath,
                    nextPath,
                    component: routeObj.element || routeObj.Component || 'Unknown',
                    params,
                    nested: routeObj.children ? [] : undefined
                  });
                  
                  // Track the component
                  if (routeObj.element && typeof routeObj.element === 'string') {
                    routeComponents.add(routeObj.element);
                  }
                }
              });
            }
          }
        }
      });
      
      if (routesFound) {
        logConversion('info', `Found ${result.routes.length} routes in ${filePath}`);
      }
    } catch (error) {
      logConversion('warning', `Failed to analyze routes in ${filePath}: ${(error as Error).message}`);
    }
  });
  
  // Analyze nested routes structure
  organizeNestedRoutes(result.routes);
  
  // Find components referenced in routes
  result.routeComponents = Array.from(routeComponents);
  
  // Analyze code splitting in routes
  result.usesCodeSplitting = detectCodeSplitting(files, result.routes);
  
  // Check for nested routes
  result.usesNestedRoutes = result.routes.some(r => r.nested && r.nested.length > 0);
  
  return result;
};

/**
 * Convert React Router path to Next.js path format
 */
export const convertToNextJsPath = (routePath: string): string => {
  // Handle index route
  if (routePath === '/' || routePath === '') {
    return '/index';
  }
  
  // Handle wildcard route
  if (routePath === '*') {
    return '/404';
  }
  
  // Convert : params to [] syntax
  let nextPath = routePath
    .replace(/\/:[a-zA-Z0-9_]+/g, match => {
      const param = match.substring(2); // Remove the '/:' prefix
      return `/[${param}]`;
    });
  
  // Replace * with [...catchAll]
  nextPath = nextPath.replace(/\/\*$/, '/[...catchAll]');
  
  // Remove leading slash for file system path
  if (nextPath.startsWith('/')) {
    nextPath = nextPath.substring(1);
  }
  
  return nextPath;
};

/**
 * Extract parameters from a route path
 */
export const extractPathParams = (routePath: string): string[] => {
  const params: string[] = [];
  const paramMatches = routePath.match(/:[a-zA-Z0-9_]+/g);
  
  if (paramMatches) {
    paramMatches.forEach(match => {
      params.push(match.substring(1)); // Remove the ':' prefix
    });
  }
  
  // Check for wildcard/catch-all routes
  if (routePath.includes('*')) {
    params.push('catchAll');
  }
  
  return params;
};

/**
 * Organize routes into a nested structure
 */
export const organizeNestedRoutes = (routes: RouteConfig[]): void => {
  // Sort routes by path length to process parent routes first
  routes.sort((a, b) => a.path.length - b.path.length);
  
  // Track processed routes to avoid duplicates
  const processedPaths = new Set<string>();
  
  // Process each route
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    
    // Skip if already processed
    if (processedPaths.has(route.path)) continue;
    
    // Mark as processed
    processedPaths.add(route.path);
    
    // Find potential parent routes
    for (let j = 0; j < routes.length; j++) {
      const potentialParent = routes[j];
      
      // Skip if the same route or already processed
      if (i === j || route.path === potentialParent.path) continue;
      
      // Check if this is a child route
      if (route.path.startsWith(`${potentialParent.path}/`) && 
          potentialParent.path !== '/') {
        
        // Initialize nested array if needed
        if (!potentialParent.nested) {
          potentialParent.nested = [];
        }
        
        // Add as nested route
        potentialParent.nested.push({
          ...route,
          parentPath: potentialParent.path
        });
        
        // Remove from top-level routes
        routes.splice(i, 1);
        i--; // Adjust index since we removed an item
        break;
      }
    }
  }
};

/**
 * Detect code splitting in route definitions
 */
export const detectCodeSplitting = (
  files: UploadedFiles, 
  routes: RouteConfig[]
): boolean => {
  // Look for dynamic import patterns in files with routes
  return Object.values(files).some(content => 
    (content.includes('React.lazy') || 
     content.includes('lazy(') || 
     content.includes('import(')) && 
    (content.includes('<Route') || 
     content.includes('createBrowserRouter'))
  );
};

/**
 * Generate Next.js pages structure from React Router
 */
export const generateNextJsPagesFromRoutes = (
  routingAnalysis: RoutingAnalysis
): Record<string, { 
  content: string; 
  params?: string[]; 
  componentName: string;
}> => {
  const nextJsPages: Record<string, { 
    content: string; 
    params?: string[]; 
    componentName: string;
  }> = {};
  
  // Generate pages for each route
  routingAnalysis.routes.forEach(route => {
    generatePageForRoute(route, nextJsPages);
  });
  
  return nextJsPages;
};

/**
 * Generate a Next.js page for a route
 */
const generatePageForRoute = (
  route: RouteConfig,
  pagesOutput: Record<string, { content: string; params?: string[]; componentName: string; }>
): void => {
  // Generate the page file path
  let pagePath = route.nextPath;
  if (!pagePath.endsWith('.js') && !pagePath.endsWith('.jsx') && 
      !pagePath.endsWith('.ts') && !pagePath.endsWith('.tsx')) {
    pagePath = `${pagePath}.js`;
  }
  
  // Skip if already generated
  if (pagesOutput[pagePath]) return;
  
  // Determine the component name
  const componentName = typeof route.component === 'string' 
    ? route.component.replace(/['"]/g, '')
    : 'PageComponent';
  
  // Generate the page content
  let content = '';
  
  // Add imports
  content += `import ${componentName} from '../components/${componentName}';\n`;
  
  // Add useRouter for pages with params
  if (route.params && route.params.length > 0) {
    content += `import { useRouter } from 'next/router';\n`;
  }
  
  content += '\n';
  
  // Generate the component
  content += `export default function Page() {\n`;
  
  // Add router param extraction
  if (route.params && route.params.length > 0) {
    content += `  const router = useRouter();\n`;
    route.params.forEach(param => {
      content += `  const ${param} = router.query.${param};\n`;
    });
    content += '\n';
  }
  
  // Render the component
  content += `  return <${componentName}`;
  
  // Pass params as props
  if (route.params && route.params.length > 0) {
    route.params.forEach(param => {
      content += ` ${param}={${param}}`;
    });
  }
  
  content += ` />;\n`;
  content += `}\n`;
  
  // Store the page
  pagesOutput[pagePath] = {
    content,
    params: route.params,
    componentName
  };
  
  // Process nested routes
  if (route.nested && route.nested.length > 0) {
    route.nested.forEach(nestedRoute => {
      generatePageForRoute(nestedRoute, pagesOutput);
    });
  }
};
