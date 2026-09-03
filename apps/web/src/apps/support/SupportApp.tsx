import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SupportShell } from './SupportShell';

const TicketsPage = lazy(() => import('@/app/tickets/page'));
const ApprovalsPage = lazy(() => import('@/app/approvals/page'));

export function SupportApp() {
  return (
    <SupportShell>
      <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading Support Desk...</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/tickets" replace />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="*" element={<Navigate to="/tickets" replace />} />
        </Routes>
      </Suspense>
    </SupportShell>
  );
}

export default SupportApp;
