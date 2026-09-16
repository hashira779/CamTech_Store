import { APP_REGISTRY, type AppId, type AppRegistryItem } from '@mystore/contracts';

/**
 * Multi-Domain Experience Resolver (Spec §228, §240).
 * Inspects incoming hostname or URL query param to resolve the active application.
 */
export function resolveCurrentApplication(): AppRegistryItem {
  if (typeof window === 'undefined') {
    return APP_REGISTRY.ceo;
  }

  const hostname = window.location.hostname.toLowerCase();
  const searchParams = new URLSearchParams(window.location.search);

  // 1. Explicit query override for testing / preview (e.g., localhost:3000?app=store)
  const appParam = searchParams.get('app')?.toLowerCase() as AppId;
  if (appParam && APP_REGISTRY[appParam]) {
    return APP_REGISTRY[appParam];
  }

  // 2. Subdomain extraction (e.g. store.camtech.cam -> store)
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    const subdomain = parts[0] as AppId;
    if (APP_REGISTRY[subdomain]) {
      return APP_REGISTRY[subdomain];
    }
  }

  // 3. Fallback based on pathname
  const pathname = window.location.pathname;
  if (pathname.startsWith('/shop')) return APP_REGISTRY.store;
  if (pathname.startsWith('/driver')) return APP_REGISTRY.delivery;
  if (pathname.startsWith('/sales/new')) return APP_REGISTRY.cashier;
  if (pathname.startsWith('/customer')) return APP_REGISTRY.customer;
  if (pathname.startsWith('/hr')) return APP_REGISTRY.hr;
  if (pathname.startsWith('/transfers')) return APP_REGISTRY.warehouse;
  if (pathname.startsWith('/finance')) return APP_REGISTRY.finance;
  if (pathname.startsWith('/developers')) return APP_REGISTRY.partner;

  return APP_REGISTRY.ceo;
}

/**
 * Absolute URL for another portal on its own subdomain, or null when a
 * cross-domain jump isn't possible and the caller should route in-app instead.
 *
 * Returns null for local dev and preview hosts (no subdomain routing there),
 * when already on the target, and when the target is not under the same
 * registrable domain — that last check stops an unexpected entry from
 * bouncing a signed-in user off-site.
 */
export function resolvePortalUrl(domain: string): string | null {
  if (typeof window === 'undefined') return null;

  const host = window.location.hostname.toLowerCase();
  const target = domain.trim().toLowerCase();
  if (!target) return null;

  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return null;
  if (host === target) return null;

  const registrableDomain = (h: string) => h.split('.').slice(-2).join('.');
  if (registrableDomain(host) !== registrableDomain(target)) return null;

  // Each portal's own subdomain serves that app at its root, so the admin
  // console's internal route (e.g. /driver) must not be carried across.
  return `${window.location.protocol}//${target}`;
}
