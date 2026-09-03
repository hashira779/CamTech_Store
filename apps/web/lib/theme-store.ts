import { create } from 'zustand';

type Theme = 'dark' | 'light' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => {
  const saved = (typeof window !== 'undefined' && localStorage.getItem('mystore-theme') as Theme) || 'dark';

  const applyTheme = (theme: Theme) => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(systemDark ? 'dark' : 'light');
    } else {
      root.classList.add(theme);
    }
    localStorage.setItem('mystore-theme', theme);
  };

  // Initial apply
  if (typeof window !== 'undefined') {
    applyTheme(saved);
  }

  return {
    theme: saved,
    setTheme: (theme: Theme) => {
      applyTheme(theme);
      set({ theme });
    },
  };
});
