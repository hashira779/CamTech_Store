import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { PosPage } from './PosPage';

export function PosApp() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/pos" replace />} />
      <Route path="/pos" element={<PosPage />} />
      <Route path="*" element={<Navigate to="/pos" replace />} />
    </Routes>
  );
}
