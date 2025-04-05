
import { ArrowDown } from 'lucide-react';
import Logo from '@/components/shared/Logo';

const Hero = () => {
  return (
    <section className="relative pt-28 pb-20 overflow-hidden nextjs-hero">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
      </div>
      
      <div className="container relative z-10 mx-auto px-6 text-center">
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 nextjs-border text-primary text-sm font-medium mb-6 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-primary mr-2"></span>
          Seamlessly Convert React to Next.js
        </div>
        
        <div className="mb-6 flex justify-center">
          <Logo size="lg" />
        </div>
        
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 max-w-4xl mx-auto animate-slide-up font-display text-gradient">
          Transform Your React App into a 
          <span className="text-primary"> Next.js </span>
          Project in Seconds
        </h1>
        
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
          NextForge analyzes your React code and intelligently converts it to a 
          Next.js project structure with proper page routing, API routes, and optimized components.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <a 
            href="#convert" 
            className="rounded-md bg-primary/10 nextjs-border hover:bg-primary/20 px-6 py-3 text-base font-medium text-primary shadow-md transition-colors"
          >
            Convert Your App Now
          </a>
          <a 
            href="#how-it-works" 
            className="rounded-md bg-white/5 nextjs-border px-6 py-3 text-base font-medium text-foreground/80 hover:bg-white/10 hover:text-foreground transition-colors"
          >
            Learn How It Works
          </a>
        </div>
        
        <div className="relative mt-16 animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="nextjs-glass rounded-lg p-1 shadow-lg max-w-4xl mx-auto">
            <div className="bg-background nextjs-border rounded-md overflow-hidden shadow-sm">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.1] bg-secondary/30">
                <div className="h-3 w-3 rounded-full bg-red-400"></div>
                <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
                <div className="h-3 w-3 rounded-full bg-green-400"></div>
                <div className="ml-4 text-xs text-muted-foreground">React to Next.js Converter</div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-white/[0.1]">
                <div className="p-4 bg-secondary/10 text-left">
                  <div className="text-xs text-muted-foreground mb-2">React App.js</div>
                  <pre className="code-editor text-xs overflow-auto p-2">
                    <code className="text-foreground/90">
{`import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import About from './pages/About';
import Navbar from './components/Navbar';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;`}
                    </code>
                  </pre>
                </div>
                <div className="p-4 text-left relative">
                  <div className="text-xs text-muted-foreground mb-2">Next.js pages/_app.js</div>
                  <pre className="code-editor text-xs overflow-auto p-2">
                    <code className="text-foreground/90">
{`import '../styles/globals.css';
import Navbar from '../components/Navbar';

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Navbar />
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;

// pages/index.js
// pages/about.js
// ... automatically created`}
                    </code>
                  </pre>
                  <div className="absolute inset-0 flex items-center justify-center text-primary opacity-30 pointer-events-none">
                    <ArrowDown size={48} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 animate-bounce">
            <a 
              href="#features" 
              className="flex items-center justify-center w-12 h-12 rounded-full nextjs-glass shadow-md text-primary glow"
              aria-label="Scroll to features"
            >
              <ArrowDown size={20} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
