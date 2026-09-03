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
