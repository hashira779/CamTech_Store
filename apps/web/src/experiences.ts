import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

// Micro-Frontend Apps: Fully Code-Split via React.lazy() for fast initial page load
const AdminApp = lazy(() => import('./apps/admin/AdminApp'));
const PosApp = lazy(() => import('./apps/pos/PosApp'));
const HrApp = lazy(() => import('./apps/hr/HrApp'));
const DeliveryApp = lazy(() => import('./apps/delivery/DeliveryApp'));
const WarehouseApp = lazy(() => import('./apps/warehouse/WarehouseApp'));
const FinanceApp = lazy(() => import('./apps/finance/FinanceApp'));
const CustomerApp = lazy(() => import('./apps/customer/CustomerApp'));
const CeoApp = lazy(() => import('./apps/ceo/CeoApp'));
const SupportApp = lazy(() => import('./apps/support/SupportApp'));
const PartnerApp = lazy(() => import('./apps/partner/PartnerApp'));
const InfraControlApp = lazy(() => import('./apps/infra/InfraControlApp'));
const MiniApp = lazy(() => import('./apps/mini/MiniApp'));

export interface Experience {
  app: LazyExoticComponent<ComponentType>;
  /** Production subdomains (§228), e.g. `pos` matches pos.camtech.cam. */
  hosts: readonly string[];
  /**
   * Route-based selection for local development and the DomainBar switcher.
   * Admin management routes (/delivery, /hr, /finance, ...) are deliberately
   * absent: they stay inside AdminApp with the full enterprise sidebar.
   */
  paths?: readonly string[];
  /** Full-screen surfaces that render without the DomainBar. */
  hideDomainBar?: boolean;
}

const ADMIN: Experience = { app: AdminApp, hosts: ['admin', 'adminconsol'] };

const EXPERIENCES: readonly Experience[] = [
  { app: InfraControlApp, hosts: ['infra', 'soc', 'noc'], paths: ['/infra', '/soc', '/noc'], hideDomainBar: true },
  { app: PosApp, hosts: ['pos', 'cashier'], paths: ['/pos'] },
  { app: HrApp, hosts: ['hr', 'hrms'] },
  { app: DeliveryApp, hosts: ['delivery'], paths: ['/driver'] },
  { app: WarehouseApp, hosts: ['wms', 'warehouse'], paths: ['/wms'] },
  { app: FinanceApp, hosts: ['finance', 'accounting'] },
  { app: CustomerApp, hosts: ['shop', 'store'], paths: ['/shop', '/customer'] },
  { app: CeoApp, hosts: ['ceo', 'business'], paths: ['/ceo'] },
  { app: SupportApp, hosts: ['support', 'desk'] },
  { app: PartnerApp, hosts: ['partner', 'developer', 'dev'] },
  ADMIN,
  { app: MiniApp, hosts: ['mini', 'tma', 'bot'], paths: ['/mini'], hideDomainBar: true },
];

/** Whole-segment match, so '/customer' never swallows the admin route '/customers'. */
export function isPathUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** A matching subdomain always wins; otherwise the route decides, defaulting to admin. */
export function resolveExperience(hostname: string, pathname: string): Experience {
  const host = hostname.toLowerCase();
  return (
    EXPERIENCES.find((experience) => experience.hosts.some((name) => host.startsWith(`${name}.`))) ??
    EXPERIENCES.find((experience) => experience.paths?.some((path) => isPathUnder(pathname, path))) ??
    ADMIN
  );
}
