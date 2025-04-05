
/**
 * Helper utilities for the conversion process
 */

/**
 * Creates a timer for measuring performance
 */
export const timer = () => {
  const start = performance.now();
  let lastCheckpoint = start;
  
  return {
    /**
     * Returns time elapsed since last checkpoint in milliseconds
     */
    checkpoint: () => {
      const now = performance.now();
      const elapsed = now - lastCheckpoint;
      lastCheckpoint = now;
      return Math.round(elapsed);
    },
    
    /**
     * Returns total time elapsed in milliseconds
     */
    total: () => {
      return Math.round(performance.now() - start);
    },
    
    /**
     * Returns the start time
     */
    getStartTime: () => {
      return start;
    }
  };
};

/**
 * Formats bytes to a human-readable format (KB, MB, etc.)
 */
export const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
};

/**
 * Sanitizes a file path for display
 */
export const sanitizeFilePath = (path: string) => {
  // Remove leading slashes and normalize
  return path.replace(/^\/+/, '').replace(/\\/g, '/');
};

/**
 * Extracts component name from file path
 */
export const extractComponentName = (filePath: string) => {
  const fileName = filePath.split('/').pop() || '';
  return fileName.replace(/\.(jsx?|tsx?)$/, '');
};

/**
 * Determines if a path is a page or a component
 */
export const isPagePath = (path: string) => {
  return path.includes('/pages/') || 
         path.includes('/app/') || 
         path.match(/src\/(pages|app)\//) || 
         path.match(/^\/?pages\//);
};
