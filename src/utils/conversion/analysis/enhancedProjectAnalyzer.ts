
/**
 * Enhanced project analyzer
 * Integrates various analysis modules to provide comprehensive project insights
 */
import { UploadedFiles } from '@/types/conversion';
import { logConversion } from '../logger';
import { analyzeLibraryUsage, analyzeHookUsage, determineClientComponents } from './dependencyAnalyzer';
import { buildProjectDependencyGraph, extractAliases } from './moduleResolver';
import { processStaticAssets } from './assetAnalyzer';
import { extractEnvironmentVariables, generateEnvFile } from './envVarAnalyzer';
import { analyzeRoutingPatterns, generateNextJsPagesFromRoutes } from './routingAnalyzer';
import { analyzeStateManagement, generateStateMigrationGuide, StateAnalysisResult } from './stateAnalyzer';

/**
 * Comprehensive project analysis result
 */
export interface EnhancedProjectAnalysis {
  // Module resolution
  aliases: Record<string, string>;
  dependencyGraph: {
    imports: Record<string, string[]>;
    exports: Record<string, string[]>;
    missingImports: Record<string, string[]>;
    circularDependencies: [string, string][];
  };
  
  // Dependencies
  libraries: ReturnType<typeof analyzeLibraryUsage>;
  hooks: ReturnType<typeof analyzeHookUsage>;
  clientComponents: string[];
  
  // Assets
  assets: {
    publicAssets: string[];
    optimizedImages: string[];
    cssModules: string[];
    globalCss: string[];
  };
  
  // Environment variables
  envVariables: ReturnType<typeof extractEnvironmentVariables>;
  envFileContent: string;
  
  // Routing
  routing: ReturnType<typeof analyzeRoutingPatterns>;
  generatedPages: ReturnType<typeof generateNextJsPagesFromRoutes>;
  
  // State management
  stateManagement: StateAnalysisResult;
  stateMigrationGuide: string;
  
  // Performance & recommendations
  processingTimeMs: number;
  recommendations: string[];
  compatibility: {
    appRouterCompatible: boolean;
    pagesRouterCompatible: boolean;
    nextVersionRecommendation: string;
  };
  
  // Error tracking
  errors: { file: string; message: string }[];
  warnings: { file: string; message: string }[];
}

/**
 * Run enhanced project analysis
 */
