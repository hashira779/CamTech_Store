import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { HrLayout } from './HrLayout';

const HrPage = lazy(() => import('@/app/hr/page'));

export function HrApp() {
  return (
    <HrLayout>
      <Suspense fallback={<div>Loading...</div>}>
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
