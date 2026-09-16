import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type SecurityEventDTO, type ActiveBanDTO } from '@mystore/contracts';
import { apiClient } from '@/lib/api-client';
import { PageSkeleton } from '@/components/page-skeleton';
import { SecurityThreatView } from '../views/SecurityThreatView';

export default function ThreatsPage() {
  const queryClient = useQueryClient();

  const { data: events, isLoading } = useQuery<SecurityEventDTO[]>({
    queryKey: ['infra-security-events'],
    queryFn: () => apiClient.get<SecurityEventDTO[]>('/api/v1/infra/security/events'),
    refetchInterval: 10_000,
  });

  const { data: bansData } = useQuery<{ total: number; bans: ActiveBanDTO[] }>({
    queryKey: ['infra-bans'],
    queryFn: () => apiClient.get<{ total: number; bans: ActiveBanDTO[] }>('/api/v1/infra/security/bans'),
    refetchInterval: 10_000,
  });

  const handleBanIp = async (ip: string, reason: string, durationHours?: number) => {
    await apiClient.post('/api/v1/infra/security/bans', { ip, reason, durationHours });
    queryClient.invalidateQueries({ queryKey: ['infra-bans'] });
    queryClient.invalidateQueries({ queryKey: ['infra-overview'] });
  };

  const handleUnbanIp = async (ip: string) => {
    await apiClient.delete(`/api/v1/infra/security/bans/${encodeURIComponent(ip)}`);
    queryClient.invalidateQueries({ queryKey: ['infra-bans'] });
    queryClient.invalidateQueries({ queryKey: ['infra-overview'] });
  };

  if (isLoading && !events) {
    return <PageSkeleton variant="cards" />;
  }

  return (
    <SecurityThreatView
      events={events ?? []}
      bans={bansData?.bans ?? []}
      onBanIp={handleBanIp}
      onUnbanIp={handleUnbanIp}
    />
  );
}
