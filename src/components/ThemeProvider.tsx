
import { createContext, useContext, ReactNode } from "react";

type ThemeProviderProps = {
  children: ReactNode;
  defaultTheme?: "dark";
  storageKey?: string;
};

type ThemeProviderState = {
  theme: "dark";
};

const initialState: ThemeProviderState = {
  theme: "dark",
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "nextforge-ui-theme",
  ...props
}: ThemeProviderProps) {
  
  // Always use dark theme
  const theme: "dark" = "dark";

  // Apply dark theme CSS variables
  if (typeof window !== "undefined") {
    const root = window.document.documentElement;
    
    // Add transition class for smooth theme changes
    root.classList.add('transition-colors');
    
    // Rich dark theme with deep purples
    root.style.setProperty('--primary-rgb', '155, 138, 255');
    root.style.setProperty('--accent-rgb', '138, 120, 246');
    root.style.setProperty('--background-start-rgb', '18, 18, 30');
    root.style.setProperty('--background-end-rgb', '12, 12, 24');
    
    // Remove light class and add dark class
    root.classList.remove("light");
    root.classList.add("dark");
  }
  
  const value = {
    theme,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");
  
  return context;
};
