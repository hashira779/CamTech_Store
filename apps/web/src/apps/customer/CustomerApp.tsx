import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CustomerLayout } from './CustomerLayout';

const CustomerShopPage = lazy(() => import('@/app/shop/page'));
const CustomerPortalPage = lazy(() => import('@/app/customer/page'));

export function CustomerApp() {
  return (
    <CustomerLayout>
      <Suspense fallback={<div className="p-8 text-center">Loading Store...</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/shop" replace />} />
          <Route path="/shop" element={<CustomerShopPage />} />
          <Route path="/customer" element={<CustomerPortalPage />} />
          <Route path="*" element={<Navigate to="/shop" replace />} />
        </Routes>
      </Suspense>
    </CustomerLayout>
  );
}
