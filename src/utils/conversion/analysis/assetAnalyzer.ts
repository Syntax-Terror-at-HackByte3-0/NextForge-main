
/**
 * Asset analyzer for CSS, images, and other static files
 */
import { UploadedFiles } from '@/types/conversion';
import { logConversion } from '../logger';
import { parseCode } from './astUtils';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import * as path from 'path';

// Types of CSS files
export enum CssFileType {
  GLOBAL = 'global',
  MODULE = 'module',
  COMPONENT_SPECIFIC = 'component',
  LIBRARY = 'library'
}

// Type for asset information
export interface AssetInfo {
  type: 'css' | 'image' | 'font' | 'video' | 'audio' | 'json' | 'other';
  path: string;
  size: number;
  references: string[]; // Files that reference this asset
  importStyle?: 'import' | 'require' | 'url' | 'static'; // How the asset is imported
  category?: CssFileType; // For CSS files
  optimization?: string; // Optimization suggestions
}

/**
 * Analyze CSS files in the project
 */
export const analyzeCssFiles = (files: UploadedFiles): Record<string, AssetInfo> => {
  const cssFiles: Record<string, AssetInfo> = {};
  
  // First, identify all CSS files
  Object.entries(files).forEach(([filePath, content]) => {
    if (/\.(css|scss|sass|less)$/.test(filePath)) {
      const fileExt = path.extname(filePath);
      const fileName = path.basename(filePath);
      
      // Determine CSS file type
      let category = CssFileType.COMPONENT_SPECIFIC;
      
      if (fileName.includes('global') || fileName === 'index.css' || fileName === 'main.css' || fileName === 'App.css') {
        category = CssFileType.GLOBAL;
      } else if (fileName.includes('.module.')) {
        category = CssFileType.MODULE;
      } else if (filePath.includes('node_modules') || filePath.includes('vendor')) {
        category = CssFileType.LIBRARY;
      }
      
      cssFiles[filePath] = {
        type: 'css',
        path: filePath,
        size: content.length,
        references: [],
        category,
        optimization: category === CssFileType.GLOBAL 
          ? 'Move to globals.css in Next.js' 
          : category === CssFileType.COMPONENT_SPECIFIC 
            ? 'Convert to CSS Modules or styled-components' 
            : undefined
      };
    }
  });
  
  // Then, find references to these CSS files in JS/TS files
  Object.entries(files).forEach(([filePath, content]) => {
    if (!/\.(js|jsx|ts|tsx)$/.test(filePath)) return;
    
    try {
      const ast = parseCode(content);
      
      traverse(ast, {
        ImportDeclaration(path) {
          const source = path.node.source.value;
          
          // Check if this is importing a CSS file
          if (source.match(/\.(css|scss|sass|less)$/)) {
            // Resolve the path
            let resolvedPath = source;
            if (source.startsWith('.')) {
              const dir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
              resolvedPath = path.normalize(dir + source);
            }
            
            // Find the matching CSS file
            Object.keys(cssFiles).forEach(cssPath => {
              if (cssPath.endsWith(resolvedPath) || resolvedPath.endsWith(cssPath)) {
                if (!cssFiles[cssPath].references.includes(filePath)) {
                  cssFiles[cssPath].references.push(filePath);
                  cssFiles[cssPath].importStyle = 'import';
                }
              }
            });
          }
        },
        
        CallExpression(path) {
          // Check for require('./style.css') patterns
          if (t.isIdentifier(path.node.callee) && 
              path.node.callee.name === 'require' && 
              path.node.arguments.length > 0 && 
              t.isStringLiteral(path.node.arguments[0]) &&
              path.node.arguments[0].value.match(/\.(css|scss|sass|less)$/)) {
              
            const source = path.node.arguments[0].value;
            
            // Resolve the path
            let resolvedPath = source;
            if (source.startsWith('.')) {
              const dir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
              resolvedPath = path.normalize(dir + source);
            }
            
            // Find the matching CSS file
            Object.keys(cssFiles).forEach(cssPath => {
              if (cssPath.endsWith(resolvedPath) || resolvedPath.endsWith(cssPath)) {
                if (!cssFiles[cssPath].references.includes(filePath)) {
                  cssFiles[cssPath].references.push(filePath);
                  cssFiles[cssPath].importStyle = 'require';
                }
              }
            });
          }
        }
      });
    } catch (error) {
      logConversion('warning', `Failed to analyze CSS imports in ${filePath}: ${(error as Error).message}`);
    }
  });
  
  return cssFiles;
};

/**
 * Analyze image usage in the project
 */
