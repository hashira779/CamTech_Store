import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { type InfraTopologyGraphDTO } from '@mystore/contracts';
import { apiClient } from '@/lib/api-client';
import { PageSkeleton } from '@/components/page-skeleton';
import { TopologyGraph } from '../components/TopologyGraph';
import { stopPollingOnAuthFailure } from '@/lib/query-polling';

export default function TopologyPage() {
  const { data: topology, isLoading } = useQuery<InfraTopologyGraphDTO>({
    queryKey: ['infra-topology'],
    queryFn: () => apiClient.get<InfraTopologyGraphDTO>('/api/v1/infra/topology'),
    refetchInterval: stopPollingOnAuthFailure(30_000),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Live Service Mesh &amp; Topology</h2>
          <p className="text-xs text-muted-foreground font-mono">
            Interactive real-time node dependency graph
          </p>
        </div>
        <span className="text-xs font-mono px-3 py-1 bg-card border border-border rounded-lg text-muted-foreground">
          Auto-Discovered Architecture
        </span>
      </div>
      <div className="h-[60vh] min-h-[320px] sm:h-[500px] lg:h-[650px] bg-card border border-border rounded-xl overflow-hidden">
        <TopologyGraph data={topology} />
      </div>
    </div>
  );
}
