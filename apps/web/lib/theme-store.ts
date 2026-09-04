import { create } from 'zustand';

type Theme = 'dark' | 'light' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => {
  const saved = (typeof window !== 'undefined' && localStorage.getItem('mystore-theme') as Theme) || 'dark';

  const applyTheme = (theme: Theme, animate = false) => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;

    if (animate) {
      root.classList.add('theme-transition');
    }

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(systemDark ? 'dark' : 'light');
    } else {
      root.classList.add(theme);
    }
    localStorage.setItem('mystore-theme', theme);

    if (animate) {
      window.setTimeout(() => {
        root.classList.remove('theme-transition');
      }, 350);
    }
  };

  // Initial apply
  if (typeof window !== 'undefined') {
    applyTheme(saved);
  }

  return {
    theme: saved,
    setTheme: (theme: Theme) => {
      applyTheme(theme, true);
      set({ theme });
    },
  };
});
