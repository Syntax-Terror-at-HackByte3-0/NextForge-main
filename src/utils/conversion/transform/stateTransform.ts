
/**
 * Extracts and transforms state management patterns
 */
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { AnalysisResult } from '../analysis/analysisTypes';
import { parseCode } from '../analysis/astUtils';

// Interface to represent extracted state information
interface StateManagementInfo {
  usesContextAPI: boolean;
  usesRedux: boolean;
  usesRecoil: boolean;
  usesJotai: boolean;
  usesZustand: boolean;
  usesLocalState: boolean;
  stateHooks: { name: string, stateVar: string, setterVar: string }[];
  contextProviders: string[];
  reduxActions: string[];
  recommendations: string[];
}

/**
 * Extract information about state management patterns
 */
export const extractStateLogic = (code: string, analysis: AnalysisResult): StateManagementInfo => {
  const stateInfo: StateManagementInfo = {
    usesContextAPI: false,
    usesRedux: false,
    usesRecoil: false,
    usesJotai: false,
    usesZustand: false,
    usesLocalState: false,
    stateHooks: [],
    contextProviders: [],
    reduxActions: [],
    recommendations: []
  };
  
  // Check for known state libraries from dependencies
  analysis.dependencies.forEach(dep => {
    if (dep.includes('react-redux') || dep.includes('@reduxjs/toolkit')) {
      stateInfo.usesRedux = true;
    }
    if (dep.includes('recoil')) {
      stateInfo.usesRecoil = true;
    }
    if (dep.includes('jotai')) {
      stateInfo.usesJotai = true;
    }
    if (dep.includes('zustand')) {
      stateInfo.usesZustand = true;
    }
  });
  
  // Check for context API usage
  if (analysis.usesContext || code.includes('createContext') || code.includes('useContext')) {
    stateInfo.usesContextAPI = true;
  }
  
  try {
    const ast = parseCode(code);
    
    // Extract useState hooks
    traverse(ast, {
      CallExpression(path) {
        if (t.isIdentifier(path.node.callee) && path.node.callee.name === 'useState') {
          stateInfo.usesLocalState = true;
          
          // Try to extract state variable and setter
          if (path.parent && t.isVariableDeclarator(path.parent)) {
            if (t.isArrayPattern(path.parent.id)) {
              const stateVar = t.isIdentifier(path.parent.id.elements[0]) 
                ? path.parent.id.elements[0].name 
                : '';
              const setterVar = path.parent.id.elements[1] && t.isIdentifier(path.parent.id.elements[1]) 
                ? path.parent.id.elements[1].name 
                : '';
              
              if (stateVar && setterVar) {
                stateInfo.stateHooks.push({
                  name: 'useState',
                  stateVar,
                  setterVar
                });
              }
            }
          }
        }
      },
      
      // Detect Context Provider components
      JSXElement(path) {
        if (t.isJSXIdentifier(path.node.openingElement.name) && 
            path.node.openingElement.name.name.includes('Provider')) {
          stateInfo.contextProviders.push(path.node.openingElement.name.name);
        }
      },
      
      // Detect Redux actions
      MemberExpression(path) {
        if (t.isIdentifier(path.node.object) && 
            path.node.object.name === 'dispatch' && 
            path.parent && 
            t.isCallExpression(path.parent)) {
          const callExpression = path.parent;
          if (callExpression.arguments.length > 0 && 
              t.isCallExpression(callExpression.arguments[0])) {
            const actionCall = callExpression.arguments[0];
            if (t.isIdentifier(actionCall.callee)) {
              stateInfo.reduxActions.push(actionCall.callee.name);
            }
          }
        }
      }
    });
    
    // Generate recommendations based on findings
    if (stateInfo.usesRedux) {
      stateInfo.recommendations.push(
        'Consider using next-redux-wrapper for server-side rendering support'
      );
      stateInfo.recommendations.push(
        'For App Router, move Redux Providers to a Client Component wrapper'
      );
    }
    
    if (stateInfo.usesContextAPI) {
      stateInfo.recommendations.push(
        'In App Router, Context Providers must be in Client Components (use "use client")'
      );
    }
    
    if (stateInfo.usesLocalState && analysis.hasDataFetching) {
      stateInfo.recommendations.push(
        'Consider moving data fetching state to getServerSideProps/getStaticProps'
      );
    }
    
    if (stateInfo.usesRecoil || stateInfo.usesJotai || stateInfo.usesZustand) {
      stateInfo.recommendations.push(
        'Ensure state management libraries are wrapped in a Client Component'
      );
    }
    
  } catch (error) {
    console.error('Error analyzing state logic:', error);
  }
  
  return stateInfo;
};

/**
 * Suggests replacements for client-state with server-state where possible
 */
export const suggestServerStateReplacements = (stateInfo: StateManagementInfo): string[] => {
  const suggestions: string[] = [];
  
  if (stateInfo.usesLocalState && stateInfo.stateHooks.length > 0) {
    suggestions.push(
      'Consider replacing these state hooks with server-side data fetching:'
    );
    
    stateInfo.stateHooks.forEach(hook => {
      suggestions.push(
        `- ${hook.stateVar}: Replace with props from getServerSideProps/getStaticProps`
      );
    });
  }
  
  return suggestions;
};

/**
 * Converts React context to work with Next.js App Router
 */
export const prepareContextForNextJs = (code: string): string => {
  // If no context usage, return original code
  if (!code.includes('createContext') || !code.includes('Provider')) {
    return code;
  }
  
  // Add client directive and app router context guidance
  return `'use client';

/*
 * CONTEXT API MIGRATION:
 * In Next.js App Router:
 * - Context Providers must be Client Components
 * - Keep context definitions in separate files from component logic when possible
 * - Initialize with meaningful default values
 */
${code}`;
};