export const analyzeImageUsage = (files: UploadedFiles): Record<string, AssetInfo> => {
  const imageFiles: Record<string, AssetInfo> = {};
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico'];
  
  // First, identify all image files
  Object.entries(files).forEach(([filePath, content]) => {
    const ext = path.extname(filePath).toLowerCase();
    if (imageExtensions.includes(ext)) {
      imageFiles[filePath] = {
        type: 'image',
        path: filePath,
        size: content.length, // This is approximate since we don't have actual file sizes
        references: [],
        optimization: 'Consider using next/image for optimization'
      };
    }
  });
  
  // Then, find references to these images in JS/TS/CSS files
  Object.entries(files).forEach(([filePath, content]) => {
    if (!/\.(js|jsx|ts|tsx|css|scss|sass|less)$/.test(filePath)) return;
    
    const isStyleFile = /\.(css|scss|sass|less)$/.test(filePath);
    
    if (isStyleFile) {
      // For style files, look for url() patterns
      const urlMatches = content.match(/url\(['"]?([^'"()]+)['"]?\)/g) || [];
      
      urlMatches.forEach(match => {
        const urlPath = match.replace(/url\(['"]?/, '').replace(/['"]?\)/, '');
        
        // Resolve relative path
        let resolvedPath = urlPath;
        if (urlPath.startsWith('.')) {
          const dir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
          resolvedPath = path.normalize(dir + urlPath);
        }
        
        // Check if this references an image
        Object.keys(imageFiles).forEach(imagePath => {
          if (imagePath.endsWith(resolvedPath) || resolvedPath.endsWith(imagePath)) {
            if (!imageFiles[imagePath].references.includes(filePath)) {
              imageFiles[imagePath].references.push(filePath);
              imageFiles[imagePath].importStyle = 'url';
            }
          }
        });
      });
    } else {
      // For JS/TS files, use AST parsing
      try {
        const ast = parseCode(content);
        
        traverse(ast, {
          ImportDeclaration(path) {
            const source = path.node.source.value;
            const ext = path.extname(source).toLowerCase();
            
            if (imageExtensions.includes(ext)) {
              // Resolve the path
              let resolvedPath = source;
              if (source.startsWith('.')) {
                const dir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
                resolvedPath = path.normalize(dir + source);
              }
              
              // Find the matching image file
              Object.keys(imageFiles).forEach(imagePath => {
                if (imagePath.endsWith(resolvedPath) || resolvedPath.endsWith(imagePath)) {
                  if (!imageFiles[imagePath].references.includes(filePath)) {
                    imageFiles[imagePath].references.push(filePath);
                    imageFiles[imagePath].importStyle = 'import';
                  }
                }
              });
            }
          },
          
          // Check for img tags in JSX
          JSXOpeningElement(path) {
            if (t.isJSXIdentifier(path.node.name) && path.node.name.name === 'img') {
              const srcAttr = path.node.attributes.find(attr => 
                t.isJSXAttribute(attr) && 
                t.isJSXIdentifier(attr.name) && 
                attr.name.name === 'src'
              );
              
              if (srcAttr && t.isJSXAttribute(srcAttr) && srcAttr.value) {
                // Handle string literals
                if (t.isStringLiteral(srcAttr.value)) {
                  const src = srcAttr.value.value;
                  
                  // If it's a relative path, try to match with an image file
                  if (src.startsWith('./') || src.startsWith('../')) {
                    const dir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
                    const resolvedPath = path.normalize(dir + src);
                    
                    Object.keys(imageFiles).forEach(imagePath => {
                      if (imagePath.endsWith(resolvedPath) || resolvedPath.endsWith(imagePath)) {
                        if (!imageFiles[imagePath].references.includes(filePath)) {
                          imageFiles[imagePath].references.push(filePath);
                          imageFiles[imagePath].importStyle = 'static';
                          imageFiles[imagePath].optimization = 'Replace with next/image component';
                        }
                      }
                    });
                  }
                }
              }
            }
          }
        });
      } catch (error) {
        logConversion('warning', `Failed to analyze image imports in ${filePath}: ${(error as Error).message}`);
      }
    }
  });
  
  return imageFiles;
};

/**
 * Process static assets for Next.js public directory
 */
export const processStaticAssets = (
  files: UploadedFiles
): { 
  publicAssets: string[]; 
  optimizedImages: string[];
  cssModules: string[];
  globalCss: string[];
} => {
  const publicAssets: string[] = [];
  const optimizedImages: string[] = [];
  const cssModules: string[] = [];
  const globalCss: string[] = [];
  
  // Analyze CSS files
  const cssFiles = analyzeCssFiles(files);
  
  Object.entries(cssFiles).forEach(([filePath, info]) => {
    if (info.category === CssFileType.GLOBAL) {
      globalCss.push(filePath);
    } else if (info.category === CssFileType.MODULE) {
      cssModules.push(filePath);
    }
  });
  
  // Analyze image files
  const imageFiles = analyzeImageUsage(files);
  
  Object.entries(imageFiles).forEach(([filePath, info]) => {
    if (info.references.length > 0) {
      // Images referenced by components could be optimized with next/image
      optimizedImages.push(filePath);
    } else {
      // Images without references should go to public directory
      publicAssets.push(filePath);
    }
  });
  
  // Check for other static assets
  Object.keys(files).forEach(filePath => {
    // Skip already processed files
    if (cssModules.includes(filePath) || 
        globalCss.includes(filePath) || 
        optimizedImages.includes(filePath) || 
        publicAssets.includes(filePath)) {
      return;
    }
    
    // Check for font files and other static assets
    const ext = path.extname(filePath).toLowerCase();
    if (['.woff', '.woff2', '.ttf', '.eot', '.otf', '.mp3', '.mp4', '.pdf', '.json'].includes(ext)) {
      publicAssets.push(filePath);
    }
    
    // Check if file is in a "public" directory
    if (filePath.includes('/public/') || filePath.includes('\\public\\')) {
      publicAssets.push(filePath);
    }
  });
  
  return { publicAssets, optimizedImages, cssModules, globalCss };
};
