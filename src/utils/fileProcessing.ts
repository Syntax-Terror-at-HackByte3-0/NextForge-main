
/**
 * Main file processing service
 * Orchestrates the conversion process with enhanced file handling
 */
import { ConversionResult, FileNode, UploadedFiles } from "@/types/conversion";
import { ConversionSettings } from "./conversion/types";
import { getConversionLogs, clearConversionLogs, logConversion } from "./conversionLogic";
import { processUploadedFiles } from "./fileUploadProcessing";
import { analyzeProjectStructure } from "./projectAnalysis";
import { generateFileMap, createDefaultFileStructure } from "./fileStructureGenerator";
import { prepareDownloadZip } from "./downloadHelper";
import { validateConversion } from "./conversion/validator";
import { enhancedReactToNextConversion } from "./conversion/enhancedConversion";
import { applyAllImportTransformations } from "./conversion/transform/importExtensions";
import { applyAllAssetTransformations } from "./conversion/transform/assetTransform";
import { getLanguageType, isTypeScriptFile } from "./conversion/analysis/fileTypeDetector";
import { timer } from "./helpers";
import { validateSyntax, batchValidate, generateValidationReport } from "./conversion/analysis/enhancedSyntaxValidator";
import { toast } from "sonner";

// Re-export utility functions
export { processUploadedFiles, analyzeProjectStructure, prepareDownloadZip };

/**
 * Applies transformations to a single file
 */
