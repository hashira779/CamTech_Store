import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'mystore-theme';

export function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Set the initial theme as early as possible (call at the top of main.tsx,
 * before render, to avoid a flash). Defaults to dark to preserve the
 * control-tower look for viewers who have not chosen a theme.
 */
export function initTheme(defaultTheme: Theme = 'dark'): Theme {
  const theme = getStoredTheme() ?? defaultTheme;
  applyTheme(theme);
  return theme;
}

/** React hook: returns [theme, toggleOrSet]. Persists + applies on change. */
export function useTheme(defaultTheme: Theme = 'dark'): [Theme, (next?: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme() ?? defaultTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
  }, [theme]);

  const setTheme = (next?: Theme) =>
    setThemeState((cur) => next ?? (cur === 'dark' ? 'light' : 'dark'));

  return [theme, setTheme];
}
