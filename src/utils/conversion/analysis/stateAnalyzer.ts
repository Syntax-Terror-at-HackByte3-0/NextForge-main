
/**
 * Analyze state management patterns in a React project
 */
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { UploadedFiles } from '@/types/conversion';
import { logConversion } from '../logger';

/**
 * Result of state management analysis
 */
export interface StateAnalysisResult {
  dominantPattern: string;
  globalStateFiles: string[];
  localStateFiles: string[];
  contextProviders: string[];
  reduxStores: string[];
  reduxReducers: string[];
  reduxActions: string[];
  mobxStores: string[];
  zustandStores: string[];
  recoilAtoms: string[];
  jotaiAtoms: string[];
  usesReactQuery: boolean;
  usesSWR: boolean;
  recommendations: string[];
  hasClientStateInServerComponents: boolean;
}

/**
 * Analyze state management patterns in a project
 */
export const analyzeStateManagement = (files: UploadedFiles): StateAnalysisResult => {
  const result: StateAnalysisResult = {
    dominantPattern: 'local-state',
    globalStateFiles: [],
    localStateFiles: [],
    contextProviders: [],
    reduxStores: [],
    reduxReducers: [],
    reduxActions: [],
    mobxStores: [],
    zustandStores: [],
    recoilAtoms: [],
    jotaiAtoms: [],
    usesReactQuery: false,
    usesSWR: false,
    recommendations: [],
    hasClientStateInServerComponents: false
  };
  
  try {
    // Placeholder implementation - this will be expanded
    const localStateCount = detectLocalStateUsage(files);
    const reduxCount = detectReduxUsage(files, result);
    const contextCount = detectContextUsage(files, result);
    const reactQueryCount = detectReactQueryUsage(files);
    const swrCount = detectSWRUsage(files);
    const zustandCount = detectZustandUsage(files, result);
    const recoilCount = detectRecoilUsage(files, result);
    const jotaiCount = detectJotaiUsage(files, result);
    const mobxCount = detectMobxUsage(files, result);
    
    // Determine dominant pattern
    const counts = [
      { name: 'local-state', count: localStateCount },
      { name: 'redux', count: reduxCount },
      { name: 'context', count: contextCount },
      { name: 'react-query', count: reactQueryCount },
      { name: 'swr', count: swrCount },
      { name: 'zustand', count: zustandCount },
      { name: 'recoil', count: recoilCount },
      { name: 'jotai', count: jotaiCount },
      { name: 'mobx', count: mobxCount }
    ].sort((a, b) => b.count - a.count);
    
    result.dominantPattern = counts[0].count > 0 ? counts[0].name : 'local-state';
    
    // Generate recommendations based on analysis
    generateRecommendations(result);
    
    // Check for client state in potential server components
    detectClientStateInServerComponents(files, result);
    
    return result;
  } catch (error) {
    console.error('Error analyzing state management:', error);
    logConversion('error', `Error analyzing state management: ${(error as Error).message}`);
    return result;
  }
};

/**
 * Detect usage of useState, useReducer in files
 */
const detectLocalStateUsage = (files: UploadedFiles): number => {
  let count = 0;
  
  for (const [filePath, content] of Object.entries(files)) {
    if (content.includes('useState(') || content.includes('useReducer(')) {
      count++;
    }
  }
  
  return count;
};

/**
 * Detect Redux usage in files
 */
const detectReduxUsage = (files: UploadedFiles, result: StateAnalysisResult): number => {
  let count = 0;
  
  for (const [filePath, content] of Object.entries(files)) {
    if (content.includes('createStore') || 
        content.includes('configureStore') || 
        content.includes('useSelector') || 
        content.includes('useDispatch') || 
        content.includes('connect(')) {
      count++;
      
      // Categorize Redux files
      if (content.includes('createStore') || content.includes('configureStore')) {
        result.reduxStores.push(filePath);
      } else if (content.includes('createSlice') || content.includes('combineReducers')) {
        result.reduxReducers.push(filePath);
      } else if (content.includes('createAction') || /export const \w+ = \(\) =>/.test(content)) {
        result.reduxActions.push(filePath);
      }
      
      result.globalStateFiles.push(filePath);
    }
  }
  
  return count;
};

/**
 * Detect Context API usage in files
 */