export const processFileContent = async (
  filePath: string,
  content: string
): Promise<string> => {
  try {
    // Only process JavaScript/TypeScript files
    if (!/\.(jsx?|tsx?)$/.test(filePath)) {
      return content;
    }
    
    // Determine file language type
    const languageType = getLanguageType(filePath);
    
    // Log file type information
    console.log(`Processing file: ${filePath}, detected type: ${languageType}`);
    
    // Apply language-specific transformations
    if (languageType !== 'other') {
      logConversion('info', `Processing ${isTypeScriptFile(filePath) ? 'TypeScript' : 'JavaScript'} file: ${filePath}`);
    }
    
    // Enhanced syntax validation
    const validationResult = validateSyntax(filePath, content);
    
    // Log validation issues
    if (!validationResult.valid) {
      validationResult.errors.forEach(error => {
        logConversion('error', `Syntax Error in ${filePath}: ${error.message}`);
      });
    }
    
    if (validationResult.warnings.length > 0) {
      validationResult.warnings.forEach(warning => {
        logConversion('warning', `Syntax Warning in ${filePath}: ${warning.message}`);
      });
    }
    
    // Apply all transformations
    let transformedContent = content;
    
    // Apply import transformations
    transformedContent = applyAllImportTransformations(transformedContent);
    
    // Apply asset transformations (images, fonts, scripts, redirects, metadata)
    transformedContent = applyAllAssetTransformations(transformedContent);
    
    return transformedContent;
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    logConversion('error', `Failed to process file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return content; // Return original content on error
  }
};

/**
 * Converts uploaded React files to a Next.js project
 * Enhanced with validation and better error handling
 */
export const convertProject = async (
  uploadedFiles: File[],
  settings: ConversionSettings = { appDir: false, typescript: true, includeExamples: true }
): Promise<ConversionResult> => {
  // Start performance timer
  const conversionTimer = timer();
  const perfLogs: Record<string, number> = {};
  
  try {
    // Clear previous conversion logs to avoid mixing logs from different conversions
    clearConversionLogs();
    
    // Ensure we have at least one file to process
    if (!uploadedFiles || uploadedFiles.length === 0) {
      logConversion('warning', 'No files provided for conversion');
      throw new Error('No files provided for conversion');
    }
    
    console.log('Starting conversion with files:', uploadedFiles.map(f => f.name));
    logConversion('info', `Starting conversion with ${uploadedFiles.length} files`);
    
    // Process the uploaded files to get file contents
    const startProcessingTime = Date.now();
    const rawFiles = await processUploadedFiles(uploadedFiles);
    perfLogs['file_processing'] = conversionTimer.checkpoint();
    console.log(`Files processed in ${Date.now() - startProcessingTime}ms:`, Object.keys(rawFiles));
    
    // Check if we got any files after processing
    if (Object.keys(rawFiles).length === 0) {
      logConversion('warning', 'No valid files found after processing uploads');
      toast.warning("No valid files found. Creating a default Next.js project structure.");
      
      // Create a default structure if no files were processed
      const defaultFileStructure = createDefaultFileStructure();
      
      return {
        pages: {
          'index.js': defaultFileStructure.children?.find(c => c.name === 'pages')
            ?.children?.find(c => c.name === 'index.js')?.content || 'export default () => <div>Hello World</div>'
        },
        components: {},
        api: {
          'hello.js': 'export default function handler(req, res) { res.status(200).json({ message: "Hello World" }); }'
        },
        styles: {
          'globals.css': defaultFileStructure.children?.find(c => c.name === 'styles')
            ?.children?.find(c => c.name === 'globals.css')?.content || ''
        },
        config: {
          'next.config.js': 'module.exports = { reactStrictMode: true };'
        },
        public: {},
        fileStructure: defaultFileStructure,
        logs: getConversionLogs(),
        stats: {
          totalFiles: 0,
          convertedFiles: 0,
          conversionTime: 0
        }
      };
    }
    
    // Apply transformations to each file before conversion
    const files: UploadedFiles = {};
    for (const [filePath, content] of Object.entries(rawFiles)) {
      files[filePath] = await processFileContent(filePath, content);
    }
    perfLogs['content_transformation'] = conversionTimer.checkpoint();
    
    // Analyze the project structure
    const analysis = analyzeProjectStructure(files);
    perfLogs['project_analysis'] = conversionTimer.checkpoint();
    console.log('Project analysis:', analysis);
    
    // Override settings from analysis if needed
    if (analysis.hasTypeScript) {
      settings.typescript = true;
      logConversion('info', 'TypeScript detected in project, enabling TypeScript support');
    }
    
    // Perform batch validation of all files
    const validationResults = batchValidate(files);
    const validationReport = generateValidationReport(validationResults);
    console.log('Validation report:', validationReport);
    
    // Count validation issues
    const errorCount = Object.values(validationResults)
      .reduce((count, result) => count + result.errors.length, 0);
    
    const warningCount = Object.values(validationResults)
      .reduce((count, result) => count + result.warnings.length, 0);
    
    if (errorCount > 0) {
      logConversion('warning', `Found ${errorCount} syntax errors in the project. Attempting to convert anyway.`);
    }
    
    if (warningCount > 0) {
      logConversion('info', `Found ${warningCount} potential compatibility warnings to review.`);
    }
    
    // Convert the React app to Next.js using enhanced converter
    const startConversionTime = Date.now();
    const conversionOutput = await enhancedReactToNextConversion(files, settings);
    perfLogs['core_conversion'] = conversionTimer.checkpoint();
    const conversionTime = Date.now() - startConversionTime;
    
    console.log(`Conversion completed in ${conversionTime}ms, generated:`, {
      pages: Object.keys(conversionOutput.pages).length,
      components: Object.keys(conversionOutput.components).length,
      api: Object.keys(conversionOutput.api).length,
      styles: Object.keys(conversionOutput.styles).length,
      config: Object.keys(conversionOutput.config).length
    });
    
    // Validate the conversion result
    const validation = validateConversion(conversionOutput);
    perfLogs['validation'] = conversionTimer.checkpoint();
    
    if (!validation.valid) {
      logConversion('warning', `Conversion completed with ${validation.errors.length} validation errors`);
    } else {
      logConversion('success', 'Conversion validated successfully');
    }
    
    // Get conversion logs
    const logs = getConversionLogs();
    
    // Generate the file structure
    const fileStructure = generateFileMap(conversionOutput);
    perfLogs['file_structure_generation'] = conversionTimer.checkpoint();
    
    // Log performance metrics
    logConversion('info', `Performance metrics:
- File processing: ${perfLogs['file_processing']}ms
- Content transformation: ${perfLogs['content_transformation']}ms
- Project analysis: ${perfLogs['project_analysis']}ms
- Core conversion: ${perfLogs['core_conversion']}ms
- Validation: ${perfLogs['validation']}ms
- File structure generation: ${perfLogs['file_structure_generation']}ms
- Total time: ${conversionTimer.total()}ms`);
    
    // Return a complete ConversionResult object
    return {
      ...conversionOutput,
      fileStructure,
      logs,
      stats: {
        totalFiles: Object.keys(files).length,
        convertedFiles: Object.keys(conversionOutput.pages).length + 
                      Object.keys(conversionOutput.components).length + 
                      Object.keys(conversionOutput.api).length,
        conversionTime
      }
    };
  } catch (error) {
    console.error('Error converting project:', error);
    logConversion('error', `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    // Create a minimal valid structure even when there's an error
    const errorMessage = error instanceof Error ? error.message : 'Unknown conversion error';
    
    // Create a default file structure with error information
    const errorFileStructure = createDefaultFileStructure();
    
    // Add error information to the index page
    const pagesDir = errorFileStructure.children?.find(c => c.name === 'pages');
    if (pagesDir && pagesDir.children) {
      const indexFile = pagesDir.children.find(c => c.name === 'index.js');
      if (indexFile) {
        indexFile.content = `export default function ErrorPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-red-500 mb-4">Conversion Error</h1>
      <p className="mb-4">There was an error converting your React project:</p>
      <pre className="bg-gray-100 p-4 rounded overflow-auto">${errorMessage}</pre>
      <p className="mt-4">Please check your code and try again.</p>
      <p className="mt-2">Make sure you have uploaded valid React files (.js, .jsx, .ts, .tsx).</p>
      <a href="/" className="text-blue-500 hover:underline">Try again</a>
    </div>
  );
}`;
      }
    }
    
    // Create a basic error result
    const errorResult: ConversionResult = {
      pages: {
        'index.js': `export default function ErrorPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-red-500 mb-4">Conversion Error</h1>
      <p className="mb-4">There was an error converting your React project:</p>
      <pre className="bg-gray-100 p-4 rounded overflow-auto">${errorMessage}</pre>
      <p className="mt-4">Please check your code and try again.</p>
      <p className="mt-2">Make sure you have uploaded valid React files (.js, .jsx, .ts, .tsx).</p>
      <a href="/" className="text-blue-500 hover:underline">Try again</a>
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
      public: {},
      fileStructure: errorFileStructure,
      logs: {
        errors: [errorMessage],
        warnings: [],
        info: []
      },
      stats: {
        totalFiles: 0,
        convertedFiles: 0,
        conversionTime: 0
      }
    };
    
    return errorResult;
  }
};
