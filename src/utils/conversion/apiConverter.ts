
/**
 * This file contains conversion logic for API routes
 */
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';

/**
 * Advanced conversion of React API/data fetching to Next.js API routes
 */
export const convertToNextApi = (code: string, endpoint: string): string => {
  try {
    // Check if code already has a Next.js API handler format
    if (code.includes('export default function handler') || code.includes('export default async function handler')) {
      return code;
    }
    
    // Parse the code to understand its structure using improved parser options
    const ast = parse(code, {
      sourceType: 'module',
      plugins: [
        'jsx', 
        'typescript', 
        'classProperties', 
        'decorators-legacy',
        'objectRestSpread',
        'dynamicImport'
      ],
      allowImportExportEverywhere: true,
      errorRecovery: true
    });
    
    // Extract API logic from the React component
    const apiLogic = extractApiLogicFromAST(ast);
    
    // Generate smarter API route handler based on extracted logic
    let handlerCode = `export default async function handler(req, res) {
  try {
    // Handle CORS for local development and production
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
    
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Handle different HTTP methods
    switch (req.method) {`;
    
    // Add method handlers based on what we extracted
    const methods = Object.keys(apiLogic);
    
    if (methods.length === 0) {
      // Fallback to generic handlers if we couldn't extract specific methods
      handlerCode += `
      case 'GET':
        // Implement GET handler here
        return res.status(200).json({ message: 'GET endpoint ready' });
      
      case 'POST':
        // Get request body data
        const data = req.body;
        // Implement POST handler here
        return res.status(200).json({ message: 'POST endpoint ready', received: data });`;
    } else {
      // Add the methods we extracted
      methods.forEach(method => {
        const methodCode = apiLogic[method as keyof typeof apiLogic];
        handlerCode += `
      case '${method.toUpperCase()}':
        ${methodCode}
        break;`;
      });
    }
    
    // Close the switch and function
    handlerCode += `
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        res.status(405).json({ error: \`Method \${req.method} Not Allowed\` });
    }
  } catch (error) {
    console.error('API route error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}`;

    return handlerCode;
  } catch (error) {
    console.error('Error converting API route:', error);
    
    // Fallback to a simpler but more robust implementation
    return `export default async function handler(req, res) {
  try {
    // Handle CORS for local development
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
    
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Original implementation adapted for Next.js API routes
    // Data extraction for different request methods
    const data = req.method === 'GET' ? req.query : req.body;
    
    // Generic handler that responds with received data
    return res.status(200).json({ 
      success: true,
      method: req.method,
      endpoint: '${endpoint}',
      data
    });
  } catch (error) {
    console.error('API route error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}`;
  }
};

/**
 * Enhanced extraction of API logic from AST with more intelligent pattern recognition
 */
