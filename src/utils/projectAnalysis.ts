/**
 * Utility functions for analyzing project structure
 */
import { detectFileType } from './conversion/analysis/fileTypeDetector';

/**
 * Analyze project structure
 */
export const analyzeProjectStructure = (files: Record<string, string>): {
  componentCount: number;
  pageCount: number;
  hasRouting: boolean;
  dependencies: string[];
  hasTypeScript: boolean;
  mainEntryFile: string | null;
  dataFetchingPatterns: string[];
  stateManagement: string[];
  cssFrameworks: string[];
  contextProviders: string[];
} => {
  let componentCount = 0;
  let pageCount = 0;
  let hasRouting = false;
  let hasTypeScript = false;
  const dependencies: string[] = [];
  const dataFetchingPatterns: string[] = [];
  const stateManagement: string[] = [];
  const cssFrameworks: string[] = [];
  const contextProviders: string[] = [];
  let mainEntryFile: string | null = null;
  
  // First pass: analyze package.json to identify dependencies
  Object.entries(files).forEach(([filename, content]) => {
    if (filename === 'package.json' || filename.endsWith('/package.json')) {
      try {
        const packageJson = JSON.parse(content);
        
        // Extract dependencies
        if (packageJson.dependencies) {
          Object.keys(packageJson.dependencies).forEach(dep => {
            dependencies.push(dep);
            
            // Detect state management libraries
            if (['redux', 'mobx', 'recoil', 'zustand', 'jotai'].includes(dep)) {
              stateManagement.push(dep);
            }
            
            // Detect CSS frameworks
            if (['tailwindcss', 'styled-components', 'emotion', 'sass', 'less', 'bootstrap', 'material-ui', '@mui/material', 'chakra-ui', '@chakra-ui/react'].includes(dep)) {
              cssFrameworks.push(dep);
            }
          });
        }
        
        // Check dev dependencies too
        if (packageJson.devDependencies) {
          Object.keys(packageJson.devDependencies).forEach(dep => {
            dependencies.push(dep);
            if (['typescript', 'ts-node', '@types/react'].includes(dep)) {
              hasTypeScript = true;
            }
          });
        }
      } catch (error) {
        console.error('Error parsing package.json:', error);
      }
    }
  });
  
  // Second pass: identify entry points and component structure
  Object.entries(files).forEach(([filename, content]) => {
    // Check for TypeScript
    if (filename.endsWith('.ts') || filename.endsWith('.tsx')) {
      hasTypeScript = true;
    }
    
    // Identify main entry file
    if (
      (filename.includes('index.') || filename.includes('main.') || filename.includes('App.')) && 
      (filename.includes('src/') || filename.includes('src\\'))
    ) {
      if (content.includes('ReactDOM.render') || content.includes('createRoot') || content.includes('<App')) {
        mainEntryFile = filename;
      }
    }
    
    // Use the file type detector for more accurate categorization
    const fileType = detectFileType(content, filename);
    
    // Process based on detected file type
    switch (fileType) {
      case 'component':
        componentCount++;
        break;
      case 'page':
        pageCount++;
        break;
      case 'context':
        contextProviders.push(filename);
        break;
    }
    
    // Check for routing
    if (
      content.includes('react-router') || 
      content.includes('<Route') || 
      content.includes('<BrowserRouter') || 
      content.includes('<Router') ||
      content.includes('<Switch') ||
      content.includes('useNavigate') ||
      content.includes('useParams') ||
      content.includes('useHistory') ||
      content.includes('createBrowserRouter') ||
      content.includes('<Link to=')
    ) {
      hasRouting = true;
    }
    
    // Detect data fetching patterns
    if (content.includes('fetch(') || content.includes('axios.') || content.includes('useQuery')) {
      if (content.includes('useQuery') || content.includes('useMutation')) {
        dataFetchingPatterns.push('react-query');
      } else if (content.includes('axios')) {
        dataFetchingPatterns.push('axios');
      } else {
        dataFetchingPatterns.push('fetch');
      }
    }
    
    // Detect Redux patterns
    if (
      content.includes('useSelector') || 
      content.includes('useDispatch') || 
      content.includes('createSlice') ||
      content.includes('createStore') ||
      content.includes('combineReducers')
    ) {
      if (!stateManagement.includes('redux')) {
        stateManagement.push('redux');
      }
    }
    
    // Detect Context API usage
    if (content.includes('createContext') || content.includes('useContext')) {
      if (!stateManagement.includes('context-api')) {
        stateManagement.push('context-api');
      }
    }
  });
  
  // Remove duplicates
  const uniqueDataFetchingPatterns = [...new Set(dataFetchingPatterns)];
  const uniqueStateManagement = [...new Set(stateManagement)];
  const uniqueCssFrameworks = [...new Set(cssFrameworks)];
  
  return {
    componentCount,
    pageCount,
    hasRouting,
    dependencies,
    hasTypeScript,
    mainEntryFile,
    dataFetchingPatterns: uniqueDataFetchingPatterns,
    stateManagement: uniqueStateManagement,
    cssFrameworks: uniqueCssFrameworks,
    contextProviders
  };
};

/**
 * Detect project structure type (monolith, monorepo, etc)
 */
export const detectProjectStructure = (files: Record<string, string>): 'monolith' | 'monorepo' | 'next-hybrid' | 'unknown' => {
  // Check for monorepo patterns
  const hasLernaJson = Object.keys(files).some(file => file === 'lerna.json');
  const hasPackagesDir = Object.keys(files).some(file => file.startsWith('packages/') || file.startsWith('packages\\'));
  let hasWorkspaces = false;  // Changed from const to let
  
  // Check package.json for workspaces
  const packageJsonFile = Object.keys(files).find(file => file === 'package.json');
  if (packageJsonFile && files[packageJsonFile]) {
    try {
      const packageJson = JSON.parse(files[packageJsonFile]);
      if (packageJson.workspaces) {
        hasWorkspaces = true;
      }
    } catch (error) {
      console.error('Error parsing package.json:', error);
    }
  }
  
  // Check for Next.js hybrid patterns
  const hasNextConfig = Object.keys(files).some(file => file === 'next.config.js' || file === 'next.config.ts');
  const hasPagesDir = Object.keys(files).some(file => file.startsWith('pages/') || file.startsWith('pages\\'));
  
  if (hasNextConfig && hasPagesDir) {
    return 'next-hybrid';
  }
  
  if (hasLernaJson || hasPackagesDir || hasWorkspaces) {
    return 'monorepo';
  }
  
  // Default to monolith if we found src dir
  const hasSrcDir = Object.keys(files).some(file => file.startsWith('src/') || file.startsWith('src\\'));
  if (hasSrcDir) {
    return 'monolith';
  }
  
  return 'unknown';
};

