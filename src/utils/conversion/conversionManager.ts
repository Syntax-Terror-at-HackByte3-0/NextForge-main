/**
 * Main conversion manager that orchestrates the conversion process
 */
import { ConversionOutput, ConversionSettings, ConversionLog, ConversionStats, FileType } from './types';
import { UploadedFiles } from '@/types/conversion';
import { analyzeComponent } from './analyzeComponent';
import { convertComponent, convertToNextPage, convertToNextApi, convertReactRouterToNextRouter, convertToNextLayout, convertToNextHook } from './componentConverter';
import { logConversion } from './logger';
import { identifyEntryPoints, determineAppInitialization } from './entryPointIdentifier';
import { processComponents } from './componentProcessor';
import { processStyles } from './styleProcessor';
import { processConfigFiles } from './configProcessor';
import { createDefaultFiles } from './defaultFilesGenerator';
import { extractRoutes } from './routeExtractor';
import { detectFileType, getLanguageType, isTypeScriptFile } from './analysis/fileTypeDetector';
import { parseCode, identifyComponentPatterns } from './analysis/astUtils';
import { applyAllAssetTransformations } from './transform/assetTransform';

/**
 * Main conversion function to transform React code to Next.js
 */
export const convertReactToNext = (files: UploadedFiles): ConversionOutput => {
  const startTime = Date.now();
  logConversion('info', `Starting conversion of ${Object.keys(files).length} files`);
  
  // Initialize the output structure
  const result: ConversionOutput = {
    pages: {},
    components: {},
    api: {},
    styles: {},
    config: {},
    public: {}
  };
  
  // Collect all dependencies from files
  const allDependencies: string[] = [];
  
  // First-pass: analyze all files to understand project structure
  logConversion('info', 'Analyzing project structure...');
  
  // Identify entry points and key files
  const { entryPointFiles, mainAppFile, routeConfigFile, appStructure } = identifyEntryPoints(files);
  
  // Analyze how the app is initialized
  const initializationInfo = determineAppInitialization(files);
  logConversion('info', `App initialization: ${initializationInfo.renderMethod} renderer, root element: ${initializationInfo.rootElement || 'unknown'}`);
  
  // Process components and extract routes
  const { 
    fileAnalysis, 
    routeConfigs, 
    contextProviders, 
    componentGraph,
    patternAnalysis
  } = processComponents(files, allDependencies);
  
  // Extract routes
  const routes = extractRoutesFromConfigs(routeConfigs);
  
  // Identify major app architecture patterns
  const appArchitecture = {
    hasStateManagement: appStructure.hasRedux || appStructure.hasContextAPI,
    stateStrategy: appStructure.hasRedux ? 'redux' : appStructure.hasContextAPI ? 'context' : 'local',
    routingSystem: appStructure.routingType,
    dataFetchingPattern: detectDataFetchingPattern(files, fileAnalysis)
  };
  
  logConversion('info', `App architecture: ${JSON.stringify(appArchitecture)}`);
  
  // Process styles
  processStyles(files, result);
  
  // Process static assets
  processStaticAssets(files, result);
  
  // Second pass: convert files based on analysis
  logConversion('info', 'Converting components and pages...');
  
  // If main app uses React Router, generate appropriate Next.js files
  if (mainAppFile && appArchitecture.routingSystem === 'react-router') {
    generateNextJSRoutingStructure(files[mainAppFile], routes, result);
    logConversion('info', `Generated Next.js routing structure from React Router`);
  }
  
  // Convert components, pages, and API routes with smarter mapping
  convertCodeFiles(files, fileAnalysis, routes, componentGraph, patternAnalysis, result, appArchitecture);
  
  // Generate configuration files
  processConfigFiles(allDependencies, result);
  
  // Create required Next.js files
  createDefaultFiles(result);
  
  // Create appropriate wrapper based on app architecture
  createAppWrapper(contextProviders, appArchitecture, result);
  
  // Log conversion completion
  const endTime = Date.now();
  const conversionTime = endTime - startTime;
  
  logConversionStats({
    totalFiles: Object.keys(files).length,
    convertedFiles: Object.keys(result.pages).length + 
                    Object.keys(result.components).length + 
                    Object.keys(result.api).length,
    warnings: 0,
    errors: 0,
    startTime,
    endTime
  });
  
  return result;
};

