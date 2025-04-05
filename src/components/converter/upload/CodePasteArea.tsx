
import React from 'react';

interface CodePasteAreaProps {
  pasteValue: string;
  setPasteValue: (value: string) => void;
  onPasteSubmit: () => void;
  isProcessing: boolean;
}

const CodePasteArea = ({ 
  pasteValue, 
  setPasteValue, 
  onPasteSubmit, 
  isProcessing 
}: CodePasteAreaProps) => {
  return (
    <div className="space-y-4">
      <textarea
        value={pasteValue}
        onChange={(e) => setPasteValue(e.target.value)}
        placeholder="Paste your React code here..."
        disabled={isProcessing}
        className="w-full h-64 p-4 text-sm code-editor bg-gray-50 dark:bg-gray-900/50 rounded-md border focus:border-primary focus:ring-1 focus:ring-primary outline-none disabled:opacity-50"
      />
      <div className="flex justify-end">
        <button
          onClick={onPasteSubmit}
          disabled={!pasteValue.trim() || isProcessing}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? "Processing..." : "Convert Code"}
        </button>
      </div>
    </div>
  );
};

export default CodePasteArea;
