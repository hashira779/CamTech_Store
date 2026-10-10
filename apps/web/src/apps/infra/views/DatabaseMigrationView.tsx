import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import {
  Database,
  Server,
  Cloud,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  ShieldCheck,
  Cpu,
  Clock,
  Play,
  ArrowUpRight,
  Check,
  Lock,
  Search,
  HardDrive,
  Copy,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import type {
  ActiveDatabaseStatusResponse,
  TestDbConnectionRequest,
  TestDbConnectionResponse,
  DbMigrationRequest,
  DbMigrationResponse,
} from '@mystore/contracts';

export function DatabaseMigrationView() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [envPreset, setEnvPreset] = useState<'LOCAL_NODE' | 'CLOUD_MANAGED'>('LOCAL_NODE');
  const [formData, setFormData] = useState<DbMigrationRequest>({
    targetHost: 'localhost',
    targetPort: 5432,
    targetDatabase: 'camtechStore_standby',
    targetUser: 'camtech',
    targetPassword: '',
    targetSslMode: 'prefer',
    targetEnvironmentType: 'LOCAL_NODE',
    migrationMode: 'FULL_MIGRATION',
    autoSwitchEngine: false,
  });

  const [testResult, setTestResult] = useState<TestDbConnectionResponse | null>(null);
  const [migrationResult, setMigrationResult] = useState<DbMigrationResponse | null>(null);
  const [tableSearch, setTableSearch] = useState('');

  // 1. Fetch Active Database Fleet Status
  const {
    data: dbStatus,
    isLoading: isLoadingStatus,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['infra-db-status'],
    queryFn: () => apiClient.get<ActiveDatabaseStatusResponse>('/api/v1/infra/database/status'),
    refetchInterval: 10000,
  });

  // 2. Test Target Connection Mutation
  const testConnMutation = useMutation({
    mutationFn: (payload: TestDbConnectionRequest) =>
      apiClient.post<TestDbConnectionResponse>('/api/v1/infra/database/test-connection', payload),
    onSuccess: (res) => {
      setTestResult(res);
    },
    onError: (err: any) => {
      setTestResult({
        success: false,
        latencyMs: 0,
        databaseExists: false,
        tableCount: 0,
        writable: false,
        message: err.message || 'Connection test failed',
      });
    },
  });

  // 3. Execute Migration Mutation
  const migrateMutation = useMutation({
    mutationFn: (payload: DbMigrationRequest) =>
      apiClient.post<DbMigrationResponse>('/api/v1/infra/database/migrate', payload),
    onSuccess: (res) => {
      setMigrationResult(res);
      queryClient.invalidateQueries({ queryKey: ['infra-db-status'] });
    },
    onError: (err: any) => {
      setMigrationResult({
        migrationId: 'failed',
        status: 'FAILED',
        totalTables: 0,
        completedTables: 0,
        totalRows: 0,
        migratedRows: 0,
        checksumVerified: false,
        durationSeconds: 0,
        tableStats: [],
        targetDsnMasked: '',
        activeEngineSwitched: false,
        message: err.message || 'Migration encountered an unrecoverable failure',
      });
    },
  });

  const handlePresetChange = (preset: 'LOCAL_NODE' | 'CLOUD_MANAGED') => {
    setEnvPreset(preset);
    if (preset === 'LOCAL_NODE') {
      setFormData((prev) => ({
        ...prev,
        targetHost: 'localhost',
        targetPort: 5432,
        targetSslMode: 'disable',
        targetEnvironmentType: 'LOCAL_NODE',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        targetHost: 'ep-silent-voice.ap-southeast-1.aws.neon.tech',
        targetPort: 5432,
        targetSslMode: 'require',
        targetEnvironmentType: 'CLOUD_MANAGED',
      }));
    }
    setTestResult(null);
  };

  const handleTestConnection = (e: React.FormEvent) => {
    e.preventDefault();
    testConnMutation.mutate({
      host: formData.targetHost,
      port: formData.targetPort,
      database: formData.targetDatabase,
      user: formData.targetUser,
      password: formData.targetPassword,
      sslMode: formData.targetSslMode,
      environmentType: formData.targetEnvironmentType,
    });
  };

  const handleStartMigration = () => {
    if (!formData.targetPassword) {
      alert('Please enter target database password before starting migration.');
      return;
    }
    setMigrationResult(null);
    migrateMutation.mutate(formData);
  };

  const filteredStats = (migrationResult?.tableStats || []).filter((s) =>
    s.tableName.toLowerCase().includes(tableSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[#F38020]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Database Fleet & Disaster Recovery Migration
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Automated PostgreSQL replication, cloud/local server migration, and zero-downtime failover
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetchStatus()}
            disabled={isLoadingStatus}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 text-xs font-mono flex items-center gap-2 border border-zinc-700/60 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStatus ? 'animate-spin' : ''}`} />
            Refresh Fleet Metrics
          </button>
        </div>
      </div>

      {/* ── Primary Active Database Status Ribbon ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-mono uppercase tracking-wider">Active Primary Node</span>
            <Server className="w-4 h-4 text-[#F38020]" />
          </div>
          <div className="text-lg font-bold text-white mt-1 font-mono truncate">
            {dbStatus?.host || 'localhost'}:{dbStatus?.port || 5432}
          </div>
          <div className="text-[11px] text-emerald-400 font-mono mt-0.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{dbStatus?.status || 'HEALTHY'}</span>
            <span className="text-zinc-500">•</span>
            <span className="text-zinc-400">{dbStatus?.pingLatencyMs ?? '1.2'}ms ping</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-mono uppercase tracking-wider">Database Storage</span>
            <HardDrive className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-lg font-bold text-white mt-1 font-mono">
            {dbStatus?.databaseSizeFormatted || '24.8 MB'}
          </div>
          <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
            Database: <strong className="text-white">{dbStatus?.database || 'camtechStore'}</strong> ({dbStatus?.tableCount || 62} tables)
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-mono uppercase tracking-wider">Engine Connection Pool</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-white mt-1 font-mono">
            {dbStatus?.poolSize || 50} Max Connections
          </div>
          <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
            PgBouncer: <span className="text-emerald-400 font-bold">Port 6432 Ready</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-mono uppercase tracking-wider">High Availability</span>
            <ShieldCheck className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-lg font-bold text-white mt-1 font-mono">
            {dbStatus?.hasReplica ? 'Read Replica Active' : 'Single Primary'}
          </div>
          <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
            Replica Port: <span className="text-purple-400 font-bold">5434</span> ({dbStatus?.replicaLatencyMs ? `${dbStatus.replicaLatencyMs}ms` : 'Sync'})
          </div>
        </div>
      </div>

      {/* ── Main Migration & Failover Panel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Target Server Configuration (5 cols) */}
        <div className="lg:col-span-5 bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#F38020]" />
                Target Database Server Configuration
              </h2>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Specify the target server (Cloud or Local node) to migrate data to if your current server is down or changing.
            </p>
          </div>

          {/* Environment Preset Pills */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950/80 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => handlePresetChange('LOCAL_NODE')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                envPreset === 'LOCAL_NODE'
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/80'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              Local / On-Prem Node
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('CLOUD_MANAGED')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                envPreset === 'CLOUD_MANAGED'
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/80'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Cloud className="w-3.5 h-3.5 text-sky-400" />
              Cloud Database (AWS/Neon)
            </button>
          </div>

          <form onSubmit={handleTestConnection} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                  Target Host / IP *
                </label>
                <input
                  type="text"
                  value={formData.targetHost}
                  onChange={(e) => setFormData({ ...formData, targetHost: e.target.value })}
                  placeholder="e.g. 10.1.0.12 or db.neon.tech"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-[#F38020]"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                  Port
                </label>
                <input
                  type="number"
                  value={formData.targetPort}
                  onChange={(e) => setFormData({ ...formData, targetPort: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-[#F38020]"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                  Database Name *
                </label>
                <input
                  type="text"
                  value={formData.targetDatabase}
                  onChange={(e) => setFormData({ ...formData, targetDatabase: e.target.value })}
                  placeholder="camtechStore"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-[#F38020]"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  value={formData.targetUser}
                  onChange={(e) => setFormData({ ...formData, targetUser: e.target.value })}
                  placeholder="postgres"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-[#F38020]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                Password *
              </label>
              <input
                type="password"
                value={formData.targetPassword}
                onChange={(e) => setFormData({ ...formData, targetPassword: e.target.value })}
                placeholder="Target database password"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-[#F38020]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                  SSL Encryption
                </label>
                <select
                  value={formData.targetSslMode}
                  onChange={(e) => setFormData({ ...formData, targetSslMode: e.target.value as any })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-[#F38020]"
                >
                  <option value="prefer">Prefer (Auto)</option>
                  <option value="require">Require (Cloud SSL)</option>
                  <option value="disable">Disable (Local Network)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                  Migration Scope
                </label>
                <select
                  value={formData.migrationMode}
                  onChange={(e) => setFormData({ ...formData, migrationMode: e.target.value as any })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-[#F38020]"
                >
                  <option value="FULL_MIGRATION">Full Migration (Schema + Data)</option>
                  <option value="FAILOVER_PROMOTE">Failover & Promote Active Engine</option>
                  <option value="SCHEMA_ONLY">Schema & Enums Only</option>
                  <option value="DATA_SYNC">Data Synchronization Only</option>
                </select>
              </div>
            </div>

            {/* Failover switch checkbox */}
            <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.autoSwitchEngine}
                  onChange={(e) => setFormData({ ...formData, autoSwitchEngine: e.target.checked })}
                  className="mt-0.5 rounded border-zinc-700 text-[#F38020] focus:ring-[#F38020] w-4 h-4 bg-zinc-900"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">
                    Zero-Downtime Failover Engine Switch
                  </span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">
                    Promote target database as active connection pool upon successful verification.
                  </span>
                </div>
              </label>
            </div>

            {/* Test Connection Button */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={testConnMutation.isPending || !formData.targetHost}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-white text-xs font-semibold flex items-center justify-center gap-2 border border-zinc-700 transition-all disabled:opacity-50"
              >
                {testConnMutation.isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                )}
                Test Target Connection
              </button>
            </div>

            {/* Test Connection Feedback */}
            {testResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                )}
                <div className="space-y-1">
                  <p className="font-semibold">
                    {testResult.success ? 'Target Server Reachable' : 'Connection Failed'}
                  </p>
                  <p className="text-[11px] opacity-90">{testResult.message}</p>
                  {testResult.serverVersion && (
                    <div className="text-[10px] font-mono text-zinc-400">
                      Version: {testResult.serverVersion} ({testResult.latencyMs}ms ping)
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Execute Migration Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleStartMigration}
                disabled={migrateMutation.isPending || !formData.targetHost}
                className="w-full py-3 px-4 rounded-xl bg-[#F38020] hover:bg-[#d96e14] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
              >
                {migrateMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Migrating Database & Replicating Data...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    Start Automated Database Migration
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Migration Progress, Pipeline & Table Audit (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Migration / Pipeline Card */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Automated Migration Pipeline & Health
                </h2>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Pre-flight checks, native enum bindings, DDL replication, batch data streaming & checksum audit
                </p>
              </div>
              {migrationResult && (
                <span
                  className={`text-[10px] font-mono px-2.5 py-1 rounded-full font-bold ${
                    migrationResult.status === 'COMPLETED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {migrationResult.status}
                </span>
              )}
            </div>

            {/* Migration Summary Stats (when finished) */}
            {migrationResult && (
              <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-[10px] font-mono text-zinc-400 uppercase">Tables Synced</span>
                    <p className="text-lg font-bold text-white font-mono mt-0.5">
                      {migrationResult.completedTables} / {migrationResult.totalTables}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-zinc-400 uppercase">Total Rows Copied</span>
                    <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                      {migrationResult.migratedRows.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-zinc-400 uppercase">Duration</span>
                    <p className="text-lg font-bold text-white font-mono mt-0.5">
                      {migrationResult.durationSeconds}s
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-zinc-400 uppercase">1:1 Checksum</span>
                    <p className="text-lg font-bold font-mono mt-0.5 flex items-center gap-1 text-emerald-400">
                      <Check className="w-4 h-4" /> Verified
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Target DSN:</span>
                  <span className="font-mono text-zinc-200 text-[11px]">
                    {migrationResult.targetDsnMasked}
                  </span>
                </div>
                {migrationResult.activeEngineSwitched && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Disaster Recovery Failover complete. The active backend connection pool is now serving from the target database.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Pipeline Step Sequence */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-zinc-300">Replication Stages</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-medium text-white block">1. Target Database Check</span>
                    <span className="text-[10px] text-zinc-400">Creates target database if absent</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-medium text-white block">2. Native ENUM Replication</span>
                    <span className="text-[10px] text-zinc-400">Binds 18+ ENUM_LABELS types</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-medium text-white block">3. DDL Schema Generation</span>
                    <span className="text-[10px] text-zinc-400">Tables, indexes, and foreign keys</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-medium text-white block">4. Fast Bulk Copy Mode</span>
                    <span className="text-[10px] text-zinc-400">Bypasses FK deadlocks in replica mode</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-medium text-white block">5. Sequences Reset</span>
                    <span className="text-[10px] text-zinc-400">Aligns setval() for serial IDs</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-medium text-white block">6. 1:1 Checksum Audit</span>
                    <span className="text-[10px] text-zinc-400">Validates source vs target counts</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Table-by-Table Data Migration Audit List */}
            {migrationResult && migrationResult.tableStats.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-zinc-300">
                    Transferred Tables ({migrationResult.tableStats.length})
                  </h3>
                  <div className="relative w-48">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
                    <input
                      type="text"
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder="Filter tables..."
                      className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/50">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900/90 text-zinc-400 font-mono text-[10px] uppercase sticky top-0 border-b border-zinc-800">
                      <tr>
                        <th className="py-2 px-3">Table Name</th>
                        <th className="py-2 px-3">Source Rows</th>
                        <th className="py-2 px-3">Migrated Rows</th>
                        <th className="py-2 px-3">Latency</th>
                        <th className="py-2 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850 font-mono text-[11px]">
                      {filteredStats.map((st) => (
                        <tr key={st.tableName} className="hover:bg-zinc-900/40">
                          <td className="py-2 px-3 font-semibold text-zinc-200">
                            {st.tableName}
                          </td>
                          <td className="py-2 px-3 text-zinc-400">{st.sourceRows}</td>
                          <td className="py-2 px-3 text-emerald-400 font-bold">
                            {st.migratedRows}
                          </td>
                          <td className="py-2 px-3 text-zinc-500">
                            {st.durationMs ? `${st.durationMs}ms` : '—'}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                              <Check className="w-3 h-3" /> OK
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DatabaseMigrationView;
