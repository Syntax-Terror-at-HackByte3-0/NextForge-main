
import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

const Logo = ({ className, size = 'md', showText = true }: LogoProps) => {
  // Size mapping
  const sizeClasses = {
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-12 w-12',
  };
  
  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("relative", sizeClasses[size])}>
        <svg 
          viewBox="0 0 80 80" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full"
        >
          {/* Gradient background */}
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="#9b87f5" />
            </linearGradient>
          </defs>
          
          {/* Base shape */}
          <path 
            d="M10,0 L70,0 C75.5228,0 80,4.47715 80,10 L80,70 C80,75.5228 75.5228,80 70,80 L10,80 C4.47715,80 0,75.5228 0,70 L0,10 C0,4.47715 4.47715,0 10,0 Z" 
            fill="url(#logoGradient)"
          />
          
          {/* N letter with custom shape */}
          <path 
            d="M25,20 L25,60 L35,60 L35,35 L55,60 L55,20 L45,20 L45,45 L25,20 Z" 
            fill="white"
          />
        </svg>
      </div>
      
      {showText && (
        <span className={cn(
          "font-logo font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400",
          textSizes[size]
        )}>
          NextForge
        </span>
      )}
    </div>
  );
};

export default Logo;
