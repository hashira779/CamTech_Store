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
