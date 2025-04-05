
/**
 * Utilities for preparing downloadable files
 */
import JSZip from 'jszip';
import { FileNode } from '@/types/conversion';

/**
 * Prepare a downloadable ZIP file from the conversion result
 */
export const prepareDownloadZip = async (fileStructure: FileNode): Promise<Blob> => {
  const zip = new JSZip();
  
  // Create a recursive function to add files and directories
  const addToZip = (node: FileNode, currentPath: string = '') => {
    if (node.type === 'file' && node.content) {
      // Add file to zip
      zip.file(`${currentPath}${node.name}`, node.content);
    } else if (node.type === 'directory' && node.children) {
      // Process all children
      const dirPath = `${currentPath}${node.name}/`;
      
      // Don't create an empty folder for the root
      if (node.name !== 'next-app') {
        zip.folder(dirPath);
      }
      
      // Process children recursively
      for (const child of node.children) {
        addToZip(
          child, 
          node.name === 'next-app' ? '' : dirPath
        );
      }
    }
  };
  
  // Start adding files from the root
  addToZip(fileStructure);
  
  // Generate the zip file
  return await zip.generateAsync({ type: 'blob' });
};
