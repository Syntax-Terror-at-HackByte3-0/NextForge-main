
/**
 * Identifies entry points for a React application
 */
import { UploadedFiles } from '@/types/conversion';
import { parseCode, extractImports, extractExports } from './analysis/astUtils';
import { logConversion } from './logger';

/**
 * Identify entry points and key files in the React application
 */
export const identifyEntryPoints = (files: UploadedFiles): {
  entryPointFiles: string[];
  mainAppFile: string | null;
  routeConfigFile: string | null;
  contextProviders: string[];
  rootComponents: string[];
  appStructure: {
    hasRouter: boolean;
    hasRedux: boolean;
    hasContextAPI: boolean;
    entryComponent: string | null;
    routingType: 'react-router' | 'next-router' | 'custom' | 'none';
  };
} => {
  let entryPointFiles: string[] = [];
  let mainAppFile: string | null = null;
  let routeConfigFile: string | null = null;
  let contextProviders: string[] = [];
  let rootComponents: string[] = [];
  
  // App structure analysis
  const appStructure = {
    hasRouter: false,
    hasRedux: false,
    hasContextAPI: false,
    entryComponent: null as string | null,
    routingType: 'none' as 'react-router' | 'next-router' | 'custom' | 'none'
  };
  
  // Find potential entry points and routing configuration files
  Object.entries(files).forEach(([filename, content]) => {
    // Skip non-JavaScript/TypeScript files
    if (!/\.(js|jsx|ts|tsx)$/.test(filename)) {
      return;
    }
    
    // Check if this is potentially an entry point
    if (filename.includes('index.') || 
        filename.includes('main.') || 
        filename.includes('app.') ||
        filename.includes('App.')) {
      entryPointFiles.push(filename);
      
      // Check for root component indicators
      if (content.includes('render(') || 
          content.includes('createRoot') || 
          content.includes('ReactDOM.render') ||
          content.includes('document.getElementById("root")')) {
        rootComponents.push(filename);
        appStructure.entryComponent = filename;
        logConversion('info', `Found root component: ${filename}`);
      }
      
      // If this contains React Router setup, it's likely the main app file
      if (content.includes('<Router') || 
          content.includes('<BrowserRouter') || 
          content.includes('createBrowserRouter') ||
          content.includes('<Route')) {
        mainAppFile = filename;
        appStructure.hasRouter = true;
        appStructure.routingType = 'react-router';
        logConversion('info', `Found React Router configuration in ${filename}`);
      }
      
      // Check for Next.js specific patterns
      if (content.includes('next/router') || 
          content.includes('next/link') ||
          content.includes('_app') ||
          content.includes('getStaticProps') ||
          content.includes('getServerSideProps')) {
        mainAppFile = filename;
        appStructure.hasRouter = true;
        appStructure.routingType = 'next-router';
        logConversion('info', `Found Next.js router patterns in ${filename}`);
      }
      
      // Check for Redux
      if (content.includes('Provider') && 
          content.includes('store') &&
          (content.includes('createStore') || content.includes('configureStore'))) {
        appStructure.hasRedux = true;
        logConversion('info', `Found Redux integration in ${filename}`);
      }
      
      // Check for Context API at the top level
      if (content.includes('createContext') || 
          (content.includes('<') && content.includes('Context.Provider'))) {
        appStructure.hasContextAPI = true;
        logConversion('info', `Found Context API usage in ${filename}`);
      }
    }
    
    // Check for routing configuration
    if ((content.includes('<Route') && 
         (content.includes('<Routes') || 
          content.includes('<Switch') || 
          content.includes('createBrowserRouter'))) ||
        (content.includes('next/router') && 
         content.includes('useRouter'))) {
      routeConfigFile = filename;
    }
    
    // Check for context providers - prioritize files with Context in the name
    if (filename.includes('Context') || filename.includes('Provider')) {
      contextProviders.push(filename);
    } else if (content.includes('createContext') && 
        (content.includes('Provider') || content.includes('useContext'))) {
      contextProviders.push(filename);
    }
  });
  
  // Analyze imports of root components to understand dependencies
  rootComponents.forEach(rootComponentFile => {
    try {
      const content = files[rootComponentFile];
      if (!content) return;
      
      const ast = parseCode(content);
      const imports = extractImports(ast);
      
      // Check imported components to identify main app structure
      imports.forEach(importInfo => {
        // Look for app component imports
        if (importInfo.source.includes('App') || 
            importInfo.source.includes('app') ||
            importInfo.source.includes('Root') || 
            importInfo.source.includes('root')) {
          
          // This component is likely the main app wrapper
          const targetFileName = Object.keys(files).find(filename => 
            filename.includes(importInfo.source) || 
            filename.endsWith(`${importInfo.source}.js`) || 
            filename.endsWith(`${importInfo.source}.jsx`) || 
            filename.endsWith(`${importInfo.source}.ts`) || 
            filename.endsWith(`${importInfo.source}.tsx`));
            
          if (targetFileName && !mainAppFile) {
            mainAppFile = targetFileName;
            logConversion('info', `Found main app component through imports: ${targetFileName}`);
          }
        }
      });
    } catch (error) {
      logConversion('warning', `Failed to analyze root component ${rootComponentFile}: ${(error as Error).message}`);
    }
  });
  
  // If we still haven't found the main app file but have entry points
  if (!mainAppFile && entryPointFiles.length > 0) {
    // Select the most likely main app file based on naming conventions
    const appCandidates = entryPointFiles.filter(f => 
      f.includes('App.') || f.includes('app.') || f.includes('Main.')
    );
    
    if (appCandidates.length > 0) {
      mainAppFile = appCandidates[0];
      logConversion('info', `Selected ${mainAppFile} as main app file based on naming convention`);
    } else {
      // Default to the first entry point
      mainAppFile = entryPointFiles[0];
      logConversion('info', `Defaulting to ${mainAppFile} as main app file`);
    }
  }
  
  logConversion('info', `Identified ${entryPointFiles.length} entry points, ${contextProviders.length} context providers`);
  
  return {
    entryPointFiles,
    mainAppFile,
    routeConfigFile,
    contextProviders,
    rootComponents,
    appStructure
  };
};