const detectContextUsage = (files: UploadedFiles, result: StateAnalysisResult): number => {
  let count = 0;
  
  for (const [filePath, content] of Object.entries(files)) {
    if (content.includes('createContext') || 
        content.includes('useContext') || 
        content.includes('Context.Provider')) {
      count++;
      
      if (content.includes('createContext')) {
        result.contextProviders.push(filePath);
        result.globalStateFiles.push(filePath);
      } else if (content.includes('useContext')) {
        result.localStateFiles.push(filePath);
      }
    }
  }
  
  return count;
};

/**
 * Detect React Query usage
 */
const detectReactQueryUsage = (files: UploadedFiles): number => {
  let count = 0;
  
  for (const [_, content] of Object.entries(files)) {
    if (content.includes('useQuery(') || 
        content.includes('useMutation(') || 
        content.includes('import { useQuery }') || 
        content.includes('import { QueryClient }')) {
      count++;
    }
  }
  
  return count;
};

/**
 * Detect SWR usage
 */
const detectSWRUsage = (files: UploadedFiles): number => {
  let count = 0;
  
  for (const [_, content] of Object.entries(files)) {
    if (content.includes('useSWR') || 
        content.includes('import useSWR') || 
        content.includes('from \'swr\'')) {
      count++;
    }
  }
  
  return count;
};

/**
 * Detect Zustand usage
 */
const detectZustandUsage = (files: UploadedFiles, result: StateAnalysisResult): number => {
  let count = 0;
  
  for (const [filePath, content] of Object.entries(files)) {
    if (content.includes('create(') || 
        content.includes('createStore') || 
        content.includes('import create from \'zustand\'') || 
        content.includes('import { create } from \'zustand\'')) {
      count++;
      result.zustandStores.push(filePath);
      result.globalStateFiles.push(filePath);
    }
  }
  
  return count;
};

/**
 * Detect Recoil usage
 */
const detectRecoilUsage = (files: UploadedFiles, result: StateAnalysisResult): number => {
  let count = 0;
  
  for (const [filePath, content] of Object.entries(files)) {
    if (content.includes('atom(') || 
        content.includes('selector(') || 
        content.includes('useRecoilState') || 
        content.includes('useRecoilValue')) {
      count++;
      
      if (content.includes('atom(')) {
        result.recoilAtoms.push(filePath);
        result.globalStateFiles.push(filePath);
      } else {
        result.localStateFiles.push(filePath);
      }
    }
  }
  
  return count;
};

/**
 * Detect Jotai usage
 */
const detectJotaiUsage = (files: UploadedFiles, result: StateAnalysisResult): number => {
  let count = 0;
  
  for (const [filePath, content] of Object.entries(files)) {
    if (content.includes('atom(') || 
        content.includes('useAtom') || 
        content.includes('import { atom }') || 
        content.includes('from \'jotai\'')) {
      count++;
      
      if (content.includes('atom(')) {
        result.jotaiAtoms.push(filePath);
        result.globalStateFiles.push(filePath);
      } else {
        result.localStateFiles.push(filePath);
      }
    }
  }
  
  return count;
};

/**
 * Detect MobX usage
 */
const detectMobxUsage = (files: UploadedFiles, result: StateAnalysisResult): number => {
  let count = 0;
  
  for (const [filePath, content] of Object.entries(files)) {
    if (content.includes('observable') || 
        content.includes('action') || 
        content.includes('computed') || 
        content.includes('makeObservable') || 
        content.includes('makeAutoObservable') || 
        content.includes('observer(')) {
      count++;
      
      if (content.includes('class') && 
          (content.includes('observable') || content.includes('makeObservable'))) {
        result.mobxStores.push(filePath);
        result.globalStateFiles.push(filePath);
      } else {
        result.localStateFiles.push(filePath);
      }
    }
  }
  
  return count;
};

/**
 * Generate recommendations based on detected state patterns
 */
