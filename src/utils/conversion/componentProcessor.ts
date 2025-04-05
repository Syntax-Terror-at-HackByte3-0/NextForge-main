
/**
 * Processes components and extracts analysis information
 */
import { UploadedFiles } from '@/types/conversion';
import { analyzeComponent } from './analyzeComponent';
import { extractRoutes } from './routeExtractor';
import { logConversion } from './logger';
import { detectFileType } from './analysis/fileTypeDetector';
import { buildDependencyGraph, identifyComponentPatterns, parseCode } from './analysis/astUtils';

/**
 * Process all components in the uploaded files
 */
export const processComponents = (
  files: UploadedFiles,
  allDependencies: string[]
): {
  fileAnalysis: Record<string, ReturnType<typeof analyzeComponent>>;
  routeConfigs: Record<string, Record<string, string>>;
  contextProviders: string[];
  stateManagement: string[];
  componentGraph: Record<string, string[]>;
  patternAnalysis: Record<string, { patterns: string[], complexity: string, suggestions: string[] }>;
} => {
  // Map to track all component file analysis
  const fileAnalysis: Record<string, ReturnType<typeof analyzeComponent>> = {};
  
  // Track React Router route configurations
  const routeConfigs: Record<string, Record<string, string>> = {};
  
  // Track context providers and state management files
  const contextProviders: string[] = [];
  const stateManagement: string[] = [];
  
  // Build component dependency graph
  const componentGraph: Record<string, string[]> = {};
  
  // Store pattern analysis for each component
  const patternAnalysis: Record<string, { 
    patterns: string[], 
    complexity: string, 
    suggestions: string[] 
  }> = {};
  
  // Analyze all files
  Object.entries(files).forEach(([filename, content]) => {
    // Analyze JavaScript/TypeScript files
    if (/\.(js|jsx|ts|tsx)$/.test(filename)) {
      try {
        // First check filename for context/provider patterns
        if (filename.includes('Context') || 
            filename.includes('Provider') || 
            filename.includes('context') || 
            filename.includes('provider')) {
          contextProviders.push(filename);
          logConversion('info', `Found context provider by name: ${filename}`);
        }
        
        const fileType = detectFileType(content, filename);
        const analysis = analyzeComponent(content, filename);
        
        // Add file type to analysis
        analysis.fileType = fileType;
        fileAnalysis[filename] = analysis;
        
        // Collect dependencies for later use
        if (analysis.dependencies.length > 0) {
          allDependencies.push(...analysis.dependencies);
        }
        
        // Analyze patterns to understand component structure
        try {
          const componentPatterns = identifyComponentPatterns(content);
          patternAnalysis[filename] = {
            patterns: componentPatterns.patterns,
            complexity: componentPatterns.complexity,
            suggestions: componentPatterns.suggestions
          };
          
          logConversion('info', `Analyzed patterns in ${filename}: ${componentPatterns.patterns.join(', ')}`);
          
          // Log valuable suggestions for conversion
          componentPatterns.suggestions.forEach(suggestion => {
            logConversion('info', `Suggestion for ${filename}: ${suggestion}`);
          });
        } catch (patternError) {
          logConversion('warning', `Could not analyze patterns in ${filename}: ${(patternError as Error).message}`);
        }
        
        // Build component dependency graph by analyzing imports/exports
        try {
          const ast = parseCode(content);
          const dependencyInfo = buildDependencyGraph(ast);
          
          // Store internal dependencies in the graph
          componentGraph[filename] = dependencyInfo.imports
            .filter(imp => imp.isRelative)
            .map(imp => imp.source);
          
          // Log component relationships
          if (componentGraph[filename].length > 0) {
            logConversion('info', `Component ${filename} depends on: ${componentGraph[filename].join(', ')}`);
          }
        } catch (graphError) {
          logConversion('warning', `Could not build dependency graph for ${filename}: ${(graphError as Error).message}`);
        }
        
        // Track special file types
        if (fileType === 'context') {
          if (!contextProviders.includes(filename)) {
            contextProviders.push(filename);
            logConversion('info', `Found context provider by content: ${filename}`);
          }
        } else if (fileType === 'store' || fileType === 'reducer') {
          stateManagement.push(filename);
          logConversion('info', `Found state management file: ${filename}`);
        }
        
        // Check for routing configuration
        if ((content.includes('<Route') && 
             (content.includes('<Routes') || 
              content.includes('<Switch') || 
              content.includes('createBrowserRouter'))) ||
            (content.includes('next/router') && content.includes('useRouter'))) {
          routeConfigs[filename] = extractRoutes(content);
          logConversion('info', `Found route configuration with ${Object.keys(routeConfigs[filename]).length} routes`, filename);
        }
      } catch (error) {
        logConversion('error', `Failed to analyze file: ${(error as Error).message}`, filename);
      }
    }
  });
  
  // Analyze component relationships to better inform conversion process
  analyzeComponentRelationships(componentGraph, fileAnalysis, patternAnalysis);
  
  logConversion('info', `Analyzed ${Object.keys(fileAnalysis).length} code files, found ${contextProviders.length} context providers`);
  
  return {
    fileAnalysis,
    routeConfigs,
    contextProviders,
    stateManagement,
    componentGraph,
    patternAnalysis
  };
};

/**
 * Analyze relationships between components to inform conversion process
 */
function analyzeComponentRelationships(
  componentGraph: Record<string, string[]>,
  fileAnalysis: Record<string, ReturnType<typeof analyzeComponent>>,
  patternAnalysis: Record<string, { patterns: string[], complexity: string, suggestions: string[] }>
) {
  // Identify potential page components (components not imported by others but import others)
  const importedBy: Record<string, string[]> = {};
  
  // Build reverse dependency graph
  Object.entries(componentGraph).forEach(([source, targets]) => {
    targets.forEach(target => {
      // Normalize the target path to match fileAnalysis keys
      const normalizedTarget = Object.keys(fileAnalysis).find(key => 
        key.endsWith(target) || key.endsWith(`${target}.js`) || 
        key.endsWith(`${target}.jsx`) || key.endsWith(`${target}.ts`) || 
        key.endsWith(`${target}.tsx`));
      
      if (normalizedTarget) {
        if (!importedBy[normalizedTarget]) {
          importedBy[normalizedTarget] = [];
        }
        importedBy[normalizedTarget].push(source);
      }
    });
  });
  
  // Components not imported by others could be pages or entry points
  Object.keys(fileAnalysis).forEach(filename => {
    if (!importedBy[filename] || importedBy[filename].length === 0) {
      // This file is not imported by others
      if (componentGraph[filename] && componentGraph[filename].length > 0) {
        // But it imports other components - likely a page
        if (fileAnalysis[filename].fileType !== 'page') {
          logConversion('info', `${filename} is not imported by other components but imports others - could be a page`);
          fileAnalysis[filename].fileType = 'page';
        }
      }
    }
  });
  
  // Identify data flow patterns
  Object.entries(fileAnalysis).forEach(([filename, analysis]) => {
    const patterns = patternAnalysis[filename]?.patterns || [];
    
    // Components using context or Redux likely need special handling in Next.js
    if (patterns.includes('context-consumer') || patterns.includes('redux-hooks')) {
      if (analysis.fileType === 'page') {
        logConversion('info', `Page ${filename} uses shared state - may need to wrap with providers in _app.js`);
      }
    }
    
    // Components with data fetching should be considered for getServerSideProps
    if (analysis.hasDataFetching && analysis.fileType === 'page') {
      logConversion('info', `Page ${filename} has data fetching - consider using getServerSideProps or getStaticProps`);
    }
  });
}
