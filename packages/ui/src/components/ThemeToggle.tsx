import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../theme';

/**
 * Dark/light theme toggle. Persists the choice and flips the shared
 * design-system tokens by setting data-theme on <html>.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme()}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`ds-btn ds-btn-ghost !px-2 !py-2 ${className}`}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
