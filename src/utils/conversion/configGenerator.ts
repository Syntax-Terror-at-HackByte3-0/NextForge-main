
/**
 * This file contains utilities for generating Next.js configuration files
 */

/**
 * Creates the necessary Next.js configuration files
 */
export const generateNextConfig = (dependencies: string[] = []): Record<string, string> => {
  const config: Record<string, string> = {};
  
  // Extract unique dependencies
  const uniqueDeps = [...new Set(dependencies)];
  
  // Check if we need certain config options
  const needsImages = uniqueDeps.includes('next/image') || uniqueDeps.includes('@next/image');
  const needsSass = uniqueDeps.includes('sass') || uniqueDeps.includes('node-sass');
  const needsTypeScript = uniqueDeps.includes('typescript') || dependencies.some(dep => dep.includes('.tsx') || dep.includes('.ts'));
  
  // Add next.config.js
  let nextConfigContent = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,`;
  
  if (needsImages) {
    nextConfigContent += `
  images: {
    domains: [],
  },`;
  }
  
  nextConfigContent += `
  experimental: {
    appDir: false,
  },
}

module.exports = nextConfig`;

  config['next.config.js'] = nextConfigContent;
  
  // Add package.json with detected dependencies
  const packageDeps: Record<string, string> = {
    'next': 'latest',
    'react': 'latest',
    'react-dom': 'latest'
  };
  
  // Add detected dependencies
  uniqueDeps.forEach(dep => {
    // Skip React and Next.js as we already have them
    if (
      !dep.includes('react') && 
      !dep.includes('next') && 
      !dep.startsWith('.') && 
      !dep.startsWith('/') &&
      !dep.includes('@types/')
    ) {
      packageDeps[dep] = 'latest';
    }
  });
  
  // Add common dev dependencies
  const devDeps: Record<string, string> = {
    '@types/node': 'latest',
    '@types/react': 'latest',
    '@types/react-dom': 'latest',
    'eslint': 'latest',
    'eslint-config-next': 'latest'
  };
  
  if (needsTypeScript) {
    devDeps['typescript'] = 'latest';
  }
  
  if (needsSass) {
    devDeps['sass'] = 'latest';
  }
  
  config['package.json'] = `{
  "name": "next-converted-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": ${JSON.stringify(packageDeps, null, 4).replace(/^{/, '').replace(/}$/, '  }')},
  "devDependencies": ${JSON.stringify(devDeps, null, 4).replace(/^{/, '').replace(/}$/, '  }')}
}`;
  
  // Add tsconfig if needed
  if (needsTypeScript) {
    config['tsconfig.json'] = `{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}`;
  }
  
  // Add .env example file
  config['.env.local.example'] = `# Environment variables
NEXT_PUBLIC_API_URL=your_api_url_here

# Add other environment variables your app needs
`;
  
  // Add .gitignore
  config['.gitignore'] = `# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
`;
  
  return config;
};
