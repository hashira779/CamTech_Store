import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Store } from 'lucide-react';

const HomePage = lazy(() => import('@/app/page'));
const LoginPage = lazy(() => import('@/app/login/page'));
const DashboardPage = lazy(() => import('@/app/dashboard/page'));
const ProductsPage = lazy(() => import('@/app/products/page'));
const LocationsPage = lazy(() => import('@/app/locations/page'));
const InventoryPage = lazy(() => import('@/app/inventory/page'));
const TransfersPage = lazy(() => import('@/app/transfers/page'));
const PricingPage = lazy(() => import('@/app/pricing/page'));
const TaxesPage = lazy(() => import('@/app/taxes/page'));
const PromotionsPage = lazy(() => import('@/app/promotions/page'));
const SalesPage = lazy(() => import('@/app/sales/page'));
const NewSalePage = lazy(() => import('@/app/sales/new/page'));
const CustomersPage = lazy(() => import('@/app/customers/page'));
const LoyaltyPage = lazy(() => import('@/app/loyalty/page'));
const StoragePage = lazy(() => import('@/app/storage/page'));
const NotificationsPage = lazy(() => import('@/app/notifications/page'));
const ReportsPage = lazy(() => import('@/app/reports/page'));
const ApprovalsPage = lazy(() => import('@/app/approvals/page'));
const FinancePage = lazy(() => import('@/app/finance/page'));
const ProcurementPage = lazy(() => import('@/app/procurement/page'));
const DeliveryPage = lazy(() => import('@/app/delivery/page'));
const DriverAppPage = lazy(() => import('@/app/driver/page'));
const CustomerShopPage = lazy(() => import('@/app/shop/page'));
const CustomerPortalPage = lazy(() => import('@/app/customer/page'));
const HrPage = lazy(() => import('@/app/hr/page'));



const ProjectsPage = lazy(() => import('@/app/projects/page'));
const TicketsPage = lazy(() => import('@/app/tickets/page'));
const AssetsPage = lazy(() => import('@/app/assets/page'));
const DevelopersPage = lazy(() => import('@/app/developers/page'));
const TelegramPage = lazy(() => import('@/app/telegram/page'));
const AutomationsPage = lazy(() => import('@/app/automations/page'));
const SettingsPage = lazy(() => import('@/app/settings/page'));

import { Toaster } from 'sonner';
import { useRealtimeStream } from '@/lib/use-realtime-stream';
import { DomainBar } from '@/components/domain-bar';

function RouteLoading() {


  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="bg-primary p-3.5 rounded-2xl shadow-lg text-primary-foreground animate-bounce">
          <Store className="w-7 h-7" />
        </div>
        <div className="space-y-1.5 text-center">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Loading Workspace...
          </p>
          <div className="w-28 h-1 bg-muted rounded-full overflow-hidden mx-auto">
            <div className="h-full bg-primary animate-pulse w-2/3 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

import { AdminApp } from './apps/admin/AdminApp';
import { PosApp } from './apps/pos/PosApp';
import { HrApp } from './apps/hr/HrApp';
import { DeliveryApp } from './apps/delivery/DeliveryApp';
import { WarehouseApp } from './apps/warehouse/WarehouseApp';
import { FinanceApp } from './apps/finance/FinanceApp';
import { CustomerApp } from './apps/customer/CustomerApp';
import { CeoApp } from './apps/ceo/CeoApp';
import { SupportApp } from './apps/support/SupportApp';
import { PartnerApp } from './apps/partner/PartnerApp';

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
  } 
  // 2. Dynamic route-based simulation for local development & DomainBar switcher
  else {
    const p = location.pathname;
    if (p.startsWith('/pos') || p.startsWith('/sales/new')) {
      CurrentApp = PosApp;
    } else if (p.startsWith('/driver') || p.startsWith('/delivery')) {
      CurrentApp = DeliveryApp;
    } else if (p.startsWith('/wms') || p.startsWith('/transfers')) {
      CurrentApp = WarehouseApp;
    } else if (p.startsWith('/hr')) {
      CurrentApp = HrApp;
    } else if (p.startsWith('/finance') || p.startsWith('/taxes')) {
      CurrentApp = FinanceApp;
    } else if (p.startsWith('/shop') || p.startsWith('/customer')) {
      CurrentApp = CustomerApp;
    } else if (p.startsWith('/ceo')) {
      CurrentApp = CeoApp;
    } else if (p.startsWith('/tickets') || p.startsWith('/approvals')) {
      CurrentApp = SupportApp;
    } else if (p.startsWith('/developers') || p.startsWith('/automations')) {
      CurrentApp = PartnerApp;
    } else {
      CurrentApp = AdminApp;
    }
  }

  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      <DomainBar />
      <Suspense fallback={<RouteLoading />}>
        <CurrentApp />
      </Suspense>
    </>
  );
}


export default App;