/**
 * Generate Next.js routing structure from React Router configuration
 */
const generateNextJSRoutingStructure = (
  appFileContent: string,
  routes: Record<string, string>,
  result: ConversionOutput
): void => {
  // Extract Route components from the app file
  const routeMatches = Array.from(
    appFileContent.matchAll(/<Route\s+path=["']([^"']*)["']\s+element={<([^>]*)(\s+\/|\s*>\s*<\/[^>]*>)}/g)
  );
  
  if (routeMatches.length === 0) {
    logConversion('warning', 'Could not extract Route components from app file');
    return;
  }
  
  // Create pages for each route
  routeMatches.forEach(match => {
    const path = match[1];
    const componentName = match[2].trim();
    
    // Skip catch-all routes
    if (path === '*') return;
    
    // Convert route path to Next.js page path
    const pagePath = path === '/' ? 'index' : path.replace(/^\//, '').replace(/\/:[^\/]+/g, '/[id]');
    
    logConversion('info', `Creating Next.js page for route ${path} using component ${componentName}`);
    
    // Add a stub if we don't have the actual component
    if (!result.pages[`${pagePath}.js`] && !result.pages[`${pagePath}.tsx`]) {
      result.pages[`${pagePath}.js`] = `
// Auto-generated page for route: ${path}
import ${componentName} from '../components/${componentName}';

export default function Page() {
  return <${componentName} />;
}
      `;
    }
  });
};

/**
 * Create appropriate app wrapper based on app architecture
 */
const createAppWrapper = (
  contextProviders: string[], 
  appArchitecture: {
    hasStateManagement: boolean;
    stateStrategy: string;
    routingSystem: string;
    dataFetchingPattern: string;
  },
  result: ConversionOutput
): void => {
  // Generate _app.js file with appropriate providers
  let appContent = `
import '../styles/globals.css';
import { AppProps } from 'next/app';

function MyApp({ Component, pageProps }: AppProps) {
  return (
`;

  // Add wrapper components based on architecture
  let wrapped = '    <Component {...pageProps} />';
  
  // Add context providers if needed
  if (contextProviders.length > 0) {
    contextProviders.forEach(provider => {
      const providerName = provider.split('/').pop()?.replace(/\.(jsx?|tsx?)$/, '') || 'Provider';
      appContent = `import { ${providerName} } from '../components/${providerName}';\n` + appContent;
      wrapped = `    <${providerName}>\n      ${wrapped}\n    </${providerName}>`;
    });
  }
  
  // Add Redux provider if needed
  if (appArchitecture.stateStrategy === 'redux') {
    appContent = `import { Provider } from 'react-redux';\nimport { store } from '../store';\n` + appContent;
    wrapped = `    <Provider store={store}>\n      ${wrapped}\n    </Provider>`;
  }
  
  appContent += wrapped + '\n  );\n}\n\nexport default MyApp;\n';
  
  // Add the app file
  result.pages['_app.tsx'] = appContent;
};

/**
 * Detect the dominant data fetching pattern used in the app
 */
const detectDataFetchingPattern = (
  files: UploadedFiles,
  fileAnalysis: Record<string, ReturnType<typeof analyzeComponent>>
): string => {
  let usesUseEffect = 0;
  let usesAsyncAwait = 0;
  let usesThen = 0;
  let usesAxios = 0;
  let usesFetch = 0;
  let usesSWR = 0;
  let usesReactQuery = 0;
  
  Object.entries(fileAnalysis).forEach(([_, analysis]) => {
    if (analysis.dependencies.includes('axios')) usesAxios++;
    if (analysis.dependencies.includes('swr')) usesSWR++;
    if (analysis.dependencies.includes('react-query') || analysis.dependencies.includes('@tanstack/react-query')) usesReactQuery++;
    if (analysis.hooks.includes('useEffect') && analysis.hasDataFetching) usesUseEffect++;
  });
  
  Object.values(files).forEach(content => {
    if (content.includes('async') && content.includes('await') && 
        (content.includes('fetch(') || content.includes('axios'))) {
      usesAsyncAwait++;
    }
    if (content.includes('.then(') && 
        (content.includes('fetch(') || content.includes('axios'))) {
      usesThen++;
    }
    if (content.includes('fetch(')) usesFetch++;
  });
  
  // Determine dominant pattern
  if (usesReactQuery > Math.max(usesSWR, usesUseEffect, usesAxios)) {
    return 'react-query';
  } else if (usesSWR > Math.max(usesReactQuery, usesUseEffect, usesAxios)) {
    return 'swr';
  } else if (usesAxios > usesFetch) {
    return 'axios';
  } else if (usesAsyncAwait > usesThen) {
    return 'async-await';
  } else if (usesThen > 0) {
    return 'promise-then';
  } else {
    return 'mixed';
  }
};

/**
 * Extract routes from route configurations
 */
const extractRoutesFromConfigs = (routeConfigs: Record<string, Record<string, string>>): Record<string, string> => {
  const routes: Record<string, string> = {};
  
  Object.values(routeConfigs).forEach(config => {
    Object.entries(config).forEach(([path, component]) => {
      routes[path] = component;
      logConversion('info', `Found route: ${path} -> ${component}`);
    });
  });
  
  return routes;
};

/**
 * Process static assets (images, fonts, etc)
 */
const processStaticAssets = (files: UploadedFiles, result: ConversionOutput): void => {
  Object.entries(files).forEach(([filename, content]) => {
    if (/\.(jpe?g|png|gif|svg|webp|ico|ttf|woff2?)$/.test(filename)) {
      const assetName = filename.split('/').pop() || filename;
      result.public[assetName] = '[BINARY ASSET]'; // Placeholder for binary assets
      logConversion('info', 'Added static asset to public directory', filename);
    }
  });
};

/**
 * Extract a smart page path from filename and content
 */
const extractSmartPagePath = (
  filename: string, 
  routes: Record<string, string>,
  content: string
): string => {
  // First check routes map for explicit routing
  const routeEntry = Object.entries(routes).find(([_, comp]) => {
    const simpleName = filename.split('/').pop()?.replace(/\.(jsx?|tsx?)$/, '') || '';
    return comp === simpleName || comp.includes(simpleName);
  });
  
  if (routeEntry) {
    const path = routeEntry[0];
    // Normalize path to Next.js conventions
    if (path === '/') return 'index';
    
    // Handle dynamic segments
    return path
      .replace(/^\/+/, '') // Remove leading slashes
      .replace(/\/:[^\/]+/g, '/[id]') // Convert :param to [id]
      .replace(/\/\*$/, '') // Remove trailing wildcard
      .replace(/\//g, '/'); // Keep path separators
  }
  
  // Extract from filename patterns
  let pagePath = filename
    .replace(/\.(jsx?|tsx?)$/, '')
    .replace(/^src[\/\\](pages|views)[\/\\]?/, '')
    .replace(/^(pages|views)[\/\\]?/, '')
    .replace(/^screens[\/\\]?/, '')
    .replace(/[\/\\]index$/, '');
  
  // Extract just the component name for simplicity
  pagePath = pagePath.split(/[\/\\]/).pop() || 'index';
  
  // Analyze content for title or header to identify page purpose
  const titleMatch = content.match(/<h1[^>]*>\s*([^<]+)\s*<\/h1>/);
  const headerMatch = content.match(/<Header[^>]*>\s*([^<]+)\s*<\/Header>/);
  
  // Normalize common patterns
  if (/home/i.test(pagePath) || /^index$/i.test(pagePath)) {
    pagePath = 'index';
  } else if (/about/i.test(pagePath)) {
    pagePath = 'about';
  } else if (/contact/i.test(pagePath)) {
    pagePath = 'contact';
  } else if (/login/i.test(pagePath) || /signin/i.test(pagePath)) {
    pagePath = 'login';
  } else if (/register/i.test(pagePath) || /signup/i.test(pagePath)) {
    pagePath = 'register';
  } else if (/profile/i.test(pagePath) || /account/i.test(pagePath)) {
    pagePath = 'profile';
  } else if (/dashboard/i.test(pagePath)) {
    pagePath = 'dashboard';
  } else if (/product/i.test(pagePath) && /detail/i.test(pagePath)) {
    pagePath = 'products/[id]';
  } else if (/product/i.test(pagePath) && !(/s$/.test(pagePath))) {
    pagePath = 'products';
  } else if (/user/i.test(pagePath) && /detail/i.test(pagePath)) {
    pagePath = 'users/[id]';
  } else if (/user/i.test(pagePath) && !(/s$/.test(pagePath))) {
    pagePath = 'users';
  }
  
  // Check for dynamic paths in content
  if (content.includes('useParams') || content.includes(':id') || 
      content.includes('[id]') || content.includes('match.params')) {
    // This is likely a dynamic route
    if (!pagePath.includes('[')) {
      pagePath = pagePath + '/[id]';
    }
  }
  
  return pagePath;
};

/**
 * Auto-convert fetch in useEffect to getServerSideProps or getStaticProps
 */
const autoConvertFetchToSSR = (content: string, analysis: ReturnType<typeof analyzeComponent>): string => {
  // This is a simplified implementation - a real one would use AST transformation
  // for more accurate results
  
  // Check if the content already has getServerSideProps/getStaticProps
  if (content.includes('getServerSideProps') || content.includes('getStaticProps')) {
    return content;
  }
  
  // Check if there's a fetch inside useEffect
  const hasFetchInEffect = content.includes('useEffect') && 
    (content.includes('fetch(') || content.includes('axios.get('));
  
  if (!hasFetchInEffect) {
    return content;
  }
  
  // Try to identify the URL pattern
  const urlPattern = content.match(/fetch\(['"]([^'"]+)['"]\)/)?.[1] || 
                    content.match(/axios\.get\(['"]([^'"]+)['"]\)/)?.[1] || 
                    'https://api.example.com/data';
  
  // Try to identify the state variable being set
  const setStateMatch = content.match(/set([A-Z][a-zA-Z]*)\(/);
  const stateVarName = setStateMatch ? 
    setStateMatch[1].charAt(0).toLowerCase() + setStateMatch[1].slice(1) : 
    'data';
  
  // Check if the URL appears to be dynamic (has params or search query)
  const isDynamic = urlPattern.includes('${') || 
                    urlPattern.includes('/[') || 
                    urlPattern.includes('/:') ||
                    urlPattern.includes('?') ||
                    content.includes('params') ||
                    content.includes('useParams');
  
  // Choose between SSR and SSG based on URL dynamics
  const dataFetchingMethod = isDynamic ? 'getServerSideProps' : 'getStaticProps';
  
  // Create the data fetching function
  const ssrFunction = `
export async function ${dataFetchingMethod}() {
  // Fetch data from external API
  const res = await fetch("${urlPattern}");
  const ${stateVarName} = await res.json();
  
  // Pass data to the page via props
  return {
    props: { ${stateVarName} },
    ${!isDynamic ? 'revalidate: 60,' : ''}
  };
}
`;
  
  // Modify component to use props
  let modifiedContent = content;
  
  // If it's a function declaration, update the parameter list
  if (content.includes('function ')) {
    modifiedContent = modifiedContent.replace(
      /function\s+([A-Za-z0-9_]+)\s*\([^)]*\)/,
      `function $1({ ${stateVarName} })`
    );
  } else if (content.includes('=>')) {
    // If it's an arrow function, update the parameter list
    modifiedContent = modifiedContent.replace(
      /const\s+([A-Za-z0-9_]+)\s*=\s*\([^)]*\)\s*=>/,
      `const $1 = ({ ${stateVarName} }) =>`
    );
  }
  
  // Remove the useEffect and useState for this data
  // This is simplified and would need proper AST manipulation for production
  const useStateRegex = new RegExp(`const\\s*\\[${stateVarName},\\s*set[A-Z][a-zA-Z]*\\]\\s*=\\s*useState[\\s\\S]*?;`);
  modifiedContent = modifiedContent.replace(useStateRegex, '');
  
  // Try to remove the useEffect that does the fetching
  // This is a simplified approach
  const useEffectRegex = /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*?fetch\([\s\S]*?\}\s*,\s*\[\s*\]\s*\);/;
  modifiedContent = modifiedContent.replace(useEffectRegex, '');
  
  // Add the SSR function
  modifiedContent += '\n' + ssrFunction;
  
  return modifiedContent;
};

