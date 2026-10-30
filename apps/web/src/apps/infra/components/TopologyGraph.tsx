import React from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { type InfraTopologyGraphDTO } from '@mystore/contracts';
import { Server, Database, Zap, Shield, Globe } from 'lucide-react';

interface TopologyGraphProps {
  data?: InfraTopologyGraphDTO;
  onSelectNode?: (nodeId: string) => void;
}

const defaultNodes: Node[] = [
  {
    id: 'nginx',
    position: { x: 420, y: 20 },
    data: { label: 'Edge Reverse Proxy', type: 'PROXY', port: 80, status: 'HEALTHY' },
    style: { background: '#18181b', color: 'var(--primary-foreground)', border: '1px solid #3f3f46', borderRadius: 10, padding: 12, minWidth: 170 },
  },
  {
    id: 'api-gateway',
    position: { x: 420, y: 120 },
    data: { label: 'API Gateway (:4000)', type: 'GATEWAY', port: 4000, status: 'HEALTHY' },
    style: { background: '#1e1b4b', color: 'var(--foreground)', border: '1px solid var(--primary)', borderRadius: 10, padding: 12, minWidth: 170, boxShadow: '0 0 15px color-mix(in srgb, var(--primary) 20%, transparent)' },
  },
  {
    id: 'auth-service',
    position: { x: 40, y: 240 },
    data: { label: 'Auth & Passkey (:4001)', type: 'MICROSERVICE', port: 4001, status: 'HEALTHY' },
    style: { background: '#18181b', color: 'var(--primary-foreground)', border: '1px solid #27272a', borderRadius: 10, padding: 10, minWidth: 160 },
  },
  {
    id: 'catalog-service',
    position: { x: 230, y: 240 },
    data: { label: 'Catalog & Stock (:4002)', type: 'MICROSERVICE', port: 4002, status: 'HEALTHY' },
    style: { background: '#18181b', color: 'var(--primary-foreground)', border: '1px solid #27272a', borderRadius: 10, padding: 10, minWidth: 160 },
  },
  {
    id: 'sales-service',
    position: { x: 420, y: 240 },
    data: { label: 'Sales & Orders (:4003)', type: 'MICROSERVICE', port: 4003, status: 'HEALTHY' },
    style: { background: '#18181b', color: 'var(--primary-foreground)', border: '1px solid #27272a', borderRadius: 10, padding: 10, minWidth: 160 },
  },
  {
    id: 'delivery-service',
    position: { x: 610, y: 240 },
    data: { label: 'Delivery & GPS (:4004)', type: 'MICROSERVICE', port: 4004, status: 'HEALTHY' },
    style: { background: '#18181b', color: 'var(--primary-foreground)', border: '1px solid #27272a', borderRadius: 10, padding: 10, minWidth: 160 },
  },
  {
    id: 'platform-service',
    position: { x: 800, y: 240 },
    data: { label: 'Workflows & Desk (:4007)', type: 'MICROSERVICE', port: 4007, status: 'HEALTHY' },
    style: { background: '#18181b', color: 'var(--primary-foreground)', border: '1px solid #27272a', borderRadius: 10, padding: 10, minWidth: 160 },
  },
  {
    id: 'postgres',
    position: { x: 240, y: 380 },
    data: { label: 'PostgreSQL 16 Primary (:5432)', type: 'DATABASE', port: 5432, status: 'HEALTHY' },
    style: { background: '#082f49', color: '#bae6fd', border: '1px solid #0284c7', borderRadius: 10, padding: 12, minWidth: 190 },
  },
  {
    id: 'redis',
    position: { x: 600, y: 380 },
    data: { label: 'Redis 7 Outbox & Stream (:6379)', type: 'CACHE', port: 6379, status: 'HEALTHY' },
    style: { background: '#450a0a', color: '#fecaca', border: '1px solid #dc2626', borderRadius: 10, padding: 12, minWidth: 190 },
  },
];

const defaultEdges: Edge[] = [
  { id: 'e1', source: 'nginx', target: 'api-gateway', animated: true, style: { stroke: 'var(--primary)', strokeWidth: 2 } },
  { id: 'e2', source: 'api-gateway', target: 'auth-service', animated: true, style: { stroke: 'var(--success)' } },
  { id: 'e3', source: 'api-gateway', target: 'catalog-service', animated: true, style: { stroke: 'var(--success)' } },
  { id: 'e4', source: 'api-gateway', target: 'sales-service', animated: true, style: { stroke: 'var(--success)' } },
  { id: 'e5', source: 'api-gateway', target: 'delivery-service', animated: true, style: { stroke: 'var(--success)' } },
  { id: 'e6', source: 'api-gateway', target: 'platform-service', animated: true, style: { stroke: 'var(--success)' } },
  { id: 'e7', source: 'auth-service', target: 'postgres', animated: true, style: { stroke: '#0284c7' } },
  { id: 'e8', source: 'catalog-service', target: 'postgres', animated: true, style: { stroke: '#0284c7' } },
  { id: 'e9', source: 'sales-service', target: 'postgres', animated: true, style: { stroke: '#0284c7' } },
  { id: 'e10', source: 'delivery-service', target: 'postgres', animated: true, style: { stroke: '#0284c7' } },
  { id: 'e11', source: 'sales-service', target: 'redis', animated: true, style: { stroke: '#dc2626' } },
  { id: 'e12', source: 'api-gateway', target: 'redis', animated: true, style: { stroke: '#dc2626' } },
];

export function TopologyGraph({ data, onSelectNode }: TopologyGraphProps) {
  const nodes = data?.nodes?.length
    ? data.nodes.map((n) => ({
        id: n.id,
        position: n.position,
        data: { label: `${n.data.label}` },
        style: {
          background: n.data.type === 'GATEWAY' ? '#1e1b4b' : (n.data.type === 'DATABASE' ? '#082f49' : (n.data.type === 'CACHE' ? '#450a0a' : '#18181b')),
          color: 'var(--primary-foreground)',
          border: '1px solid #3f3f46',
          borderRadius: 8,
          padding: 10,
          fontSize: 12,
          fontWeight: 600,
        },
      }))
    : defaultNodes;

  const edges = data?.edges?.length
    ? data.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: true,
        style: { stroke: 'var(--primary)', strokeWidth: 1.5 },
      }))
    : defaultEdges;

  return (
    <div className="w-full h-[460px] bg-card/80 rounded-xl border border-border/80 overflow-hidden relative">
      <div className="absolute top-3 left-4 z-10 flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-card/90 border border-border/80 text-[11px] font-mono text-foreground">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
          <span>Mesh Topology (Live)</span>
        </div>
        <div className="text-[11px] text-muted-foreground font-mono hidden sm:inline">
          Click any node to inspect telemetry & logs
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={(_, node) => onSelectNode?.(node.id)}
        fitView
        attributionPosition="bottom-right"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#27272a" />
        <Controls className="bg-card border-border fill-zinc-300" />
      </ReactFlow>
    </div>
  );
}
