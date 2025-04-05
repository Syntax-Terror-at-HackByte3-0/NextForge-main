
import { useState, useEffect } from 'react';
import { CheckCircle, Clock, ArrowRight, FileCode, FileWarning, FileCheck, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConversionResult } from '@/types/conversion';

interface ConversionStep {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'warning' | 'error';
  details?: string[];
}

const initialSteps: ConversionStep[] = [
  {
    id: 1,
    title: 'Analyzing Project Structure',
    description: 'Scanning files and identifying React components and patterns',
    status: 'pending',
    details: ['Identifying components', 'Detecting routing', 'Analyzing imports', 'Checking data fetching patterns']
  },
  {
    id: 2,
    title: 'Processing Components',
    description: 'Analyzing and transforming React components for Next.js',
    status: 'pending',
    details: ['Converting hooks', 'Updating imports', 'Adding client/server directives', 'Optimizing for Next.js']
  },
  {
    id: 3,
    title: 'Converting Router Logic',
    description: 'Transforming React Router into Next.js pages directory',
    status: 'pending',
    details: ['Extracting routes', 'Creating page files', 'Converting navigation hooks', 'Updating links']
  },
  {
    id: 4,
    title: 'Creating API Routes',
    description: 'Converting fetch calls to Next.js API routes where appropriate',
    status: 'pending',
    details: ['Analyzing fetch patterns', 'Creating API handlers', 'Setting up response structures', 'Implementing error handling']
  },
  {
    id: 5,
    title: 'Generating Configuration',
    description: 'Setting up Next.js configuration files and project structure',
    status: 'pending',
    details: ['Creating next.config.js', 'Setting up tsconfig.json', 'Configuring package.json', 'Preparing public directory']
  },
  {
    id: 6,
    title: 'Finalizing Project',
    description: 'Building the final project structure with all converted files',
    status: 'pending',
    details: ['Organizing files', 'Cleaning up temporary files', 'Creating README with instructions', 'Final validation']
  }
];