const generateRecommendations = (result: StateAnalysisResult): void => {
  const recommendations: string[] = [];
  
  switch (result.dominantPattern) {
    case 'redux':
      recommendations.push('Consider using Redux Toolkit for simpler Redux setup in Next.js');
      recommendations.push('Add "use client" directive to all Redux connected components');
      break;
    case 'context':
      recommendations.push('Centralize Context providers in a custom _app.js/_app.tsx file');
      recommendations.push('Add "use client" directive to context provider components');
      break;
    case 'zustand':
      recommendations.push('Zustand works well with Next.js - keep your store initialization in a separate file');
      recommendations.push('Add "use client" directive to files that import Zustand stores');
      break;
    case 'recoil':
    case 'jotai':
      recommendations.push('Wrap your application with RecoilRoot/Provider in _app.tsx');
      recommendations.push('Add "use client" directive to all components using Recoil/Jotai');
      break;
    case 'mobx':
      recommendations.push('Add "use client" directive to MobX store classes and observer components');
      recommendations.push('Consider moving some logic to React Server Components where appropriate');
      break;
    case 'react-query':
      recommendations.push('Set up QueryClientProvider in _app.tsx');
      recommendations.push('Add "use client" directive to components using useQuery/useMutation');
      break;
    case 'swr':
      recommendations.push('SWR works well with Next.js - consider using with Suspense in App Router');
      recommendations.push('Add "use client" directive to components using useSWR');
      break;
    default:
      recommendations.push('Local state management works well with Next.js');
      recommendations.push('Add "use client" directive to components using useState/useReducer');
  }
  
  // Add general recommendations
  recommendations.push('Separate data fetching from state management where possible');
  recommendations.push('Consider using React Server Components for components without client state');
  
  result.recommendations = recommendations;
};

/**
 * Detect client state in potential server components
 */
const detectClientStateInServerComponents = (files: UploadedFiles, result: StateAnalysisResult): void => {
  // Simple heuristic: if a file doesn't import React or doesn't use hooks but uses state
  // management imports, it might be attempting to use client state in a server component
  
  let potentialIssueFound = false;
  
  for (const [filePath, content] of Object.entries(files)) {
    // Skip files that explicitly declare they are client components
    if (content.includes('use client')) continue;
    
    // Skip files that are clearly client components
    if (content.includes('onClick=') || 
        content.includes('onChange=') || 
        content.includes('useEffect(') || 
        content.includes('useState(')) continue;
    
    // Check if the file has any state management imports
    const hasStateImports = content.includes('useSelector') || 
                           content.includes('useDispatch') || 
                           content.includes('useStore') || 
                           content.includes('useAtom') || 
                           content.includes('useRecoilState');
    
    if (hasStateImports) {
      potentialIssueFound = true;
      break;
    }
  }
  
  result.hasClientStateInServerComponents = potentialIssueFound;
};

/**
 * Generate a state migration guide
 */
export const generateStateMigrationGuide = (stateAnalysis: StateAnalysisResult): string => {
  const guide = `# State Management Migration Guide\n\n`;
  
  const statePattern = stateAnalysis.dominantPattern;
  
  let migrationGuide = guide;
  
  migrationGuide += `## Detected State Management Pattern: ${statePattern}\n\n`;
  
  switch (statePattern) {
    case 'redux':
      migrationGuide += `### Redux Migration Steps\n\n`;
      migrationGuide += `1. **Create a proper store directory**\n`;
      migrationGuide += `   Create a \`/app/store\` or \`/src/store\` directory to house all Redux files.\n\n`;
      migrationGuide += `2. **Add "use client" directive**\n`;
      migrationGuide += `   Add \`"use client"\` at the top of all components that use Redux hooks.\n\n`;
      migrationGuide += `3. **Setup Provider in layout or app**\n`;
      migrationGuide += `   Wrap your application with the Redux Provider in a root layout or custom app file.\n\n`;
      break;
    
    case 'context':
      migrationGuide += `### Context API Migration Steps\n\n`;
      migrationGuide += `1. **Centralize Context Providers**\n`;
      migrationGuide += `   Create a combined providers component to avoid nesting multiple context providers.\n\n`;
      migrationGuide += `2. **Add "use client" directive**\n`;
      migrationGuide += `   Add \`"use client"\` at the top of all context provider components and components using context.\n\n`;
      migrationGuide += `3. **Consider Server Components**\n`;
      migrationGuide += `   Components that don't access context can be server components for better performance.\n\n`;
      break;
    
    // Add similar sections for other state management libraries
    default:
      migrationGuide += `### Local State Migration Steps\n\n`;
      migrationGuide += `1. **Add "use client" directive**\n`;
      migrationGuide += `   Add \`"use client"\` at the top of all components using React hooks like useState/useReducer.\n\n`;
      migrationGuide += `2. **Consider Server Components**\n`;
      migrationGuide += `   Components without state can be server components (without the directive) for better performance.\n\n`;
  }
  
  migrationGuide += `## Additional Recommendations\n\n`;
  migrationGuide += stateAnalysis.recommendations.map(rec => `- ${rec}`).join('\n');
  
  return migrationGuide;
};
