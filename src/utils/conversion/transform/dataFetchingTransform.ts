
/**
 * Generates data fetching methods for Next.js pages
 */
import { AnalysisResult, RenderingStrategy } from '../analysis/analysisTypes';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { parseCode } from '../analysis/astUtils';

/**
 * Generate getServerSideProps for pages with dynamic data
 */
export const generateServerSideProps = (pageName: string, analysis?: AnalysisResult): string => {
  // Create a more sophisticated implementation based on detected fetch patterns
  const hasFetch = analysis?.hasDataFetching || false;
  const fetchLibrary = analysis?.dependencies.includes('axios') ? 'axios' : 'fetch';
  
  return `\n\nexport async function getServerSideProps(context) {
  // Fetch data from external API or database
  try {
    ${hasFetch ? `// Data fetching with ${fetchLibrary}
    // const res = await ${fetchLibrary === 'axios' ? 
      "axios.get('your-api-endpoint')" : 
      "fetch('your-api-endpoint')"};
    // const data = ${fetchLibrary === 'axios' ? 'res.data' : 'await res.json()'}` : 
    '// Add your data fetching logic here'
    }
    
    return {
      props: {
        // Forward fetched data as props
        // data,
        // You can add more props here
      }
    };
  } catch (error) {
    console.error('Error fetching data:', error);
    return {
      props: {
        error: 'Failed to load data'
      }
    };
  }
}\n`;
};

/**
 * Generate getStaticProps for pages with static data
 */
export const generateStaticProps = (pageName: string, analysis?: AnalysisResult): string => {
  // Create a more sophisticated implementation based on detected fetch patterns
  const hasFetch = analysis?.hasDataFetching || false;
  const fetchLibrary = analysis?.dependencies.includes('axios') ? 'axios' : 'fetch';
  
  return `\n\nexport async function getStaticProps(context) {
  // Fetch data at build time
  try {
    ${hasFetch ? `// Data fetching with ${fetchLibrary}
    // const res = await ${fetchLibrary === 'axios' ? 
      "axios.get('your-api-endpoint')" : 
      "fetch('your-api-endpoint')"};
    // const data = ${fetchLibrary === 'axios' ? 'res.data' : 'await res.json()'}` : 
    '// Add your data fetching logic here'
    }
    
    return {
      props: {
        // Forward fetched data as props
        // data,
        // You can add more props here
      },
      // Re-generate the page:
      // - At most once every 10 seconds
      // - When a request comes in
      revalidate: 10
    };
  } catch (error) {
    console.error('Error fetching data:', error);
    return {
      props: {
        error: 'Failed to load data'
      }
    };
  }
}\n`;
};

/**
 * Generate getStaticPaths for dynamic routes
 */
export const generateStaticPaths = (paramName: string): string => {
  return `\n\nexport async function getStaticPaths() {
  // Generate paths based on your data
  // For example:
  // const res = await fetch('your-api-endpoint');
  // const data = await res.json();
  // const paths = data.map(item => ({ params: { ${paramName}: item.id.toString() } }));
  
  return {
    paths: [
      // { params: { ${paramName}: '1' } },
      // { params: { ${paramName}: '2' } },
    ],
    fallback: 'blocking' // 'blocking', true, or false
  };
}\n`;
};

/**
 * Add appropriate data fetching method based on analysis
 */
export const addDataFetchingMethod = (code: string, pageName: string, analysis: AnalysisResult): string => {
  // Skip if we already have data fetching methods
  if (
    code.includes('export async function getServerSideProps') ||
    code.includes('export async function getStaticProps')
  ) {
    return code;
  }
  
  // Extract existing fetch/axios calls to use in getServerSideProps or getStaticProps
  let existingFetchCalls = extractFetchCalls(code);
  
  if (analysis.hasDataFetching) {
    // Determine the appropriate data fetching method
    const renderingStrategy = analysis.recommendedRenderingStrategy || 'ssr';
    
    // Add the appropriate data fetching method
    if (renderingStrategy === 'ssr') {
      return code + generateServerSideProps(pageName, analysis);
    } else if (renderingStrategy === 'ssg' || renderingStrategy === 'isr') {
      return code + generateStaticProps(pageName, analysis);
    }
  }
  
  return code;
};

/**
 * Extract fetch/axios calls from code
 */
const extractFetchCalls = (code: string): string[] => {
  const fetchCalls: string[] = [];
  
  try {
    const ast = parseCode(code);
    
    traverse(ast, {
      CallExpression(path) {
        // Check for fetch calls
        if (t.isIdentifier(path.node.callee) && path.node.callee.name === 'fetch') {
          const fetchCall = generate(path.node).code;
          fetchCalls.push(fetchCall);
        }
        
        // Check for axios calls
        if (t.isMemberExpression(path.node.callee) && 
            t.isIdentifier(path.node.callee.object) && 
            path.node.callee.object.name === 'axios' &&
            t.isIdentifier(path.node.callee.property) && 
            ['get', 'post', 'put', 'delete'].includes(path.node.callee.property.name)) {
          const axiosCall = generate(path.node).code;
          fetchCalls.push(axiosCall);
        }
      }
    });
  } catch (error) {
    console.error('Error extracting fetch calls:', error);
  }
  
  return fetchCalls;
};

/**
 * Convert React effects/lifecycle fetch to Next.js data fetching
 */
export const convertReactFetchToNextFetch = (code: string, analysis: AnalysisResult): string => {
  if (!analysis.hasDataFetching) {
    return code;
  }
  
  try {
    const ast = parseCode(code);
    let modified = false;
    
    // Track extracted fetch logic
    const extractedFetchCalls: string[] = [];
    
    // Extract fetch calls from useEffect or componentDidMount
    traverse(ast, {
      CallExpression(path) {
        if (t.isIdentifier(path.node.callee) && path.node.callee.name === 'useEffect') {
          // Look for fetch/axios calls in the useEffect callback
          const callback = path.node.arguments[0];
          if (t.isArrowFunctionExpression(callback) || t.isFunctionExpression(callback)) {
            const body = callback.body;
            if (t.isBlockStatement(body)) {
              // Traverse the body to find fetch/axios calls
              traverse(body, {
                CallExpression(fetchPath) {
                  const fetchCallee = fetchPath.node.callee;
                  if ((t.isIdentifier(fetchCallee) && fetchCallee.name === 'fetch') || 
                      (t.isMemberExpression(fetchCallee) && 
                       t.isIdentifier(fetchCallee.object) && 
                       fetchCallee.object.name === 'axios')) {
                    // Extract the fetch call and its surrounding logic
                    let parentStatement = fetchPath.findParent(p => p.isExpressionStatement() || p.isVariableDeclaration());
                    if (parentStatement) {
                      const statementCode = generate(parentStatement.node).code;
                      extractedFetchCalls.push(statementCode);
                    } else {
                      const fetchCode = generate(fetchPath.node).code;
                      extractedFetchCalls.push(fetchCode);
                    }
                  }
                }
              }, path.scope, path);
            }
          }
        }
      },
      
      ClassMethod(path) {
        if (t.isIdentifier(path.node.key) && path.node.key.name === 'componentDidMount') {
          // Look for fetch/axios calls in componentDidMount
          traverse(path.node.body, {
            CallExpression(fetchPath) {
              const fetchCallee = fetchPath.node.callee;
              if ((t.isIdentifier(fetchCallee) && fetchCallee.name === 'fetch') || 
                  (t.isMemberExpression(fetchCallee) && 
                   t.isIdentifier(fetchCallee.object) && 
                   fetchCallee.object.name === 'axios')) {
                // Extract the fetch call and its surrounding logic
                let parentStatement = fetchPath.findParent(p => p.isExpressionStatement() || p.isVariableDeclaration());
                if (parentStatement) {
                  const statementCode = generate(parentStatement.node).code;
                  extractedFetchCalls.push(statementCode);
                } else {
                  const fetchCode = generate(fetchPath.node).code;
                  extractedFetchCalls.push(fetchCode);
                }
              }
            }
          }, path.scope, path);
        }
      }
    });
    
    // Only perform the transformation if we found fetch calls
    if (extractedFetchCalls.length > 0) {
      modified = true;
      
      // Remove the useEffect and componentDidMount fetch calls
      // This is a more complex transformation and would require more careful AST manipulation
      
      // For now, we'll just add a comment about this transformation
      code = `/* 
 * FETCH TRANSFORMATION: 
 * The following fetch calls were found in client-side code:
 * ${extractedFetchCalls.map(c => `\n * - ${c}`).join('')}
 * 
 * Consider moving these to getServerSideProps or getStaticProps for better performance.
 */
