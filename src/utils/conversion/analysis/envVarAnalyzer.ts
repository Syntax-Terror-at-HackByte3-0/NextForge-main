
/**
 * Environment variable analyzer
 * Detects and processes environment variable usage
 */
import { UploadedFiles } from '@/types/conversion';
import { parseCode } from './astUtils';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { logConversion } from '../logger';

export interface EnvVariable {
  name: string;
  references: string[]; // Files that reference this env var
  value?: string; // Optional default value
  isPublic: boolean; // Whether it's used in client-side code
  description?: string; // Description of the variable's purpose
}

/**
 * Extract environment variables from a project
 */
export const extractEnvironmentVariables = (files: UploadedFiles): Record<string, EnvVariable> => {
  const envVars: Record<string, EnvVariable> = {};
  
  // Check for .env files first
  Object.entries(files).forEach(([filePath, content]) => {
    if (filePath.includes('.env')) {
      // Parse .env file
      const lines = content.split('\n');
      
      lines.forEach(line => {
        // Skip comments and empty lines
        if (line.trim().startsWith('#') || !line.trim()) return;
        
        // Extract variable
        const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
        if (match) {
          const name = match[1];
          const value = match[2].replace(/["']/g, ''); // Remove quotes
          
          // Add to environment variables
          if (!envVars[name]) {
            envVars[name] = {
              name,
              references: [],
              value,
              isPublic: name.startsWith('NEXT_PUBLIC_') || name.startsWith('REACT_APP_'),
              description: `Extracted from ${filePath}`
            };
          }
        }
      });
    }
  });
  
  // Then check process.env usage in code
  Object.entries(files).forEach(([filePath, content]) => {
    if (!/\.(js|jsx|ts|tsx)$/.test(filePath)) return;
    
    try {
      const ast = parseCode(content);
      const isClientSideFile = filePath.includes('components/') || 
                               content.includes('useState') || 
                               content.includes('useEffect');
      
      traverse(ast, {
        MemberExpression(path) {
          // Look for process.env.X patterns
          if (t.isIdentifier(path.node.object) && 
              path.node.object.name === 'process' && 
              t.isIdentifier(path.node.property) && 
              path.node.property.name === 'env') {
            
            // Get the environment variable name
            const parent = path.parent;
            if (t.isMemberExpression(parent) && t.isIdentifier(parent.property)) {
              const varName = parent.property.name;
              
              // Add to environment variables
              if (!envVars[varName]) {
                envVars[varName] = {
                  name: varName,
                  references: [filePath],
                  isPublic: isClientSideFile || varName.startsWith('NEXT_PUBLIC_') || varName.startsWith('REACT_APP_')
                };
              } else if (!envVars[varName].references.includes(filePath)) {
                envVars[varName].references.push(filePath);
                // Update isPublic if used in client-side code
                if (isClientSideFile) {
                  envVars[varName].isPublic = true;
                }
              }
            }
          }
        }
      });
    } catch (error) {
      logConversion('warning', `Failed to analyze env vars in ${filePath}: ${(error as Error).message}`);
    }
  });
  
  return envVars;
};

/**
 * Generate a .env.local file content
 */
export const generateEnvFile = (envVars: Record<string, EnvVariable>): string => {
  let content = '# Environment variables for Next.js\n';
  content += '# These variables were automatically extracted from your React project\n\n';
  
  // Group variables by their purpose
  const publicVars = Object.values(envVars).filter(v => v.isPublic);
  const privateVars = Object.values(envVars).filter(v => !v.isPublic);
  
  // Add public variables
  if (publicVars.length > 0) {
    content += '# Public variables (accessible in browser)\n';
    publicVars.forEach(v => {
      // Convert REACT_APP_ prefix to NEXT_PUBLIC_
      let name = v.name;
      if (name.startsWith('REACT_APP_')) {
        name = 'NEXT_PUBLIC_' + name.substring(10);
        content += `# Renamed from ${v.name} for Next.js compatibility\n`;
      } else if (!name.startsWith('NEXT_PUBLIC_')) {
        name = 'NEXT_PUBLIC_' + name;
        content += `# Prefixed with NEXT_PUBLIC_ for browser access\n`;
      }
      
      if (v.description) {
        content += `# ${v.description}\n`;
      }
      content += `${name}=${v.value || ''}\n\n`;
    });
  }
  
  // Add private variables
  if (privateVars.length > 0) {
    content += '# Private variables (server-side only)\n';
    privateVars.forEach(v => {
      // Remove REACT_APP_ prefix if present
      let name = v.name;
      if (name.startsWith('REACT_APP_')) {
        name = name.substring(10);
        content += `# Renamed from ${v.name} for Next.js compatibility\n`;
      }
      
      if (v.description) {
        content += `# ${v.description}\n`;
      }
      content += `${name}=${v.value || ''}\n\n`;
    });
  }
  
  return content;
};

/**
 * Generate documentation on migrating environment variables
 */
export const generateEnvMigrationGuide = (envVars: Record<string, EnvVariable>): string => {
  const hasReactAppVars = Object.keys(envVars).some(name => name.startsWith('REACT_APP_'));
  
  let guide = '# Environment Variables Migration Guide\n\n';
  
  guide += '## Next.js Environment Variables\n\n';
  guide += 'Next.js has a built-in support for environment variables, which is similar to create-react-app but with some key differences:\n\n';
  guide += '1. Variables must be prefixed with `NEXT_PUBLIC_` to be exposed to the browser (instead of `REACT_APP_`).\n';
  guide += '2. Environment variables are only available at build time, not runtime.\n';
  guide += '3. You can use different .env files for different environments (.env.development, .env.production).\n\n';
  
  if (hasReactAppVars) {
    guide += '## Changes Made During Conversion\n\n';
    guide += 'The following changes were made to your environment variables:\n\n';
    
    Object.values(envVars).forEach(v => {
      if (v.name.startsWith('REACT_APP_')) {
        guide += `- \`${v.name}\` → \`NEXT_PUBLIC_${v.name.substring(10)}\`\n`;
      }
    });
    
    guide += '\n## Code Changes\n\n';
    guide += 'If you were using `process.env.REACT_APP_*` variables in your code, they have been updated to use the new prefix:\n\n';
    guide += '```javascript\n';
    guide += '// Old code\nconst apiKey = process.env.REACT_APP_API_KEY;\n\n';
    guide += '// New code\nconst apiKey = process.env.NEXT_PUBLIC_API_KEY;\n';
    guide += '```\n\n';
  }
  
  guide += '## Setting Up Environment Variables\n\n';
  guide += '1. Create a `.env.local` file in the root of your project.\n';
  guide += '2. Add your environment variables to this file.\n';
  guide += '3. For different environments, you can use `.env.development`, `.env.production`, etc.\n\n';
  
  guide += '## Example .env.local\n\n';
  guide += '```\n';
  guide += '# Public variables (accessible in browser)\n';
  guide += 'NEXT_PUBLIC_API_URL=https://api.example.com\n';
  guide += 'NEXT_PUBLIC_GA_ID=UA-000000-01\n\n';
  guide += '# Private variables (server-side only)\n';
  guide += 'DATABASE_URL=postgres://user:password@localhost:5432/db\n';
  guide += 'API_SECRET_KEY=your-secret-key\n';
  guide += '```\n\n';
  
  guide += '## Important Notes\n\n';
  guide += '- Never commit `.env.local` to your repository. It should be added to `.gitignore`.\n';
  guide += '- Only variables prefixed with `NEXT_PUBLIC_` will be available in the browser.\n';
  guide += '- Use server-side functions like `getServerSideProps` to access private variables.\n';
  
  return guide;
};
