import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Truck,
  Navigation,
  Phone,
  CheckCircle2,
  Clock,
  MapPin,
  DollarSign,
  FileSignature,
  Battery,
  ShieldCheck,
  ChevronRight,
  Package,
  Sparkles,
  RefreshCw,
  X
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

const API_BASE_URL = (() => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return window.location.origin;
    }
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:4000';
})();

interface DeliveryTask {
  id: string;
  trackingNumber: string;
  recipientName: string;
  recipientPhone: string;
  destinationAddress: string;
  status: 'PENDING' | 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED';
  codAmount: number;
  paymentMethod: 'CASH_ON_DELIVERY' | 'PAID_KHQR';
}

interface DriverProfile {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  licensePlate: string;
  status: string;
  batteryLevel: number;
}

export function App() {
  const [deliveries, setDeliveries] = useState<DeliveryTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<DeliveryTask | null>(null);
  const [isPodOpen, setIsPodOpen] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');

  // 1. Fetch real driver roster from Central Data Center API
  const { data: drivers } = useQuery<DriverProfile[]>({
    queryKey: ['delivery-fleet-drivers'],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/delivery/drivers/public`);
        if (!res.ok) return [];
        const json = await res.json();
        return json.data || json || [];
      } catch {
        return [];
      }
    },
    staleTime: 30000
  });

  const activeDriver: DriverProfile | undefined = 
    (drivers && drivers.find((d) => d.id === selectedDriverId)) ||
    (drivers && drivers[0]);

  // 2. Fetch live tasks from Central Data Center API (polls every 3s for new store orders)
  const { data: serverTasks, isLoading: isTasksLoading, refetch } = useQuery({
    queryKey: ['delivery-live-tasks'],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/delivery/tasks`);
        if (!res.ok) throw new Error('API offline');
        const json = await res.json();
        const items = json.data?.items || json.items || json.data || [];
        if (Array.isArray(items)) {
          return items.map((t: any) => ({
            id: t.id,
            trackingNumber: t.trackingNumber || `TRK-${t.id.slice(-6)}`,
            recipientName: t.recipientName || 'Customer',
            recipientPhone: t.recipientPhone || 'N/A',
            destinationAddress: t.destinationAddress || 'Address on file',
            status: t.status || 'DISPATCHED',
            codAmount: Number(t.codAmount || 0),
            paymentMethod: t.paymentMethod || 'PAID_KHQR'
          }));
        }
        return [];
      } catch {
        return [];
      }
    },
    refetchInterval: 3000 // Real-time 3-second auto-poll for new store checkouts
  });

  useEffect(() => {
    if (serverTasks) {
      setDeliveries(serverTasks);
      setSelectedTask((current) => {
        if (!current) return null;
        return serverTasks.find((t) => t.id === current.id) || current;
      });
    }
  }, [serverTasks]);

  const activeDeliveries = deliveries;
  const remainingCount = deliveries.filter((d) => d.status !== 'DELIVERED').length;
  const completedCount = deliveries.filter((d) => d.status === 'DELIVERED').length;
  const progressPercent = deliveries.length > 0 ? Math.round((completedCount / deliveries.length) * 100) : 0;

  const updateStatus = async (id: string, newStatus: DeliveryTask['status']) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/delivery/tasks/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!res.ok) {
        toast.error('Failed to update status on server');
        return;
      }
    } catch {
      toast.error('Network error, please try again');
      return;
    }
    
    setDeliveries((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: newStatus } : d))
    );
    if (selectedTask?.id === id) {
      setSelectedTask((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    refetch();
    toast.success(`Package status updated to ${newStatus}`);
  };

  const handleCompleteDelivery = async () => {
    if (!selectedTask) return;
    if (!signatureName.trim()) {
      toast.error('Recipient signature / name required for POD');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/delivery/tasks/${selectedTask.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DELIVERED', proofOfDelivery: signatureName })
      });
      if (!res.ok) {
        toast.error('Failed to complete delivery on backend');
        return;
      }
    } catch {
      // offline
    }

    setDeliveries((prev) =>
      prev.map((d) => (d.id === selectedTask.id ? { ...d, status: 'DELIVERED' } : d))
    );
    setSelectedTask((prev) => (prev ? { ...prev, status: 'DELIVERED' } : null));

    setIsPodOpen(false);
    setSignatureName('');
    toast.success('🎉 Proof of Delivery (POD) synced to Data Center!');
    refetch();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans select-none flex flex-col">
      <Toaster position="top-right" richColors />

      {/* Driver Status Header with Live Telemetry */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-40">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              {activeDriver ? (
                <>
                  <div className="flex items-center gap-2">
                    {drivers && drivers.length > 1 ? (
                      <select
                        value={activeDriver.id}
                        onChange={(e) => setSelectedDriverId(e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-white text-xs font-bold rounded-lg px-2 py-0.5 focus:outline-none focus:border-blue-500"
                      >
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.vehicleType})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <h1 className="text-sm font-bold text-white tracking-wide">{activeDriver.name}</h1>
                    )}
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold">
                      {activeDriver.vehicleType}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <span>{activeDriver.licensePlate}</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-mono">Battery: {activeDriver.batteryLevel}%</span>
                  </p>
                </>
              ) : (
                <div>
                  <h1 className="text-sm font-bold text-white tracking-wide">Fleet Dispatch</h1>
                  <p className="text-[11px] text-slate-400">Connecting to courier telemetry...</p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => { refetch(); toast.info('Refreshed dispatch queue'); }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Refresh Queue"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Courier App Body */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col space-y-4">
        {/* Active Route Summary */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/40 via-slate-900 to-slate-900 border border-blue-900/30">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5" /> Active Phnom Penh Route
            </span>
            <span className="text-xs font-mono text-emerald-400 font-bold">
              {remainingCount} Active • {deliveries.length} Total
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(5, progressPercent)}%` }}
            ></div>
          </div>
        </div>

        {/* Task Cards & Empty State */}
        {isTasksLoading ? (
          <div className="space-y-3 my-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1.5 w-2/3">
                    <div className="w-20 h-4 bg-slate-800 rounded"></div>
                    <div className="w-32 h-5 bg-slate-800 rounded"></div>
                  </div>
                  <div className="w-16 h-5 bg-slate-800/80 rounded-full"></div>
                </div>
                <div className="space-y-1.5 pt-1">
                  <div className="w-48 h-3.5 bg-slate-800/60 rounded"></div>
                  <div className="w-28 h-3.5 bg-slate-800/60 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : activeDeliveries.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 my-4">
            <Package className="w-10 h-10 text-slate-600 mx-auto mb-3 animate-pulse" />
            <h3 className="text-sm font-bold text-white mb-1">Queue is Empty</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mb-4">
              All deliveries completed or waiting for incoming customer orders from online storefront.
            </p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Check for New Orders
            </button>
          </div>
        ) : (
          <div className="space-y-3">
          {activeDeliveries.map((task) => (
            <div
              key={task.id}
              onClick={() => setSelectedTask(task)}
              className={`p-4 rounded-2xl border transition cursor-pointer ${
                selectedTask?.id === task.id
                  ? 'bg-blue-950/20 border-blue-500 shadow-lg shadow-blue-500/10'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                    {task.trackingNumber}
                  </span>
                  <h3 className="text-sm font-bold text-white mt-1.5">{task.recipientName}</h3>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    task.status === 'DELIVERED'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : task.status === 'IN_TRANSIT'
                      ? 'bg-blue-500/20 text-blue-400'
                      : task.status === 'DISPATCHED'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-purple-500/20 text-purple-400'
                  }`}
                >
                  {task.status}
                </span>
              </div>

              <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-3">
                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">{task.destinationAddress}</span>
              </p>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 font-mono">
                  {task.codAmount > 0 ? (
                    <span className="text-amber-400 font-bold">Collect COD: ${task.codAmount.toFixed(2)}</span>
                  ) : (
                    <span className="text-emerald-400 font-bold">Prepaid via KHQR</span>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </div>
            </div>
          ))}
        </div>
        )}
      </main>

      {/* Selected Task Action Bar */}
      {selectedTask && (
        <div className="bg-slate-900 border-t border-slate-800 p-4 sticky bottom-0 z-40 max-w-md w-full mx-auto">
          <div className="flex gap-2">
            <a
              href={`tel:${selectedTask.recipientPhone}`}
              className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-xs font-bold transition"
              title="Call Recipient"
            >
              <Phone className="w-4 h-4" />
            </a>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(selectedTask.destinationAddress)}`}
              target="_blank"
              rel="noreferrer"
              className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-xs font-bold transition"
              title="Open GPS Navigation"
            >
              <Navigation className="w-4 h-4" />
            </a>

            {selectedTask.status === 'PENDING' && (
              <button
                onClick={() => updateStatus(selectedTask.id, 'DISPATCHED')}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition"
              >
                <Truck className="w-4 h-4" />
                Accept & Dispatch
              </button>
            )}

            {selectedTask.status === 'DISPATCHED' && (
              <button
                onClick={() => updateStatus(selectedTask.id, 'IN_TRANSIT')}
                className="flex-1 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20 transition"
              >
                <Navigation className="w-4 h-4" />
                Start Delivery Route
              </button>
            )}

            {selectedTask.status === 'IN_TRANSIT' && (
              <button
                onClick={() => setIsPodOpen(true)}
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition"
              >
                <FileSignature className="w-4 h-4" />
                Complete Delivery & Sign POD
              </button>
            )}

            {selectedTask.status === 'DELIVERED' && (
              <div className="flex-1 py-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Delivery Completed
              </div>
            )}
          </div>
        </div>
      )}

      {/* Proof of Delivery (POD) Modal */}
      {isPodOpen && selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-blue-400" />
                Proof of Delivery (POD)
              </h3>
              <button
                onClick={() => setIsPodOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">Recipient Name / Signature</span>
                <input
                  type="text"
                  placeholder="Enter full name of signer..."
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-blue-500"
                />
              </div>

              {selectedTask.codAmount > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
                  <p className="font-bold">⚠️ Cash Collection Required</p>
                  <p className="text-[11px] mt-0.5">
                    Please collect <span className="font-bold font-mono">${selectedTask.codAmount.toFixed(2)}</span> cash before handing over package.
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handleCompleteDelivery}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-emerald-500/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirm Delivery & Sign
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
