
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import Logo from '@/components/shared/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const Navbar = () => {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={cn(
        "fixed top-0 w-full z-50 transition-all duration-300 py-4 px-6",
        scrolled 
          ? "nextjs-glass border-b border-white/[0.1]" 
          : "bg-transparent"
      )}
    >
      <div className="container mx-auto flex items-center justify-between">
        <Logo />
        
        <nav className="hidden md:flex items-center space-x-8">
          <Link 
            to="/" 
            className={cn(
              "text-sm font-medium transition-colors",
              location.pathname === "/" 
                ? "text-primary font-semibold" 
                : "text-foreground/80 hover:text-foreground"
            )}
          >
            Home
          </Link>
          <a href="#features" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
            How It Works
          </a>
          <a 
            href="https://github.com/orgs/Syntax-Terror-at-HackByte3-0/" 
            target="_blank" 
            rel="noreferrer"
            className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
          >
            GitHub
          </a>
        </nav>

        <div className="flex items-center gap-4">
          <ThemeToggle variant="ghost" />
          
          <a 
            href="#convert" 
            className="hidden md:inline-flex rounded-md bg-primary/10 border border-primary/20 hover:bg-primary/20 px-4 py-2 text-sm font-medium text-primary shadow-sm transition-colors"
          >
            Convert Now
          </a>
          
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost" 
                size="icon"
                className="inline-flex md:hidden"
                aria-label="Toggle menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[300px] sm:w-[400px] bg-background/95 backdrop-blur-xl border-l border-white/[0.1]">
              <div className="flex flex-col gap-6 py-6">
                <Link 
                  to="/" 
                  className={cn(
                    "text-lg font-medium transition-colors",
                    location.pathname === "/" ? "text-primary font-semibold" : "text-foreground/80"
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  Home
                </Link>
                <a 
                  href="#features" 
                  className="text-lg font-medium text-foreground/80"
                  onClick={() => setIsOpen(false)}
                >
                  Features
                </a>
                <a 
                  href="#how-it-works" 
                  className="text-lg font-medium text-foreground/80"
                  onClick={() => setIsOpen(false)}
                >
                  How It Works
                </a>
                <a 
                  href="https://github.com" 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-lg font-medium text-foreground/80"
                  onClick={() => setIsOpen(false)}
                >
                  GitHub
                </a>
                <div className="pt-4">
                  <a 
                    href="#convert" 
                    className="inline-flex w-full justify-center rounded-md bg-primary/10 border border-primary/20 hover:bg-primary/20 px-4 py-2 text-base font-medium text-primary shadow-sm transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    Convert Now
                  </a>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
