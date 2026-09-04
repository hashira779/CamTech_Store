import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { FinanceLayout } from './FinanceLayout';
import { PageSkeleton } from '@/components/page-skeleton';

const FinancePage = lazy(() => import('@/app/finance/page'));
const TaxesPage = lazy(() => import('@/app/taxes/page'));

export function FinanceApp() {
  return (
    <FinanceLayout>
      <Suspense fallback={<PageSkeleton variant="table" />}>
        <Routes>
          <Route path="/" element={<Navigate to="/finance" replace />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/taxes" element={<TaxesPage />} />
          <Route path="*" element={<Navigate to="/finance" replace />} />
        </Routes>
      </Suspense>
    </FinanceLayout>
  );
}

export default FinanceApp;
