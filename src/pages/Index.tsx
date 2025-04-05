
import { useState, useEffect } from 'react';
import { toast } from "sonner";
import { ConversionResult } from '@/types/conversion';
import { convertProject } from '@/utils/fileProcessing';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/converter/Hero';
import FileUpload from '@/components/converter/FileUpload';
import ConversionProcess from '@/components/converter/ConversionProcess';
import ResultDisplay from '@/components/converter/ResultDisplay';
import FeatureComparison from '@/components/converter/FeatureComparison';
import { PageTransition } from '@/components/animations/PageTransition';
import { CodeSnippet } from '@/components/shared/CodeSnippet';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

// Example code snippet to demonstrate the feature
const exampleNextCode = `// pages/index.js
export default function Home() {
  return (
    <div>
      <h1>Welcome to Next.js!</h1>
      <p>Get started by editing this page</p>
    </div>
  )
}

export async function getStaticProps() {
  // Server-side data fetching at build time
  return {
    props: {
      // Your data
    }
  }
}`;

/**
 * Home page component for the React to Next.js converter tool
 */
export default function Index() {
  const [isConverting, setIsConverting] = useState(false);
  const [conversionComplete, setConversionComplete] = useState(false);
  const [conversionResult, setConversionResult] = useState<ConversionResult | undefined>(undefined);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [showCodeExample, setShowCodeExample] = useState(false);

  // Clear any conversion errors when component mounts
  useEffect(() => {
    setConversionError(null);
    
    // Show code example after a short delay
    const timer = setTimeout(() => {
      setShowCodeExample(true);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Reset conversion state when conversion is complete
  const handleConversionComplete = () => {
    setIsConverting(false);
    setConversionComplete(true);
  };
  
  // Handle file selection to start conversion
  const handleFilesSelected = async (files: File[]) => {
    // Reset state
    setConversionError(null);
    setIsConverting(true);
    setConversionComplete(false);
    
    // Log files for debugging
    console.log('Files selected:', files.map(f => f.name));
    
    try {
      // Start conversion process
      const result = await convertProject(files);
      
      // Save the conversion result
      setConversionResult(result);
      
      // Show success message
      if (result.logs?.errors && result.logs.errors.length > 0) {
        // Show warning if there were errors during conversion
        toast.warning('Conversion completed with some errors. See the log for details.');
      } else if (result.logs?.warnings && result.logs.warnings.length > 0) {
        // Show info toast if there were warnings
        toast.info('Conversion completed with some warnings. See the log for details.');
      } else {
        // Show success message for clean conversion
        toast.success('Conversion completed successfully!');
      }
    } catch (error) {
      // Handle conversion error
      console.error('Error during conversion:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setConversionError(errorMessage);
      toast.error(`Conversion error: ${errorMessage}`);
    } finally {
      handleConversionComplete();
    }
  };
  
  // Reset the conversion to start over
  const handleReset = () => {
    setConversionResult(undefined);
    setConversionComplete(false);
    setConversionError(null);
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-muted/30 dark:bg-gray-900">
      <Navbar />
      
      <PageTransition className="flex-grow">
        {/* Hero Section */}
        <Hero />
        
        {/* File Upload Section */}
        {!isConverting && !conversionComplete && (
          <FileUpload onFilesSelected={handleFilesSelected} />
        )}
        
        {/* Interactive Code Example */}
        {!isConverting && !conversionComplete && showCodeExample && (
          <div className="max-w-4xl mx-auto px-4 pb-16">
            <h2 className="text-2xl font-bold text-center mb-6">Here's What Your Next.js Code Will Look Like</h2>
            <CodeSnippet 
              code={exampleNextCode} 
              language="javascript" 
              filename="pages/index.js"
              highlightLines={[2, 10]}
            />
          </div>
        )}
        
        {/* Conversion Process */}
        {isConverting && (
          <ConversionProcess
            isConverting={isConverting}
            onComplete={handleConversionComplete}
            conversionResult={conversionResult}
            hasError={!!conversionError}
            errorMessage={conversionError || undefined}
          />
        )}
        
        {/* Results Display */}
        {conversionComplete && (
          <>
            <ResultDisplay
              isVisible={conversionComplete}
              conversionResult={conversionResult}
            />
            <div className="flex justify-center pb-12 pt-4">
              <Button 
                variant="outline" 
                className="flex items-center gap-2"
                onClick={handleReset}
              >
                <RotateCcw className="h-4 w-4" />
                Convert Another Project
              </Button>
            </div>
          </>
        )}
        
        {/* Feature Comparison */}
        <FeatureComparison />
      </PageTransition>
      
      <Footer />
    </div>
  );
}