/**
 * Convert code files (components, pages, API routes)
 */
const convertCodeFiles = (
  files: UploadedFiles,
  fileAnalysis: Record<string, ReturnType<typeof analyzeComponent>>,
  routes: Record<string, string>,
  componentGraph: Record<string, string[]>,
  patternAnalysis: Record<string, { patterns: string[], complexity: string, suggestions: string[] }>,
  result: ConversionOutput,
  appArchitecture: {
    hasStateManagement: boolean;
    stateStrategy: string;
    routingSystem: string;
    dataFetchingPattern: string;
  }
): void => {
  // Track which files we've already processed to avoid duplicates
  const processedFiles = new Set<string>();
  
  // First, identify and process page components
  Object.entries(fileAnalysis).forEach(([filename, analysis]) => {
    // Skip if already processed
    if (processedFiles.has(filename)) return;
    
    // Determine file extension (preserve .tsx/.jsx)
    const extension = /\.(tsx|jsx)$/.test(filename) 
      ? filename.match(/\.(tsx|jsx)$/)?.[1] || '.js' 
      : analysis.isTypescript ? '.tsx' : '.jsx';
    
    try {
      // If this was previously identified as a page, or it's in a routes config
      const isExplicitPage = analysis.fileType === 'page' || Object.values(routes).includes(filename);
      
      // Or it's not imported by others but does import others (potential page)
      const notImportedByOthers = Object.values(componentGraph).every(deps => !deps.includes(filename));
      const importsOthers = componentGraph[filename] && componentGraph[filename].length > 0;
      const isPotentialPage = notImportedByOthers && importsOthers;
      
      // Or it contains routing patterns
      const hasRoutingPatterns = analysis.hasRouting || (patternAnalysis[filename]?.patterns || []).includes('router-hooks');
      
      if (isExplicitPage || isPotentialPage || hasRoutingPatterns) {
        // Convert page
        convertPageFile(filename, files[filename], analysis, routes, extension, result, appArchitecture);
        processedFiles.add(filename);
      }
    } catch (error) {
      logConversion('error', `Error processing potential page ${filename}: ${(error as Error).message}`);
    }
  });
  
  // Then process the remaining files
  Object.entries(files).forEach(([filename, content]) => {
    // Skip if already processed or not a code file
    if (processedFiles.has(filename) || !/\.(jsx?|tsx?)$/.test(filename)) return;
    
    const analysis = fileAnalysis[filename];
    
    // Skip non-code files
    if (!analysis) return;
    
    // Determine file extension (preserve .tsx/.jsx)
    const extension = /\.(tsx|jsx)$/.test(filename) 
      ? filename.match(/\.(tsx|jsx)$/)?.[1] || '.js' 
      : analysis.isTypescript ? '.tsx' : '.jsx';
    
    try {
      // Detect file type if not already analyzed
      const fileType = analysis.fileType || detectFileType(content, filename);
      
      // Process file based on its detected type
      switch (fileType) {
        case 'component':
          convertComponentFile(filename, content, analysis, extension, result, appArchitecture);
          break;
        
        case 'api':
          convertApiFile(filename, content, result);
          break;
        
        case 'layout':
          convertLayoutFile(filename, content, analysis, extension, result, appArchitecture);
          break;
        
        case 'context':
          convertContextFile(filename, content, analysis, extension, result);
          break;
        
        case 'store':
        case 'reducer':
          convertStateManagementFile(filename, content, analysis, extension, result);
          break;
        
        case 'hook':
          convertHookFile(filename, content, analysis, extension, result);
          break;
        
        case 'util':
        case 'config':
          preserveUtilityFile(filename, content, analysis, extension, result);
          break;
        
        default:
          preserveUnknownFile(filename, content, extension, result);
      }
      
      processedFiles.add(filename);
    } catch (error) {
      handleConversionError(error, filename, content, result);
    }
  });
};

