
/**
 * Enhanced analyzer for Next.js Server Component compatibility
 */
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { validateSyntax } from './enhancedSyntaxValidator';
import { parseCode } from './astUtils';

export interface ServerComponentFeature {
  name: string;
  type: 'hook' | 'api' | 'event' | 'import' | 'other';
  description: string;
  severity: 'error' | 'warning' | 'info';
  line?: number;
  suggestedFix?: string;
}

export interface CompatibilityIssue {
  issue: string;
  location?: string;
  suggestion?: string;
}

export interface LibraryCompatibility {
  name: string;
  serverCompatible: boolean;
  reason?: string;
}

export interface ServerComponentAnalysisResult {
  compatibility: 'server-only' | 'client-only' | 'either';
  clientFeatures: ServerComponentFeature[];
  serverFeatures: ServerComponentFeature[];
  requirements: {
    clientDirective: boolean;
    dataFetching: boolean;
  };
  compatibility_issues: CompatibilityIssue[];
  libraries: LibraryCompatibility[];
  suggestedDirective?: 'use client' | 'use server' | null;
  fullAnalysis?: Record<string, any>;
}

export interface ServerComponentCategories {
  serverComponents: string[];
  clientComponents: string[];
  mixedComponents: string[];
  apiRoutes: string[];
  unknownComponents: string[];
  fullAnalysis: Record<string, ServerComponentAnalysisResult>;
}

/**
 * Analyzes a component for Server Component compatibility
 */
