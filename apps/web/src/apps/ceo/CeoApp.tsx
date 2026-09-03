import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ExecutiveShell } from './ExecutiveShell';

const DashboardPage = lazy(() => import('@/app/dashboard/page'));
const ReportsPage = lazy(() => import('@/app/reports/page'));
const LoginPage = lazy(() => import('@/app/login/page'));

export function CeoApp() {
  return (
    <ExecutiveShell>
      <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading Executive Analytics...</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/ceo" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </ExecutiveShell>
  );
}

export default CeoApp;
