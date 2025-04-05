
/**
 * Processes configuration files during conversion
 */
import { ConversionOutput } from './types';
import { generateNextConfig } from './configGenerator';
import { logConversion } from './logger';

/**
 * Process configuration files and generate Next.js config
 */
export const processConfigFiles = (
  allDependencies: string[],
  result: ConversionOutput
): void => {
  logConversion('info', 'Generating Next.js configuration files...');
  
  // Generate Next.js configuration
  const config = generateNextConfig(allDependencies);
  Object.entries(config).forEach(([configName, configContent]) => {
    result.config[configName] = configContent;
    logConversion('success', `Generated config file: ${configName}`);
  });
};
