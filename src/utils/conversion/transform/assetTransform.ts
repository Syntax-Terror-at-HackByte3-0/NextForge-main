
/**
 * Asset transformation utilities
 */
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';

/**
 * Applies all asset transformations to the given code
 */
export const applyAllAssetTransformations = (code: string): string => {
  let transformedCode = code;
  
  // Apply each transformation in sequence
  transformedCode = optimizeImagesInComponent(transformedCode);
  transformedCode = optimizeFontsInComponent(transformedCode);
  transformedCode = optimizeScriptsInComponent(transformedCode);
  transformedCode = convertRedirectsToNextRouter(transformedCode);
  transformedCode = convertHeadToMetadata(transformedCode);
  
  return transformedCode;
};

/**
 * Optimize image elements in a component
 */
export const optimizeImagesInComponent = (code: string): string => {
  // Check if the code contains any img tags
  if (!code.includes('<img')) {
    return code;
  }

  try {
    // Basic regex-based transformation to replace img tags with Next.js Image
    // For a production implementation, this should use AST for more precision
    
    // Add Image import if needed
    let transformedCode = code;
    if (!transformedCode.includes('import Image from')) {
      const importStatement = "import Image from 'next/image';\n";
      
      // Find a good insertion point for the import
      const importIndex = transformedCode.indexOf('import');
      if (importIndex >= 0) {
        const lastImportEnd = transformedCode.lastIndexOf('import');
        const lastImportLineEnd = transformedCode.indexOf('\n', lastImportEnd);
        transformedCode = transformedCode.slice(0, lastImportLineEnd + 1) + 
                         importStatement + 
                         transformedCode.slice(lastImportLineEnd + 1);
      } else {
        transformedCode = importStatement + transformedCode;
      }
    }
    
    // Transform img tags to Image components
    transformedCode = transformedCode.replace(
      /<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/g,
      (match, beforeSrc, src, afterSrc) => {
        const altMatch = match.match(/alt=["']([^"']*)["']/);
        const alt = altMatch ? altMatch[1] : '';
        
        return `<Image 
        src="${src}" 
        alt="${alt}" 
        width={500} 
        height={300} 
        ${beforeSrc} ${afterSrc}
      />`;
      }
    );
    
    return transformedCode;
  } catch (error) {
    console.error('Error optimizing images:', error);
    return code;
  }
};

/**
 * Optimize fonts in a component
 */
export const optimizeFontsInComponent = (code: string): string => {
  // Detect common font loading patterns
  if (code.includes('@font-face') || 
      code.includes('WebFont.load') || 
      code.includes('Fonts.load')) {
    
    // Add a comment indicating next steps for font optimization
    return `// Consider using next/font for optimized font loading
// Example: import { Inter } from 'next/font/google'
${code}`;
  }
  
  return code;
};

/**
 * Optimize scripts in a component
 */
export const optimizeScriptsInComponent = (code: string): string => {
  // Detect script tags or dynamic script loading
  if (code.includes('<script') || 
      code.includes('document.createElement("script")') ||
      code.includes('appendChild(script)')) {
    
    // Add information about using next/script
    if (!code.includes('import Script from ')) {
      return `// For client-side scripts, consider using next/script
// Example: import Script from 'next/script'
${code}`;
    }
  }
  
  return code;
};

/**
 * Convert redirects to use Next.js router
 */
export const convertRedirectsToNextRouter = (code: string): string => {
  // Identify redirect patterns and convert them
  let transformedCode = code;
  
  // Convert window.location redirects
  transformedCode = transformedCode.replace(
    /window\.location\.href\s*=\s*['"]([^'"]+)['"]/g,
    (match, url) => {
      return `router.push("${url}")`;
    }
  );
  
  // Convert window.location.replace
  transformedCode = transformedCode.replace(
    /window\.location\.replace\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    (match, url) => {
      return `router.replace("${url}")`;
    }
  );
  
  // If we made changes, ensure router import is present
  if (transformedCode !== code && 
      transformedCode.includes('router.push') && 
      !transformedCode.includes('useRouter')) {
    
    transformedCode = `import { useRouter } from 'next/router';\n${transformedCode}`;
    
    // Add router initialization if needed
    if (!transformedCode.includes('const router = useRouter()')) {
      const componentStart = transformedCode.match(/(?:function|const)\s+(\w+)/);
      if (componentStart) {
        const insertPoint = transformedCode.indexOf('{', transformedCode.indexOf(componentStart[0]));
        if (insertPoint > 0) {
          transformedCode = transformedCode.slice(0, insertPoint + 1) +
                           '\n  const router = useRouter();' + 
                           transformedCode.slice(insertPoint + 1);
        }
      }
    }
  }
  
  return transformedCode;
};

/**
 * Convert head tags to Next.js metadata
 */
export const convertHeadToMetadata = (code: string): string => {
  // Check if the code uses Head component
  if (!code.includes('<Head') && !code.includes('<Helmet')) {
    return code;
  }
  
  // Implementation similar to headTransform.ts
  // Simple regex-based extraction
  try {
    const titleMatch = code.match(/<title[^>]*>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    const descriptionMatch = code.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/);
    const description = descriptionMatch ? descriptionMatch[1].trim() : '';
    
    // Generate metadata export
    if (title || description) {
      return `// Next.js 13+ App Router uses metadata export instead of <Head>
export const metadata = {
  ${title ? `title: "${title}",` : ''}
  ${description ? `description: "${description}",` : ''}
};

${code}`;
    }
  } catch (error) {
    console.error('Error converting Head to metadata:', error);
  }
  
  return code;
};
