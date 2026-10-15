import { useEffect, useState } from 'react';

const STORAGE_KEY = 'farm-ledger-theme';

export type Theme = 'light' | 'dark';

function readTheme(): Theme {
  if (document.documentElement.classList.contains('dark')) return 'dark';
  return 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Private mode can block storage. The class on <html> still switches the theme.
    }
  }, [theme]);

  function toggle() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  return { theme, toggle };
}
