import React, { useState } from 'react';
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

const SAMPLE_DELIVERIES: DeliveryTask[] = [
  {
    id: 'd1',
    trackingNumber: 'TRK-2026-001928',
    recipientName: 'Sokha Chem',
    recipientPhone: '012 444 555',
    destinationAddress: 'Street 310, BKK1, Phnom Penh',
    status: 'IN_TRANSIT',
    codAmount: 18.50,
    paymentMethod: 'CASH_ON_DELIVERY',
  },
  {
    id: 'd2',
    trackingNumber: 'TRK-2026-001929',
    recipientName: 'Dara Pich',
    recipientPhone: '098 777 666',
    destinationAddress: 'Building 4B, Russian Market, Toul Tompoung',
    status: 'DISPATCHED',
    codAmount: 0.0,
    paymentMethod: 'PAID_KHQR',
  },
  {
    id: 'd3',
    trackingNumber: 'TRK-2026-001930',
    recipientName: 'Vannak Lim',
    recipientPhone: '087 111 222',
    destinationAddress: 'Street 51, Daun Penh, Phnom Penh',
    status: 'DISPATCHED',
    codAmount: 42.00,
    paymentMethod: 'CASH_ON_DELIVERY',
  },
];

export function App() {
  const [dutyStatus, setDutyStatus] = useState<'ON_DUTY' | 'ON_BREAK' | 'OFF_DUTY'>('ON_DUTY');
  const [tasks, setTasks] = useState<DeliveryTask[]>(SAMPLE_DELIVERIES);
  const [activeTask, setActiveTask] = useState<DeliveryTask | null>(null);
  const [podSignature, setPodSignature] = useState('');
  const [podNotes, setPodNotes] = useState('');

  const activeTasks = tasks.filter((t) => t.status !== 'DELIVERED');
  const completedTasks = tasks.filter((t) => t.status === 'DELIVERED');
  const totalCod = activeTasks.reduce((sum, t) => sum + (t.paymentMethod === 'CASH_ON_DELIVERY' ? t.codAmount : 0), 0);

  const startRoute = (id: string) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, status: 'IN_TRANSIT' } : t)));
    toast.info('Route started! GPS telemetry ping active.');
  };

  const completeDelivery = () => {
    if (!activeTask) return;
    setTasks(tasks.map((t) => (t.id === activeTask.id ? { ...t, status: 'DELIVERED' } : t)));
    toast.success(`Delivered package ${activeTask.trackingNumber}`);
    setActiveTask(null);
    setPodSignature('');
    setPodNotes('');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col max-w-md mx-auto shadow-2xl border-x border-slate-800">
      <Toaster position="top-center" richColors closeButton />

      {/* ─── Mobile Driver App Header ─── */}
      <header className="p-4 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md sticky top-0 z-30 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight">Driver Express</h1>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md font-mono">
                  delivery.camtech.cam
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Motorcycle Courier #PP-8492 • Spec §233</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
            <Battery className="w-4 h-4" /> 94%
          </div>
        </div>

        {/* Status Switcher */}
        <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-medium">
          {(['ON_DUTY', 'ON_BREAK', 'OFF_DUTY'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setDutyStatus(st)}
              className={`py-1.5 rounded-lg transition-all text-center ${
                dutyStatus === st
                  ? st === 'ON_DUTY'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st === 'ON_DUTY' ? '🟢 Active' : st === 'ON_BREAK' ? '☕ Break' : '⚪ Offline'}
            </button>
          ))}
        </div>
      </header>

      {/* ─── Route Summary Metrics ─── */}
      <section className="p-4 grid grid-cols-3 gap-2 bg-slate-900/40 border-b border-slate-800/80">
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
          <span className="text-[10px] text-slate-400 font-medium block">Stops Left</span>
          <span className="text-lg font-black text-sky-400">{activeTasks.length}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
          <span className="text-[10px] text-slate-400 font-medium block">Delivered</span>
          <span className="text-lg font-black text-emerald-400">{completedTasks.length}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
          <span className="text-[10px] text-slate-400 font-medium block">COD to Collect</span>
          <span className="text-lg font-black text-amber-400">${totalCod.toFixed(2)}</span>
        </div>
      </section>

      {/* ─── Tasks List ─── */}
      <main className="flex-1 p-4 space-y-3 overflow-y-auto">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
          <span>Today's Delivery Queue</span>
          <span>{activeTasks.length} Active</span>
        </div>

        {activeTasks.length === 0 ? (
          <div className="text-center py-16 px-4 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
            <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-200">All Deliveries Complete!</h3>
            <p className="text-xs text-slate-400 mt-1">Stand by for new dispatch assignments.</p>
          </div>
        ) : (
          activeTasks.map((t, idx) => (
            <div
              key={t.id}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-md space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-200">{t.trackingNumber}</span>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1">{t.recipientName}</h4>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    t.status === 'IN_TRANSIT'
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {t.status === 'IN_TRANSIT' ? 'On The Way' : 'Dispatched'}
                </span>
              </div>

              <div className="flex items-start gap-2 text-xs text-slate-300">
                <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="line-clamp-2 leading-relaxed">{t.destinationAddress}</p>
              </div>

              {t.paymentMethod === 'CASH_ON_DELIVERY' && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" /> Cash on Delivery (COD)
                  </span>
                  <span>${t.codAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 pt-1">
                <a
                  href={`tel:${t.recipientPhone}`}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" /> Call
                </a>

                {t.status === 'DISPATCHED' ? (
                  <button
                    onClick={() => startRoute(t.id)}
                    className="col-span-2 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Navigation className="w-3.5 h-3.5" /> Start Route
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveTask(t)}
                    className="col-span-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50"
                  >
                    <FileSignature className="w-3.5 h-3.5" /> Deliver & POD
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </main>

      {/* ─── POD Signature Modal ─── */}
      {activeTask && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Confirm Proof of Delivery
              </h3>
              <button onClick={() => setActiveTask(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 block">Recipient</span>
              <p className="font-bold text-slate-200">{activeTask.recipientName}</p>
              {activeTask.paymentMethod === 'CASH_ON_DELIVERY' && (
                <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between text-amber-400 font-bold">
                  <span>COD Cash to Collect:</span>
                  <span>${activeTask.codAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div>
              <label className="text-slate-300 block mb-1">Recipient Name / Signature Confirmation</label>
              <input
                placeholder="e.g. Received by Sokha Chem"
                value={podSignature}
                onChange={(e) => setPodSignature(e.target.value)}
                className="w-full h-9 rounded-xl bg-slate-950 border border-slate-800 px-3 text-slate-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-slate-300 block mb-1">Delivery Notes (Optional)</label>
              <input
                placeholder="e.g. Left with reception security"
                value={podNotes}
                onChange={(e) => setPodNotes(e.target.value)}
                className="w-full h-9 rounded-xl bg-slate-950 border border-slate-800 px-3 text-slate-100 focus:outline-none"
              />
            </div>

            <button
              onClick={completeDelivery}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg"
            >
              Complete Delivery & Settle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
