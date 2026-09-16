import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { type InfraTopologyGraphDTO } from '@mystore/contracts';
import { apiClient } from '@/lib/api-client';
import { PageSkeleton } from '@/components/page-skeleton';
import { TopologyGraph } from '../components/TopologyGraph';

export default function TopologyPage() {
  const { data: topology, isLoading } = useQuery<InfraTopologyGraphDTO>({
    queryKey: ['infra-topology'],
    queryFn: () => apiClient.get<InfraTopologyGraphDTO>('/api/v1/infra/topology'),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Live Service Mesh &amp; Topology</h2>
          <p className="text-xs text-slate-400 font-mono">
            Interactive real-time node dependency graph
          </p>
        </div>
        <span className="text-xs font-mono px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-400">
          Auto-Discovered Architecture
        </span>
      </div>
      <div className="h-[650px] bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
        <TopologyGraph data={topology} />
      </div>
    </div>
  );
}
