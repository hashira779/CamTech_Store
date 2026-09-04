import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PageSkeleton } from '@/components/page-skeleton';

const CustomerShopPage = lazy(() => import('@/app/shop/page'));
const CustomerPortalPage = lazy(() => import('@/app/customer/page'));

export function CustomerApp() {
  return (
    <Suspense fallback={<PageSkeleton variant="cards" />}>
      <Routes>
        <Route path="/" element={<Navigate to="/shop" replace />} />
        <Route path="/shop" element={<CustomerShopPage />} />
        <Route path="/customer" element={<CustomerPortalPage />} />
        <Route path="*" element={<Navigate to="/shop" replace />} />
      </Routes>
    </Suspense>
  );
}

export default CustomerApp;
