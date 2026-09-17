import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import '@/app/globals.css';
import { retryUnlessAuthFailure } from '@/lib/query-polling';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry transport and server faults, but accept an authorization verdict
      // the first time — a 401/403 will not change on a second attempt, and
      // retrying it only amplifies load on an endpoint already refusing us.
      retry: retryUnlessAuthFailure(1),
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2, // 2 minutes cache validity for instant page switches
      gcTime: 1000 * 60 * 10,    // 10 minutes memory retention
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
