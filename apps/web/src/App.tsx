import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
const HrPage = lazy(() => import('@/app/hr/page'));
const ProjectsPage = lazy(() => import('@/app/projects/page'));
const TicketsPage = lazy(() => import('@/app/tickets/page'));
const AssetsPage = lazy(() => import('@/app/assets/page'));
const DevelopersPage = lazy(() => import('@/app/developers/page'));
const TelegramPage = lazy(() => import('@/app/telegram/page'));
const AutomationsPage = lazy(() => import('@/app/automations/page'));
const SettingsPage = lazy(() => import('@/app/settings/page'));

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

export function App() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/locations" element={<LocationsPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/transfers" element={<TransfersPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/taxes" element={<TaxesPage />} />
        <Route path="/promotions" element={<PromotionsPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/sales/new" element={<NewSalePage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/loyalty" element={<LoyaltyPage />} />
        <Route path="/storage" element={<StoragePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/procurement" element={<ProcurementPage />} />
        <Route path="/hr" element={<HrPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/developers" element={<DevelopersPage />} />
        <Route path="/telegram" element={<TelegramPage />} />
        <Route path="/automations" element={<AutomationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
