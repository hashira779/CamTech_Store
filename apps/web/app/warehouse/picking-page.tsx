'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import type { PickingOrderDto } from '@mystore/contracts';
import {
  Boxes,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  Search,
  CheckSquare,
  Square,
  Truck,
  BellRing,
  Volume2,
  VolumeX,
  AlertTriangle,
  Layers,
  ArrowRight,
  ShieldCheck,
  Send,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12); // E5
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24); // G5
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Ignore autoplay restriction before user gesture
  }
}

export function PickingPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PICKED'>('PENDING');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<PickingOrderDto | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [packingNotes, setPackingNotes] = useState('');

  const prevPendingCountRef = useRef<number>(0);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['wms-picking-orders'],
    queryFn: () => api.listPickingOrders(token!),
    enabled: Boolean(token),
    refetchInterval: 5000,
  });

  const pendingOrders = orders.filter((o) => o.wmsStatus === 'PENDING_PICKING');
  const pickedOrders = orders.filter((o) => o.wmsStatus === 'PICKED');

  // Audio alert on incoming new order
  useEffect(() => {
    if (pendingOrders.length > prevPendingCountRef.current && prevPendingCountRef.current > 0) {
      if (soundEnabled) {
        playChime();
      }
      toast.info(`🔔 New Customer Order arrived! (${pendingOrders.length} to pick)`, {
        description: `Order #${pendingOrders[0]?.saleNumber || ''} is ready for picking.`,
      });
    }
    prevPendingCountRef.current = pendingOrders.length;
  }, [pendingOrders.length, soundEnabled]);

  // Fulfill mutation
  const fulfillMutation = useMutation({
    mutationFn: ({ saleId, notes }: { saleId: string; notes?: string }) =>
      api.fulfillPickingOrder(token!, saleId, { notes, packerName: user?.name || 'Warehouse Stocker' }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['wms-picking-orders'] });
      setSelectedOrder(null);
      setCheckedItems({});
      setPackingNotes('');
      toast.success(`📦 Order #${updated.saleNumber} marked Picked & Packed!`, {
        description: 'Delivery couriers have been notified that parcel is waiting at dispatch bay.',
      });
    },
    onError: (err: any) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to complete picking');
    },
  });

  const toggleItemCheck = (itemId: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === 'PENDING' && o.wmsStatus !== 'PENDING_PICKING') return false;
    if (filter === 'PICKED' && o.wmsStatus !== 'PICKED') return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.saleNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.deliveryAddress && o.deliveryAddress.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const allSelectedItemsChecked =
    selectedOrder &&
    selectedOrder.items.length > 0 &&
    selectedOrder.items.every((it) => checkedItems[it.id]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner with Real-Time Alert Status */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-zinc-900 to-zinc-900 border border-amber-500/20 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Boxes className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                Warehouse Stocker • Picking & Packing Console
              </h1>
              {pendingOrders.length > 0 && (
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Live customer orders synchronized from storefront checkout. Pick items from shelves and hand over to delivery couriers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) playChime();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              soundEnabled
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            {soundEnabled ? 'Chime Active' : 'Muted'}
          </button>

          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['wms-picking-orders'] })}
            variant="outline"
            size="sm"
            className="text-xs bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200"
          >
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-400 font-medium">To Pick (Pending)</span>
            <p className="text-2xl font-black text-amber-400 mt-1">{pendingOrders.length}</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-400 font-medium">Picked & Handed to Courier</span>
            <p className="text-2xl font-black text-emerald-400 mt-1">{pickedOrders.length}</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-400 font-medium">Total Orders Today</span>
            <p className="text-2xl font-black text-sky-400 mt-1">{orders.length}</p>
          </div>
          <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Package className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-800 w-full sm:w-auto">
          <button
            onClick={() => setFilter('PENDING')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === 'PENDING'
                ? 'bg-amber-500 text-zinc-950 shadow-sm font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Pending Picking ({pendingOrders.length})
          </button>
          <button
            onClick={() => setFilter('PICKED')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === 'PICKED'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Picked & Boxed ({pickedOrders.length})
          </button>
          <button
            onClick={() => setFilter('ALL')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === 'ALL'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All Orders ({orders.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order #, customer, address..."
            className="pl-9 bg-zinc-900 border-zinc-800 text-xs text-white placeholder:text-zinc-500 rounded-xl"
          />
        </div>
      </div>

      {/* Orders Grid */}
      {isLoading ? (
        <div className="text-center py-16 text-zinc-500 text-sm">Synchronizing warehouse orders...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-20 p-6 bg-zinc-900/40 rounded-2xl border border-dashed border-zinc-800 space-y-2">
          <CheckCircle2 className="w-12 h-12 text-zinc-600 mx-auto" />
          <h3 className="text-base font-semibold text-zinc-300">No Orders in this Queue</h3>
          <p className="text-xs text-zinc-500">
            {filter === 'PENDING'
              ? 'Great work! All customer orders are picked and packaged.'
              : 'No orders match your filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => {
            const isPending = order.wmsStatus === 'PENDING_PICKING';
            return (
              <div
                key={order.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                  isPending
                    ? 'bg-zinc-900 border-amber-500/30 hover:border-amber-500/50 shadow-md'
                    : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-amber-400">{order.saleNumber}</span>
                      <h4 className="text-sm font-bold text-white mt-0.5">{order.customerName}</h4>
                    </div>
                    <Badge
                      className={`text-[10px] font-semibold ${
                        isPending
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}
                    >
                      {isPending ? 'To Pick' : 'Picked & Ready'}
                    </Badge>
                  </div>

                  <div className="flex items-start gap-2 text-xs text-zinc-400">
                    <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <p className="line-clamp-2">{order.deliveryAddress || 'Central Store, Phnom Penh'}</p>
                  </div>

                  {/* Items Preview */}
                  <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                      Items to Assemble ({order.itemCount})
                    </span>
                    {order.items.slice(0, 3).map((it) => (
                      <div key={it.id} className="flex items-center justify-between text-xs text-zinc-300">
                        <span className="truncate pr-2 font-medium">
                          {it.quantity}x {it.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0">
                          {it.zone} • {it.bin}
                        </span>
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <span className="text-[10px] text-zinc-500 block pt-1">
                        +{order.items.length - 3} more items...
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-zinc-500">
                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  {isPending ? (
                    <Button
                      onClick={() => {
                        setSelectedOrder(order);
                        setCheckedItems({});
                      }}
                      className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl shadow-sm"
                    >
                      Open Picking Checklist
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setSelectedOrder(order);
                        const allChecked: Record<string, boolean> = {};
                        order.items.forEach((it) => (allChecked[it.id] = true));
                        setCheckedItems(allChecked);
                      }}
                      variant="outline"
                      className="border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-xs rounded-xl"
                    >
                      View Details
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Picking Checklist Modal */}
      <Dialog open={Boolean(selectedOrder)} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <span>Picking Checklist: {selectedOrder?.saleNumber}</span>
              <Badge
                className={`text-[10px] ${
                  selectedOrder?.wmsStatus === 'PENDING_PICKING'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}
              >
                {selectedOrder?.wmsStatus === 'PENDING_PICKING' ? 'Pending Pick' : 'Completed'}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Customer: <strong className="text-zinc-200">{selectedOrder?.customerName}</strong> • Phone: {selectedOrder?.customerPhone || 'N/A'}
              <br />
              Delivery To: <span className="text-zinc-300">{selectedOrder?.deliveryAddress}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-2">
            <div className="flex items-center justify-between text-xs text-zinc-400 pb-1 border-b border-zinc-800">
              <span>Item Description & Location</span>
              <span>Checked</span>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {selectedOrder?.items.map((it) => {
                const isChecked = Boolean(checkedItems[it.id]);
                return (
                  <div
                    key={it.id}
                    onClick={() => selectedOrder.wmsStatus === 'PENDING_PICKING' && toggleItemCheck(it.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      isChecked
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <h5 className={`text-xs font-bold ${isChecked ? 'text-emerald-300 line-through' : 'text-white'}`}>
                        {it.quantity}x {it.name}
                      </h5>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
                        <span className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded">{it.sku}</span>
                        <span className="text-amber-400 font-semibold">{it.zone}</span>
                        <span>•</span>
                        <span className="text-zinc-300">{it.bin}</span>
                      </div>
                    </div>

                    <div>
                      {isChecked ? (
                        <CheckSquare className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Square className="w-5 h-5 text-zinc-600" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedOrder?.wmsStatus === 'PENDING_PICKING' && (
              <div className="space-y-1.5 pt-2">
                <label className="text-[11px] font-semibold text-zinc-400">Packaging Notes / Special Instructions</label>
                <Input
                  value={packingNotes}
                  onChange={(e) => setPackingNotes(e.target.value)}
                  placeholder="e.g. Fragile package boxed, placed on Shelf 2 for Express Courier"
                  className="bg-zinc-950 border-zinc-800 text-xs text-white"
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-zinc-800/80 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedOrder(null)}
              className="border-zinc-700 text-zinc-300 text-xs rounded-xl"
            >
              Close
            </Button>

            {selectedOrder?.wmsStatus === 'PENDING_PICKING' && (
              <Button
                disabled={fulfillMutation.isPending || !allSelectedItemsChecked}
                onClick={() =>
                  selectedOrder &&
                  fulfillMutation.mutate({ saleId: selectedOrder.id, notes: packingNotes })
                }
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5"
              >
                <Truck className="w-4 h-4" />
                Mark Picked & Hand to Courier
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PickingPage;
