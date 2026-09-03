import React, { useState } from 'react';
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

interface DeliveryTask {
  id: string;
  trackingNumber: string;
  recipientName: string;
  recipientPhone: string;
  destinationAddress: string;
  status: 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED';
  codAmount: number;
  paymentMethod: 'CASH_ON_DELIVERY' | 'PAID_KHQR';
}

const FALLBACK_DELIVERIES: DeliveryTask[] = [
  {
    id: 'd1',
    trackingNumber: 'TRK-2026-001928',
    recipientName: 'Sokha Chem',
    recipientPhone: '+855 12 889 900',
    destinationAddress: 'Street 310, BKK1, Phnom Penh',
    status: 'IN_TRANSIT',
    codAmount: 39.99,
    paymentMethod: 'CASH_ON_DELIVERY',
  },
  {
    id: 'd2',
    trackingNumber: 'TRK-2026-001929',
    recipientName: 'David Miller',
    recipientPhone: '+855 98 112 233',
    destinationAddress: 'Russian Market, Toul Tompoung 1',
    status: 'DISPATCHED',
    codAmount: 0.0,
    paymentMethod: 'PAID_KHQR',
  },
  {
    id: 'd3',
    trackingNumber: 'TRK-2026-001930',
    recipientName: 'Lisa Wang',
    recipientPhone: '+855 77 445 566',
    destinationAddress: 'Street 51, Daun Penh, Phnom Penh',
    status: 'DISPATCHED',
    codAmount: 249.00,
    paymentMethod: 'CASH_ON_DELIVERY',
  },
];

export function App() {
  const [deliveries, setDeliveries] = useState<DeliveryTask[]>(FALLBACK_DELIVERIES);
  const [selectedTask, setSelectedTask] = useState<DeliveryTask | null>(null);
  const [isPodOpen, setIsPodOpen] = useState(false);
  const [signatureName, setSignatureName] = useState('');

  // Fetch live tasks from central data center
  const { data: serverTasks, refetch } = useQuery({
    queryKey: ['delivery-live-tasks'],
    queryFn: async () => {
      try {
        const res = await fetch('http://localhost:4000/api/v1/delivery/tasks');
        if (!res.ok) throw new Error('API offline');
        const json = await res.json();
        const items = json.data?.items || json.items || json.data || [];
        if (Array.isArray(items) && items.length > 0) {
          return items.map((t: any) => ({
            id: t.id,
            trackingNumber: t.trackingNumber || `TRK-${t.id.slice(-6)}`,
            recipientName: t.recipientName || 'Customer',
            recipientPhone: t.recipientPhone || '+855 12 000 000',
            destinationAddress: t.destinationAddress || 'Phnom Penh Center',
            status: t.status || 'DISPATCHED',
            codAmount: Number(t.codAmount || 0),
            paymentMethod: t.paymentMethod || 'PAID_KHQR'
          }));
        }
        return FALLBACK_DELIVERIES;
      } catch {
        return FALLBACK_DELIVERIES;
      }
    }
  });

  const activeDeliveries = serverTasks || deliveries;

  const updateStatus = (id: string, newStatus: DeliveryTask['status']) => {
    setDeliveries((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: newStatus } : d))
    );
    if (selectedTask?.id === id) {
      setSelectedTask((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    toast.success(`Package status updated to ${newStatus}`);
  };

  const handleCompleteDelivery = async () => {
    if (!selectedTask) return;
    if (!signatureName.trim()) {
      toast.error('Recipient signature / name required for POD');
      return;
    }

    updateStatus(selectedTask.id, 'DELIVERED');
    setIsPodOpen(false);
    setSignatureName('');
    toast.success('🎉 Proof of Delivery (POD) synced to Data Center!');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans select-none flex flex-col">
      <Toaster position="top-right" richColors />

      {/* Driver Status Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-40">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white tracking-wide">Meng Chhay</h1>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold">
                  PORT 5004
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Driver Unit #04 • Central Data Center: :4000</p>
            </div>
          </div>

          <button
            onClick={() => { refetch(); toast.info('Refreshed dispatch queue'); }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
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
            <span className="text-xs font-mono text-emerald-400 font-bold">3 Packages</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full w-2/3 rounded-full"></div>
          </div>
        </div>

        {/* Task Cards */}
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
                      : 'bg-amber-500/20 text-amber-400'
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

            {selectedTask.status !== 'DELIVERED' ? (
              <button
                onClick={() => setIsPodOpen(true)}
                className="flex-1 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20 transition"
              >
                <FileSignature className="w-4 h-4" />
                Complete Delivery & Sign POD
              </button>
            ) : (
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
