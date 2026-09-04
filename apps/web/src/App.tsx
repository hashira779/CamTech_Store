import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Store } from 'lucide-react';

import { Toaster } from 'sonner';
import { useRealtimeStream } from '@/lib/use-realtime-stream';
import { DomainBar } from '@/components/domain-bar';
import { ErrorBoundary } from '@/components/error-boundary';

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

import { AppShellSkeleton } from '@/components/page-skeleton';

function RouteLoading() {
  return <AppShellSkeleton />;
}

export function App() {
  useRealtimeStream();

  const location = useLocation();
  const hostname = window.location.hostname.toLowerCase();
  let CurrentApp = AdminApp; // Default fallback

  // 1. Subdomain matching (production multi-subdomain routing §228)
  if (hostname.startsWith('pos.') || hostname.startsWith('cashier.')) {
    CurrentApp = PosApp;
  } else if (hostname.startsWith('hr.')) {
    CurrentApp = HrApp;
  } else if (hostname.startsWith('delivery.')) {
    CurrentApp = DeliveryApp;
  } else if (hostname.startsWith('wms.') || hostname.startsWith('warehouse.')) {
    CurrentApp = WarehouseApp;
  } else if (hostname.startsWith('finance.') || hostname.startsWith('accounting.')) {
    CurrentApp = FinanceApp;
  } else if (hostname.startsWith('shop.') || hostname.startsWith('store.')) {
    CurrentApp = CustomerApp;
  } else if (hostname.startsWith('ceo.')) {
    CurrentApp = CeoApp;
  } else if (hostname.startsWith('support.') || hostname.startsWith('desk.')) {
    CurrentApp = SupportApp;
  } else if (hostname.startsWith('partner.') || hostname.startsWith('developer.') || hostname.startsWith('dev.')) {
    CurrentApp = PartnerApp;
  } else if (hostname.startsWith('admin.')) {
    CurrentApp = AdminApp;
  } else {
    // 2. Dynamic route-based simulation for local development & DomainBar switcher
    // Dedicated standalone mini-frontends are kept to their specific entrypoints;
    // all admin management routes (/delivery, /transfers, /hr, /finance, /taxes, etc.)
    // stay cleanly inside AdminApp with full enterprise sidebar.
    const p = location.pathname;
    const isPath = (prefix: string) => p === prefix || p.startsWith(`${prefix}/`);

    if (isPath('/pos')) {
      CurrentApp = PosApp;
    } else if (isPath('/driver')) {
      CurrentApp = DeliveryApp;
    } else if (isPath('/wms')) {
      CurrentApp = WarehouseApp;
    } else if (isPath('/shop') || isPath('/customer')) {
      // isPath('/customer') matches '/customer' or '/customer/...' exactly,
      // preventing admin CRM route '/customers' from being swallowed.
      CurrentApp = CustomerApp;
    } else if (isPath('/ceo')) {
      CurrentApp = CeoApp;
    } else {
      CurrentApp = AdminApp;
    }
  }

  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      <DomainBar />
      {/* DomainBar stays outside the boundary, so if the active experience
          crashes the user can still navigate to another one. resetKeys clears
          the error automatically on route change. */}
      <ErrorBoundary resetKeys={[location.pathname]}>
        <Suspense fallback={<RouteLoading />}>
          <CurrentApp />
        </Suspense>
      </ErrorBoundary>
    </>
  );
}


export default App;
