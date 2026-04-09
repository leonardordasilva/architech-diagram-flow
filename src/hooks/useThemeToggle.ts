import { useState, useCallback, useEffect } from 'react';

export function useThemeToggle() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('microflow_theme');
      if (saved !== null) return saved === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('microflow_theme', next ? 'dark' : 'light');
      }
      return next;
    });
  }, []);

  return { darkMode, toggleDarkMode };
}
