
/**
 * Manages the transformation of React components to Next.js components
 */
import { applyAllAssetTransformations } from './assetTransform';
import { convertImports } from './importTransform';
import { convertHeadToMetadata } from './headTransform';

/**
 * Apply server component transforms to the code
 */
export const applyServerComponentTransforms = (code: string, analysis: any): string => {
  // If the component uses client-side functionality, add 'use client' directive
  if (analysis.hasClientSideCode || 
      analysis.hasReactHooks || 
      code.includes('useState') || 
      code.includes('useReducer') || 
      code.includes('useEffect') ||
      code.includes('window.') || 
      code.includes('document.')) {
    
    // Add 'use client' directive if not already present
    if (!code.includes('"use client"') && !code.includes("'use client'")) {
      return `"use client";\n\n${code}`;
    }
  }
  
  return code;
};

/**
 * Apply data fetching transforms to convert client-side data fetching to server-side
 */
export const applyDataFetchingTransforms = (code: string, analysis: any): string => {
  // If the component has useEffect with data fetching and no getServerSideProps
  // This is a simplified implementation - a real one would use AST parsing
  if (analysis.hasDataFetching && 
      !code.includes('getServerSideProps') && 
      !code.includes('getStaticProps')) {
    
    // Consider adding getServerSideProps
    const getServerSidePropsSection = `
export async function getServerSideProps() {
  // Server-side data fetching - customize based on your needs
  try {
    // Fetch your data here
    // const data = await fetchData();
    
    return {
      props: {
        // data,
      },
    };
  } catch (error) {
    console.error('Error fetching data:', error);
    return {
      props: {
        error: 'Failed to load data',
      },
    };
  }
}
`;
    
    return `${code}\n${getServerSidePropsSection}`;
  }
  
  return code;
};

/**
 * Apply state management transforms to make state work well with Next.js
 */
export const applyStateManagementTransforms = (code: string, analysis: any): string => {
  // This is a placeholder for more sophisticated state transformation logic
  // Real implementation would use AST parsing and targeted transformations
  
  // If using Redux, we might need to adjust the store configuration
  if (analysis.hasRedux) {
    // Add appropriate wrappers or modifications
  }
  
  // If using React Context, ensure it's properly set up for Next.js
  if (analysis.hasContextAPI) {
    // Adjust context providers if needed
  }
  
  // Ensure any component with state has 'use client' directive
  if (analysis.hasReactHooks) {
    if (!code.includes('"use client"') && !code.includes("'use client'")) {
      return `"use client";\n\n${code}`;
    }
  }
  
  return code;
};

/**
 * Apply router-related transforms to convert React Router to Next.js router
 */
export const applyRouterTransforms = (code: string, analysis: any): string => {
  // Convert React Router imports
  let transformedCode = code;
  
  // Replace common React Router patterns
  if (analysis.hasRouting || 
      code.includes('useNavigate') || 
      code.includes('useHistory') || 
      code.includes('useLocation') || 
      code.includes('useParams')) {
    
    // Convert useHistory/useNavigate
    transformedCode = transformedCode.replace(
      /const\s+(\w+)\s+=\s+use(History|Navigate)\(\)/g,
      'const $1 = useRouter()'
    );
    
    // Convert history.push/navigate calls
    transformedCode = transformedCode.replace(
      /(\w+)\.(push|navigate)\(['"]([^'"]+)['"](,\s*\{[^}]+\})?\)/g,
      '$1.push("$3")'
    );
    
    // Convert useParams
    transformedCode = transformedCode.replace(
      /const\s+(\{[^}]+\}|\w+)\s+=\s+useParams\(\)/g,
      'const router = useRouter()\n  const $1 = router.query'
    );
    
    // Convert useLocation
    transformedCode = transformedCode.replace(
      /const\s+(\w+)\s+=\s+useLocation\(\)/g,
      'const $1 = useRouter()'
    );
    
    // Add imports if needed
    if (transformedCode.includes('useRouter()') && !transformedCode.includes('useRouter from')) {
      transformedCode = `import { useRouter } from 'next/router';\n${transformedCode}`;
    }
    
    // Add 'use client' directive if needed
    if (!transformedCode.includes('"use client"') && !transformedCode.includes("'use client'")) {
      transformedCode = `"use client";\n\n${transformedCode}`;
    }
  }
  
  return transformedCode;
};

/**
 * Apply client directive transform based on component analysis
 */
export const applyClientDirectiveTransform = (code: string, analysis: any): string => {
  // Check if this component needs 'use client' directive
  if (analysis.hasClientSideCode || 
      analysis.hasReactHooks || 
      code.includes('window.') || 
      code.includes('document.') || 
      code.includes('localStorage') || 
      code.includes('sessionStorage') ||
      code.includes('useState') ||
      code.includes('useEffect') ||
      code.includes('useRef') ||
      code.includes('useCallback') ||
      code.includes('useMemo') ||
      code.includes('useContext')) {
    
    // Add 'use client' directive if not already present
    if (!code.includes('"use client"') && !code.includes("'use client'")) {
      return `"use client";\n\n${code}`;
    }
  }
  
  return code;
};

/**
 * Apply all transformations to convert a React component to Next.js
 */
export const applyAllTransformations = (code: string, analysis: any): string => {
  let transformedCode = code;
  
  // Apply transformations in sequence
  transformedCode = convertImports(transformedCode, analysis.isTypescript);
  transformedCode = applyAllAssetTransformations(transformedCode);
  transformedCode = applyClientDirectiveTransform(transformedCode, analysis);
  transformedCode = applyServerComponentTransforms(transformedCode, analysis);
  transformedCode = applyRouterTransforms(transformedCode, analysis);
  transformedCode = applyDataFetchingTransforms(transformedCode, analysis);
  transformedCode = applyStateManagementTransforms(transformedCode, analysis);
  transformedCode = convertHeadToMetadata(transformedCode);
  
  return transformedCode;
};