export function analyzeServerComponentCompatibility(
  code: string, 
  filePath: string = 'unknown.tsx'
): ServerComponentAnalysisResult {
  const result: ServerComponentAnalysisResult = {
    compatibility: 'either',
    clientFeatures: [],
    serverFeatures: [],
    requirements: {
      clientDirective: false,
      dataFetching: false
    },
    compatibility_issues: [],
    libraries: []
  };

  // Check for 'use client' directive
  if (code.includes('"use client"') || code.includes("'use client'")) {
    result.compatibility = 'client-only';
    result.requirements.clientDirective = true;
    result.clientFeatures.push({
      name: 'use client directive',
      type: 'other',
      description: 'Component has "use client" directive',
      severity: 'info'
    });
    result.suggestedDirective = 'use client';
    return result;
  }

  try {
    // Check for React hooks
    const hookPattern = /use[A-Z]\w+\(/g;
    let match;
    while ((match = hookPattern.exec(code)) !== null) {
      const hookName = match[0].slice(0, -1); // Remove the opening parenthesis
      
      // Skip certain hooks that might be custom or server-compatible
      if (['useTransition', 'useFormStatus', 'useOptimistic'].includes(hookName)) {
        continue;
      }
      
      result.clientFeatures.push({
        name: hookName,
        type: 'hook',
        description: `Uses ${hookName} which requires client-side React`,
        severity: 'error',
        line: getLineNumber(code, match.index),
        suggestedFix: `Move ${hookName} to a separate client component`
      });
    }

    // Check for browser APIs
    const browserAPIs = ['window', 'document', 'localStorage', 'sessionStorage', 'navigator'];
    browserAPIs.forEach(api => {
      if (new RegExp(`\\b${api}\\.`).test(code)) {
        result.clientFeatures.push({
          name: api,
          type: 'api',
          description: `Uses browser API ${api} which doesn't exist in server environment`,
          severity: 'error',
          suggestedFix: `Move ${api} usage to a separate client component or add a runtime check`
        });
      }
    });

    // Check for JSX event handlers
    const eventHandlerPattern = /<[^>]+\s+on[A-Z]\w+=/g;
    while ((match = eventHandlerPattern.exec(code)) !== null) {
      const handlerMatch = match[0].match(/on([A-Z]\w+)=/);
      if (handlerMatch && handlerMatch[1]) {
        const eventName = handlerMatch[1];
        result.clientFeatures.push({
          name: `on${eventName}`,
          type: 'event',
          description: `Uses event handler on${eventName} which requires client interactivity`,
          severity: 'error',
          line: getLineNumber(code, match.index),
          suggestedFix: `Move this interactive element to a client component`
        });
      }
    }

    // Check imports for client-side libraries
    const importPattern = /import\s+.+\s+from\s+['"](.+)['"]/g;
    while ((match = importPattern.exec(code)) !== null) {
      const libraryName = match[1];
      
      // Libraries that are incompatible with Server Components
      const clientLibraries = [
        { name: 'react-redux', reason: 'State management libraries need client components' },
        { name: 'redux', reason: 'State management libraries need client components' },
        { name: '@reduxjs/toolkit', reason: 'State management libraries need client components' },
        { name: 'zustand', reason: 'State management libraries need client components' },
        { name: 'jotai', reason: 'State management libraries need client components' },
        { name: 'recoil', reason: 'State management libraries need client components' },
        { name: 'styled-components', reason: 'CSS-in-JS libraries need client components' },
        { name: '@emotion', reason: 'CSS-in-JS libraries need client components' },
        { name: 'framer-motion', reason: 'Animation libraries need client components' },
        { name: 'react-spring', reason: 'Animation libraries need client components' },
        { name: 'react-query', reason: 'Data fetching libraries often need client components' },
        { name: '@tanstack/react-query', reason: 'Data fetching libraries often need client components' },
        { name: 'react-hook-form', reason: 'Form libraries need client components' }
      ];

      for (const lib of clientLibraries) {
        if (libraryName.includes(lib.name)) {
          result.clientFeatures.push({
            name: lib.name,
            type: 'import',
            description: `Imports ${lib.name} which ${lib.reason}`,
            severity: 'error',
            line: getLineNumber(code, match.index),
            suggestedFix: `Move this import to a client component file`
          });
          
          result.libraries.push({
            name: lib.name,
            serverCompatible: false,
            reason: lib.reason
          });
          
          break;
        }
      }
    }

    // Server-side features
    if (code.includes('async function') || code.includes('async (')) {
      result.serverFeatures.push({
        name: 'async function',
        type: 'other',
        description: 'Contains async functions which are ideal for Server Components',
        severity: 'info'
      });
    }

    if (code.includes('fetch(')) {
      result.serverFeatures.push({
        name: 'fetch',
        type: 'api',
        description: 'Contains data fetching which is ideal in Server Components',
        severity: 'info'
      });
      result.requirements.dataFetching = true;
    }

    // Determine overall compatibility
    if (result.clientFeatures.length > 0) {
      result.compatibility = 'client-only';
      result.requirements.clientDirective = true;
      result.suggestedDirective = 'use client';
      
      // Add compatibility issues
      result.compatibility_issues.push({
        issue: `Contains ${result.clientFeatures.length} client-side features that require "use client" directive`,
        suggestion: 'Add "use client" directive at the top of the file'
      });
    } else if (result.serverFeatures.length > 0) {
      result.compatibility = 'server-only';
      result.suggestedDirective = null;
    } else {
      result.compatibility = 'either';
      result.suggestedDirective = null;
    }
  } catch (error) {
    console.error(`Error analyzing server component compatibility for ${filePath}:`, error);
    result.compatibility = 'client-only'; // Default to client for safety
    result.requirements.clientDirective = true;
    result.suggestedDirective = 'use client';
    result.compatibility_issues.push({
      issue: `Error analyzing component: ${error instanceof Error ? error.message : 'Unknown error'}`,
      suggestion: 'Add "use client" directive for safety'
    });
  }

  return result;
}

/**
 * Helper to get line number from character index
 */
function getLineNumber(code: string, index: number): number {
  const textBeforeIndex = code.substring(0, index);
  return (textBeforeIndex.match(/\n/g) || []).length + 1;
}

/**
 * Categorize components as server-only, client-only, or mixed
 */
export function categorizeComponents(
  files: Record<string, string>,
  imports: Record<string, string[]> = {}
): ServerComponentCategories {
  const result: ServerComponentCategories = {
    serverComponents: [],
    clientComponents: [],
    mixedComponents: [],
    apiRoutes: [],
    unknownComponents: [],
    fullAnalysis: {}
  };

  // Analyze each file
  for (const [filePath, content] of Object.entries(files)) {
    // Skip non-component files
    if (!filePath.endsWith('.jsx') && !filePath.endsWith('.tsx') && 
        !filePath.endsWith('.js') && !filePath.endsWith('.ts')) {
      continue;
    }

    // Detect API routes
    if (filePath.includes('/api/') || filePath.includes('\\api\\')) {
      result.apiRoutes.push(filePath);
      continue;
    }

    // Analyze server component compatibility
    const analysis = analyzeServerComponentCompatibility(content, filePath);
    result.fullAnalysis[filePath] = analysis;

    // Categorize based on analysis
    if (analysis.compatibility === 'server-only') {
      result.serverComponents.push(filePath);
    } else if (analysis.compatibility === 'client-only') {
      result.clientComponents.push(filePath);
    } else if (analysis.clientFeatures.length > 0 && analysis.serverFeatures.length > 0) {
      result.mixedComponents.push(filePath);
    } else {
      result.unknownComponents.push(filePath);
    }
  }

  return result;
}

/**
 * Generate a human-readable report from server component analysis
 */
export function generateServerComponentReport(analysis: ServerComponentCategories): string {
  let report = `# Next.js Server Component Analysis\n\n`;
  
  report += `## Summary\n\n`;
  report += `- Server Components: ${analysis.serverComponents.length}\n`;
  report += `- Client Components: ${analysis.clientComponents.length}\n`;
  report += `- Mixed Components: ${analysis.mixedComponents.length}\n`;
  report += `- API Routes: ${analysis.apiRoutes.length}\n`;
  report += `- Unknown Components: ${analysis.unknownComponents.length}\n\n`;
  
  if (analysis.serverComponents.length > 0) {
    report += `## Server Components\n\n`;
    analysis.serverComponents.forEach(component => {
      report += `- ${component}\n`;
      const componentAnalysis = analysis.fullAnalysis[component];
      if (componentAnalysis && componentAnalysis.serverFeatures.length > 0) {
        report += `  - Server features: ${componentAnalysis.serverFeatures.map(f => f.name).join(', ')}\n`;
      }
    });
    report += `\n`;
  }
  
  if (analysis.clientComponents.length > 0) {
    report += `## Client Components\n\n`;
    analysis.clientComponents.forEach(component => {
      report += `- ${component}\n`;
      const componentAnalysis = analysis.fullAnalysis[component];
      if (componentAnalysis && componentAnalysis.clientFeatures.length > 0) {
        report += `  - Client features: ${componentAnalysis.clientFeatures.map(f => f.name).join(', ')}\n`;
      }
    });
    report += `\n`;
  }
  
  if (analysis.mixedComponents.length > 0) {
    report += `## Mixed Components (Require Refactoring)\n\n`;
    analysis.mixedComponents.forEach(component => {
      report += `- ${component}\n`;
      const componentAnalysis = analysis.fullAnalysis[component];
      if (componentAnalysis) {
        if (componentAnalysis.clientFeatures.length > 0) {
          report += `  - Client features: ${componentAnalysis.clientFeatures.map(f => f.name).join(', ')}\n`;
        }
        if (componentAnalysis.serverFeatures.length > 0) {
          report += `  - Server features: ${componentAnalysis.serverFeatures.map(f => f.name).join(', ')}\n`;
        }
        if (componentAnalysis.compatibility_issues.length > 0) {
          report += `  - Issues: ${componentAnalysis.compatibility_issues.map(i => i.issue).join('; ')}\n`;
        }
      }
    });
    report += `\n`;
  }
  
  report += `## Recommendations\n\n`;
  report += `1. Files with client-side features should have "use client" directive at the top\n`;
  report += `2. Consider moving client-side logic to dedicated client components\n`;
  report += `3. Keep data fetching in Server Components where possible\n`;
  
  return report;
}
