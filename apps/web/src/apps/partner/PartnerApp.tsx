import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PartnerShell } from './PartnerShell';

const DevelopersPage = lazy(() => import('@/app/developers/page'));
const AutomationsPage = lazy(() => import('@/app/automations/page'));

export function PartnerApp() {
  return (
    <PartnerShell>
      <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading Partner Hub...</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/developers" replace />} />
          <Route path="/developers" element={<DevelopersPage />} />
          <Route path="/automations" element={<AutomationsPage />} />
          <Route path="*" element={<Navigate to="/developers" replace />} />
        </Routes>
      </Suspense>
    </PartnerShell>
  );
}

export default PartnerApp;
