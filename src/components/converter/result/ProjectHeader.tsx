
import { Download } from 'lucide-react';

interface ProjectHeaderProps {
  onDownload: () => void;
}

const ProjectHeader = ({ onDownload }: ProjectHeaderProps) => {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3 border-b bg-gray-50 dark:bg-gray-900">
      <div className="h-3 w-3 rounded-full bg-red-400"></div>
      <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
      <div className="h-3 w-3 rounded-full bg-green-400"></div>
      <div className="ml-4 text-xs text-muted-foreground">Converted Next.js Project</div>
      
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onDownload}
          className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary/90 transition-colors"
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Download Project
        </button>
      </div>
    </div>
  );
};

export default ProjectHeader;
