import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'blue' | 'green' | 'purple';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('app-theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    // Save theme to localStorage
    localStorage.setItem('app-theme', theme);
    
    // Remove old theme classes
    document.body.classList.remove('theme-light', 'theme-dark', 'theme-blue', 'theme-green', 'theme-purple');
    document.documentElement.classList.remove('dark');
    
    // Add new theme class
    document.body.classList.add(`theme-${theme}`);
    
    // Add dark class to html element for Tailwind dark mode
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
    
    // Apply theme-specific body styling
    const body = document.body;
    
    // Get CSS variables for current theme
    const computedStyle = getComputedStyle(body);
    const bgSecondary = computedStyle.getPropertyValue('--bg-secondary');
    const textPrimary = computedStyle.getPropertyValue('--text-primary');
    
    // Apply to body
    if (bgSecondary) body.style.backgroundColor = bgSecondary;
    if (textPrimary) body.style.color = textPrimary;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};