/**
 * Convert a page file
 */
const convertPageFile = (
  filename: string,
  content: string,
  analysis: ReturnType<typeof analyzeComponent>,
  routes: Record<string, string>,
  extension: string,
  result: ConversionOutput,
  appArchitecture: {
    hasStateManagement: boolean;
    stateStrategy: string;
    routingSystem: string;
    dataFetchingPattern: string;
  }
): void => {
  // Calculate page path (new smart extraction)
  let pagePath = extractSmartPagePath(filename, routes, content);
  
  // Analyze component patterns for better conversion
  try {
    const componentPatterns = identifyComponentPatterns(content);
    
    // If this has client-side data fetching and Next.js SSR would be beneficial
    if (componentPatterns.patterns.includes('side-effects') && 
        content.includes('fetch(') || 
        content.includes('axios')) {
      
      // Add automatic conversion of fetch to getServerSideProps
      if (appArchitecture.dataFetchingPattern === 'async-await' || 
          appArchitecture.dataFetchingPattern === 'promise-then') {
        content = autoConvertFetchToSSR(content, analysis);
        logConversion('info', `Automatically converted client-side fetch to getServerSideProps in ${filename}`);
      }
    }
  } catch (error) {
    logConversion('warning', `Could not analyze patterns for page ${filename}: ${(error as Error).message}`);
  }
  
  // If using React Router, convert it to Next.js
  if (analysis.hasRouting || content.includes('useNavigate') || 
      content.includes('useHistory') || content.includes('useLocation')) {
    content = convertReactRouterToNextRouter(content);
    logConversion('info', `Converted React Router code to Next.js in page ${filename}`);
  }
  
  // Convert the page content
  const convertedPage = convertToNextPage(content, pagePath, analysis);
  
  // Store in the result
  result.pages[`${pagePath}${extension}`] = convertedPage;
  logConversion('success', `Converted page: ${pagePath}`, filename);
};

