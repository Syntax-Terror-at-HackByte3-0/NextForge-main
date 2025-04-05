
/**
 * Utilities for transforming CSS-in-JS to Next.js styles
 */
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import { parseCode } from '../analysis/astUtils';
import { logConversion } from '../logger';

/**
 * Extract styled-components or emotion styles to CSS files
 */
export const extractCSSInJSStyles = (code: string, filename: string): { 
  code: string;
  extractedCSS: string | null;
  styleImportPath: string | null;
} => {
  // Skip if no CSS-in-JS is detected
  if (!code.includes('styled') && !code.includes('css`') && !code.includes('createGlobalStyle')) {
    return { code, extractedCSS: null, styleImportPath: null };
  }
  
  try {
    const ast = parseCode(code);
    let extractedCSS = '';
    let modified = false;
    let componentName = '';
    
    // Try to identify the component name from the filename
    const filenameParts = filename.split(/[\/\\]/).pop();
    if (filenameParts) {
      componentName = filenameParts.replace(/\.(jsx?|tsx?)$/, '');
    }
    
    // Generate a CSS class name based on the component name
    const baseCssClassName = componentName 
      ? componentName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
      : 'extracted-component';
    
    // Track styled components to replace
    const styledComponentsMap: Record<string, string> = {};
    
    // First pass: collect styled components
    traverse(ast, {
      VariableDeclarator(path) {
        // Look for styled component declarations like const Button = styled.button`...`
        if (t.isIdentifier(path.node.id) && 
            path.node.init && 
            t.isTaggedTemplateExpression(path.node.init) &&
            ((t.isMemberExpression(path.node.init.tag) && 
              t.isIdentifier(path.node.init.tag.object) && 
              path.node.init.tag.object.name === 'styled') || 
             (t.isIdentifier(path.node.init.tag) && 
              path.node.init.tag.name === 'styled'))) {
          
          // Get component name (identifier)
          const componentName = path.node.id.name;
          
          // Generate CSS class name
          const cssClassName = `${baseCssClassName}__${componentName.toLowerCase()}`;
          
          // Get style content
          if (path.node.init.quasi.quasis.length > 0) {
            const css = path.node.init.quasi.quasis
              .map(quasi => quasi.value.raw)
              .join('/* expression */');
            
            // Add to extracted CSS with class selector
            extractedCSS += `.${cssClassName} {\n${css}\n}\n\n`;
            
            // Store the mapping
            styledComponentsMap[componentName] = cssClassName;
            modified = true;
          }
        }
      }
    });
    
    // If no styles were extracted, return original code
    if (!modified) {
      return { code, extractedCSS: null, styleImportPath: null };
    }
    
    // Second pass: replace styled components with regular components + className
    traverse(ast, {
      VariableDeclarator(path) {
        // Check if this is a styled component we've already processed
        if (t.isIdentifier(path.node.id) && 
            path.node.id.name in styledComponentsMap && 
            path.node.init && 
            t.isTaggedTemplateExpression(path.node.init)) {
          
          const componentName = path.node.id.name;
          const cssClassName = styledComponentsMap[componentName];
          
          // Determine the element type
          let elementType = 'div'; // Default
          if (t.isMemberExpression(path.node.init.tag) && 
              t.isIdentifier(path.node.init.tag.object) && 
              path.node.init.tag.object.name === 'styled' && 
              t.isIdentifier(path.node.init.tag.property)) {
            elementType = path.node.init.tag.property.name;
          }
          
          // Replace with a React component that returns the element with className
          const newComponent = parse(`
const ${componentName} = ({ className, ...props }) => {
  return <${elementType} className={\`${cssClassName} \${className || ''}\`} {...props} />;
};
          `).program.body[0];
          
          path.parentPath.replaceWith(newComponent);
        }
      }
    });
    
    // Third pass: add module import for the CSS file
    const cssFilename = `${componentName}.module.css`;
    const styleImportPath = `../styles/${cssFilename}`;
    
    traverse(ast, {
      Program(path) {
        const styleImport = parse(`import styles from '${styleImportPath}';`).program.body[0];
        path.node.body.unshift(styleImport);
      }
    });
    
    const output = generate(ast);
    
    // Log the extraction
    logConversion('info', `Extracted CSS-in-JS styles to ${cssFilename}`, filename);
    
    return {
      code: output.code,
      extractedCSS,
      styleImportPath
    };
  } catch (error) {
    console.error('Error extracting CSS-in-JS styles:', error);
    return { code, extractedCSS: null, styleImportPath: null };
  }
};
