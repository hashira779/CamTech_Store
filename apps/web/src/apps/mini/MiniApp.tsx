import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PageSkeleton } from '@/components/page-skeleton';

const TelegramMiniAppPage = lazy(() => import('@/app/mini/page'));

export function MiniApp() {
  return (
    <Suspense fallback={<PageSkeleton variant="cards" />}>
      <Routes>
        <Route path="/" element={<TelegramMiniAppPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default MiniApp;
