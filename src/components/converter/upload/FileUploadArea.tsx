
import React, { useRef, useState } from 'react';
import { UploadCloud, AlertCircle, FileCheck, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface FileUploadAreaProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
}

const FileUploadArea = ({ onFilesSelected, isProcessing }: FileUploadAreaProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragErrorMessage, setDragErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // File validation
  const validateFileTypes = (files: File[]): boolean => {
    const allowedTypes = [
      '.js', '.jsx', '.ts', '.tsx', 
      '.json', '.css', '.scss', 
      '.html', '.md', '.zip'
    ];
    
    // Special handling for ZIP files - they're valid on their own
    const hasZipFile = files.some(file => file.name.endsWith('.zip'));
    
    if (hasZipFile) {
      // If we have a ZIP file, we only process that (ignore other files)
      if (files.length > 1) {
        toast.info("ZIP file detected. Other files will be ignored.");
      }
      setDragErrorMessage(null);
      return true;
    }
    
    // If no ZIP, check for React files
    const hasReactFiles = files.some(file => 
      file.name.endsWith('.js') || 
      file.name.endsWith('.jsx') || 
      file.name.endsWith('.ts') || 
      file.name.endsWith('.tsx')
    );
    
    if (!hasReactFiles) {
      setDragErrorMessage("Please include at least one React file (.js, .jsx, .ts, .tsx) or a zip archive");
      return false;
    }
    
    // Check if any files have unsupported extensions
    const invalidFiles = files.filter(file => {
      const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
      return !allowedTypes.includes(ext);
    });
    
    if (invalidFiles.length > 0) {
      const fileList = invalidFiles.map(f => f.name).join(', ');
      setDragErrorMessage(`Unsupported file type(s): ${fileList}`);
      return false;
    }
    
    setDragErrorMessage(null);
    return true;
  };
  
  // Check file sizes
  const validateFileSizes = (files: File[]): boolean => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
    const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total
    
    let totalSize = 0;
    for (const file of files) {
      totalSize += file.size;
      
      if (file.size > MAX_FILE_SIZE) {
        setDragErrorMessage(`File ${file.name} exceeds the maximum size limit of 10MB`);
        return false;
      }
    }
    
    if (totalSize > MAX_TOTAL_SIZE) {
      setDragErrorMessage(`Total files size (${(totalSize / (1024 * 1024)).toFixed(2)}MB) exceeds the maximum limit of 50MB`);
      return false;
    }
    
    return true;
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      if (validateFileTypes(files) && validateFileSizes(files)) {
        // Filter to only include ZIP files if one is present
        const zipFile = files.find(file => file.name.endsWith('.zip'));
        const filesToProcess = zipFile ? [zipFile] : files;
        
        onFilesSelected(filesToProcess);
      } else {
        toast.error(dragErrorMessage || "Invalid files");
      }
    }
  };
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      if (validateFileTypes(files) && validateFileSizes(files)) {
        // Filter to only include ZIP files if one is present
        const zipFile = files.find(file => file.name.endsWith('.zip'));
        const filesToProcess = zipFile ? [zipFile] : files;
        
        onFilesSelected(filesToProcess);
      } else {
        toast.error(dragErrorMessage || "Invalid files");
      }
    }
  };
  
  // Determine the upload area icon based on state
  const getUploadIcon = () => {
    if (dragErrorMessage) {
      return <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />;
    }
    
    return <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground mb-4" />;
  };
  
  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-12 text-center transition-colors",
        isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30",
        dragErrorMessage ? "border-red-500 bg-red-50/10" : ""
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {getUploadIcon()}
      
      <h3 className="text-lg font-medium mb-2">
        {dragErrorMessage ? "File Error" : "Drag and drop your files here"}
      </h3>
      
      {dragErrorMessage ? (
        <p className="text-red-500 mb-6">{dragErrorMessage}</p>
      ) : (
        <div className="space-y-2 mb-6">
          <p className="text-muted-foreground">
            Upload React component files (JS/JSX/TS/TSX) or a ZIP archive
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-1 bg-muted rounded-full">.js / .jsx</span>
            <span className="px-2 py-1 bg-muted rounded-full">.ts / .tsx</span>
            <span className="px-2 py-1 bg-muted rounded-full">.zip <Archive className="inline h-3 w-3 ml-1" /></span>
            <span className="px-2 py-1 bg-muted rounded-full">.json / .css</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Maximum file size: 10MB per file, 50MB total
          </p>
        </div>
      )}
      
      <input
        type="file"
        multiple
        accept=".js,.jsx,.ts,.tsx,.zip,.json,.css,.scss,.html"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileSelect}
      />
      
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
        className={cn(
          "rounded-md px-4 py-2 text-sm font-medium shadow-sm transition-colors", 
          "disabled:opacity-50 disabled:cursor-not-allowed",
          dragErrorMessage 
            ? "bg-red-500 text-white hover:bg-red-600" 
            : "bg-primary text-white hover:bg-primary/90"
        )}
      >
        {isProcessing ? "Processing..." : dragErrorMessage ? "Select Different Files" : "Select Files"}
      </button>
    </div>
  );
};

export default FileUploadArea;
