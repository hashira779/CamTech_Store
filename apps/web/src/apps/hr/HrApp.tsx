import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { HrLayout } from './HrLayout';
import { PageSkeleton } from '@/components/page-skeleton';

const HrPage = lazy(() => import('@/app/hr/page'));

export function HrApp() {
  return (
    <HrLayout>
      <Suspense fallback={<PageSkeleton variant="table" />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<HrPage />} />
          <Route path="/employees" element={<HrPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </HrLayout>
  );
}

export default HrApp;
