
/**
 * Types for the conversion process
 */

/**
 * File node in the project file structure
 */
export interface FileNode {
  name: string;
  path: string;
  type: 'directory' | 'file';
  content?: string;
  children?: FileNode[];
}

/**
 * Output structure of conversion result
 */
export interface ConversionResult {
  pages: Record<string, string>;
  components: Record<string, string>;
  api: Record<string, string>;
  styles: Record<string, string>;
  config: Record<string, string>;
  public: Record<string, string>;
  fileStructure: FileNode;
  logs?: {
    warnings: string[];
    errors: string[];
    info: string[];
  };
  stats?: {
    totalFiles: number;
    convertedFiles: number;
    conversionTime: number;
  };
}

export type UploadedFiles = Record<string, string>;

// Adding the FileType definition here for consistency
export type FileType = 'component' | 'page' | 'layout' | 'api' | 'config' | 'style' | 'util' | 'hook' | 'context' | 'reducer' | 'store';
