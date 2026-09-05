import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { WarehouseLayout } from './WarehouseLayout';
import { PageSkeleton } from '@/components/page-skeleton';

const PickingPage = lazy(() => import('@/app/warehouse/picking-page'));
const InventoryPage = lazy(() => import('@/app/inventory/page'));
const TransfersPage = lazy(() => import('@/app/transfers/page'));
const LoginPage = lazy(() => import('@/app/login/page'));

export function WarehouseApp() {
  return (
    <WarehouseLayout>
      <Suspense fallback={<PageSkeleton variant="table" />}>
        <Routes>
          <Route path="/" element={<Navigate to="/wms/picking" replace />} />
          <Route path="/wms" element={<Navigate to="/wms/picking" replace />} />
          <Route path="/wms/picking" element={<PickingPage />} />
          <Route path="/picking" element={<PickingPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/transfers" element={<TransfersPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/wms/picking" replace />} />
        </Routes>
      </Suspense>
    </WarehouseLayout>
  );
}

export default WarehouseApp;
