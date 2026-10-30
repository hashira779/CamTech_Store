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
    (selectedOrder.items?.length ?? 0) > 0 &&
    (selectedOrder.items ?? []).every((it) => checkedItems[it.id]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner with Real-Time Alert Status */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-lg bg-gradient-to-r from-warning/40 via-zinc-900 to-zinc-900 border border-warning/20 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-warning/10 text-warning border border-warning/30">
            <Boxes className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                Warehouse Stocker • Picking & Packing Console
              </h1>
              {pendingOrders.length > 0 && (
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-warning"></span>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
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
                ? 'bg-warning/10 text-warning border-warning/30'
                : 'bg-muted text-muted-foreground border-border'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            {soundEnabled ? 'Chime Active' : 'Muted'}
          </button>

          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['wms-picking-orders'] })}
            variant="outline"
            size="sm"
            className="text-xs bg-muted hover:bg-muted border-border text-foreground"
          >
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-card border border-border shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground font-medium">To Pick (Pending)</span>
            <p className="text-2xl font-bold text-warning mt-1">{pendingOrders.length}</p>
          </div>
          <div className="p-3 rounded-lg bg-warning/10 text-warning border border-warning/20">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-lg bg-card border border-border shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground font-medium">Picked & Handed to Courier</span>
            <p className="text-2xl font-bold text-success mt-1">{pickedOrders.length}</p>
          </div>
          <div className="p-3 rounded-lg bg-success/10 text-success border border-success/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-lg bg-card border border-border shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground font-medium">Total Orders Today</span>
            <p className="text-2xl font-bold text-info mt-1">{orders.length}</p>
          </div>
          <div className="p-3 rounded-lg bg-info/10 text-info border border-info/20">
            <Package className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-card p-1 rounded-lg border border-border w-full sm:w-auto">
          <button
            onClick={() => setFilter('PENDING')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === 'PENDING'
                ? 'bg-warning text-foreground shadow-sm font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Pending Picking ({pendingOrders.length})
          </button>
          <button
            onClick={() => setFilter('PICKED')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === 'PICKED'
                ? 'bg-muted text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Picked & Boxed ({pickedOrders.length})
          </button>
          <button
            onClick={() => setFilter('ALL')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === 'ALL'
                ? 'bg-muted text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Orders ({orders.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order #, customer, address..."
            className="pl-9 bg-card border-border text-xs text-foreground placeholder:text-muted-foreground rounded-lg"
          />
        </div>
      </div>

      {/* Orders Grid */}
      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Synchronizing warehouse orders...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-20 p-6 bg-card/40 rounded-lg border border-dashed border-border space-y-2">
          <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto" />
          <h3 className="text-base font-semibold text-foreground">No Orders in this Queue</h3>
          <p className="text-xs text-muted-foreground">
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
                className={`p-5 rounded-lg border transition-all flex flex-col justify-between space-y-4 ${
                  isPending
                    ? 'bg-card border-warning/30 hover:border-warning/50 shadow-md'
                    : 'bg-card/60 border-border hover:border-border'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-warning">{order.saleNumber}</span>
                      <h4 className="text-sm font-bold text-foreground mt-0.5">{order.customerName}</h4>
                    </div>
                    <Badge
                      className={`text-[10px] font-semibold ${
                        isPending
                          ? 'bg-warning/10 text-warning border-warning/20 animate-pulse'
                          : 'bg-success/10 text-success border-success/20'
                      }`}
                    >
                      {isPending ? 'To Pick' : 'Picked & Ready'}
                    </Badge>
                  </div>

                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                    <p className="line-clamp-2">{order.deliveryAddress || 'Central Store, Phnom Penh'}</p>
                  </div>

                  {/* Items Preview */}
                  <div className="p-2.5 rounded-lg bg-card border border-border/80 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Items to Assemble ({order.itemCount})
                    </span>
                    {(order.items ?? []).slice(0, 3).map((it) => (
                      <div key={it.id} className="flex items-center justify-between text-xs text-foreground">
                        <span className="truncate pr-2 font-medium">
                          {it.quantity}x {it.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                          {it.zone} • {it.bin}
                        </span>
                      </div>
                    ))}
                    {(order.items?.length ?? 0) > 3 && (
                      <span className="text-[10px] text-muted-foreground block pt-1">
                        +{(order.items?.length ?? 0) - 3} more items...
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-border/80 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  {isPending ? (
                    <Button
                      onClick={() => {
                        setSelectedOrder(order);
                        setCheckedItems({});
                      }}
                      className="bg-warning hover:bg-warning text-foreground font-bold text-xs rounded-lg shadow-sm"
                    >
                      Open Picking Checklist
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setSelectedOrder(order);
                        const allChecked: Record<string, boolean> = {};
                        (order.items ?? []).forEach((it) => (allChecked[it.id] = true));
                        setCheckedItems(allChecked);
                      }}
                      variant="outline"
                      className="border-border hover:bg-muted text-foreground text-xs rounded-lg"
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
        <DialogContent className="bg-card border-border text-foreground max-w-lg rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <span>Picking Checklist: {selectedOrder?.saleNumber}</span>
              <Badge
                className={`text-[10px] ${
                  selectedOrder?.wmsStatus === 'PENDING_PICKING'
                    ? 'bg-warning/10 text-warning border-warning/20'
                    : 'bg-success/10 text-success border-success/20'
                }`}
              >
                {selectedOrder?.wmsStatus === 'PENDING_PICKING' ? 'Pending Pick' : 'Completed'}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Customer: <strong className="text-foreground">{selectedOrder?.customerName}</strong> • Phone: {selectedOrder?.customerPhone || 'N/A'}
              <br />
              Delivery To: <span className="text-foreground">{selectedOrder?.deliveryAddress}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground pb-1 border-b border-border">
              <span>Item Description & Location</span>
              <span>Checked</span>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {(selectedOrder?.items ?? []).map((it) => {
                const isChecked = Boolean(checkedItems[it.id]);
                return (
                  <div
                    key={it.id}
                    onClick={() => selectedOrder?.wmsStatus === 'PENDING_PICKING' && toggleItemCheck(it.id)}
                    className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition ${
                      isChecked
                        ? 'bg-success/20 border-success/30'
                        : 'bg-card border-border hover:border-border'
                    }`}
                  >
                    <div>
                      <h5 className={`text-xs font-bold ${isChecked ? 'text-success line-through' : 'text-foreground'}`}>
                        {it.quantity}x {it.name}
                      </h5>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{it.sku}</span>
                        <span className="text-warning font-semibold">{it.zone}</span>
                        <span>•</span>
                        <span className="text-foreground">{it.bin}</span>
                      </div>
                    </div>

                    <div>
                      {isChecked ? (
                        <CheckSquare className="w-5 h-5 text-success" />
                      ) : (
                        <Square className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedOrder?.wmsStatus === 'PENDING_PICKING' && (
              <div className="space-y-1.5 pt-2">
                <label className="text-[11px] font-semibold text-muted-foreground">Packaging Notes / Special Instructions</label>
                <Input
                  value={packingNotes}
                  onChange={(e) => setPackingNotes(e.target.value)}
                  placeholder="e.g. Fragile package boxed, placed on Shelf 2 for Express Courier"
                  className="bg-card border-border text-xs text-foreground"
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-border/80 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedOrder(null)}
              className="border-border text-foreground text-xs rounded-lg"
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
                className="bg-success hover:bg-success text-success-foreground font-bold text-xs rounded-lg shadow-lg flex items-center gap-1.5"
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
