/**
 * Enhanced React to Next.js conversion with detailed logging and better error handling
 */
import { ConversionOutput, ConversionSettings, ConversionLog } from './types';
import { UploadedFiles } from '@/types/conversion';
import { convertReactToNext } from './conversionManager';
import { getConversionLogs, clearConversionLogs, logConversion } from './logger';
import { analyzeProjectStructure } from '../projectAnalysis';
import { validateCodeSyntax, validateServerComponentCompatibility } from './analysis/validatorUtils';
import { 
  analyzeServerComponentCompatibility, 
  categorizeComponents, 
  generateServerComponentReport 
} from './analysis/enhancedServerComponentAnalyzer';
import { buildProjectDependencyGraph } from './analysis/moduleResolver';
import { timer } from '../helpers';

/**
 * Enhanced React to Next.js conversion with better error handling and detailed logging
 */
export const enhancedReactToNextConversion = async (
  files: UploadedFiles,
  settings: ConversionSettings = { appDir: false, typescript: true, includeExamples: true }
): Promise<ConversionOutput> => {
  clearConversionLogs();
  logConversion('info', 'Starting enhanced conversion process...');
  
  // Start timer to track performance
  const conversionTimer = timer();
  const perfLogs: Record<string, number> = {};
  
  try {
    // Step 1: Validate syntax
    logConversion('info', 'Validating syntax of all files...');
    let syntaxErrors = 0;
    const fileValidationIssues: Record<string, string[]> = {};
    
    for (const [fileName, content] of Object.entries(files)) {
      if (fileName.endsWith('.js') || fileName.endsWith('.jsx') || 
          fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
        const validation = validateCodeSyntax(content);
        if (!validation.valid) {
          logConversion('warning', `Syntax errors in ${fileName}: ${validation.errors.join(', ')}`);
          fileValidationIssues[fileName] = validation.errors;
          syntaxErrors++;
        }
      }
    }
    
    perfLogs['syntax_validation'] = conversionTimer.checkpoint();
    
    if (syntaxErrors > 0) {
      logConversion('warning', `Found ${syntaxErrors} files with syntax errors. Attempting to convert anyway.`);
    }
    
    // Step 2: Project analysis
    logConversion('info', 'Analyzing project structure...');
    const projectAnalysis = analyzeProjectStructure(files);
    logConversion('info', `Project analysis complete. Found ${projectAnalysis.componentCount} components, ${projectAnalysis.pageCount} pages`);
    logConversion('info', `Detected libraries: ${projectAnalysis.dependencies.join(', ')}`);
    
    perfLogs['project_analysis'] = conversionTimer.checkpoint();
    
    // Step 3: Configure conversion settings based on analysis
    if (projectAnalysis.hasTypeScript) {
      settings.typescript = true;
      logConversion('info', 'TypeScript detected, enabling TypeScript support');
    }
    
    // Determine if we should use App Router or Pages Router
    const nextVersionHint = projectAnalysis.dependencies.find(dep => 
      dep.startsWith('next@') || dep === 'next'
    );
    
    // If we find a dependency hint for Next.js 13+, suggest App Router
    if (nextVersionHint && nextVersionHint.includes('13')) {
      settings.appDir = true;
      settings.routingStrategy = 'app';
      logConversion('info', 'Next.js 13+ detected, recommending App Router');
    } else {
      settings.routingStrategy = 'pages';
      logConversion('info', 'Using Pages Router for conversion');
    }
    
    // Step 4: NEW STEP - Enhanced Server Component Analysis for App Router
    if (settings.appDir) {
      logConversion('info', 'Performing enhanced Server Component compatibility analysis...');
      
      // Build component dependency graph for cross-component analysis
      const dependencyGraph = buildProjectDependencyGraph(files);
      
      // Perform server component compatibility categorization
      const serverComponentAnalysis = categorizeComponents(files, dependencyGraph.imports);
      
      logConversion('info', `
Server Component Analysis Results:
- Server Components: ${serverComponentAnalysis.serverComponents.length}
- Client Components: ${serverComponentAnalysis.clientComponents.length}
- Mixed Components: ${serverComponentAnalysis.mixedComponents.length}
- API Routes: ${serverComponentAnalysis.apiRoutes.length}
- Unknown: ${serverComponentAnalysis.unknownComponents.length}`);
      
      // Generate detailed report
      const serverComponentReport = generateServerComponentReport(serverComponentAnalysis);
      
      // Add markers to code for components that need "use client" directive
      for (const [filePath, content] of Object.entries(files)) {
        if (!filePath.endsWith('.js') && !filePath.endsWith('.jsx') && 
            !filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
          continue;
        }
        
        if (serverComponentAnalysis.clientComponents.includes(filePath) || 
            serverComponentAnalysis.mixedComponents.includes(filePath)) {
          // Get the full analysis for this file
          const fileAnalysis = serverComponentAnalysis.fullAnalysis[filePath];
          
          if (fileAnalysis && fileAnalysis.suggestedDirective === 'use client') {
            // Check if the file doesn't already have use client directive
            if (!content.includes('"use client"') && !content.includes("'use client'")) {
              // Generate a helpful comment explaining why
              const reasonsComment = fileAnalysis.clientFeatures.length > 0 
                ? `/*
 * This component requires the "use client" directive because:
${fileAnalysis.clientFeatures.slice(0, 3).map(f => ` * - ${f.description}`).join('\n')}${fileAnalysis.clientFeatures.length > 3 ? `\n * - and ${fileAnalysis.clientFeatures.length - 3} more` : ''}
 */`
                : '';
              
              // Update the file content with use client directive
              files[filePath] = `"use client";
${reasonsComment ? `\n${reasonsComment}\n` : ''}
${content}`;
              
              logConversion('info', `Added "use client" directive to ${filePath}`);
            }
          }
        }
      }
      
      perfLogs['server_component_analysis'] = conversionTimer.checkpoint();
    }
    
    // Step 5: Perform the conversion
    logConversion('info', 'Starting conversion process...');
    const output = await convertReactToNext(files);
    
    perfLogs['conversion'] = conversionTimer.checkpoint();
    
    // Step 6: Post-processing for quality control
    const fileCount = {
      pages: Object.keys(output.pages).length,
      components: Object.keys(output.components).length,
      api: Object.keys(output.api).length,
      styles: Object.keys(output.styles).length,
      configs: Object.keys(output.config).length
    };
    
    // Log performance metrics
    logConversion('info', `Performance metrics:
- Syntax validation: ${perfLogs['syntax_validation']}ms
- Project analysis: ${perfLogs['project_analysis']}ms
${settings.appDir ? `- Server component analysis: ${perfLogs['server_component_analysis']}ms\n` : ''}
- Conversion: ${perfLogs['conversion']}ms
- Total time: ${conversionTimer.total()}ms`);
    
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
