import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PageSkeleton } from '@/components/page-skeleton';

const DeliveryPage = lazy(() => import('@/app/delivery/page'));

export function DeliveryApp() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <Routes>
        <Route path="/" element={<Navigate to="/delivery" replace />} />
        <Route path="/delivery" element={<DeliveryPage />} />
        <Route path="*" element={<Navigate to="/delivery" replace />} />
      </Routes>
    </Suspense>
  );
}

export default DeliveryApp;
