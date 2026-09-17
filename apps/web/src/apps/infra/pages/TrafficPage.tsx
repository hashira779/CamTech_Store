import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { type ApiTrafficRequestDTO } from '@mystore/contracts';
import { apiClient } from '@/lib/api-client';
import { PageSkeleton } from '@/components/page-skeleton';
import { ApiTrafficView } from '../views/ApiTrafficView';
import { stopPollingOnAuthFailure } from '@/lib/query-polling';

export default function TrafficPage() {
  const { data: traffic, isLoading } = useQuery<ApiTrafficRequestDTO[]>({
    queryKey: ['infra-traffic'],
    queryFn: () => apiClient.get<ApiTrafficRequestDTO[]>('/api/v1/infra/traffic'),
    refetchInterval: stopPollingOnAuthFailure(5_000),
  });

  if (isLoading && !traffic) {
    return <PageSkeleton variant="cards" />;
  }

  return <ApiTrafficView requests={traffic ?? []} />;
}
