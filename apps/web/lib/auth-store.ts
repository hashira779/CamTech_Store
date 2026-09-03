'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthenticatedUser } from '@mystore/contracts';

interface AuthState {
  token: string | null;
  user: AuthenticatedUser | null;
  setAuth: (token: string, user: AuthenticatedUser) => void;
  clear: () => void;
  hasPermission: (permission: string) => boolean;
}

/**
 * Client-side auth state (spec §1 mentions Zustand). Token persisted to
 * localStorage for the slice; a production app would prefer httpOnly cookies.
 */
export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) =>
        set({
          token,
          user: user
            ? {
                ...user,
                permissions: Array.isArray(user.permissions) ? user.permissions : [],
                roles: Array.isArray(user.roles) ? user.roles : [],
              }
            : null,
        }),
      clear: () => set({ token: null, user: null }),
      hasPermission: (permission) => {
        const u = get().user;
        if (!u) return false;
        const roles = Array.isArray(u.roles) ? u.roles : [];
        if (
          roles.includes('ORG_ADMIN' as any) ||
          roles.includes('SUPER_ADMIN' as any) ||
          roles.includes('COMPANY_ADMIN' as any) ||
          roles.includes('PLATFORM_ADMIN' as any)
        ) {
          return true;
        }
        return Boolean(u.permissions?.includes(permission));
      },
    }),
    { name: 'mystore-auth' },
  ),
);
