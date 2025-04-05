
/**
 * Types for the conversion process
 */
export interface ConversionSettings {
  appDir: boolean;
  typescript: boolean;
  includeExamples: boolean;
  routingStrategy?: 'pages' | 'app';
}

export type ConversionOutput = {
  pages: Record<string, string>;
  components: Record<string, string>;
  api: Record<string, string>;
  styles: Record<string, string>;
  config: Record<string, string>;
  public: Record<string, string>;
};

export interface ConversionError {
  message: string;
  file?: string;
  code?: string;
  stack?: string;
}

export interface ConversionLog {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  file?: string;
  timestamp: number;
}

export interface ConversionStats {
  totalFiles: number;
  convertedFiles: number;
  warnings: number;
  errors: number;
  startTime: number;
  endTime?: number;
}

// Updated FileType to include 'context', 'reducer', and 'store'
export type FileType = 'component' | 'page' | 'layout' | 'api' | 'config' | 'style' | 'util' | 'hook' | 'context' | 'reducer' | 'store';
