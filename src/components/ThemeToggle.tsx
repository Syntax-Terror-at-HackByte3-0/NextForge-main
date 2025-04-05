
import React from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function ThemeToggle({ 
  variant = "default", 
  size = "icon", 
  className 
}: ThemeToggleProps) {
  const { theme } = useTheme();

  // This is now just a decorative button with no icon
  return (
    <Button
      variant={variant}
      size={size}
      className={cn("", className)}
      aria-label="Dark theme"
    />
  );
}