/**
 * Convert a component file
 */
const convertComponentFile = (
  filename: string,
  content: string,
  analysis: ReturnType<typeof analyzeComponent>,
  extension: string,
  result: ConversionOutput,
  appArchitecture: {
    hasStateManagement: boolean;
    stateStrategy: string;
    routingSystem: string;
    dataFetchingPattern: string;
  }
): void => {
  // Extract component name from filename
  const componentName = filename.split(/[\/\\]/).pop()?.replace(/\.(jsx?|tsx?)$/, '') || 'Component';
  
  // Convert regular component
  const convertedComponent = convertComponent(content, analysis);
  result.components[`${componentName}${extension}`] = convertedComponent;
  logConversion('success', `Converted component: ${componentName}`, filename);
};

/**
 * Convert an API file
 */
const convertApiFile = (
  filename: string,
  content: string,
  result: ConversionOutput
): void => {
  // Extract API route name from filename
  const apiName = filename.split(/[\/\\]/).pop()?.replace(/\.(jsx?|tsx?)$/, '') || 'api';
  
  // Convert API endpoint
  const convertedApi = convertToNextApi(content, apiName);
  result.api[`${apiName}.js`] = convertedApi;
  logConversion('success', `Converted API endpoint: ${apiName}`, filename);
};

/**
 * Convert a layout file
 */