/**
 * Determine app initialization pattern from entry files
 */
export const determineAppInitialization = (files: UploadedFiles): {
  renderMethod: 'legacy' | 'createRoot' | 'hydrate' | 'unknown';
  rootElement: string | null;
  entryFile: string | null;
} => {
  let renderMethod: 'legacy' | 'createRoot' | 'hydrate' | 'unknown' = 'unknown';
  let rootElement: string | null = null;
  let entryFile: string | null = null;
  
  // Common entry file names
  const potentialEntryFiles = Object.keys(files).filter(filename => 
    filename.includes('index.') || 
    filename.includes('main.') || 
    filename.endsWith('index.js') || 
    filename.endsWith('index.tsx')
  );
  
  for (const filename of potentialEntryFiles) {
    const content = files[filename];
    
    if (content.includes('ReactDOM.createRoot')) {
      renderMethod = 'createRoot';
      entryFile = filename;
      // Extract root element id
      const rootMatch = content.match(/document\.getElementById\(['"]([^'"]+)['"]\)/);
      if (rootMatch) rootElement = rootMatch[1];
      break;
    } else if (content.includes('ReactDOM.render')) {
      renderMethod = 'legacy';
      entryFile = filename;
      // Extract root element id
      const rootMatch = content.match(/document\.getElementById\(['"]([^'"]+)['"]\)/);
      if (rootMatch) rootElement = rootMatch[1];
      break;
    } else if (content.includes('ReactDOM.hydrate')) {
      renderMethod = 'hydrate';
      entryFile = filename;
      // Extract root element id
      const rootMatch = content.match(/document\.getElementById\(['"]([^'"]+)['"]\)/);
      if (rootMatch) rootElement = rootMatch[1];
      break;
    }
  }
  
  return { renderMethod, rootElement, entryFile };
};
