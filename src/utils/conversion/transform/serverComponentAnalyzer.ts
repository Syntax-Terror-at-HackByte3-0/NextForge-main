
/**
 * Analyzes components to determine eligibility for Server Components in Next.js App Router
 */
import { AnalysisResult } from '../analysis/analysisTypes';
import { parseCode, couldBeServerComponent, extractImports } from '../analysis/astUtils';
import { logConversion } from '../logger';

/**
 * Analyze a component to determine if it could be a Server Component
 */
export const analyzeServerComponentEligibility = (
  code: string, 
  analysis: AnalysisResult
): {
  eligible: boolean;
  reasons: string[];
  recommendations: string[];
} => {
  const result = {
    eligible: false,
    reasons: [] as string[],
    recommendations: [] as string[]
  };
  
  // Quick checks that immediately disqualify a component
  if (analysis.componentType === 'class') {
    result.reasons.push('Class components cannot be Server Components');
    result.recommendations.push('Convert to a functional component to potentially use as a Server Component');
    return result;
  }
  
  if (analysis.usesHooks) {
    result.reasons.push(`Component uses React hooks: ${analysis.hooks.join(', ')}`);
    result.recommendations.push('Move hooks to a separate Client Component');
    return result;
  }
  
  if (analysis.browserAPIs && analysis.browserAPIs.length > 0) {
    result.reasons.push(`Component uses browser APIs: ${analysis.browserAPIs.join(', ')}`);
    result.recommendations.push('Move browser API calls to a separate Client Component');
    return result;
  }
  
  try {
    const ast = parseCode(code);
    
    // Check if AST analysis suggests it could be a server component
    if (couldBeServerComponent(ast)) {
      result.eligible = true;
      result.reasons.push('Component contains only static JSX or presentation logic');
      result.reasons.push('No client-side hooks, event handlers, or browser APIs detected');
      
      // Import analysis
      const imports = extractImports(ast);
      
      // Check for potentially problematic imports
      const clientLibraries = [
        'styled-components', 
        '@emotion', 
        'framer-motion',
        'react-redux',
        '@reduxjs/toolkit',
        'recoil',
        'jotai',
        'zustand',
        'mobx'
      ];
      
      const problematicImports = imports
        .filter(imp => clientLibraries.some(lib => imp.source.includes(lib)))
        .map(imp => imp.source);
      
      if (problematicImports.length > 0) {
        result.eligible = false;
        result.reasons.push(`Uses client-side libraries: ${problematicImports.join(', ')}`);
        result.recommendations.push('Move these imports to a Client Component wrapper');
      }
      
      // Additional recommendations
      if (result.eligible) {
        result.recommendations.push('This component can be used directly as a Server Component in Next.js App Router');
        result.recommendations.push('Remove any "use client" directive if present');
        result.recommendations.push('Consider moving data fetching logic directly into this component');
      }
    } else {
      result.eligible = false;
      result.reasons.push('Component contains client-side code patterns');
      result.recommendations.push('Add "use client" directive at the top of the file');
    }
  } catch (error) {
    result.eligible = false;
    result.reasons.push(`Error analyzing component: ${error instanceof Error ? error.message : 'Unknown error'}`);
    logConversion('error', `Server Component analysis error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return result;
};

/**
 * Generate comments for a component based on Server Component analysis
 */
export const generateServerComponentComments = (
  analysis: ReturnType<typeof analyzeServerComponentEligibility>
): string => {
  if (analysis.eligible) {
    return `/*
 * SERVER COMPONENT ELIGIBLE:
 * This component can be used as a Server Component in Next.js App Router.
 * 
 * Benefits:
 * - Reduced client-side JavaScript
 * - Direct database/API access without client-server waterfalls
 * - Better performance and SEO
 * 
 * Recommendations:
${analysis.recommendations.map(rec => ` * - ${rec}`).join('\n')}
 */`;
  } else {
    return `/*
 * CLIENT COMPONENT REQUIRED:
 * This component must be a Client Component in Next.js App Router.
 * 
 * Reasons:
${analysis.reasons.map(reason => ` * - ${reason}`).join('\n')}
 * 
 * Recommendations:
${analysis.recommendations.map(rec => ` * - ${rec}`).join('\n')}
 */`;
  }
};
