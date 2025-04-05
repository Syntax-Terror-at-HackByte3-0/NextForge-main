
import { useState } from 'react';
import { toast } from "sonner";
import FileUploadArea from './upload/FileUploadArea';
import CodePasteArea from './upload/CodePasteArea';
import FilePreview from './upload/FilePreview';
import UploadOptions from './upload/UploadOptions';
import { FileCheck, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
}

const FileUpload = ({ onFilesSelected }: FileUploadProps) => {
  const [uploadMode, setUploadMode] = useState<'files' | 'paste'>('files');
  const [pasteValue, setPasteValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [filePreview, setFilePreview] = useState<{files: string[], size: number, reactFileCount: number} | null>(null);
  const [processedFiles, setProcessedFiles] = useState<File[] | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  
  const handlePaste = async () => {
    if (pasteValue.trim()) {
      setIsProcessing(true);
      setProcessingError(null);
      
      try {
        // Detect language based on code content
        const language = detectLanguage(pasteValue);
        const fileExtension = language === 'typescript' ? 
                             (pasteValue.includes('JSX') || pasteValue.includes('jsx') ? '.tsx' : '.ts') : 
                             (pasteValue.includes('JSX') || pasteValue.includes('jsx') ? '.jsx' : '.js');
        
        // Create a filename with appropriate extension
        const filename = `pasted-code${fileExtension}`;
        
        // Create a file object from the pasted code
        const file = new File([pasteValue], filename, { 
          type: language === 'typescript' ? 'application/typescript' : 'application/javascript' 
        });
        
        setFilePreview({
          files: [filename],
          size: pasteValue.length,
          reactFileCount: 1 // Assume pasted code is for a React component
        });
        
        // Store as a File object for consistency
        setProcessedFiles([file]);
        
        toast.success("Code processed successfully");
      } catch (error) {
        console.error("Error processing pasted code:", error);
        setProcessingError("Failed to process the pasted code. Ensure it's valid React/JavaScript code.");
        toast.error("Error processing code");
      } finally {
        setIsProcessing(false);
      }
    } else {
      toast.error("Please paste some code first");
    }
  };
  
  const detectLanguage = (code: string): 'typescript' | 'javascript' => {
    // Simple detection based on TypeScript-specific syntax
    const hasTypeAnnotations = /:\s*[A-Za-z]+(<[^>]+>)?(\[\])?/.test(code);
    const hasInterface = /interface\s+[A-Za-z]+\s*\{/.test(code);
    const hasType = /type\s+[A-Za-z]+\s*=/.test(code);
    const hasImportType = /import\s+type/.test(code);
    
    return (hasTypeAnnotations || hasInterface || hasType || hasImportType) ? 'typescript' : 'javascript';
  };
  
  const countReactFiles = (files: File[]): number => {
    return files.filter(file => {
      const name = file.name.toLowerCase();
      return name.endsWith('.jsx') || 
             name.endsWith('.tsx') || 
             (name.endsWith('.js') && !name.includes('.min.js')) || 
             name.endsWith('.ts');
    }).length;
  };
  
  const processFiles = async (files: File[]) => {
    setIsProcessing(true);
    setProcessingError(null);
    
    try {
      // Calculate file stats
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      const fileNames = files.map(file => file.name);
      const reactFileCount = countReactFiles(files);
      
      // Generate a preview
      setFilePreview({
        files: fileNames,
        size: totalSize,
        reactFileCount
      });
      
      // Store the files
      setProcessedFiles(files);
      
      // Display appropriate messages based on file analysis
      if (reactFileCount === 0) {
        toast.warning("No React component files detected. Conversion may be limited.");
      } else if (files.some(f => f.name.endsWith('.zip'))) {
        toast.success(`Processing ZIP archive with ${reactFileCount} React files`);
      } else {
        toast.success(`${files.length} files processed (${reactFileCount} React files)`);
      }
      
      console.log(`Processed ${files.length} files with ${reactFileCount} React files`);
    } catch (error) {
      console.error("Error processing files:", error);
      setProcessingError(error instanceof Error ? error.message : "Error processing files");
      toast.error(error instanceof Error ? error.message : "Error processing files");
    } finally {
      setIsProcessing(false);
    }
  };
  
  const resetUpload = () => {
    setFilePreview(null);
    setPasteValue('');
    setProcessedFiles(null);
    setProcessingError(null);
  };
  
  const handleStartConversion = () => {
    if (processedFiles && processedFiles.length > 0) {
      onFilesSelected(processedFiles);
    } else {
      toast.error("No files are ready for conversion");
    }
  };
  
  return (
    <section id="convert" className="py-20">
      <div className="container mx-auto px-6">
        <div className="text-center mb-10 animate-slide-up">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Convert Your React Code</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Upload your React project files or paste your code to convert it to Next.js.
          </p>
        </div>
        
        <div className="max-w-3xl mx-auto glass rounded-lg p-6 animate-fade-in">
          {filePreview ? (
            <FilePreview 
              files={filePreview.files}
              size={filePreview.size}
              onReset={resetUpload}
              onStartConversion={handleStartConversion}
              isProcessing={isProcessing}
              reactFileCount={filePreview.reactFileCount}
            />
          ) : (
            <>
              <UploadOptions 
                uploadMode={uploadMode}
                setUploadMode={setUploadMode}
              />
              
              {processingError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <p className="text-red-700 font-medium">Processing Error</p>
                    <p className="text-red-600 text-sm">{processingError}</p>
                  </div>
                </div>
              )}
              
              {uploadMode === 'files' ? (
                <FileUploadArea 
                  onFilesSelected={processFiles}
                  isProcessing={isProcessing}
                />
              ) : (
                <CodePasteArea
                  pasteValue={pasteValue}
                  setPasteValue={setPasteValue}
                  onPasteSubmit={handlePaste}
                  isProcessing={isProcessing}
                />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default FileUpload;
