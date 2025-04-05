
import { useState } from 'react';
import { Folder, FileText, ChevronRight, ChevronDown, File, Code, FileJson, Settings, Globe, Layout } from 'lucide-react';
import { FileNode } from '@/types/conversion';
import { cn } from '@/lib/utils';

interface FileTreeProps {
  fileStructure: FileNode;
  selectedFile: FileNode | null;
  setSelectedFile: (file: FileNode | null) => void;
}

const FileTree = ({ fileStructure, selectedFile, setSelectedFile }: FileTreeProps) => {
  const [expandedFolders, setExpandedFolders] = useState<string[]>(['/']);
  
  // Toggle folder expansion
  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => 
      prev.includes(path) 
        ? prev.filter(p => p !== path)
        : [...prev, path]
    );
  };
  
  // Get the appropriate icon for a file based on its name/extension
  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.js') || fileName.endsWith('.jsx') || fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
      return <Code className="h-4 w-4 mr-2 text-yellow-500" />;
    }
    if (fileName.endsWith('.json')) {
      return <FileJson className="h-4 w-4 mr-2 text-green-500" />;
    }
    if (fileName.endsWith('.css') || fileName.endsWith('.scss') || fileName.endsWith('.less')) {
      return <File className="h-4 w-4 mr-2 text-blue-500" />;
    }
    if (fileName === 'next.config.js' || fileName.includes('config')) {
      return <Settings className="h-4 w-4 mr-2 text-purple-500" />;
    }
    if (fileName.endsWith('.html') || fileName.includes('public')) {
      return <Globe className="h-4 w-4 mr-2 text-orange-500" />;
    }
    if (fileName.includes('layout') || fileName.includes('Layout')) {
      return <Layout className="h-4 w-4 mr-2 text-indigo-500" />;
    }
    return <FileText className="h-4 w-4 mr-2 text-gray-500" />;
  };
  
  // Get the appropriate icon for a directory
  const getFolderIcon = (folderName: string) => {
    if (folderName === 'pages') {
      return <Folder className="h-4 w-4 mr-2 text-blue-600" />;
    }
    if (folderName === 'components') {
      return <Folder className="h-4 w-4 mr-2 text-purple-600" />;
    }
    if (folderName === 'styles') {
      return <Folder className="h-4 w-4 mr-2 text-pink-600" />;
    }
    if (folderName === 'api') {
      return <Folder className="h-4 w-4 mr-2 text-green-600" />;
    }
    if (folderName === 'public') {
      return <Folder className="h-4 w-4 mr-2 text-orange-600" />;
    }
    return <Folder className="h-4 w-4 mr-2 text-blue-500" />;
  };

  const renderFileTree = (node: FileNode, depth = 0) => {
    if (!node) {
      console.warn('FileTree: Received null node');
      return null;
    }
    
    const isExpanded = expandedFolders.includes(node.path);
    
    return (
      <div key={node.path}>
        <button
          onClick={() => 
            node.type === 'directory' 
              ? toggleFolder(node.path) 
              : setSelectedFile(node)
          }
          className={cn(
            "flex items-center py-1.5 px-2 rounded-md text-sm w-full text-left hover:bg-secondary/50 transition-colors my-0.5",
            selectedFile?.path === node.path && "bg-secondary"
          )}
          style={{ paddingLeft: `${(depth * 12) + 8}px` }}
        >
          {node.type === 'directory' && (
            isExpanded ? 
              <ChevronDown className="h-3.5 w-3.5 mr-1 text-gray-500" /> : 
              <ChevronRight className="h-3.5 w-3.5 mr-1 text-gray-500" />
          )}
          
          {node.type === 'directory' 
            ? getFolderIcon(node.name)
            : getFileIcon(node.name)
          }
          
          <span className={node.type === 'directory' ? "font-medium" : ""}>
            {node.name}
          </span>
        </button>
        
        {node.type === 'directory' && isExpanded && node.children && (
          <div>
            {node.children
              .sort((a, b) => {
                // Sort directories first, then files
                if (a.type === 'directory' && b.type === 'file') return -1;
                if (a.type === 'file' && b.type === 'directory') return 1;
                // Then sort alphabetically
                return a.name.localeCompare(b.name);
              })
              .map(child => renderFileTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Automatically expand root directory
  if (expandedFolders.length === 0) {
    setExpandedFolders(['/']);
  }

  return (
    <div className="w-64 border-r p-4 overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
      <h3 className="text-xs font-semibold text-muted-foreground mb-2">PROJECT STRUCTURE</h3>
      {renderFileTree(fileStructure)}
    </div>
  );
};

export default FileTree;