const convertLayoutFile = (
  filename: string,
  content: string,
  analysis: ReturnType<typeof analyzeComponent>,
  extension: string,
  result: ConversionOutput,
  appArchitecture: {
    hasStateManagement: boolean;
    stateStrategy: string;
    routingSystem: string;
    dataFetchingPattern: string;
  }
): void => {
  // Extract layout name from filename
  const layoutName = filename.split(/[\/\\]/).pop()?.replace(/\.(jsx?|tsx?)$/, '') || 'Layout';
  
  // Convert layout component
  const convertedLayout = convertComponent(content, analysis);
  result.components[`${layoutName}${extension}`] = convertedLayout;
  
  // Create _app file if it's the main layout
  if (/main|app|root/i.test(layoutName)) {
    const appExt = analysis.isTypescript ? '.tsx' : '.js';
    const appComponent = `
import '../styles/globals.css';
import type { AppProps } from 'next/app';
import ${layoutName} from '../components/${layoutName}';

${analysis.isTypescript ? 'import React from \'react\';\n\n' : ''}function MyApp({ Component, pageProps }: ${analysis.isTypescript ? 'AppProps' : 'any'}) {
  return (
    <${layoutName}>
      <Component {...pageProps} />
    </${layoutName}>
  );
}

export default MyApp;
`;
    result.pages[`_app${appExt}`] = appComponent;
    logConversion('success', 'Created _app with main layout', filename);
  }
  
  logConversion('success', `Converted layout: ${layoutName}`, filename);
};