// This component simulates and displays the conversion process
const ConversionProcess = ({ 
  isConverting, 
  onComplete,
  conversionResult,
  hasError = false,
  errorMessage = ''
}: { 
  isConverting: boolean;
  onComplete: () => void;
  conversionResult?: ConversionResult;
  hasError?: boolean;
  errorMessage?: string;
}) => {
  const [steps, setSteps] = useState<ConversionStep[]>(initialSteps);
  const [currentStep, setCurrentStep] = useState(0);
  const [showDetails, setShowDetails] = useState<number[]>([]);
  
  // Toggle showing details for a step
  const toggleDetails = (stepId: number) => {
    setShowDetails(prev => 
      prev.includes(stepId) 
        ? prev.filter(id => id !== stepId)
        : [...prev, stepId]
    );
  };
  
  // Reset the process when starting a new conversion
  useEffect(() => {
    if (isConverting) {
      setSteps(initialSteps);
      setCurrentStep(0);
      setShowDetails([]);
    }
  }, [isConverting]);
  
  // This simulates the conversion process
  useEffect(() => {
    if (isConverting && currentStep < steps.length) {
      // Mark current step as processing
      setSteps(prevSteps => 
        prevSteps.map((step, idx) => 
          idx === currentStep ? { ...step, status: 'processing' as const } : step
        )
      );
      
      // Simulate processing time (varying for each step)
      const processingTime = 800 + Math.random() * 1200;
      
      const timer = setTimeout(() => {
        // If there's an error and we're at the last step or a random step
        const shouldShowError = hasError && (currentStep === steps.length - 1 || 
                                            (currentStep === 2 && Math.random() > 0.5));
        
        // Occasionally show warning for API conversion step
        const shouldShowWarning = currentStep === 3 && Math.random() > 0.7 && !shouldShowError;
        
        setSteps(prevSteps => 
          prevSteps.map((step, idx) => 
            idx === currentStep 
              ? { 
                  ...step, 
                  status: shouldShowError ? 'error' as const : 
                          shouldShowWarning ? 'warning' as const : 
                          'completed' as const,
                  details: shouldShowError 
                    ? [...(step.details || []), errorMessage || 'An error occurred during conversion'] 
                    : shouldShowWarning 
                    ? [...(step.details || []), 'Some API calls may need manual review'] 
                    : step.details
                } 
              : step
          )
        );
        
        // Move to next step unless error
        if (!shouldShowError) {
          setCurrentStep(prev => prev + 1);
        }
        
        // If all steps are completed or there's an error, trigger onComplete
        if (currentStep === steps.length - 1 || shouldShowError) {
          setTimeout(() => {
            console.log('Conversion process complete, passing result:', conversionResult);
            onComplete();
          }, 1000);
        }
      }, processingTime);
      
      return () => clearTimeout(timer);
    }
  }, [currentStep, isConverting, steps.length, onComplete, conversionResult, hasError, errorMessage]);
  
  if (!isConverting) return null;
  
  return (
    <section className="py-12 animate-fade-in">
      <div className="container mx-auto px-6">
        <div className="max-w-3xl mx-auto">
          <h3 className="text-xl font-semibold mb-6 text-center">Converting Your Project</h3>
          
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div 
                key={step.id}
                className={cn(
                  "p-4 rounded-lg transition-all duration-300",
                  step.status === 'completed' 
                    ? "bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/20" 
                  : step.status === 'processing' 
                    ? "bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/20" 
                  : step.status === 'warning'
                    ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/20"
                  : step.status === 'error'
                    ? "bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/20"
                  : "bg-gray-50 dark:bg-gray-900/10 border border-gray-200 dark:border-gray-800/20"
                )}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 pt-1">
                    {step.status === 'completed' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : step.status === 'processing' ? (
                      <Clock className="h-5 w-5 text-blue-500 animate-pulse-subtle" />
                    ) : step.status === 'warning' ? (
                      <FileWarning className="h-5 w-5 text-amber-500" />
                    ) : step.status === 'error' ? (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-700" />
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className={cn(
                        "text-sm font-medium",
                        step.status === 'completed' 
                          ? "text-green-800 dark:text-green-300" 
                        : step.status === 'processing' 
                          ? "text-blue-800 dark:text-blue-300" 
                        : step.status === 'warning'
                          ? "text-amber-800 dark:text-amber-300"
                        : step.status === 'error'
                          ? "text-red-800 dark:text-red-300"
                        : "text-gray-700 dark:text-gray-400"
                      )}>
                        {step.title}
                      </h4>
                      {step.details && step.details.length > 0 && step.status !== 'pending' && (
                        <button 
                          onClick={() => toggleDetails(step.id)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          {showDetails.includes(step.id) ? 'Hide details' : 'Show details'}
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {step.description}
                    </p>
                    
                    {/* Details section */}
                    {showDetails.includes(step.id) && step.details && (
                      <div className="mt-3 text-xs space-y-1 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
                        {step.details.map((detail, i) => (
                          <div key={i} className="flex items-center">
                            {step.status === 'completed' ? (
                              <FileCheck className="h-3 w-3 mr-1.5 text-green-500" />
                            ) : step.status === 'processing' ? (
                              <Clock className="h-3 w-3 mr-1.5 text-blue-500" />
                            ) : step.status === 'warning' && i === step.details.length - 1 ? (
                              <FileWarning className="h-3 w-3 mr-1.5 text-amber-500" />
                            ) : step.status === 'error' && i === step.details.length - 1 ? (
                              <AlertCircle className="h-3 w-3 mr-1.5 text-red-500" />
                            ) : (
                              <FileCode className="h-3 w-3 mr-1.5 text-gray-400" />
                            )}
                            <span>{detail}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {index < steps.length - 1 && (
                  <div className="ml-2.5 mt-2 pl-0.5 h-6 border-l-2 border-dashed border-gray-200 dark:border-gray-800/50" />
                )}
              </div>
            ))}
          </div>
          
          {currentStep === steps.length && !hasError && (
            <div className="text-center mt-8 animate-fade-in">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 mb-4">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Conversion Complete!</h3>
              <p className="text-muted-foreground mb-6">
                Your React project has been successfully converted to Next.js
              </p>
              <div className="flex justify-center">
                <button
                  onClick={onComplete}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors"
                >
                  View Results
                  <ArrowRight className="ml-2 h-4 w-4 inline" />
                </button>
              </div>
            </div>
          )}
          
          {hasError && (
            <div className="text-center mt-8 animate-fade-in">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 mb-4">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Conversion Issue</h3>
              <p className="text-muted-foreground mb-2">
                We encountered some issues during conversion
              </p>
              <p className="text-sm text-red-500 mb-6">
                {errorMessage || "Some files couldn't be properly converted. You can still view the partial results."}
              </p>
              <div className="flex justify-center">
                <button
                  onClick={onComplete}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors"
                >
                  View Results
                  <ArrowRight className="ml-2 h-4 w-4 inline" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default ConversionProcess;
