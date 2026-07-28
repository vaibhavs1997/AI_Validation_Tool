import { createContext, useContext, useEffect, useState } from 'react';
import { Theme, themes, defaultTheme } from '../theme-config';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  config: typeof themes[Theme];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('testforge-theme') as Theme | null;
      if (saved && (saved === 'slate' || saved === 'mist')) {
        return saved;
      }
    } catch {}
    return defaultTheme;
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    try {
      localStorage.setItem('testforge-theme', newTheme);
    } catch {}
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('testforge-theme', theme);
    } catch {}
  }, [theme]);

  const value: ThemeContextValue = {
    theme,
    setTheme,
    config: themes[theme],
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}