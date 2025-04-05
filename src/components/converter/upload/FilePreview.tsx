
import React from 'react';
import { Folder, FileType, File, Archive, X, RefreshCw, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilePreviewProps {
  files: string[];
  size: number;
  reactFileCount?: number;
  onReset: () => void;
  onStartConversion: () => void;
  isProcessing: boolean;
}

const FilePreview = ({ 
  files, 
  size, 
  reactFileCount = 0,
  onReset, 
  onStartConversion, 
  isProcessing 
}: FilePreviewProps) => {
  // Format the size in human-readable format
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} bytes`;
    else if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    else return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  // Group files by type
  const getFilesByType = () => {
    const types: Record<string, number> = {
      'React': 0,
      'Config': 0,
      'Style': 0,
      'Other': 0
    };
    
    files.forEach(file => {
      const ext = file.split('.').pop()?.toLowerCase() || '';
      
      if (['jsx', 'tsx'].includes(ext)) {
        types['React']++;
      } else if (['js', 'ts'].includes(ext)) {
        // We don't know for sure, but let's count it as React
        types['React']++;
      } else if (['json', 'config.js', 'config.ts'].some(e => file.endsWith(e))) {
        types['Config']++;
      } else if (['css', 'scss', 'less', 'sass'].includes(ext)) {
        types['Style']++;
      } else {
        types['Other']++;
      }
    });
    
    return types;
  };
  
  const fileTypes = getFilesByType();
  const fileCount = files.length;
  const zipCount = files.filter(f => f.endsWith('.zip')).length;
  
  // Get an appropriate icon for a file
  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    if (ext === 'zip') return <Archive className="h-4 w-4" />;
    else if (['jsx', 'tsx', 'js', 'ts'].includes(ext || '')) return <FileType className="h-4 w-4" />;
    else if (['css', 'scss', 'less'].includes(ext || '')) return <File className="h-4 w-4" />;
    else return <File className="h-4 w-4" />;
  };
  
  // Display a limited number of files
  const MAX_FILES_TO_SHOW = 5;
  const displayFiles = files.slice(0, MAX_FILES_TO_SHOW);
  const hiddenFilesCount = Math.max(0, files.length - MAX_FILES_TO_SHOW);
  
  return (
    <div className="rounded-lg border border-border p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Files Ready for Conversion</h3>
        <button 
          onClick={onReset} 
          className="text-muted-foreground hover:text-foreground"
          disabled={isProcessing}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      <div className="space-y-4">
        {/* File statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-secondary/50 p-3 rounded-lg">
            <div className="text-xs text-muted-foreground">Total Files</div>
            <div className="text-xl font-medium">{fileCount}</div>
          </div>
          <div className="bg-secondary/50 p-3 rounded-lg">
            <div className="text-xs text-muted-foreground">Size</div>
            <div className="text-xl font-medium">{formatSize(size)}</div>
          </div>
          <div className="bg-secondary/50 p-3 rounded-lg">
            <div className="text-xs text-muted-foreground">React Files</div>
            <div className="text-xl font-medium">{reactFileCount}</div>
          </div>
          <div className="bg-secondary/50 p-3 rounded-lg">
            <div className="text-xs text-muted-foreground">ZIP Archives</div>
            <div className="text-xl font-medium">{zipCount}</div>
          </div>
        </div>
        
        {/* File type breakdown */}
        <div className="bg-secondary/30 p-3 rounded-lg">
          <h4 className="text-sm font-medium mb-2">File Type Breakdown</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(fileTypes).map(([type, count]) => (
              count > 0 && (
                <div key={type} className="px-2 py-1 bg-background rounded-full text-xs">
                  {type}: {count}
                </div>
              )
            ))}
          </div>
        </div>
        
        {/* File list */}
        <div className="bg-secondary/30 p-3 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Files ({fileCount})</h4>
          <ul className="space-y-1 text-sm">
            {displayFiles.map((file, index) => (
              <li key={index} className="flex items-center">
                {getFileIcon(file)}
                <span className="ml-2 truncate">{file}</span>
              </li>
            ))}
            {hiddenFilesCount > 0 && (
              <li className="text-muted-foreground text-xs">
                ...and {hiddenFilesCount} more file{hiddenFilesCount !== 1 ? 's' : ''}
              </li>
            )}
          </ul>
        </div>
      </div>
      
      <div className="mt-6 flex justify-end">
        <button
          onClick={onStartConversion}
          disabled={isProcessing}
          className={cn(
            "rounded-md bg-primary px-4 py-2 text-sm font-medium text-white",
            "shadow-sm hover:bg-primary/90 transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex items-center"
          )}
        >
          {isProcessing ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Start Conversion
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default FilePreview;
