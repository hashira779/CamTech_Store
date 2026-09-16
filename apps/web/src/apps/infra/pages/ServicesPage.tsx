import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { type InfraServiceNodeDTO } from '@mystore/contracts';
import { apiClient } from '@/lib/api-client';
import { PageSkeleton } from '@/components/page-skeleton';
import { ServicesView } from '../views/ServicesView';

export default function ServicesPage() {
  const { data: services, isLoading } = useQuery<InfraServiceNodeDTO[]>({
    queryKey: ['infra-services'],
    queryFn: () => apiClient.get<InfraServiceNodeDTO[]>('/api/v1/infra/services'),
    refetchInterval: 10_000,
  });

  if (isLoading && !services) {
    return <PageSkeleton variant="cards" />;
  }

  return <ServicesView services={services} />;
}
