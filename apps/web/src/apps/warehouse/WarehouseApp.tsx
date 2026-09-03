import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { WarehouseLayout } from './WarehouseLayout';

const InventoryPage = lazy(() => import('@/app/inventory/page'));
const TransfersPage = lazy(() => import('@/app/transfers/page'));
const LoginPage = lazy(() => import('@/app/login/page'));

export function WarehouseApp() {
  return (
    <WarehouseLayout>
      <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading WMS...</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/transfers" replace />} />
          <Route path="/wms" element={<TransfersPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/transfers" element={<TransfersPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/transfers" replace />} />
        </Routes>
      </Suspense>
    </WarehouseLayout>
  );
}

export default WarehouseApp;
