
/**
 * Enhanced utilities for processing uploaded files
 * Includes better handling for ZIP files, encoding, and optimization
 */
import { toast } from "sonner";
import JSZip from "jszip";
import { UploadedFiles } from "@/types/conversion";

// File processing utility functions
const fileProcessingUtils = {
  /**
   * Read a File object as text with encoding detection
   */
  readFileAsText: async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        let content = reader.result as string;
        // Apply normalization to the content
        content = fileProcessingUtils.normalizeFileContent(content);
        resolve(content);
      };
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsText(file);
    });
  },

  /**
   * Read a File object as ArrayBuffer (for zip processing)
   */
  readFileAsArrayBuffer: (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Normalize file content (line endings, whitespace, etc.)
   */
  normalizeFileContent: (content: string): string => {
    // Normalize line endings
    let normalized = content.replace(/\r\n/g, '\n');
    
    // Trim trailing whitespace on each line
    normalized = normalized.split('\n')
      .map(line => line.trimRight())
      .join('\n');
    
    // Ensure file ends with a newline
    if (!normalized.endsWith('\n')) {
      normalized += '\n';
    }
    
    // Remove multiple consecutive blank lines (more than 2)
    normalized = normalized.replace(/\n{3,}/g, '\n\n');
    
    return normalized;
  },

  /**
   * Determine if a file should be processed based on its filename
   */
  isProcessableFile: (filename: string): boolean => {
    // Check by extension for React files and configuration
    const ext = filename.split('.').pop()?.toLowerCase();
    
    // Process React and configuration files
    const reactExtensions = ['js', 'jsx', 'ts', 'tsx'];
    const configExtensions = ['json', 'css', 'scss', 'html', 'md'];
    const allExtensions = [...reactExtensions, ...configExtensions];
    
    // Check if the extension is in our list
    if (!ext || !allExtensions.includes(ext)) {
      return false;
    }
    
    // Ignore test files, spec files, and common build artifacts
    if (
      filename.includes('.test.') || 
      filename.includes('.spec.') || 
      filename.includes('.min.') ||
      filename.includes('.d.ts') ||
      filename.includes('__tests__') ||
      filename.includes('__mocks__') ||
      filename.includes('.eslintrc') ||
      filename.includes('.prettierrc') ||
      filename.includes('.babelrc')
    ) {
      return false;
    }
    
    return true;
  },

  /**
   * Check if a file is a React component file
   */
  isReactFile: (filename: string): boolean => {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    // Only JSX and TSX files are definitely React component files
    if (ext === 'jsx' || ext === 'tsx') {
      return true;
    }
    
    // JS and TS files might be React component files if they're in certain directories
    if (ext === 'js' || ext === 'ts') {
      return (
        filename.includes('/components/') ||
        filename.includes('/pages/') ||
        filename.includes('/views/') ||
        filename.includes('/containers/') ||
        filename.includes('/screens/')
      );
    }
    
    return false;
  }
};

/**
 * Process a single ZIP file and extract its contents
 */
