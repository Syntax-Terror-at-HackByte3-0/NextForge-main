
/**
 * Processes style files during conversion
 */
import { UploadedFiles } from '@/types/conversion';
import { ConversionOutput } from './types';
import { convertStyles } from './styleConverter';
import { logConversion } from './logger';

/**
 * Process all style files in the uploaded files
 */
export const processStyles = (
  files: UploadedFiles,
  result: ConversionOutput
): void => {
  Object.entries(files).forEach(([filename, content]) => {
    // Identify CSS/SCSS files
    if (/\.(css|scss|sass|less)$/.test(filename)) {
      // Global stylesheets are typically named like global.css, index.css, or app.css
      const isGlobal = /global|index|app/i.test(filename);
      
      if (isGlobal) {
        result.styles['globals.css'] = convertStyles(content, filename);
        logConversion('info', 'Identified global stylesheet', filename);
      } else {
        // Assume it's a component stylesheet
        const styleName = filename.split('/').pop() || 'styles.css';
        result.styles[styleName] = convertStyles(content, filename);
      }
    }
  });
};
