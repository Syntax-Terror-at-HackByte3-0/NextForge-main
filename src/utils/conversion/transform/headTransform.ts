
/**
 * Transform <Head> components to Next.js metadata
 */
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';

/**
 * Converts React Helmet or Next.js Head components to Next.js metadata API
 */
export const convertHeadToMetadata = (code: string): string => {
  // Check if the code uses Head component
  if (!code.includes('<Head') && !code.includes('<Helmet')) {
    return code;
  }
  
  // Simple regex-based replacement for common patterns
  // In a real implementation, we would use AST to properly transform this
  
  try {
    // Extract title from Head component
    const titleMatch = code.match(/<title[^>]*>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    // Extract meta description
    const descriptionMatch = code.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/);
    const description = descriptionMatch ? descriptionMatch[1].trim() : '';
    
    // Generate metadata export
    let metadataExport = '';
    if (title || description) {
      metadataExport = `
export const metadata = {
  ${title ? `title: "${title}",` : ''}
  ${description ? `description: "${description}",` : ''}
};

`;
    }
    
    // If we found title or description, add the metadata export
    if (metadataExport) {
      // Remove Head import if it exists
      let updatedCode = code.replace(/import\s+Head\s+from\s+['"]next\/head["'];?\n?/g, '');
      updatedCode = updatedCode.replace(/import\s+{\s*Head\s*}\s+from\s+['"]next\/head["'];?\n?/g, '');
      
      // Remove Helmet import if it exists
      updatedCode = updatedCode.replace(/import\s+Helmet\s+from\s+['"]react-helmet["'];?\n?/g, '');
      updatedCode = updatedCode.replace(/import\s+{\s*Helmet\s*}\s+from\s+['"]react-helmet["'];?\n?/g, '');
      
      // Remove Head component
      updatedCode = updatedCode.replace(/<Head>([\s\S]*?)<\/Head>/g, '');
      updatedCode = updatedCode.replace(/<Helmet>([\s\S]*?)<\/Helmet>/g, '');
      
      // Add metadata export
      // Find a good insertion point after imports
      const lastImportIndex = updatedCode.lastIndexOf('import');
      if (lastImportIndex >= 0) {
        const importEndIndex = updatedCode.indexOf('\n', lastImportIndex) + 1;
        updatedCode = updatedCode.slice(0, importEndIndex) + '\n' + metadataExport + updatedCode.slice(importEndIndex);
      } else {
        updatedCode = metadataExport + updatedCode;
      }
      
      return updatedCode;
    }
  } catch (error) {
    console.error('Error converting Head to metadata:', error);
  }
  
  return code;
};
