
/**
 * Utilities for detecting file types in the codebase
 */
import { FileType } from '../types';

/**
 * Language type for a file
 */
export type LanguageType = 'typescript' | 'javascript' | 'css' | 'json' | 'html' | 'other';

/**
 * Detects the primary type of file based on content and filename analysis
 */
export const detectFileType = (content: string, filename: string): FileType => {
  const lowercaseFilename = filename.toLowerCase();
  
  // API routes detection
  if (lowercaseFilename.includes('/api/') ||
      content.includes('export function handler') ||
      content.includes('export default function handler') ||
      content.includes('export default async function handler')) {
    return 'api';
  }
  
  // Config file detection
  if (lowercaseFilename.includes('config') ||
      lowercaseFilename.endsWith('.config.js') ||
      lowercaseFilename.endsWith('.config.ts') ||
      lowercaseFilename === 'package.json' ||
      lowercaseFilename === 'tsconfig.json') {
    return 'config';
  }
  
  // Style file detection
  if (lowercaseFilename.endsWith('.css') ||
      lowercaseFilename.endsWith('.scss') ||
      lowercaseFilename.endsWith('.less') ||
      lowercaseFilename.endsWith('.styled.js') ||
      lowercaseFilename.endsWith('.styled.ts')) {
    return 'style';
  }
  
  // Page detection
  if (lowercaseFilename.includes('/pages/') ||
      lowercaseFilename.includes('/views/') ||
      lowercaseFilename.includes('/screens/') ||
      (content.includes('export default') && 
      (content.includes('useParams') || content.includes('useHistory') || 
       content.includes('useNavigate') || content.includes('useLocation')))) {
    return 'page';
  }
  
  // Layout detection
  if (lowercaseFilename.includes('layout') ||
      lowercaseFilename.includes('header') ||
      lowercaseFilename.includes('footer') ||
      lowercaseFilename.includes('sidebar') ||
      lowercaseFilename.includes('navigation') ||
      (content.includes('children') && content.includes('<header') && content.includes('<footer'))) {
    return 'layout';
  }
  
  // Hook detection
  if (lowercaseFilename.startsWith('use') ||
      content.includes('export function use') ||
      content.includes('export const use') ||
      content.includes('export default function use') ||
      content.includes('export default const use')) {
    return 'hook';
  }
  
  // Context provider detection
  if (lowercaseFilename.includes('context') ||
      lowercaseFilename.includes('provider') ||
      content.includes('createContext') ||
      content.includes('useContext')) {
    return 'context';
  }
  
  // Redux reducer detection
  if (lowercaseFilename.includes('reducer') ||
      lowercaseFilename.includes('slice') ||
      content.includes('createSlice') ||
      content.includes('combineReducers')) {
    return 'reducer';
  }
  
  // Redux store detection
  if (lowercaseFilename.includes('store') ||
      content.includes('createStore') ||
      content.includes('configureStore')) {
    return 'store';
  }
  
  // Utility file detection
  if (lowercaseFilename.includes('util') ||
      lowercaseFilename.includes('helper') ||
      lowercaseFilename.includes('service') ||
      lowercaseFilename.includes('constant') ||
      lowercaseFilename.includes('api') ||
      lowercaseFilename.includes('client')) {
    return 'util';
  }
  
  // Component detection (default when no other specific type is detected)
  if (content.includes('import React') || 
      content.includes('React.') ||
      content.includes('function') || 
      content.includes('=>') || 
      content.includes('class') ||
      content.includes('JSX')) {
    return 'component';
  }
  
  // If none of the above, return a generic type
  return 'component';
};

/**
 * Determines if a file is a TypeScript file
 */
export const isTypeScriptFile = (filename: string): boolean => {
  return filename.endsWith('.ts') || filename.endsWith('.tsx');
};

/**
 * Gets the language type of a file
 */
export const getLanguageType = (filename: string): LanguageType => {
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) {
    return 'typescript';
  } else if (filename.endsWith('.js') || filename.endsWith('.jsx')) {
    return 'javascript';
  } else if (filename.endsWith('.css') || filename.endsWith('.scss') || filename.endsWith('.less')) {
    return 'css';
  } else if (filename.endsWith('.json')) {
    return 'json';
  } else if (filename.endsWith('.html') || filename.endsWith('.htm')) {
    return 'html';
  } else {
    return 'other';
  }
};
