import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PageSkeleton } from '@/components/page-skeleton';

import { PosPage } from './PosPage';
const LoginPage = lazy(() => import('@/app/login/page'));

export function PosApp() {
  return (
    <Suspense fallback={<PageSkeleton variant="cards" />}>
      <Routes>
        <Route path="/" element={<Navigate to="/pos" replace />} />
        <Route path="/pos" element={<PosPage />} />
        <Route path="/sales/new" element={<PosPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/pos" replace />} />
      </Routes>
    </Suspense>
  );
}

export default PosApp;
