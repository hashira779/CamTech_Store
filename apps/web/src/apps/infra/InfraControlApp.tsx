import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { InfraShell } from './InfraShell';
import { PageSkeleton } from '@/components/page-skeleton';

/**
 * ADR-0003: Vite + React Router — no Next.js.
 * See docs/adr/0003-infra-vite-react-router.md
 *
 * Each page is lazily loaded so only the active view's bundle is fetched.
 * Data-fetching (useQuery) lives inside each page, not at this root level.
 * InfraShell owns the persistent layout, SSE stream, and break-glass modal.
 */
const OverviewPage   = lazy(() => import('./pages/OverviewPage'));
const ServicesPage   = lazy(() => import('./pages/ServicesPage'));
const TopologyPage   = lazy(() => import('./pages/TopologyPage'));
const TrafficPage    = lazy(() => import('./pages/TrafficPage'));
const ThreatsPage    = lazy(() => import('./pages/ThreatsPage'));
const IncidentsPage  = lazy(() => import('./pages/IncidentsPage'));
const AuditPage      = lazy(() => import('./pages/AuditPage'));

// ICP — Infrastructure Control Platform Pages
const ServersPage    = lazy(() => import('./pages/ServersPage'));
const DockerPage     = lazy(() => import('./pages/DockerPage'));
const SchedulerPage  = lazy(() => import('./pages/SchedulerPage'));
const CloudflarePage = lazy(() => import('./pages/CloudflarePage'));
const AlertsPage     = lazy(() => import('./pages/AlertsPage'));

const LoginPage      = lazy(() => import('@/app/login/page'));

const PageFallback = () => <PageSkeleton variant="cards" />;

export function InfraControlApp() {
  return (
    <Routes>
      <Route path="/login" element={<Suspense fallback={<PageFallback />}><LoginPage /></Suspense>} />
      {/* Redirect root → overview */}
      <Route path="/" element={<Navigate to="/infra/overview" replace />} />

      {/* All infra pages share the persistent InfraShell layout */}
      <Route element={<InfraShell />}>
        <Route
          path="/infra/overview"
          element={<Suspense fallback={<PageFallback />}><OverviewPage /></Suspense>}
        />
        <Route
          path="/infra/servers"
          element={<Suspense fallback={<PageFallback />}><ServersPage /></Suspense>}
        />
        <Route
          path="/infra/docker"
          element={<Suspense fallback={<PageFallback />}><DockerPage /></Suspense>}
        />
        <Route
          path="/infra/scheduler"
          element={<Suspense fallback={<PageFallback />}><SchedulerPage /></Suspense>}
        />
        <Route
          path="/infra/services"
          element={<Suspense fallback={<PageFallback />}><ServicesPage /></Suspense>}
        />
        <Route
          path="/infra/topology"
          element={<Suspense fallback={<PageFallback />}><TopologyPage /></Suspense>}
        />
        <Route
          path="/infra/traffic"
          element={<Suspense fallback={<PageFallback />}><TrafficPage /></Suspense>}
        />
        <Route
          path="/infra/cloudflare"
          element={<Suspense fallback={<PageFallback />}><CloudflarePage /></Suspense>}
        />
        <Route
          path="/infra/alerts"
          element={<Suspense fallback={<PageFallback />}><AlertsPage /></Suspense>}
        />
        <Route
          path="/infra/threats"
          element={<Suspense fallback={<PageFallback />}><ThreatsPage /></Suspense>}
        />
        <Route
          path="/infra/incidents"
          element={<Suspense fallback={<PageFallback />}><IncidentsPage /></Suspense>}
        />
        <Route
          path="/infra/audit"
          element={<Suspense fallback={<PageFallback />}><AuditPage /></Suspense>}
        />
        {/* Deep-link fallback within infra shell */}
        <Route path="*" element={<Navigate to="/infra/overview" replace />} />
      </Route>
    </Routes>
  );
}

export default InfraControlApp;
