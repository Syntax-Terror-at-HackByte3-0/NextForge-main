
import { cn } from '@/lib/utils';
import { Folder, Code } from 'lucide-react';

interface UploadOptionsProps {
  uploadMode: 'files' | 'paste';
  setUploadMode: (mode: 'files' | 'paste') => void;
}

const UploadOptions = ({ uploadMode, setUploadMode }: UploadOptionsProps) => {
  return (
    <div className="flex space-x-4 mb-6">
      <button
        onClick={() => setUploadMode('files')}
        className={cn(
          "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors",
          uploadMode === 'files' 
            ? "bg-primary text-white" 
            : "bg-secondary text-primary hover:bg-secondary/80"
        )}
      >
        <Folder className="inline mr-2 h-4 w-4" />
        Upload Files
      </button>
      <button
        onClick={() => setUploadMode('paste')}
        className={cn(
          "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors",
          uploadMode === 'paste' 
            ? "bg-primary text-white" 
            : "bg-secondary text-primary hover:bg-secondary/80"
        )}
      >
        <Code className="inline mr-2 h-4 w-4" />
        Paste Code
      </button>
    </div>
  );
};

export default UploadOptions;
