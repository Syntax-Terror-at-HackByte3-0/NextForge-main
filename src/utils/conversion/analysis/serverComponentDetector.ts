
/**
 * Specialized detector for Next.js Server Component compatibility
 */
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { parseCode } from './astUtils';

interface ServerComponentAnalysis {
  canBeServerComponent: boolean;
  clientSideFeatures: string[];
  serverSideFeatures: string[];
  recommendation: 'server' | 'client' | 'either';
  conversionNotes: string[];
}

/**
 * Analyzes a component to determine if it can be a Next.js Server Component
 * 
 * Server Components can't use:
 * - useState, useEffect, useLayoutEffect, etc.
 * - Browser APIs (window, document, etc.)
 * - Event handlers (onClick, onChange, etc.)
 * - Class components
 * 
 * This is the original implementation maintained for backwards compatibility.
 * For new code, prefer using enhancedServerComponentAnalyzer.ts
 */
export const analyzeServerComponentCompatibility = (code: string, filePath: string): ServerComponentAnalysis => {
  const result: ServerComponentAnalysis = {
    canBeServerComponent: true,
    clientSideFeatures: [],
    serverSideFeatures: [],
    recommendation: 'either',
    conversionNotes: []
  };

  // Common server-side features
  const serverSidePatterns = [
    'getServerSideProps',
    'getStaticProps',
    'getStaticPaths',
    'fetch(',
    'axios.get(',
    'import fs from',
    'import path from',
    'await',
    'async'
  ];

  // Check for these patterns first
  serverSidePatterns.forEach(pattern => {
    if (code.includes(pattern)) {
      result.serverSideFeatures.push(pattern);
    }
  });

  try {
    const ast = parseCode(code);

    traverse(ast, {
      // Check for hooks that can't be used in Server Components
      CallExpression(path) {
        if (t.isIdentifier(path.node.callee)) {
          const hookName = path.node.callee.name;
          
          // State hooks and effects can't be used in Server Components
          if (['useState', 'useReducer', 'useEffect', 'useLayoutEffect', 'useRef', 'useCallback', 'useMemo', 'useImperativeHandle'].includes(hookName)) {
            result.canBeServerComponent = false;
            result.clientSideFeatures.push(hookName);
          }
          
          // Router hooks typically need client components
          if (['useRouter', 'useParams', 'useNavigate', 'useHistory', 'useLocation'].includes(hookName)) {
            result.canBeServerComponent = false;
            result.clientSideFeatures.push(hookName);
          }
        }
      },
      
      // Class components can't be Server Components
      ClassDeclaration() {
        result.canBeServerComponent = false;
        result.clientSideFeatures.push('ClassComponent');
      },
      
      // Check for browser APIs
      MemberExpression(path) {
        const objectName = path.node.object.type === 'Identifier' ? path.node.object.name : '';
        
        if (['window', 'document', 'localStorage', 'sessionStorage', 'navigator'].includes(objectName)) {
          result.canBeServerComponent = false;
          result.clientSideFeatures.push(objectName);
        }
      },
      
      // Check for event handlers in JSX
      JSXAttribute(path) {
        if (t.isJSXIdentifier(path.node.name) && 
            (path.node.name.name.startsWith('on') && path.node.name.name.length > 2 && 
             path.node.name.name[2] === path.node.name.name[2].toUpperCase())) {
          result.canBeServerComponent = false;
          result.clientSideFeatures.push(`Event handler: ${path.node.name.name}`);
        }
      },
      
      // Import from 'next/dynamic' usually indicates client component
      ImportDeclaration(path) {
        if (path.node.source.value === 'next/dynamic') {
          result.canBeServerComponent = false;
          result.clientSideFeatures.push('next/dynamic import');
          result.conversionNotes.push('Uses dynamic imports, which are typically for client components');
        }
      }
    });
    
    // If we have client-side features, recommend client component
    if (result.clientSideFeatures.length > 0) {
      result.recommendation = 'client';
      result.conversionNotes.push(`Found ${result.clientSideFeatures.length} client-side features that require 'use client' directive`);
    } 
    // If we have server-side features but no client-side features, recommend server component
    else if (result.serverSideFeatures.length > 0) {
      result.recommendation = 'server';
      result.conversionNotes.push('Component has server-side features and no client-side dependencies');
    } 
    // Default to either if we couldn't determine
    else {
      result.recommendation = 'either';
      result.conversionNotes.push('No clear client or server requirements detected');
    }
    
  } catch (error) {
    console.error(`Error analyzing server component compatibility for ${filePath}:`, error);
    result.canBeServerComponent = false;
    result.recommendation = 'client';
    result.conversionNotes.push('Error during analysis - defaulting to client component for safety');
  }
  
  return result;
};
