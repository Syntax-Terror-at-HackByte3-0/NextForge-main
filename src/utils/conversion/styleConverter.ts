/**
 * This file contains utilities for converting style files
 */

/**
 * Converts a style file to Next.js compatible format
 */
export const convertStyles = (code: string, filename: string): string => {
  try {
    console.log(`Converting style file: ${filename}`);
    
    // Check if this is a CSS modules file
    const isCSSModule = filename.includes('.module.');
    
    // For global styles in Next.js, we can use them directly
    if (!isCSSModule && (filename.includes('global') || filename.includes('main') || filename.includes('app'))) {
      return code;
    }
    
    // Process CSS Modules
    if (isCSSModule) {
      // CSS modules are directly supported in Next.js
      // Just make sure the filename has .module.css extension
      // We don't need to change the content
      return code;
    }
    
    // For SCSS/SASS files, we need to ensure Next.js is configured to support them
    if (filename.endsWith('.scss') || filename.endsWith('.sass')) {
      // The content can remain the same, but we'll add a note about required dependencies
      return `/* 
 * This SCSS file requires Next.js to be configured with sass support.
 * Make sure to run: npm install sass
 */
${code}`;
    }
    
    // Less files need conversion or additional packages
    if (filename.endsWith('.less')) {
      return `/* 
 * This Less file requires conversion to CSS or SCSS.
 * For Less support in Next.js, install: npm install less @zeit/next-less
 * And configure next.config.js
 */
${code}`;
    }
    
    // Default: return code as is
    return code;
  } catch (error) {
    console.error(`Error converting style file ${filename}:`, error);
    return code; // Return original code on error
  }
};
