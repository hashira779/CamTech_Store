import React, { Suspense } from 'react';
import { useLocation } from 'react-router-dom';

import { Toaster } from 'sonner';
import { useRealtimeStream } from '@/lib/use-realtime-stream';
import { useInactivityTimeout } from '@/lib/use-inactivity-timeout';
import { DomainBar } from '@/components/domain-bar';
import { ErrorBoundary } from '@/components/error-boundary';
import { AppShellSkeleton } from '@/components/page-skeleton';
import { isPathUnder, resolveExperience } from './experiences';

export function App() {
  useRealtimeStream();
  useInactivityTimeout();

  const location = useLocation();
  const { app: CurrentApp, hideDomainBar } = resolveExperience(window.location.hostname, location.pathname);
  const showDomainBar = !hideDomainBar && !isPathUnder(location.pathname, '/mini');

  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      {showDomainBar && <DomainBar />}
      {/* DomainBar stays outside the boundary, so if the active experience
          crashes the user can still navigate to another one. resetKeys clears
          the error automatically on route change. */}
      <ErrorBoundary resetKeys={[location.pathname]}>
        <Suspense fallback={<AppShellSkeleton />}>
          <CurrentApp />
        </Suspense>
      </ErrorBoundary>
    </>
  );
}


export default App;
