import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from './auth-store';
import { isJwtExpired } from './api-client';

// Inactivity timeout: 30 minutes (1,800,000 ms)
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_STORAGE_KEY = 'mystore-last-active';
const THROTTLE_MS = 15 * 1000; // Throttle storage writes to once every 15s

/**
 * Enterprise Automatic Inactivity & Session Expiry Watchdog.
 * Tracks user activity (mouse, keystrokes, touch, scroll) across all tabs.
 * If user is inactive for 30 minutes or token expires, clears state and logs out automatically.
 */
export function useInactivityTimeout() {
  const { token, clear } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const lastRecordedRef = useRef<number>(Date.now());

  useEffect(() => {
    // If not authenticated, do not listen
    if (!token) return;

    // 1. Immediate validation: is token already expired?
    if (isJwtExpired(token)) {
      clear();
      navigate('/login?expired=true', { replace: true });
      return;
    }

    // Initialize last active timestamp
    const initialNow = Date.now();
    lastRecordedRef.current = initialNow;
    try {
      if (!localStorage.getItem(ACTIVITY_STORAGE_KEY)) {
        localStorage.setItem(ACTIVITY_STORAGE_KEY, String(initialNow));
      }
    } catch {}

    const recordActivity = () => {
      const now = Date.now();
      if (now - lastRecordedRef.current > THROTTLE_MS) {
        lastRecordedRef.current = now;
        try {
          localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
        } catch {}
      }
    };

    // User activity listeners
    const events: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'click',
    ];

    events.forEach((evt) => {
      window.addEventListener(evt, recordActivity, { passive: true });
    });

    // Background interval check every 15 seconds
    const checkInterval = setInterval(() => {
      // 1. Check JWT validity
      if (isJwtExpired(token)) {
        clear();
        toast.warning('Your session has expired. Please sign in again.');
        navigate('/login?expired=true', { replace: true });
        return;
      }

      // 2. Check Inactivity threshold
      let lastActive = lastRecordedRef.current;
      try {
        const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY);
        if (stored) {
          lastActive = parseInt(stored, 10) || lastActive;
        }
      } catch {}

      const elapsed = Date.now() - lastActive;
      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        clear();
        try {
          localStorage.removeItem(ACTIVITY_STORAGE_KEY);
        } catch {}
        toast.info('You have been signed out automatically due to 30 minutes of inactivity.');
        navigate('/login?inactive=true', { replace: true });
      }
    }, 15000);

    // Synchronize across multiple browser tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'mystore-auth' && !e.newValue) {
        // Logged out in another tab
        clear();
        navigate('/login');
      }
      if (e.key === ACTIVITY_STORAGE_KEY && e.newValue) {
        lastRecordedRef.current = parseInt(e.newValue, 10) || Date.now();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, recordActivity));
      clearInterval(checkInterval);
      window.removeEventListener('storage', handleStorage);
    };
  }, [token, clear, navigate, location.pathname]);
}
