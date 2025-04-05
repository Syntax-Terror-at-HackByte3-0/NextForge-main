
/**
 * Advanced React to Next.js conversion engine
 */
import { ConversionOutput, ConversionSettings } from './conversion/types';
import { UploadedFiles } from '@/types/conversion';
import { convertReactToNext } from './conversion/conversionManager';
import { getConversionLogs, clearConversionLogs, logConversion } from './conversion/logger';
import { analyzeProjectStructure } from './projectAnalysis';
import { validateCodeSyntax } from './conversion/analysis/validatorUtils';
import { analyzeProject, generateAnalysisReport } from './conversion/analysis/enhancedProjectAnalyzer';

// Re-export the main conversion function
export { convertReactToNext, getConversionLogs, clearConversionLogs, logConversion };

/**
 * Enhanced React to Next.js conversion with better error handling
 */
export const enhancedReactToNextConversion = async (
  files: UploadedFiles,
  settings: ConversionSettings = { appDir: false, typescript: true, includeExamples: true }
): Promise<ConversionOutput> => {
  clearConversionLogs();
  logConversion('info', 'Starting enhanced conversion process...');
  
  try {
    // Add validation check for syntax errors
    let syntaxErrors = 0;
    for (const [fileName, content] of Object.entries(files)) {
      if (fileName.endsWith('.js') || fileName.endsWith('.jsx') || 
          fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
        const validation = validateCodeSyntax(content);
        if (!validation.valid) {
          logConversion('warning', `Syntax errors in ${fileName}: ${validation.errors.join(', ')}`);
          syntaxErrors++;
        }
      }
    }
    
    if (syntaxErrors > 0) {
      logConversion('warning', `Found ${syntaxErrors} files with syntax errors. Attempting to convert anyway.`);
    }
    
    // Run enhanced project analysis
    logConversion('info', 'Running enhanced project analysis...');
    const enhancedAnalysis = analyzeProject(files);
    
    // Generate analysis report
    const analysisReport = generateAnalysisReport(enhancedAnalysis);
    logConversion('info', 'Project analysis complete.');
    
    // Basic project structure analysis (legacy - will be fully replaced by enhanced analysis)
    const projectAnalysis = analyzeProjectStructure(files);
    logConversion('info', `Basic analysis complete. Found ${projectAnalysis.componentCount} components, ${projectAnalysis.pageCount} pages`);
    
    // Update settings based on project analysis
    if (projectAnalysis.hasTypeScript || enhancedAnalysis.hooks.some(h => h.name === 'useTypedSelector')) {
      settings.typescript = true;
      logConversion('info', 'TypeScript detected, enabling TypeScript support');
    }
    
    // Determine if we should use App Router or Pages Router
    const shouldUseAppRouter = enhancedAnalysis.compatibility.appRouterCompatible && 
                              !enhancedAnalysis.compatibility.pagesRouterCompatible;
    
    const hasReactRouter = enhancedAnalysis.routing.hasReactRouter;
    
    if (shouldUseAppRouter) {
      settings.appDir = true;
      settings.routingStrategy = 'app';
      logConversion('info', 'Project analysis suggests using App Router');
    } else {
      settings.routingStrategy = 'pages';
      logConversion('info', 'Using Pages Router for conversion');
    }
    
    // Add environment variables file
    if (Object.keys(enhancedAnalysis.envVariables).length > 0) {
      logConversion('info', `Adding .env.local with ${Object.keys(enhancedAnalysis.envVariables).length} environment variables`);
    }
    
    // Perform the conversion
    const output = convertReactToNext(files);
    
    // Add analysis report to output
    output.config['analysis-report.md'] = analysisReport;
    
    // Add environment variables file if we found any
    if (Object.keys(enhancedAnalysis.envVariables).length > 0) {
      output.config['.env.local'] = enhancedAnalysis.envFileContent;
    }
    
    // Add state management migration guide if needed
    if (enhancedAnalysis.stateManagement.globalStateFiles && enhancedAnalysis.stateManagement.globalStateFiles.length > 0) {
      output.config['state-migration-guide.md'] = enhancedAnalysis.stateMigrationGuide;
    }
    
    // Post-process for quality control
    const fileCount = {
      pages: Object.keys(output.pages).length,
      components: Object.keys(output.components).length,
      api: Object.keys(output.api).length,
      styles: Object.keys(output.styles).length,
      configs: Object.keys(output.config).length
    };
    
    logConversion('success', `Conversion complete. Generated ${fileCount.pages} pages, ${fileCount.components} components, ${fileCount.api} API routes`);
    
    return output;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown conversion error';
    logConversion('error', `Conversion failed: ${errorMessage}`);
    
    // Return a minimal valid output structure with error info
    return {
      pages: {
        'index.js': `export default function ErrorPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-red-500 mb-4">Conversion Error</h1>
      <p className="mb-4">There was an error converting your React project:</p>
      <pre className="bg-gray-100 p-4 rounded overflow-auto">${errorMessage}</pre>
      <p className="mt-4">Please check your code and try again.</p>
    </div>
  );
}`
      },
      components: {},
      api: {},
      styles: {
        'globals.css': 'body { font-family: sans-serif; }'
      },
      config: {
        'README.md': `# Conversion Error\n\nThere was an error converting your React project: ${errorMessage}\n\nPlease check your code and try again.`
      },
      public: {}
    };
  }
};
