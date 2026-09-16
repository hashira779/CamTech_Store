import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type IncidentDTO, type IncidentSeverity } from '@mystore/contracts';
import { apiClient } from '@/lib/api-client';
import { PageSkeleton } from '@/components/page-skeleton';
import { IncidentsView } from '../views/IncidentsView';

export default function IncidentsPage() {
  const queryClient = useQueryClient();

  const { data: incidents, isLoading } = useQuery<IncidentDTO[]>({
    queryKey: ['infra-incidents'],
    queryFn: () => apiClient.get<IncidentDTO[]>('/api/v1/infra/incidents'),
    refetchInterval: 10_000,
  });

  const handleCreateIncident = async (
    title: string,
    severity: IncidentSeverity,
    description: string,
    affectedServices: string[],
  ) => {
    await apiClient.post('/api/v1/infra/incidents', {
      title,
      severity,
      description,
      affectedServices,
    });
    queryClient.invalidateQueries({ queryKey: ['infra-incidents'] });
    queryClient.invalidateQueries({ queryKey: ['infra-overview'] });
  };

  if (isLoading && !incidents) {
    return <PageSkeleton variant="cards" />;
  }

  return (
    <IncidentsView
      incidents={incidents ?? []}
      onCreateIncident={handleCreateIncident}
    />
  );
}
