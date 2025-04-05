
/**
 * This file contains logic for analyzing React components
 * This is now a re-export file to maintain compatibility with existing code
 */
import { analyzeComponent } from './analysis/componentAnalyzer';
import { AnalysisResult, FileType } from './analysis/analysisTypes';

// Re-export the main analysis function and types
export { 
  analyzeComponent, 
  type AnalysisResult, 
  type FileType 
};

// Export a more comprehensive component analysis function
export const analyzeComponentAdvanced = async (
  code: string, 
  filePath: string
): Promise<AnalysisResult & { nextCompatibility: { valid: boolean; errors: string[]; warnings: string[] } }> => {
  // Get basic analysis
  const basicAnalysis = await analyzeComponent(code, filePath);
  
  // Add Next.js compatibility check
  const nextCompatibility = {
    valid: true,
    errors: [] as string[],
    warnings: [] as string[]
  };
  
  // Check for React Router
  if (basicAnalysis.hasRouting) {
    nextCompatibility.warnings.push('Uses React Router which needs conversion to Next.js routing');
  }
  
  // Check for hooks that aren't SSR compatible
  if (basicAnalysis.hooks.includes('useLayoutEffect')) {
    nextCompatibility.warnings.push('Uses useLayoutEffect which may cause issues with SSR');
  }
  
  return {
    ...basicAnalysis,
    nextCompatibility
  };
};
