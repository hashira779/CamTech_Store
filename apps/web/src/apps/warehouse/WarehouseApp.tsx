import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { WarehouseLayout } from './WarehouseLayout';

const InventoryPage = lazy(() => import('@/app/inventory/page'));
const TransfersPage = lazy(() => import('@/app/transfers/page'));

export function WarehouseApp() {
  return (
    <WarehouseLayout>
      <Suspense fallback={<div>Loading WMS...</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/transfers" replace />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/transfers" element={<TransfersPage />} />
          <Route path="*" element={<Navigate to="/transfers" replace />} />
        </Routes>
      </Suspense>
    </WarehouseLayout>
  );
}