export const analyzeProject = (files: UploadedFiles): EnhancedProjectAnalysis => {
  const startTime = performance.now();
  
  logConversion('info', 'Starting enhanced project analysis...');
  const errors: { file: string; message: string }[] = [];
  const warnings: { file: string; message: string }[] = [];
  
  // 1. Extract aliases and analyze module resolution
  const aliases = extractAliases(files);
  logConversion('info', `Found ${Object.keys(aliases).length} path aliases`);
  
  // 2. Build dependency graph
  const dependencyGraph = buildProjectDependencyGraph(files);
  
  logConversion('info', `Analyzed dependencies: ${Object.keys(dependencyGraph.imports).length} files with imports`);
  if (dependencyGraph.missingImports && Object.keys(dependencyGraph.missingImports).length > 0) {
    logConversion('warning', `Found ${Object.keys(dependencyGraph.missingImports).length} files with missing imports`);
    
    Object.entries(dependencyGraph.missingImports).forEach(([file, missingImports]) => {
      warnings.push({
        file,
        message: `Missing imports: ${missingImports.join(', ')}`
      });
    });
  }
  
  if (dependencyGraph.circularDependencies.length > 0) {
    logConversion('warning', `Found ${dependencyGraph.circularDependencies.length} circular dependencies`);
    dependencyGraph.circularDependencies.forEach(([a, b]) => {
      warnings.push({
        file: a,
        message: `Circular dependency with ${b}`
      });
    });
  }
  
  // 3. Library and hook usage analysis
  const libraries = analyzeLibraryUsage(files);
  const hooks = analyzeHookUsage(files);
  
  // 4. Determine client components
  const clientComponents = determineClientComponents(files, libraries, hooks);
  logConversion('info', `Identified ${clientComponents.length} client components requiring "use client" directive`);
  
  // 5. CSS and static assets analysis
  const assets = processStaticAssets(files);
  logConversion('info', `Found ${assets.publicAssets.length} static assets, ${assets.optimizedImages.length} images to optimize, ${assets.cssModules.length} CSS modules, and ${assets.globalCss.length} global CSS files`);
  
  // 6. Environment variables analysis
  const envVariables = extractEnvironmentVariables(files);
  const envFileContent = generateEnvFile(envVariables);
  logConversion('info', `Found ${Object.keys(envVariables).length} environment variables`);
  
  // 7. Routing analysis
  const routing = analyzeRoutingPatterns(files);
  const generatedPages = generateNextJsPagesFromRoutes(routing);
  
  logConversion('info', `Found ${routing.routes.length} routes${routing.hasReactRouter ? ' using React Router' : ''}`);
  logConversion('info', `Generated ${Object.keys(generatedPages).length} Next.js pages`);
  
  // 8. State management analysis
  const stateManagement = analyzeStateManagement(files);
  const stateMigrationGuide = generateStateMigrationGuide(stateManagement);
  
  logConversion('info', `Identified dominant state management pattern: ${stateManagement.dominantPattern}`);
  
  // 9. Generate compatibility assessment and recommendations
  const compatibility = {
    appRouterCompatible: true,
    pagesRouterCompatible: true,
    nextVersionRecommendation: '13.4.0+'
  };
  
  // Check for App Router incompatibilities
  if (stateManagement.hasClientStateInServerComponents || 
      routing.hasReactRouter || 
      libraries.some(lib => 
        lib.requiresClientDirective && 
        lib.category === 'state-management' && 
        lib.usageCount > 5
      )) {
    // Still compatible but needs more work
    logConversion('warning', 'Project has patterns that may require significant changes for App Router compatibility');
  }
  
  // Generate final recommendations
  const recommendations = [
    ...stateManagement.recommendations,
    // Module resolution recommendations
    ...Object.entries(dependencyGraph.missingImports).map(([file, imports]) => 
      `Fix missing imports in ${file}: ${imports.join(', ')}`
    ).slice(0, 5),
    // React Router migration
    routing.hasReactRouter ? 'Replace React Router with Next.js file-based routing system' : '',
    // CSS recommendations
    assets.cssModules.length > 0 ? 'Keep CSS Modules approach for component styling' : '',
    assets.globalCss.length > 0 ? 'Convert global CSS to globals.css in Next.js' : '',
    // Image optimization
    assets.optimizedImages.length > 0 ? 'Replace <img> tags with next/image for optimization' : '',
    // Client components
    clientComponents.length > 0 ? `Add "use client" directive to ${clientComponents.length} components that use client-side features` : ''
  ].filter(Boolean); // Remove empty strings
  
  const endTime = performance.now();
  const processingTimeMs = Math.round(endTime - startTime);
  
  logConversion('success', `Enhanced project analysis complete in ${processingTimeMs}ms`);
  
  return {
    aliases,
    dependencyGraph,
    libraries,
    hooks,
    clientComponents,
    assets,
    envVariables,
    envFileContent,
    routing,
    generatedPages,
    stateManagement,
    stateMigrationGuide,
    processingTimeMs,
    recommendations,
    compatibility,
    errors,
    warnings
  };
};

/**
 * Generate a summary report of the project analysis
 */
