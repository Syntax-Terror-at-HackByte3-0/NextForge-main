/**
 * Component conversion utilities
 */
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { applyAllAssetTransformations } from './transform/assetTransform';

/**
 * Converts React Router code to Next.js
 */
export const convertReactRouterToNextRouter = (code: string): string => {
  // Replace React Router imports with Next.js
  let modifiedCode = code.replace(
    /import\s+\{([^}]*)(useHistory|useLocation|useParams|useRouteMatch|useNavigate)([^}]*)\}\s+from\s+['"]react-router-dom['"]/g,
    'import { useRouter } from "next/router"'
  );
  
  // Replace useHistory/useNavigate with useRouter
  modifiedCode = modifiedCode.replace(
    /const\s+(\w+)\s+=\s+use(History|Navigate)\(\)/g,
    'const $1 = useRouter()'
  );
  
  // Replace history.push and navigate with router.push
  modifiedCode = modifiedCode.replace(
    /(\w+)\.(push|navigate)\(['"]([^'"]+)['"](,\s*\{[^}]+\})?\)/g,
    '$1.push("$3")'
  );
  
  // Replace useParams() with router.query
  modifiedCode = modifiedCode.replace(
    /const\s+(\{[^}]+\}|\w+)\s+=\s+useParams\(\)/g,
    'const router = useRouter()\n  const $1 = router.query'
  );
  
  // Replace useLocation with useRouter
  modifiedCode = modifiedCode.replace(
    /const\s+(\w+)\s+=\s+useLocation\(\)/g,
    'const $1 = useRouter()'
  );
  
  // Replace location.pathname with router.pathname
  modifiedCode = modifiedCode.replace(
    /(\w+)\.pathname/g,
    '$1.pathname'
  );
  
  return modifiedCode;
};

/**
 * Ensures a component has an export default statement
 */
export const ensureExportDefault = (code: string, componentName: string): string => {
  if (code.includes('export default')) {
    return code;
  }
  
  return `${code.trim()}\n\nexport default ${componentName};\n`;
};

/**
 * Converts a React component to a Next.js component
 */
export const convertComponent = (code: string, analysis: any): string => {
  // Apply asset transformations
  let transformedCode = applyAllAssetTransformations(code);
  
  // Convert any React Router code
  if (analysis.hasRouting) {
    transformedCode = convertReactRouterToNextRouter(transformedCode);
  }
  
  // Add use client directive if needed
  if (analysis.hasClientSideCode || analysis.hasReactHooks) {
    if (!transformedCode.includes('"use client"') && !transformedCode.includes("'use client'")) {
      transformedCode = `"use client";\n\n${transformedCode}`;
    }
  }
  
  // Ensure default export if a component name is provided
  if (analysis.componentName) {
    transformedCode = ensureExportDefault(transformedCode, analysis.componentName);
  }
  
  return transformedCode;
};

/**
 * Converts a React component to a Next.js page
 */
export const convertToNextPage = (code: string, pagePath: string, analysis: any): string => {
  // First apply standard component conversions
  let transformedCode = convertComponent(code, analysis);
  
  // If this page has data fetching in useEffect, consider adding a basic getServerSideProps 
  // function for potential server-side fetching
  if (analysis.hasDataFetching && !transformedCode.includes('getServerSideProps') && !transformedCode.includes('getStaticProps')) {
    transformedCode += `\n
// You can use this function for server-side data fetching
export async function getServerSideProps() {
  return {
    props: {}
  };
}
`;
  }
  
  return transformedCode;
};

/**
 * Converts a React component to a Next.js API route
 */
export const convertToNextApi = (code: string, apiName: string): string => {
  // Check if this looks like an API handler function
  if (code.includes('export') && (code.includes('req') || code.includes('request')) && 
      (code.includes('res') || code.includes('response'))) {
    
    // It might already be a proper API route, just ensure it has the right signature
    return code.replace(
      /export\s+(default\s+)?(async\s+)?function\s+\w+\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/g,
      `export default $2function handler($3, $4)`
    );
  }
  
  // Otherwise, create a basic API route template
  return `
export default function handler(req, res) {
  // Extract original code functionality
  try {
    // Handle different HTTP methods
    switch(req.method) {
      case 'GET':
        return res.status(200).json({ message: 'GET endpoint for ${apiName}' });
      case 'POST':
        return res.status(200).json({ message: 'POST endpoint for ${apiName}' });
      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}
`;
};

/**
 * Converts a React component to a Next.js layout
 */
export const convertToNextLayout = (code: string, analysis: any): string => {
  // First apply standard component conversion
  let transformedCode = convertComponent(code, analysis);
  
  // If this doesn't have children prop already, add it
  if (!transformedCode.includes('children') && !transformedCode.includes('props.children')) {
    // Try to identify the component definition
    const componentDefinitionRegex = /function\s+(\w+)\s*\(\s*(?:props)?\s*\)\s*{|const\s+(\w+)\s*=\s*\(\s*(?:props)?\s*\)\s*=>/;
    const match = transformedCode.match(componentDefinitionRegex);
    
    if (match) {
      // Add children prop to the component
      transformedCode = transformedCode.replace(
        componentDefinitionRegex,
        (matched) => {
          if (matched.includes('function')) {
            return matched.replace(/\(\s*(?:props)?\s*\)/, '({ children })');
          } else {
            return matched.replace(/\(\s*(?:props)?\s*\)/, '({ children })');
          }
        }
      );
      
      // Find the return statement and add children
      const returnRegex = /return\s*\(\s*<([^>]+)>/;
      const returnMatch = transformedCode.match(returnRegex);
      
      if (returnMatch) {
        const rootElement = returnMatch[1].split(/\s+/)[0];
        transformedCode = transformedCode.replace(
          new RegExp(`</${rootElement}>\\s*\\);`, 'g'),
          `  {children}\n  </${rootElement}>\n  );`
        );
      }
    }
  }
  
  return transformedCode;
};

/**
 * Converts a React hook to be Next.js compatible
 */
export const convertToNextHook = (code: string, hookName: string, analysis: any): string => {
  // Check if this hook uses client-side only features
  if (analysis.hasClientSideCode || 
      code.includes('window.') || 
      code.includes('document.') ||
      code.includes('localStorage') ||
      code.includes('sessionStorage') ||
      code.includes('navigator')) {
    
    // Add 'use client' directive if it's not already there
    if (!code.includes('"use client"') && !code.includes("'use client'")) {
      code = `"use client";\n\n${code}`;
    }
  }
  
  return code;
};
