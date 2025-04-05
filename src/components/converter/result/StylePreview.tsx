
import React from 'react';
import { FileIcon } from 'lucide-react';
import { ConversionResult } from '@/types/conversion';

interface StylePreviewProps {
  conversionResult?: ConversionResult;
}

const StylePreview = ({ conversionResult }: StylePreviewProps) => {
  if (!conversionResult || !conversionResult.styles || Object.keys(conversionResult.styles).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <FileIcon className="w-12 h-12 mb-4 opacity-30" />
        <p>No styles found in the conversion</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Extracted Styles</h3>
      <div className="space-y-4">
        {Object.entries(conversionResult.styles).map(([filename, content]) => (
          <div key={filename} className="border rounded-md overflow-hidden">
            <div className="bg-secondary/30 font-mono text-sm py-2 px-4 border-b">
              {filename}
            </div>
            <pre className="p-4 text-sm overflow-auto max-h-60 bg-gray-50 dark:bg-gray-900/50">
              <code>{content}</code>
            </pre>
          </div>
        ))}
      </div>
      
      <div className="bg-secondary/10 rounded-md p-4 text-sm">
        <p className="font-medium mb-2">About the converted styles</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Next.js supports CSS Modules out of the box</li>
          <li>Global styles are placed in <code>styles/globals.css</code></li>
          <li>Component-specific styles are in <code>styles/[Component].module.css</code></li>
          <li>CSS-in-JS libraries like styled-components are also supported</li>
        </ul>
      </div>
    </div>
  );
};

export default StylePreview;