export const generateAnalysisReport = (analysis: EnhancedProjectAnalysis): string => {
  let report = '# Project Analysis Report\n\n';
  
  // Basic stats
  report += '## Project Overview\n\n';
  report += `- **Analysis Time**: ${analysis.processingTimeMs}ms\n`;
  report += `- **Files Analyzed**: ${Object.keys(analysis.dependencyGraph.imports).length}\n`;
  report += `- **Libraries Used**: ${analysis.libraries.length}\n`;
  report += `- **React Hooks Used**: ${analysis.hooks.length}\n`;
  report += `- **Client Components**: ${analysis.clientComponents.length}\n`;
  report += `- **Routes Detected**: ${analysis.routing.routes.length}\n\n`;
  
  // State management
  report += '## State Management\n\n';
  report += `- **Primary Pattern**: ${analysis.stateManagement.dominantPattern}\n`;
  report += `- **Global State Files**: ${analysis.stateManagement.globalStateFiles.length}\n`;
  report += `- **Local State Files**: ${analysis.stateManagement.localStateFiles.length}\n\n`;
  
  // Routing
  report += '## Routing\n\n';
  report += `- **Router Type**: ${analysis.routing.hasReactRouter ? 'React Router' : 'Custom/None'}\n`;
  if (analysis.routing.hasReactRouter) {
    report += `- **Router Version**: ${analysis.routing.routerVersion || 'Unknown'}\n`;
  }
  report += `- **Routes**: ${analysis.routing.routes.length}\n`;
  report += `- **Generated Next.js Pages**: ${Object.keys(analysis.generatedPages).length}\n\n`;
  
  // Assets
  report += '## Assets\n\n';
  report += `- **Public Assets**: ${analysis.assets.publicAssets.length}\n`;
  report += `- **Images to Optimize**: ${analysis.assets.optimizedImages.length}\n`;
  report += `- **CSS Modules**: ${analysis.assets.cssModules.length}\n`;
  report += `- **Global CSS Files**: ${analysis.assets.globalCss.length}\n\n`;
  
  // Environment variables
  report += '## Environment Variables\n\n';
  report += `- **Total Variables**: ${Object.keys(analysis.envVariables).length}\n`;
  report += `- **Public Variables**: ${Object.values(analysis.envVariables).filter(v => v.isPublic).length}\n`;
  report += `- **Private Variables**: ${Object.values(analysis.envVariables).filter(v => !v.isPublic).length}\n\n`;
  
  // Libraries
  report += '## Top Libraries\n\n';
  const topLibraries = [...analysis.libraries].sort((a, b) => b.usageCount - a.usageCount).slice(0, 10);
  report += '| Library | Category | Files | Client-only |\n';
  report += '|---------|----------|-------|------------|\n';
  topLibraries.forEach(lib => {
    report += `| ${lib.name} | ${lib.category} | ${lib.files.length} | ${lib.requiresClientDirective ? 'Yes' : 'No'} |\n`;
  });
  report += '\n';
  
  // Top hooks
  report += '## Top React Hooks\n\n';
  const topHooks = [...analysis.hooks].sort((a, b) => b.usageCount - a.usageCount).slice(0, 10);
  report += '| Hook | Usage Count | Files | Client-only |\n';
  report += '|------|-------------|-------|------------|\n';
  topHooks.forEach(hook => {
    report += `| ${hook.name} | ${hook.usageCount} | ${hook.files.length} | ${hook.requiresClientDirective ? 'Yes' : 'No'} |\n`;
  });
  report += '\n';
  
  // Compatibility assessment
  report += '## Next.js Compatibility\n\n';
  report += `- **App Router Compatible**: ${analysis.compatibility.appRouterCompatible ? 'Yes' : 'No'}\n`;
  report += `- **Pages Router Compatible**: ${analysis.compatibility.pagesRouterCompatible ? 'Yes' : 'No'}\n`;
  report += `- **Recommended Next.js Version**: ${analysis.compatibility.nextVersionRecommendation}\n\n`;
  
  // Recommendations
  report += '## Key Recommendations\n\n';
  analysis.recommendations.forEach(rec => {
    report += `- ${rec}\n`;
  });
  report += '\n';
  
  // Issues
  report += '## Issues to Address\n\n';
  if (analysis.errors.length > 0) {
    report += '### Errors\n\n';
    analysis.errors.forEach(({file, message}) => {
      report += `- **${file}**: ${message}\n`;
    });
    report += '\n';
  }
  
  if (analysis.warnings.length > 0) {
    report += '### Warnings\n\n';
    analysis.warnings.slice(0, 10).forEach(({file, message}) => {
      report += `- **${file}**: ${message}\n`;
    });
    
    if (analysis.warnings.length > 10) {
      report += `- And ${analysis.warnings.length - 10} more warnings...\n`;
    }
    report += '\n';
  }
  
  return report;
};
