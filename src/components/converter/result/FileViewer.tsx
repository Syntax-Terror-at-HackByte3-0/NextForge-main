import { useState, useEffect } from 'react';
import { Copy, CheckCheck, FileText, AlertCircle, AlertTriangle, Info, Terminal } from 'lucide-react';
import { FileNode } from '@/types/conversion';

export interface FileViewerProps {
  selectedFile: FileNode | null;
  conversionLogs?: {
    warnings: string[];
    errors: string[];
    info: string[];
  };
}

const FileViewer = ({ selectedFile, conversionLogs }: FileViewerProps) => {
  const [copied, setCopied] = useState(false);
  const [formattedContent, setFormattedContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'logs'>('content');
  
  useEffect(() => {
    if (selectedFile?.content) {
      try {
        setFormattedContent(formatCode(selectedFile.content, getFileType(selectedFile.name)));
        setError(null);
      } catch (err) {
        console.error('Error formatting code:', err);
        setFormattedContent(selectedFile.content);
        setError('Error formatting code. Showing raw content.');
      }
    } else {
      setFormattedContent(null);
      setError(null);
    }
  }, [selectedFile]);
  
  const handleCopyCode = () => {
    if (selectedFile?.content) {
      navigator.clipboard.writeText(selectedFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const getFileType = (fileName: string): string => {
    if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return 'javascript';
    if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return 'typescript';
    if (fileName.endsWith('.css')) return 'css';
    if (fileName.endsWith('.scss') || fileName.endsWith('.sass')) return 'scss';
    if (fileName.endsWith('.json')) return 'json';
    if (fileName.endsWith('.md')) return 'markdown';
    if (fileName.endsWith('.html')) return 'html';
    return 'plaintext';
  };
  
  const formatCode = (content: string, fileType: string): string => {
    // In a real implementation, you might use a syntax highlighter library
    // For now, we just display the raw content
    return content;
  };

  const isBinaryContent = (content: string): boolean => {
    return content === '[Binary File]';
  };

  const hasLogs = conversionLogs && (
    conversionLogs.errors.length > 0 || 
    conversionLogs.warnings.length > 0 || 
    conversionLogs.info.length > 0
  );

  return (
    <div className="flex-1 p-4 overflow-y-auto relative">
      {error && (
        <div className="absolute top-2 right-2 bg-amber-100 text-amber-800 px-3 py-1 rounded-md text-xs flex items-center">
          <AlertCircle className="h-3 w-3 mr-1.5" />
          {error}
        </div>
      )}
      
      {selectedFile ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium flex-1 truncate mr-4">{selectedFile.path}</div>
            {selectedFile.content && !isBinaryContent(selectedFile.content) && (
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
              >
                {copied ? (
                  <>
                    <CheckCheck className="h-3.5 w-3.5 mr-1.5 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copy code
                  </>
                )}
              </button>
            )}
          </div>
          
          {hasLogs && (
            <div className="mb-4 border-b flex">
              <button 
                onClick={() => setActiveTab('content')} 
                className={`px-4 py-2 text-sm ${activeTab === 'content' ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}
              >
                File Content
              </button>
              <button 
                onClick={() => setActiveTab('logs')} 
                className={`px-4 py-2 text-sm flex items-center ${activeTab === 'logs' ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}
              >
                Conversion Logs
                {conversionLogs && conversionLogs.errors.length > 0 && (
                  <span className="ml-2 bg-red-100 text-red-800 px-1.5 py-0.5 rounded-full text-xs">
                    {conversionLogs.errors.length}
                  </span>
                )}
              </button>
            </div>
          )}
          
          {activeTab === 'content' ? (
            selectedFile.content ? (
              isBinaryContent(selectedFile.content) ? (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  <p>Binary file content cannot be displayed</p>
                </div>
              ) : (
                <pre className="code-editor text-sm bg-gray-50 dark:bg-gray-900/50 p-4 rounded-md overflow-auto h-[400px] font-mono whitespace-pre-wrap">
                  <code className="text-foreground">
                    {formattedContent}
                  </code>
                </pre>
              )
            ) : (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                <p>No content available for this file</p>
              </div>
            )
          ) : (
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-md overflow-auto h-[400px]">
              {conversionLogs?.errors.length ? (
                <div className="mb-4">
                  <h3 className="text-sm font-medium flex items-center text-red-700 mb-2">
                    <AlertCircle className="h-4 w-4 mr-1.5" />
                    Errors ({conversionLogs.errors.length})
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {conversionLogs.errors.map((err, i) => (
                      <li key={`err-${i}`} className="pl-6 text-red-700">• {err}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              
              {conversionLogs?.warnings.length ? (
                <div className="mb-4">
                  <h3 className="text-sm font-medium flex items-center text-amber-700 mb-2">
                    <AlertTriangle className="h-4 w-4 mr-1.5" />
                    Warnings ({conversionLogs.warnings.length})
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {conversionLogs.warnings.map((warning, i) => (
                      <li key={`warn-${i}`} className="pl-6 text-amber-700">• {warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              
              {conversionLogs?.info.length ? (
                <div>
                  <h3 className="text-sm font-medium flex items-center text-blue-700 mb-2">
                    <Info className="h-4 w-4 mr-1.5" />
                    Info ({conversionLogs.info.length})
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {conversionLogs.info.map((info, i) => (
                      <li key={`info-${i}`} className="pl-6 text-blue-700">• {info}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              
              {(!conversionLogs || 
                (conversionLogs.errors.length === 0 && 
                 conversionLogs.warnings.length === 0 && 
                 conversionLogs.info.length === 0)) && (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <Terminal className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>No conversion logs available</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Select a file to view its contents</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileViewer;
