
import { FileNode, ConversionResult } from '@/types/conversion';
import FileTree from './FileTree';
import FileViewer from './FileViewer';
import EmptyState from './EmptyState';
import { AlertCircle, FileWarning, FileCode, Info } from 'lucide-react';

interface ProjectContainerProps {
  conversionResult?: ConversionResult;
  selectedFile: FileNode | null;
  setSelectedFile: (file: FileNode | null) => void;
}

const ProjectContainer = ({ 
  conversionResult,
  selectedFile,
  setSelectedFile
}: ProjectContainerProps) => {
  if (!conversionResult) {
    return <EmptyState />;
  }
  
  // Check for different error/warning conditions
  const hasErrors = conversionResult.logs?.errors && conversionResult.logs.errors.length > 0;
  const hasWarnings = conversionResult.logs?.warnings && conversionResult.logs.warnings.length > 0;
  const noFilesProcessed = !conversionResult.fileStructure || 
                           !conversionResult.fileStructure.children || 
                           conversionResult.fileStructure.children.length === 0 ||
                           conversionResult.stats?.totalFiles === 0;
  
  const showProjectStats = conversionResult.stats && conversionResult.stats.totalFiles > 0;
  
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Error Notification Banner */}
      {hasErrors && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 px-4 py-2 rounded-md flex items-center text-sm max-w-xl">
            <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
            <div>
              <p className="font-medium">{conversionResult.logs?.errors?.[0] || "Conversion encountered errors"}</p>
              {conversionResult.logs?.errors && conversionResult.logs.errors.length > 1 && (
                <p className="text-xs mt-1">And {conversionResult.logs.errors.length - 1} more errors</p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Warning for No Files */}
      {noFilesProcessed && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 px-4 py-2 rounded-md flex items-center text-sm max-w-xl">
            <FileWarning className="w-4 h-4 mr-2 flex-shrink-0" />
            <div>
              <p className="font-medium">No files were detected for conversion</p>
              <p className="text-xs mt-1">Please upload a valid React project including .js/.jsx/.tsx files or a complete project ZIP</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Info Banner for Conversion Stats */}
      {showProjectStats && !hasErrors && !noFilesProcessed && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-md flex items-center text-sm max-w-xl">
            <Info className="w-4 h-4 mr-2 flex-shrink-0" />
            <div>
              <p className="font-medium">Conversion complete</p>
              <p className="text-xs mt-1">
                Processed {conversionResult.stats.totalFiles} files, 
                converted {conversionResult.stats.convertedFiles} components/pages
                {hasWarnings && ` with ${conversionResult.logs?.warnings?.length} warnings`}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Warning Notification Banner */}
      {hasWarnings && !hasErrors && (
        <div className="absolute top-14 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 px-4 py-2 rounded-md flex items-center text-sm max-w-xl">
            <FileWarning className="w-4 h-4 mr-2 flex-shrink-0" />
            <div>
              <p className="font-medium">{conversionResult.logs?.warnings?.[0] || "Some items need manual review"}</p>
              {conversionResult.logs?.warnings && conversionResult.logs.warnings.length > 1 && (
                <p className="text-xs mt-1">And {conversionResult.logs.warnings.length - 1} more warnings</p>
              )}
            </div>
          </div>
        </div>
      )}
      
      <FileTree 
        fileStructure={conversionResult.fileStructure}
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
      />
      <FileViewer 
        selectedFile={selectedFile}
        conversionLogs={conversionResult.logs}
      />
    </div>
  );
};

export default ProjectContainer;
