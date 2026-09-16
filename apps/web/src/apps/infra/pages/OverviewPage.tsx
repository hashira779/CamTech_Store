import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { type InfraOverviewDTO, type InfraTopologyGraphDTO, type ApiTrafficRequestDTO, type IncidentDTO } from '@mystore/contracts';
import { apiClient } from '@/lib/api-client';
import { PageSkeleton } from '@/components/page-skeleton';
import { OverviewView } from '../views/OverviewView';

export default function OverviewPage() {
  const navigate = useNavigate();

  const { data: overview, isLoading } = useQuery<InfraOverviewDTO>({
    queryKey: ['infra-overview'],
    queryFn: () => apiClient.get<InfraOverviewDTO>('/api/v1/infra/overview'),
    refetchInterval: 10_000,
  });

  const { data: topology } = useQuery<InfraTopologyGraphDTO>({
    queryKey: ['infra-topology'],
    queryFn: () => apiClient.get<InfraTopologyGraphDTO>('/api/v1/infra/topology'),
    refetchInterval: 30_000,
  });

  const { data: traffic = [] } = useQuery<ApiTrafficRequestDTO[]>({
    queryKey: ['infra-traffic'],
    queryFn: () => apiClient.get<ApiTrafficRequestDTO[]>('/api/v1/infra/traffic'),
    refetchInterval: 10_000,
  });

  const { data: incidents = [] } = useQuery<IncidentDTO[]>({
    queryKey: ['infra-incidents'],
    queryFn: () => apiClient.get<IncidentDTO[]>('/api/v1/infra/incidents'),
    refetchInterval: 10_000,
  });

  if (isLoading && !overview) {
    return <PageSkeleton variant="dashboard" />;
  }

  return (
    <OverviewView
      overview={overview}
      topology={topology}
      traffic={traffic}
      incidents={incidents}
      onSelectService={() => navigate('/infra/services')}
      onNavigateTab={(tab) => navigate(`/infra/${tab}`)}
    />
  );
}
