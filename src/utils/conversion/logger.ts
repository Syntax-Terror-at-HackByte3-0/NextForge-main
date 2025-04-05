
/**
 * Logger for the conversion process
 */
import { ConversionLog } from './types';

// Conversion logs collection
const conversionLogs: ConversionLog[] = [];

/**
 * Log conversion events
 */
export const logConversion = (type: 'info' | 'warning' | 'error' | 'success', message: string, file?: string): void => {
  conversionLogs.push({
    type,
    message,
    file,
    timestamp: Date.now()
  });
  
  // Also log to console for debugging
  switch (type) {
    case 'info':
      console.log(`[INFO] ${file ? `[${file}] ` : ''}${message}`);
      break;
    case 'warning':
      console.warn(`[WARNING] ${file ? `[${file}] ` : ''}${message}`);
      break;
    case 'error':
      console.error(`[ERROR] ${file ? `[${file}] ` : ''}${message}`);
      break;
    case 'success':
      console.log(`[SUCCESS] ${file ? `[${file}] ` : ''}${message}`);
      break;
  }
};

/**
 * Clear all conversion logs
 * This should be called at the start of each new conversion
 */
export const clearConversionLogs = (): void => {
  conversionLogs.length = 0;
  console.log('[INFO] Conversion logs cleared');
};

/**
 * Get conversion logs for display
 */
export const getConversionLogs = () => {
  return {
    warnings: conversionLogs.filter(log => log.type === 'warning').map(log => `${log.file || ''}: ${log.message}`),
    errors: conversionLogs.filter(log => log.type === 'error').map(log => `${log.file || ''}: ${log.message}`),
    info: conversionLogs.filter(log => log.type === 'info').map(log => `${log.message}`)
  };
};