/**
 * Convert a context provider file
 */
const convertContextFile = (
  filename: string,
  content: string,
  analysis: ReturnType<typeof analyzeComponent>,
  extension: string,
  result: ConversionOutput
): void => {
  // Extract context name from filename
  const contextName = filename.split(/[\/\\]/).pop()?.replace(/\.(jsx?|tsx?)$/, '') || 'Context';
  
  // In Next.js, context providers typically go in contexts/ or lib/ directories
  result.components[`contexts/${contextName}${extension}`] = content;
  logConversion('success', `Converted context provider: ${contextName}`, filename);
};

/**
 * Convert a state management file (Redux, etc.)
 */
const convertStateManagementFile = (
  filename: string,
  content: string,
  analysis: ReturnType<typeof analyzeComponent>,
  extension: string,
  result: ConversionOutput
): void => {
  // Extract file name
  const stateFileName = filename.split(/[\/\\]/).pop()?.replace(/\.(jsx?|tsx?)$/, '') || 'state';
  
  // In Next.js, state management files typically go in store/ or lib/ directories
  result.components[`store/${stateFileName}${extension}`] = content;
  logConversion('success', `Converted state management file: ${stateFileName}`, filename);
};

/**
 * Convert a React hook file to Next.js
 */
const convertHookFile = (
  filename: string,
  content: string,
  analysis: ReturnType<typeof analyzeComponent>,
  extension: string,
  result: ConversionOutput
): void => {
  // Extract hook name from filename
  const hookName = filename.split(/[\/\\]/).pop()?.replace(/\.(jsx?|tsx?)$/, '') || 'hook';
  
  // Apply transformations, including the new asset transformations
  let convertedHook = content;
  
  // Apply Next.js-specific transformations
  convertedHook = convertToNextHook(convertedHook, hookName, analysis);
  
  // Add the hook to the output
  result.components[`hooks/${hookName}${extension}`] = convertedHook;
  logConversion('success', `Converted hook: ${hookName}`, filename);
};

/**
 * Preserve utility files (utils, config, hooks)
 */
const preserveUtilityFile = (
  filename: string,
  content: string,
  analysis: ReturnType<typeof analyzeComponent>,
  extension: string,
  result: ConversionOutput
): void => {
  const utilName = filename.split(/[\/\\]/).pop()?.replace(/\.(jsx?|tsx?)$/, '') || 'util';
  
  if (/api|service|http|axios|fetch/.test(filename)) {
    // This is likely an API service utility
    result.components[`${utilName}${extension}`] = content;
    logConversion('info', `Preserved API service: ${utilName}`, filename);
  } else if (/hook|use[A-Z]/.test(filename)) {
    // This is a custom hook
    result.components[`${utilName}${extension}`] = content;
    logConversion('info', `Preserved custom hook: ${utilName}`, filename);
  } else {
    // General utility or config file
    result.components[`${utilName}${extension}`] = content;
    logConversion('info', `Preserved utility: ${utilName}`, filename);
  }
};

/**
 * Preserve unknown file types
 */
const preserveUnknownFile = (
  filename: string,
  content: string,
  extension: string,
  result: ConversionOutput
): void => {
  const fileName = filename.split(/[\/\\]/).pop()?.replace(/\.(jsx?|tsx?)$/, '') || 'file';
  result.components[`${fileName}${extension}`] = content;
  logConversion('warning', `Preserved file of unknown type: ${fileName}`, filename);
};

/**
 * Handle conversion errors
 */
const handleConversionError = (
  error: unknown,
  filename: string,
  content: string,
  result: ConversionOutput
): void => {
  logConversion('error', `Failed to convert file: ${(error as Error).message}`, filename);
  
  // Still preserve the file to avoid data loss
  const fallbackName = filename.split(/[\/\\]/).pop() || 'error-file';
  result.components[fallbackName] = content;
};

/**
 * Log conversion statistics
 */
const logConversionStats = (stats: ConversionStats): void => {
  logConversion(
    'success', 
    `Conversion completed in ${stats.endTime - stats.startTime}ms. ` +
    `Processed ${stats.totalFiles} files, ` +
    `converted ${stats.convertedFiles} files, ` +
    `with ${stats.warnings} warnings and ${stats.errors} errors.`
  );
};