${code}`;
    }
    
    return code;
  } catch (error) {
    console.error('Error converting React fetch to Next.js fetch:', error);
    return code;
  }
};

/**
 * Determine the optimal rendering strategy based on component analysis
 */
export const determineRenderingStrategy = (analysis: AnalysisResult): RenderingStrategy => {
  // If already determined, use that
  if (analysis.recommendedRenderingStrategy) {
    return analysis.recommendedRenderingStrategy;
  }
  
  if (analysis.hasDataFetching) {
    // Check for dynamic data indicators
    const hasDynamicData = analysis.hasClientSideCode || 
                           analysis.browserAPIs?.includes('Date') ||
                           analysis.dependencies.some(dep => 
                             dep.includes('date') || dep.includes('time'));
                             
    if (hasDynamicData) {
      return 'ssr';
    } else {
      // Check for indications of dynamic routes/parameters
      const hasDynamicParams = analysis.routePatterns?.some(route => 
        route.includes(':') || route.includes('[')) || false;
        
      return hasDynamicParams ? 'isr' : 'ssg';
    }
  } 
  
  // Default to client-side rendering for components without data fetching
  return 'csr';
};

/**
 * Generate recommended data fetching imports based on component analysis
 */
export const generateDataFetchingImports = (analysis: AnalysisResult): string => {
  const imports: string[] = [];
  
  // For SWR
  if (analysis.dependencies.some(dep => dep.includes('swr'))) {
    imports.push("import useSWR from 'swr'");
  }
  
  // For React Query
  if (analysis.dependencies.some(dep => dep.includes('query') || dep.includes('tanstack'))) {
    imports.push("import { useQuery } from '@tanstack/react-query'");
  }
  
  // For Next.js data hooks
  if (analysis.hasDataFetching && !imports.length) {
    // If no data fetching library is used but data fetching exists
    imports.push("// Consider using SWR or React Query for data fetching");
    imports.push("// import useSWR from 'swr'");
  }
  
  return imports.join('\n');
};