const processZipFile = async (zipFile: File): Promise<UploadedFiles> => {
  console.log(`Processing zip file: ${zipFile.name}`);
  const fileContents: UploadedFiles = {};
  
  try {
    // Read the zip file
    const zipData = await fileProcessingUtils.readFileAsArrayBuffer(zipFile);
    const zip = await JSZip.loadAsync(zipData);
    
    // Process each file in the zip
    const zipEntries = Object.entries(zip.files);
    console.log(`Found ${zipEntries.length} files in zip`);
    
    let processedCount = 0;
    let reactFilesCount = 0;
    
    // First pass: scan for project structure
    const hasNodeModules = zipEntries.some(([path]) => path.includes('node_modules/'));
    const hasSrcDir = zipEntries.some(([path]) => path.startsWith('src/'));
    const hasPackageJson = zipEntries.some(([path]) => path === 'package.json');
    
    // Determine if this is a typical React project structure
    const isReactProject = hasPackageJson && (hasSrcDir || zipEntries.some(([path]) => 
      path.endsWith('.jsx') || path.endsWith('.tsx')));
    
    if (isReactProject) {
      console.log('Detected React project structure');
    }
    
    // Process each file in the zip archive
    const fileProcessingPromises = zipEntries
      .filter(([path, zipEntry]) => {
        // Skip directories
        if (zipEntry.dir) return false;
        
        // Skip hidden files, node_modules, and other non-relevant directories
        if (path.startsWith('.') || 
            path.includes('node_modules/') || 
            path.includes('dist/') ||
            path.includes('build/') ||
            path.includes('.git/')) {
          return false;
        }
        
        // Check if this is a file we should process
        return fileProcessingUtils.isProcessableFile(path);
      })
      .map(async ([path, zipEntry]) => {
        try {
          const content = await zipEntry.async('string');
          
          // Normalize content (line endings, trailing whitespace)
          const normalizedContent = fileProcessingUtils.normalizeFileContent(content);
          
          // Count React files specifically
          if (fileProcessingUtils.isReactFile(path)) {
            reactFilesCount++;
          }
          
          processedCount++;
          
          return { path, content: normalizedContent };
        } catch (error) {
          console.error(`Error extracting ${path}:`, error);
          return null;
        }
      });
    
    // Wait for all file processing to complete
    const results = await Promise.all(fileProcessingPromises);
    
    // Add successfully processed files to the output
    results.forEach(result => {
      if (result) {
        fileContents[result.path] = result.content;
      }
    });
    
    console.log(`Processed ${processedCount} files from the zip (${reactFilesCount} React files)`);
    
    if (processedCount === 0) {
      toast.error("No valid React files found in the zip. Please check the zip structure.");
    } else if (reactFilesCount === 0) {
      toast.warning("No React component files (.jsx/.tsx) found. Conversion may be limited.");
    } else {
      toast.success(`Extracted ${processedCount} files from ${zipFile.name}`);
    }
  } catch (error) {
    console.error("Error processing zip file:", error);
    toast.error("Failed to process zip file. Make sure it's a valid zip archive.");
  }
  
  return fileContents;
};

/**
 * Process individual files (non-ZIP)
 */
const processIndividualFiles = async (files: File[]): Promise<UploadedFiles> => {
  const fileContents: UploadedFiles = {};
  
  // Filter to only process text files
  const textFiles = files.filter(file => fileProcessingUtils.isProcessableFile(file.name));
  
  // Warn if we're skipping a lot of files
  if (textFiles.length < files.length) {
    const skippedCount = files.length - textFiles.length;
    toast.warning(`Skipped ${skippedCount} non-React files`);
  }
  
  // Process each file in parallel for better performance
  const processingPromises = textFiles.map(async (file) => {
    try {
      const content = await fileProcessingUtils.readFileAsText(file);
      // Normalize the file path to use forward slashes
      const normalizedPath = file.webkitRelativePath || file.name;
      return { path: normalizedPath, content };
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      toast.error(`Failed to process ${file.name}`);
      return null;
    }
  });
  
  const results = await Promise.all(processingPromises);
  
  // Add successfully processed files to the output
  results.forEach(result => {
    if (result) {
      fileContents[result.path] = result.content;
    }
  });
  
  return fileContents;
};

/**
 * Main function to process uploaded files
 */
export const processUploadedFiles = async (files: File[]): Promise<UploadedFiles> => {
  console.log(`Processing ${files.length} files...`);
  
  // Check file count
  if (files.length === 0) {
    toast.error("No files provided. Please upload at least one React file.");
    return {};
  }
  
  // Validate file sizes first to prevent processing extremely large files
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit per file
  const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total limit
  
  let totalSize = 0;
  for (const file of files) {
    totalSize += file.size;
    
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File ${file.name} exceeds the maximum size limit of 10MB`);
      return {};
    }
  }
  
  if (totalSize > MAX_TOTAL_SIZE) {
    toast.error(`Total files size exceeds the maximum limit of 50MB`);
    return {};
  }
  
  // Initialize the result object
  let fileContents: UploadedFiles = {};
  
  // Check if there's a zip file
  const zipFile = files.find(file => file.name.endsWith('.zip'));
  
  if (zipFile) {
    // Process the ZIP file
    fileContents = await processZipFile(zipFile);
  } else {
    // Process individual files
    fileContents = await processIndividualFiles(files);
  }
  
  // Validation: Check if we got any valid files after processing
  if (Object.keys(fileContents).length === 0) {
    console.error("No valid files found after processing uploads");
    toast.error("No React files detected. Please upload .js, .jsx, .ts, .tsx files or a React project zip.");
    return {};
  }
  
  // Check for React component files
  const reactFileCount = Object.keys(fileContents).filter(path => 
    fileProcessingUtils.isReactFile(path)
  ).length;
  
  if (reactFileCount === 0) {
    toast.warning("No React component files found. The conversion might be limited.");
  } else {
    console.log(`Successfully processed ${Object.keys(fileContents).length} files (${reactFileCount} React files)`);
  }
  
  return fileContents;
};
