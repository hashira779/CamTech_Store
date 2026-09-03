import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

const DashboardPage = lazy(() => import('@/app/dashboard/page'));
const ProductsPage = lazy(() => import('@/app/products/page'));
const SalesPage = lazy(() => import('@/app/sales/page'));
const SettingsPage = lazy(() => import('@/app/settings/page'));

export function AdminApp() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/products" element={<ProductsPage />} />
      <Route path="/sales" element={<SalesPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
