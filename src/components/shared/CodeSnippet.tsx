
import React, { useState } from "react";
import { Check, Clipboard, Code } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type CodeSnippetProps = {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  className?: string;
};

export function CodeSnippet({
  code,
  language = "typescript",
  filename,
  showLineNumbers = true,
  highlightLines = [],
  className,
}: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Split code into lines for rendering
  const codeLines = code.split("\n");

  return (
    <div className={cn("rounded-lg overflow-hidden bg-zinc-950 dark:bg-zinc-900 my-4", className)}>
      {filename && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900 dark:bg-zinc-800">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-zinc-400" />
            <span className="text-sm text-zinc-300">{filename}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs text-zinc-400 hover:text-zinc-100"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Clipboard className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>
      )}
      <div className="overflow-auto code-editor p-4">
        <pre className="text-zinc-100 text-sm">
          {codeLines.map((line, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                highlightLines.includes(i + 1) && "bg-primary/10 -mx-4 px-4"
              )}
            >
              {showLineNumbers && (
                <span className="inline-block mr-4 w-6 text-right text-zinc-500 select-none">
                  {i + 1}
                </span>
              )}
              <span className={language}>{line || " "}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
