
import { CheckCircle, XCircle } from 'lucide-react';

const FeatureComparison = () => {
  const features = [
    {
      name: 'Server-Side Rendering (SSR)',
      react: false,
      next: true,
      description: 'Pre-renders pages on the server for improved performance and SEO.'
    },
    {
      name: 'Static Site Generation (SSG)',
      react: false,
      next: true,
      description: 'Generates static HTML at build time for optimal performance.'
    },
    {
      name: 'Incremental Static Regeneration',
      react: false,
      next: true,
      description: 'Updates static pages after deployment without rebuilding the entire site.'
    },
    {
      name: 'API Routes',
      react: false,
      next: true,
      description: 'Create API endpoints as part of your Next.js application.'
    },
    {
      name: 'File-based Routing',
      react: false,
      next: true,
      description: 'Automatic routing based on the file system, no router configuration needed.'
    },
    {
      name: 'Image Optimization',
      react: false,
      next: true,
      description: 'Automatic image optimization with the Next.js Image component.'
    },
    {
      name: 'Zero Config',
      react: false,
      next: true,
      description: 'Works out of the box with sensible defaults, minimal setup required.'
    },
    {
      name: 'Fast Refresh',
      react: true,
      next: true,
      description: 'Instant feedback for component changes while preserving state.'
    }
  ];

  return (
    <section id="comparison" className="py-20 bg-gray-50 dark:bg-gray-900/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16 animate-slide-up">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">React vs Next.js</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Understand the key differences and benefits of migrating from React to Next.js.
          </p>
        </div>
        
        <div className="max-w-4xl mx-auto">
          <div className="glass rounded-lg shadow-lg overflow-hidden animate-fade-in">
            <div className="grid grid-cols-4 text-center font-medium bg-gray-100 dark:bg-gray-800/80 p-4">
              <div className="col-span-2">Feature</div>
              <div>React</div>
              <div>Next.js</div>
            </div>
            
            <div className="divide-y">
              {features.map((feature, index) => (
                <div 
                  key={index}
                  className="grid grid-cols-4 p-4 items-center hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="col-span-2">
                    <h3 className="font-medium">{feature.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{feature.description}</p>
                  </div>
                  
                  <div className="text-center">
                    {feature.react ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-400 mx-auto" />
                    )}
                  </div>
                  
                  <div className="text-center">
                    {feature.next && (
                      <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-12 text-center animate-slide-up">
            <h3 className="text-xl font-semibold mb-4">Why Migrate to Next.js?</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
                  </svg>
                </div>
                <h4 className="text-lg font-medium mb-2">Better Performance</h4>
                <p className="text-muted-foreground text-sm">
                  Next.js optimizes your app with built-in code splitting, server-side rendering, and static generation.
                </p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </div>
                <h4 className="text-lg font-medium mb-2">Improved SEO</h4>
                <p className="text-muted-foreground text-sm">
                  Server-side rendering and static generation make your content more discoverable by search engines.
                </p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 10v12" />
                    <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
                  </svg>
                </div>
                <h4 className="text-lg font-medium mb-2">Developer Experience</h4>
                <p className="text-muted-foreground text-sm">
                  Enjoy built-in features like file-based routing, API routes, and optimized development workflow.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeatureComparison;
