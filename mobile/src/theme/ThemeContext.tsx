import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors } from './colors';

type ThemeType = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeType;
  isDark: boolean;
  colors: Omit<typeof darkColors, 'blurTint'> & { blurTint: 'light' | 'dark' | 'default' };
  toggleTheme: () => void;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  isDark: true,
  colors: darkColors,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();

  const getInitialTheme = (): ThemeType => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.colorScheme) {
      const scheme = (window as any).Telegram.WebApp.colorScheme;
      if (scheme === 'light' || scheme === 'dark') return scheme;
    }
    return systemScheme || 'dark';
  };

  const [theme, setThemeState] = useState<ThemeType>(getInitialTheme());

  useEffect(() => {
    const loadStoredTheme = async () => {
      try {
        if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.colorScheme) {
          const scheme = (window as any).Telegram.WebApp.colorScheme;
          if (scheme === 'light' || scheme === 'dark') {
            setThemeState(scheme);
            return;
          }
        }
        
        const stored = await AsyncStorage.getItem('app_theme');
        if (stored === 'light' || stored === 'dark') {
          setThemeState(stored);
        } else if (systemScheme) {
          setThemeState(systemScheme);
        }
      } catch (e) {
        console.warn('Failed to load theme:', e);
      }
    };
    loadStoredTheme();

    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const handleTgThemeChange = () => {
        const scheme = (window as any).Telegram.WebApp.colorScheme;
        if (scheme === 'light' || scheme === 'dark') {
          setThemeState(scheme);
        }
      };
      (window as any).Telegram.WebApp.onEvent('themeChanged', handleTgThemeChange);
      return () => {
        try {
          (window as any).Telegram.WebApp.offEvent('themeChanged', handleTgThemeChange);
        } catch (err) {}
      };
    }
  }, [systemScheme]);

  const setTheme = async (newTheme: ThemeType) => {
    setThemeState(newTheme);
    try {
      await AsyncStorage.setItem('app_theme', newTheme);
    } catch (e) {
      console.warn('Failed to save theme:', e);
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('color-scheme', theme);
      const bg = theme === 'dark' ? '#000000' : '#FFFFFF';
      document.documentElement.style.setProperty('background-color', bg);
      document.body.style.backgroundColor = bg;
    }
  }, [theme]);

  const isDark = theme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