const extractApiLogicFromAST = (ast: any): { get?: string; post?: string; put?: string; delete?: string } => {
  const result: { get?: string; post?: string; put?: string; delete?: string } = {};
  
  try {
    traverse(ast, {
      CallExpression(path) {
        // Match a variety of API call patterns
        let methodDetected = '';
        let methodSource = '';
        
        // Detect fetch calls
        if (t.isIdentifier(path.node.callee) && path.node.callee.name === 'fetch') {
          methodSource = 'fetch';
          
          // Examine options parameter for method
          if (path.node.arguments.length > 1 && t.isObjectExpression(path.node.arguments[1])) {
            const methodProp = path.node.arguments[1].properties.find(
              (p: any) => t.isObjectProperty(p) && 
                          t.isIdentifier(p.key) && 
                          p.key.name === 'method' &&
                          t.isStringLiteral(p.value)
            );
            
            if (methodProp && t.isObjectProperty(methodProp) && t.isStringLiteral(methodProp.value)) {
              methodDetected = methodProp.value.value.toLowerCase();
            } else {
              methodDetected = 'get'; // Default for fetch
            }
          } else {
            methodDetected = 'get'; // Default for fetch with no options
          }
        }
        // Detect axios calls
        else if (t.isMemberExpression(path.node.callee) && 
                t.isIdentifier(path.node.callee.object) && 
                path.node.callee.object.name === 'axios') {
          methodSource = 'axios';
          
          if (t.isIdentifier(path.node.callee.property)) {
            methodDetected = path.node.callee.property.name.toLowerCase();
          }
        }
        
        // If we detected a method, extract the relevant code
        if (methodDetected && ['get', 'post', 'put', 'delete'].includes(methodDetected)) {
          // Generate appropriate Next.js API code based on the detected method
          const extractedCode = generate(path.findParent((p) => t.isExpressionStatement(p) || t.isVariableDeclaration(p))?.node || path.node).code;
          
          // Analyze URL and body parameters for more intelligent conversion
          let url = '';
          let hasBody = false;
          
          if (methodSource === 'fetch' && path.node.arguments.length > 0) {
            if (t.isStringLiteral(path.node.arguments[0])) {
              url = path.node.arguments[0].value;
            }
            
            if (path.node.arguments.length > 1 && t.isObjectExpression(path.node.arguments[1])) {
              const bodyProp = path.node.arguments[1].properties.find(
                (p: any) => t.isObjectProperty(p) && 
                            t.isIdentifier(p.key) && 
                            p.key.name === 'body'
              );
              
              hasBody = !!bodyProp;
            }
          }
          
          // Create method-specific handler logic
          switch (methodDetected) {
            case 'get':
              result.get = `
        // Extracted from original: ${methodSource} ${methodDetected} request
        // Original URL: ${url || 'not detected'}
        // Query parameters are available in req.query
        const response = await fetch(\`\${process.env.API_URL || ''}/your-endpoint\${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}\`);
        const data = await response.json();
        return res.status(200).json(data);`;
              break;
              
            case 'post':
              result.post = `
        // Extracted from original: ${methodSource} ${methodDetected} request
        // Original URL: ${url || 'not detected'}
        // Request body is available in req.body
        const requestData = req.body;
        // Process the data as needed
        const response = await fetch(\`\${process.env.API_URL || ''}/your-endpoint\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        });
        const responseData = await response.json();
        return res.status(response.status).json(responseData);`;
              break;
              
            case 'put':
              result.put = `
        // Extracted from original: ${methodSource} ${methodDetected} request
        // Original URL: ${url || 'not detected'}
        // Request body is available in req.body
        const requestData = req.body;
        // Process the data as needed
        const response = await fetch(\`\${process.env.API_URL || ''}/your-endpoint\${req.query.id ? \`/\${req.query.id}\` : ''}\`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        });
        const responseData = await response.json();
        return res.status(response.status).json(responseData);`;
              break;
              
            case 'delete':
              result.delete = `
        // Extracted from original: ${methodSource} ${methodDetected} request
        // Original URL: ${url || 'not detected'}
        // ID parameter might be in req.query.id or part of the path
        const id = req.query.id;
        const response = await fetch(\`\${process.env.API_URL || ''}/your-endpoint\${id ? \`/\${id}\` : ''}\`, {
          method: 'DELETE'
        });
        const responseData = await response.json();
        return res.status(response.status).json(responseData);`;
              break;
          }
        }
      }
    });
  } catch (error) {
    console.error('Error extracting API logic from AST:', error);
  }
  
  return result;
};

/**
 * Analyze React component to detect if it should be converted to an API route
 */
export const shouldBeApiRoute = (code: string, filePath: string): boolean => {
  // Check filename patterns that suggest API files
  const apiFilePatterns = [
    /api\.[jt]sx?$/i,
    /service\.[jt]sx?$/i,
    /client\.[jt]sx?$/i,
    /fetch\.[jt]sx?$/i,
    /http\.[jt]sx?$/i,
  ];
  
  if (apiFilePatterns.some(pattern => pattern.test(filePath))) {
    return true;
  }
  
  // Check code content for API-like patterns
  const apiCodePatterns = [
    /axios\.[a-z]+\(/i,
    /fetch\(/i,
    /new XMLHttpRequest\(/i,
    /\.[a-z]+\(['"]https?:\/\//i,
    /Content-Type.*application\/json/i,
    /Authorization.*Bearer/i
  ];
  
  if (apiCodePatterns.some(pattern => pattern.test(code))) {
    // Do deeper analysis if we detect initial API patterns
    try {
      const ast = parse(code, {
        sourceType: 'module',
        plugins: [
          'jsx', 
          'typescript', 
          'classProperties', 
          'decorators-legacy',
          'objectRestSpread',
          'dynamicImport'
        ],
        allowImportExportEverywhere: true,
        errorRecovery: true
      });
      
      let apiCallCount = 0;
      let uiElementCount = 0;
      
      traverse(ast, {
        // Count API-like calls
        CallExpression(path) {
          const callee = path.node.callee;
          if (
            (t.isIdentifier(callee) && callee.name === 'fetch') ||
            (t.isMemberExpression(callee) && 
            t.isIdentifier(callee.object) && 
            callee.object.name === 'axios')
          ) {
            apiCallCount++;
          }
        },
        // Count UI elements
        JSXElement() {
          uiElementCount++;
        }
      });
      
      // If we have API calls and few UI elements, it's likely an API module
      return apiCallCount > 0 && (uiElementCount === 0 || apiCallCount > uiElementCount);
    } catch (error) {
      console.error('Error analyzing for API route detection:', error);
      return false;
    }
  }
  
  return false;
};
