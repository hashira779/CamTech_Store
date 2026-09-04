import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SupportShell } from './SupportShell';
import { PageSkeleton } from '@/components/page-skeleton';

const TicketsPage = lazy(() => import('@/app/tickets/page'));
const ApprovalsPage = lazy(() => import('@/app/approvals/page'));

export function SupportApp() {
  return (
    <SupportShell>
      <Suspense fallback={<PageSkeleton variant="list" />}>
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
