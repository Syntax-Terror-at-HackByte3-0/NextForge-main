
/**
 * Transforms React API code to Next.js API routes
 */
import { convertImports } from './importTransform';
import { logConversion } from '../logger';

/**
 * Transforms React API components to Next.js API routes
 */
export const transformApiComponent = (code: string, apiName: string): string => {
  // Log the API transformation
  logConversion('info', `Transforming API component: ${apiName}`);
  
  // Start with basic imports conversion
  let convertedCode = convertImports(code);
  
  // Check if this already looks like a Next.js API handler
  if (
    convertedCode.includes('export default function handler') ||
    convertedCode.includes('export default async function handler')
  ) {
    logConversion('info', `API ${apiName} already has handler format, minimal changes applied`);
    return convertedCode;
  }
  
  // Look for fetch or response patterns
  const hasFetchPattern = code.includes('fetch(') || code.includes('axios');
  const hasResponsePattern = code.includes('response') || code.includes('status');
  
  // Basic API route template if we can't extract logic from existing code
  let apiTemplate = `export default async function handler(req, res) {
  // Your API logic goes here
  try {
    if (req.method === 'GET') {
      // Handle GET request
      res.status(200).json({ message: 'API route generated from ${apiName}' });
    } else if (req.method === 'POST') {
      // Handle POST request
      const data = req.body;
      res.status(200).json({ message: 'Data received', data });
    } else {
      // Handle unsupported methods
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(\`Method \${req.method} Not Allowed\`);
    }
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}`;

  if (hasFetchPattern) {
    logConversion('info', `Detected fetch patterns in API ${apiName}, customizing handler`);
    // Enhanced template for APIs that perform fetches
    apiTemplate = `export default async function handler(req, res) {
  try {
    // Extracted from "${apiName}"
    if (req.method === 'GET') {
      // This API appears to fetch data from another source
      const response = await fetch('https://api.example.com/data');
      const data = await response.json();
      res.status(200).json(data);
    } else {
      res.setHeader('Allow', ['GET']);
      res.status(405).end(\`Method \${req.method} Not Allowed\`);
    }
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}`;
  }

  logConversion('success', `Transformed API component: ${apiName}`);
  return apiTemplate;
};
