
import { ConversionResult } from '@/types/conversion';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Download, Loader2, Check, FileWarning, FileCode } from 'lucide-react';

interface ResultHeaderProps {
  conversionResult?: ConversionResult;
  onDownload: () => void;
  isDownloading: boolean;
  onToggleWarnings?: () => void;
  hasWarnings?: boolean;
  showWarnings?: boolean;
}

const ResultHeader = ({ 
  conversionResult, 
  onDownload, 
  isDownloading,
  onToggleWarnings,
  hasWarnings,
  showWarnings
}: ResultHeaderProps) => {
  // Count files by type
  const pageCount = conversionResult ? Object.keys(conversionResult.pages).length : 0;
  const componentCount = conversionResult ? Object.keys(conversionResult.components).length : 0;
  const apiCount = conversionResult ? Object.keys(conversionResult.api).length : 0;
  const hasErrors = conversionResult?.logs?.errors && conversionResult.logs.errors.length > 0;
  
  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold mb-2">Conversion Results</h2>
          
          <div className="flex items-center">
            <span className="text-md text-muted-foreground">
              {pageCount} pages, {componentCount} components, {apiCount} API routes
            </span>
            
            {hasErrors && (
              <div className="ml-3 px-2 py-1 bg-red-100 dark:bg-red-800/20 text-red-700 dark:text-red-300 rounded-md text-xs flex items-center">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Conversion errors
              </div>
            )}
            
            {hasWarnings && (
              <button 
                onClick={onToggleWarnings}
                className={`ml-3 px-2 py-1 ${showWarnings 
                  ? 'bg-amber-200 dark:bg-amber-700/40 text-amber-800 dark:text-amber-200' 
                  : 'bg-amber-100 dark:bg-amber-800/20 text-amber-700 dark:text-amber-300'} 
                  rounded-md text-xs flex items-center hover:bg-amber-200 dark:hover:bg-amber-700/40 transition-colors`}
              >
                <FileWarning className="w-3 h-3 mr-1" />
                {showWarnings ? 'Hide warnings' : 'Show warnings'}
              </button>
            )}
          </div>
        </div>
        
        <div className="mt-4 md:mt-0">
          <Button
            onClick={onDownload}
            disabled={isDownloading || !conversionResult}
            className="flex items-center gap-2"
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparing Download...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download Project
              </>
            )}
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800 rounded-md p-4">
          <div className="flex items-center">
            <div className="rounded-full bg-green-200 dark:bg-green-700 p-2 mr-4">
              <FileCode className="w-5 h-5 text-green-600 dark:text-green-300" />
            </div>
            <div>
              <h3 className="font-medium">Next.js Project</h3>
              <p className="text-sm text-muted-foreground">Ready to use with Pages Router</p>
            </div>
          </div>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-md p-4">
          <div className="flex items-center">
            <div className="rounded-full bg-blue-200 dark:bg-blue-700 p-2 mr-4">
              <Check className="w-5 h-5 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <h3 className="font-medium">TypeScript Support</h3>
              <p className="text-sm text-muted-foreground">
                {conversionResult?.stats?.totalFiles ? 'TypeScript enabled' : 'Optional TypeScript'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800 rounded-md p-4">
          <div className="flex items-center">
            <div className="rounded-full bg-purple-200 dark:bg-purple-700 p-2 mr-4">
              <Download className="w-5 h-5 text-purple-600 dark:text-purple-300" />
            </div>
            <div>
              <h3 className="font-medium">Download & Deploy</h3>
              <p className="text-sm text-muted-foreground">Ready for deployment on Vercel</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultHeader;
