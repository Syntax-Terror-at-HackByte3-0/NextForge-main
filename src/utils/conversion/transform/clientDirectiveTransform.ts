/**
 * Transformer to add "use client" directives to React components for Next.js
 */
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { logConversion } from '../logger';
import { 
  analyzeServerComponentCompatibility as analyzeComponent
} from '../analysis/enhancedServerComponentAnalyzer';
import { parseCode } from '../analysis/astUtils';

/**
 * Checks if a component can be a Server Component or needs "use client" directive
 */
function checkServerComponentCompatibility(code: string, filePath: string) {
  // Analyze the component
  const analysis = analyzeComponent(code, filePath);
  
  // Return result based on analysis
  return {
    couldBeServerComponent: analysis.compatibility === 'server-only' || analysis.compatibility === 'either',
    needsClientDirective: analysis.suggestedDirective === 'use client',
    reasons: analysis.clientFeatures.map(feature => feature.description)
  };
}

/**
 * Add "use client" directive to a component if needed
 * Return the modified code and a flag indicating if it was modified
 */
export const addClientDirectiveIfNeeded = (
  code: string,
  filePath: string,
  forceAdd: boolean = false
): { code: string; modified: boolean; isClient: boolean } => {
  // Skip if the file already has a "use client" directive
  if (code.trim().startsWith('"use client"') || code.trim().startsWith("'use client'")) {
    return { code, modified: false, isClient: true };
  }
  
  // Check if this is likely a server component
  const { couldBeServerComponent, needsClientDirective, reasons } = checkServerComponentCompatibility(code, filePath);
  
  // If it's not a server component or we're forcing the directive
  if (forceAdd || needsClientDirective) {
    // Generate a comment explaining why
    let comment = '';
    if (reasons && reasons.length > 0) {
      comment = `/*
 * This component requires "use client" directive because:
${reasons.slice(0, 3).map(reason => ` * - ${reason}`).join('\n')}${reasons.length > 3 ? `\n * - and ${reasons.length - 3} more reasons` : ''}
 */
`;
    }
    
    // Add the directive at the top of the file
    const modifiedCode = `"use client";

${comment}${code}`;
    
    return { code: modifiedCode, modified: true, isClient: true };
  }
  
  return { code, modified: false, isClient: !couldBeServerComponent };
};

/**
 * Batch process a set of files and add "use client" directives where needed
 */
export const batchAddClientDirectives = (
  files: Record<string, string>,
  forceAdd: boolean = false
): { processed: Record<string, string>; stats: { total: number; modified: number; serverComponents: number; clientComponents: number } } => {
  const result: Record<string, string> = {};
  const stats = {
    total: 0,
    modified: 0,
    serverComponents: 0,
    clientComponents: 0
  };
  
  // Process each file
  for (const [filePath, content] of Object.entries(files)) {
    // Only process React component files
    if (filePath.endsWith('.jsx') || filePath.endsWith('.tsx') || 
        filePath.endsWith('.js') || filePath.endsWith('.ts')) {
      stats.total++;
      
      const { code, modified, isClient } = addClientDirectiveIfNeeded(content, filePath, forceAdd);
      result[filePath] = code;
      
      if (modified) {
        stats.modified++;
        logConversion('info', `Added "use client" directive to ${filePath}`);
      }
      
      if (isClient) {
        stats.clientComponents++;
      } else {
        stats.serverComponents++;
      }
    } else {
      // Keep non-component files as-is
      result[filePath] = content;
    }
  }
  
  logConversion('info', `Client directive processing complete: ${stats.modified} files modified, ${stats.serverComponents} server components, ${stats.clientComponents} client components`);
  
  return { processed: result, stats };
};

/**
 * Generate a report on Server Components vs Client Components
 */
export const generateClientComponentReport = (files: Record<string, string>): string => {
  let report = `# Client/Server Component Analysis\n\n`;
  
  const clientComponents: string[] = [];
  const serverComponents: string[] = [];
  
  // Analyze each component file
  for (const [filePath, content] of Object.entries(files)) {
    // Only analyze component files
    if (filePath.endsWith('.jsx') || filePath.endsWith('.tsx') || 
        filePath.endsWith('.js') || filePath.endsWith('.ts')) {
      
      // Check if it already has "use client" directive
      const hasClientDirective = content.trim().startsWith('"use client"') || 
                               content.trim().startsWith("'use client'");
      
      if (hasClientDirective) {
        clientComponents.push(filePath);
        continue;
      }
      
      // Analyze the component
      const analysis = analyzeComponent(content, filePath);
      const compatibility = analysis.compatibility;
      
      if (compatibility === 'client-only' || analysis.clientFeatures.length > 0) {
        clientComponents.push(filePath);
      } else {
        serverComponents.push(filePath);
      }
    }
  }
  
  // Generate the report
  report += `## Summary\n\n`;
  report += `- Total component files: ${clientComponents.length + serverComponents.length}\n`;
  report += `- Client Components: ${clientComponents.length}\n`;
  report += `- Server Components: ${serverComponents.length}\n\n`;
  
  if (serverComponents.length > 0) {
    report += `## Server Components\n\n`;
    serverComponents.forEach(comp => {
      report += `- ${comp}\n`;
    });
    report += '\n';
  }
  
  if (clientComponents.length > 0) {
    report += `## Client Components\n\n`;
    clientComponents.forEach(comp => {
      report += `- ${comp}\n`;
    });
    report += '\n';
  }
  
  report += `## Recommendations\n\n`;
  report += `1. Components with client-side interactivity should have "use client" directive\n`;
  report += `2. Server Components can fetch data directly and reduce client-side JS\n`;
  report += `3. Consider splitting complex components into Server and Client parts\n`;
  
  return report;
};
