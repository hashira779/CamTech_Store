import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { PosPage } from './PosPage';
const LoginPage = lazy(() => import('@/app/login/page'));

export function PosApp() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/pos" replace />} />
      <Route path="/pos" element={<PosPage />} />
      <Route path="/sales/new" element={<PosPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<Navigate to="/pos" replace />} />
    </Routes>
  );
}

export default PosApp;
