
import { useState, useEffect } from 'react';
import { FileNode, ConversionResult } from '@/types/conversion';
import { toast } from "@/components/ui/use-toast";
import { prepareDownloadZip } from '@/utils/downloadHelper';
import ResultHeader from './result/ResultHeader';
import ProjectContainer from './result/ProjectContainer';
import Instructions from './result/Instructions';
import { AlertTriangle } from 'lucide-react';

interface ResultDisplayProps {
  isVisible: boolean;
  conversionResult?: ConversionResult;
}

const ResultDisplay = ({ isVisible, conversionResult }: ResultDisplayProps) => {
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showWarnings, setShowWarnings] = useState(false);
  
  useEffect(() => {
    console.log('ResultDisplay: received conversionResult', conversionResult);
    
    // Reset selected file when conversion result changes
    setSelectedFile(null);
    
    // Show warnings toast if there are warnings
    if (conversionResult?.logs?.warnings && conversionResult.logs.warnings.length > 0) {
      toast({
        title: "Conversion completed with warnings",
        description: `${conversionResult.logs.warnings.length} warnings were found. Click on warnings to view details.`,
        action: (
          <div className="bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 
                        px-3 py-1 rounded-md flex items-center text-sm cursor-pointer"
               onClick={() => setShowWarnings(true)}>
            <AlertTriangle className="w-4 h-4 mr-2" />
            View
          </div>
        )
      });
    }
    
    // If conversion result is available and visible, try to select a good starting file
    if (conversionResult && isVisible) {
      // Try to find a good initial file to display (index.js or README)
      const findInitialFile = (node: FileNode): FileNode | null => {
        if (node.type === 'file') {
          if (node.path.endsWith('index.js') || node.path.endsWith('index.tsx')) {
            return node;
          }
          if (node.path.endsWith('README.md')) {
            return node;
          }
          return null;
        }
        
        if (node.children) {
          for (const child of node.children) {
            const found = findInitialFile(child);
            if (found) return found;
          }
        }
        
        return null;
      };
      
      const initialFile = findInitialFile(conversionResult.fileStructure);
      if (initialFile) {
        setSelectedFile(initialFile);
      }
    }
  }, [conversionResult, isVisible]);
  
  if (!isVisible) return null;
  
  const handleDownload = async () => {
    if (!conversionResult) {
      toast({
        title: "No converted project available",
        description: "Please convert a project first.",
        variant: "destructive"
      });
      return;
    }
    
    setIsDownloading(true);
    
    toast({
      title: "Preparing download",
      description: "Your project will be downloaded as a zip file."
    });
    
    try {
      // Generate zip file
      const zipBlob = await prepareDownloadZip(conversionResult.fileStructure);
      
      // Create download link
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nextjs-project.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download complete",
        description: "Your Next.js project has been downloaded.",
      });
    } catch (error) {
      console.error('Error downloading project:', error);
      toast({
        title: "Download failed",
        description: "There was an error preparing your download.",
        variant: "destructive"
      });
    } finally {
      setIsDownloading(false);
    }
  };
  
  const toggleWarnings = () => {
    setShowWarnings(!showWarnings);
  };
  
  // Check if there are any warnings or errors
  const hasWarnings = conversionResult?.logs?.warnings && conversionResult.logs.warnings.length > 0;
  const hasErrors = conversionResult?.logs?.errors && conversionResult.logs.errors.length > 0;
  
  return (
    <section className="py-16 animate-fade-in">
      <div className="container mx-auto px-6">
        <ResultHeader 
          conversionResult={conversionResult} 
          onDownload={handleDownload}
          isDownloading={isDownloading}
          onToggleWarnings={toggleWarnings}
          hasWarnings={hasWarnings}
          showWarnings={showWarnings}
        />
        
        {/* Warnings panel - conditionally rendered */}
        {showWarnings && (hasWarnings || hasErrors) && (
          <div className="mb-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-md p-4">
            <h3 className="font-medium text-amber-800 dark:text-amber-300 flex items-center mb-2">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Conversion Warnings and Errors
            </h3>
            
            {hasErrors && (
              <div className="mb-3">
                <h4 className="text-red-600 dark:text-red-400 font-medium text-sm mb-1">Errors:</h4>
                <ul className="list-disc pl-5 text-sm space-y-1 text-red-700 dark:text-red-300">
                  {conversionResult?.logs?.errors.map((error, i) => (
                    <li key={`error-${i}`}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {hasWarnings && (
              <div>
                <h4 className="text-amber-600 dark:text-amber-400 font-medium text-sm mb-1">Warnings:</h4>
                <ul className="list-disc pl-5 text-sm space-y-1 text-amber-700 dark:text-amber-300">
                  {conversionResult?.logs?.warnings.map((warning, i) => (
                    <li key={`warning-${i}`}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <p className="text-xs text-gray-500 mt-3">
              These issues may require manual attention after conversion. 
              The converted code should still work but might need adjustments.
            </p>
          </div>
        )}
        
        <div className="glass rounded-lg p-1 shadow-lg max-w-6xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-md h-[600px] overflow-hidden flex flex-col">
            <div className="flex-1 flex overflow-hidden">
              <ProjectContainer
                conversionResult={conversionResult}
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
              />
            </div>
          </div>
        </div>
        
        <Instructions />
      </div>
    </section>
  );
};

export default ResultDisplay;
