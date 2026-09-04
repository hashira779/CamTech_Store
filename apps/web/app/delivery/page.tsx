'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import { PageHeader } from '@/components/page-header';
import { KpiCard } from '@/components/kpi-card';
import { LiveMap } from '@/components/delivery/live-map';
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
import {
  Truck,
  Bike,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  Navigation,
  DollarSign,
  UserCheck,
  AlertTriangle,
  Play,
  Pause,
  Layers,
  Send,
} from 'lucide-react';
import type {
  DeliveryOrderDto,
  DeliveryDriverDto,
  CreateDeliveryOrderInput,
  CreateDriverInput,
  DeliveryStatus,
} from '@mystore/contracts';

const STATUS_BADGES: Record<DeliveryStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pending Dispatch', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  DISPATCHED: { label: 'Dispatched', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  IN_TRANSIT: { label: 'In Transit', className: 'bg-sky-500/10 text-sky-400 border-sky-500/20 animate-pulse' },
  DELIVERED: { label: 'Delivered', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  FAILED: { label: 'Failed', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  CANCELLED: { label: 'Cancelled', className: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  RETURNED: { label: 'Returned', className: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
};

export function DeliveryPage() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Modals
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [createDriverOpen, setCreateDriverOpen] = useState(false);
  const [assignDriverOpen, setAssignDriverOpen] = useState(false);
  const [podOpen, setPodOpen] = useState(false);
  const [activeOrderForAction, setActiveOrderForAction] = useState<DeliveryOrderDto | null>(null);

  // Form states
  const [orderForm, setOrderForm] = useState<CreateDeliveryOrderInput>({
    recipientName: '',
    recipientPhone: '',
    deliveryAddress: '',
    destLat: 11.5500,
    destLng: 104.9200,
    codAmount: 0,
    deliveryFee: 2.50,
    notes: '',
  });

  const [driverForm, setDriverForm] = useState<CreateDriverInput>({
    name: '',
    phone: '',
    vehicleType: 'MOTORCYCLE',
    licensePlate: '',
    initialLat: 11.5564,
    initialLng: 104.9282,
  });

  const [assignDriverId, setAssignDriverId] = useState<string>('');
  const [podNotes, setPodNotes] = useState<string>('');

  // ─── Queries ───
  const { data: orders = [], refetch: refetchOrders } = useQuery({
    queryKey: ['delivery-orders', statusFilter, search],
    queryFn: () =>
      api.listDeliveryOrders(token!, {
        status: statusFilter || undefined,
        search: search || undefined,
      }),
    enabled: Boolean(token),
    refetchInterval: 5000,
  });

  const { data: drivers = [], refetch: refetchDrivers } = useQuery({
    queryKey: ['delivery-drivers'],
    queryFn: () => api.listDrivers(token!),
    enabled: Boolean(token),
    refetchInterval: 5000,
  });

  // ─── Mutations ───
  const createOrderMutation = useMutation({
    mutationFn: (input: CreateDeliveryOrderInput) => api.createDeliveryOrder(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
      setCreateOrderOpen(false);
      setOrderForm({
        recipientName: '',
        recipientPhone: '',
        deliveryAddress: '',
        destLat: 11.5500,
        destLng: 104.9200,
        codAmount: 0,
        deliveryFee: 2.50,
        notes: '',
      });
    },
  });

  const createDriverMutation = useMutation({
    mutationFn: (input: CreateDriverInput) => api.createDriver(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-drivers'] });
      setCreateDriverOpen(false);
      setDriverForm({
        name: '',
        phone: '',
        vehicleType: 'MOTORCYCLE',
        licensePlate: '',
        initialLat: 11.5564,
        initialLng: 104.9282,
      });
    },
  });

  const assignDriverMutation = useMutation({
    mutationFn: ({ orderId, driverId }: { orderId: string; driverId: string }) =>
      api.assignDriver(token!, orderId, driverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-drivers'] });
      setAssignDriverOpen(false);
      setActiveOrderForAction(null);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({
      orderId,
      status,
      proofOfDelivery,
      notes,
    }: {
      orderId: string;
      status: string;
      proofOfDelivery?: string;
      notes?: string;
    }) =>
      api.updateDeliveryStatus(token!, orderId, { status, proofOfDelivery, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-drivers'] });
      setPodOpen(false);
      setActiveOrderForAction(null);
    },
  });

  // ─── Live GPS Telemetry Simulation ───
  useEffect(() => {
    if (!isSimulating || !token) return;

    const interval = setInterval(async () => {
      for (const drv of drivers) {
        if (drv.status === 'EN_ROUTE') {
          // Nudge coordinates slightly along path
          const latDelta = (Math.random() - 0.48) * 0.0015;
          const lngDelta = (Math.random() - 0.48) * 0.0015;
          const newLat = drv.currentLat + latDelta;
          const newLng = drv.currentLng + lngDelta;

          try {
            await api.pingDriverLocation(token, drv.id, {
              latitude: newLat,
              longitude: newLng,
              batteryLevel: Math.max(20, (drv.batteryLevel ?? 95) - 1),
            });
          } catch (e) {
            // ignore heartbeat errors in simulation
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ['delivery-drivers'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
    }, 3000);

    return () => clearInterval(interval);
  }, [isSimulating, drivers, token, queryClient]);

  // KPIs
  const activeOrders = orders.filter(
    (o) => o.status === 'DISPATCHED' || o.status === 'IN_TRANSIT'
  );
  const pendingOrders = orders.filter((o) => o.status === 'PENDING');
  const enRouteDrivers = drivers.filter((d) => d.status === 'EN_ROUTE');
  const totalCod = activeOrders.reduce((sum, o) => sum + o.codAmount, 0);

  return (
    <EnterpriseShell>
      <div className="space-y-6 pb-12">
        <PageHeader
          title="Delivery & Fleet Dispatch"
          description="Real-time order fulfillment, live GPS telemetry, and driver dispatch management"
        >
          <div className="flex items-center gap-2">
            <Button
              variant={isSimulating ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setIsSimulating((s) => !s)}
              className="gap-1.5 font-medium"
            >
              {isSimulating ? (
                <>
                  <Pause className="w-3.5 h-3.5" /> Stop Simulation
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> Simulate Live Movement
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateDriverOpen(true)}
              className="gap-1.5"
            >
              <Truck className="w-3.5 h-3.5" /> Add Driver
            </Button>
            <Button
              size="sm"
              onClick={() => setCreateOrderOpen(true)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" /> Create Delivery
            </Button>
          </div>
        </PageHeader>

        {/* ─── KPI Cards ─── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard
            title="Active Deliveries"
            value={activeOrders.length}
            icon={Navigation}
            change={12}
            changeLabel="vs last week"
          />
          <KpiCard
            title="Fleet Units En Route"
            value={`${enRouteDrivers.length} / ${drivers.length}`}
            icon={Truck}
            change={8}
            changeLabel="units active"
          />
          <KpiCard
            title="Active COD to Collect"
            value={`$${totalCod.toFixed(2)}`}
            icon={DollarSign}
          />
          <KpiCard
            title="Avg Transit Time"
            value="16.4 min"
            icon={Clock}
            change={-4}
            changeLabel="faster delivery"
          />
        </div>

        {/* ─── Super Live Map Section ─── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-wide text-foreground uppercase flex items-center gap-2">
              <Navigation className="w-4 h-4 text-sky-400" />
              Live Fleet Dispatch Canvas
            </h3>
            <span className="text-xs text-muted-foreground">
              Click any driver or delivery marker to inspect real-time telemetry
            </span>
          </div>

          <LiveMap
            drivers={drivers}
            orders={orders}
            selectedDriverId={selectedDriverId}
            selectedOrderId={selectedOrderId}
            onSelectDriver={(d) => setSelectedDriverId(d.id)}
            onSelectOrder={(o) => {
              setSelectedOrderId(o.id);
              if (o.driverId) setSelectedDriverId(o.driverId);
            }}
            isSimulating={isSimulating}
          />
        </div>

        {/* ─── Dispatch Queue & Fleet Status Tabs ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Orders Table */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <h3 className="text-sm font-semibold tracking-wide text-foreground uppercase">
                Dispatch Order Queue ({orders.length})
              </h3>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search tracking, recipient..."
                    className="pl-8 h-8 text-xs"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-hidden"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="DISPATCHED">Dispatched</option>
                  <option value="IN_TRANSIT">In Transit</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Order / Tracking</th>
                      <th className="py-3 px-4">Recipient</th>
                      <th className="py-3 px-4">Driver</th>
                      <th className="py-3 px-4">COD / Fee</th>
                      <th className="py-3 px-4">ETA / Dist</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-foreground font-sans">
                          No delivery orders found matching filter criteria.
                        </td>
                      </tr>
                    ) : (
                      orders.map((ord) => {
                        const isSelected = selectedOrderId === ord.id;
                        const statusConfig = STATUS_BADGES[ord.status] ?? STATUS_BADGES.PENDING;

                        return (
                          <tr
                            key={ord.id}
                            onClick={() => {
                              setSelectedOrderId(ord.id);
                              if (ord.driverId) setSelectedDriverId(ord.driverId);
                            }}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-sky-500/10' : 'hover:bg-muted/30'
                            }`}
                          >
                            <td className="py-3 px-4">
                              <span className="font-bold text-foreground text-xs font-mono">
                                {ord.trackingNumber}
                              </span>
                              <p className="text-[10px] text-muted-foreground font-sans line-clamp-1">
                                {ord.deliveryAddress}
                              </p>
                            </td>
                            <td className="py-3 px-4 font-sans">
                              <div className="font-medium text-foreground">{ord.recipientName}</div>
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5" />
                                {ord.recipientPhone}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-sans">
                              {ord.driverName ? (
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px]">
                                    {ord.driverVehicle === 'VAN' ? (
                                      <Truck className="w-3 h-3" />
                                    ) : (
                                      <Bike className="w-3 h-3" />
                                    )}
                                  </div>
                                  <span className="text-xs text-foreground">{ord.driverName}</span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-amber-500 italic">Unassigned</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-foreground">
                                ${ord.codAmount.toFixed(2)}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                +${ord.deliveryFee.toFixed(2)} fee
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {ord.etaMinutes ? (
                                <div>
                                  <span className="text-xs text-sky-400 font-bold">
                                    {ord.etaMinutes} min
                                  </span>
                                  <p className="text-[10px] text-muted-foreground">
                                    {ord.distanceKm?.toFixed(1)} km
                                  </p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline" className={`text-[10px] ${statusConfig.className}`}>
                                {statusConfig.label}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                {!ord.driverId && ord.status === 'PENDING' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px] px-2"
                                    onClick={() => {
                                      setActiveOrderForAction(ord);
                                      setAssignDriverOpen(true);
                                    }}
                                  >
                                    Assign
                                  </Button>
                                )}
                                {ord.status === 'DISPATCHED' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px] px-2 text-sky-400 border-sky-500/30"
                                    onClick={() =>
                                      updateStatusMutation.mutate({
                                        orderId: ord.id,
                                        status: 'IN_TRANSIT',
                                      })
                                    }
                                  >
                                    In Transit
                                  </Button>
                                )}
                                {ord.status === 'IN_TRANSIT' && (
                                  <Button
                                    size="sm"
                                    className="h-7 text-[11px] px-2 bg-emerald-600 hover:bg-emerald-500"
                                    onClick={() => {
                                      setActiveOrderForAction(ord);
                                      setPodOpen(true);
                                    }}
                                  >
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Deliver
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right 1 Col: Fleet Status Roster */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold tracking-wide text-foreground uppercase">
              Fleet Units ({drivers.length})
            </h3>

            <div className="space-y-2.5">
              {drivers.map((drv) => {
                const isSelected = selectedDriverId === drv.id;
                const isEnRoute = drv.status === 'EN_ROUTE';

                return (
                  <div
                    key={drv.id}
                    onClick={() => setSelectedDriverId(drv.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/10 border-sky-500/40 shadow-md ring-1 ring-sky-500/30'
                        : 'bg-card border-border/60 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          {drv.vehicleType === 'VAN' ? (
                            <Truck className="w-4 h-4" />
                          ) : (
                            <Bike className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-foreground block">
                            {drv.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {drv.licensePlate}
                          </span>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          isEnRoute
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}
                      >
                        {isEnRoute ? 'En Route' : 'Idle'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40 font-mono">
                      <span>{drv.activeOrdersCount ?? 0} active orders</span>
                      <span className="text-sky-400">{drv.batteryLevel ?? 95}% bat</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── Modals ─── */}

        {/* Create Delivery Modal */}
        <Dialog open={createOrderOpen} onOpenChange={setCreateOrderOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Delivery Order</DialogTitle>
              <DialogDescription>
                Schedule an on-demand courier dispatch with destination coordinates.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-xs font-medium text-foreground">Recipient Name</label>
                <Input
                  className="h-8 mt-1 text-xs"
                  placeholder="e.g. Sreyroth Kim"
                  value={orderForm.recipientName}
                  onChange={(e) => setOrderForm({ ...orderForm, recipientName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Recipient Phone</label>
                <Input
                  className="h-8 mt-1 text-xs"
                  placeholder="+855 12 345 678"
                  value={orderForm.recipientPhone}
                  onChange={(e) => setOrderForm({ ...orderForm, recipientPhone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Delivery Address</label>
                <Input
                  className="h-8 mt-1 text-xs"
                  placeholder="Street address, district..."
                  value={orderForm.deliveryAddress}
                  onChange={(e) => setOrderForm({ ...orderForm, deliveryAddress: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-foreground">COD Amount ($)</label>
                  <Input
                    type="number"
                    className="h-8 mt-1 text-xs font-mono"
                    value={orderForm.codAmount}
                    onChange={(e) => setOrderForm({ ...orderForm, codAmount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground">Delivery Fee ($)</label>
                  <Input
                    type="number"
                    className="h-8 mt-1 text-xs font-mono"
                    value={orderForm.deliveryFee}
                    onChange={(e) => setOrderForm({ ...orderForm, deliveryFee: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Assign Driver (Optional)</label>
                <select
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground mt-1"
                  value={orderForm.driverId || ''}
                  onChange={(e) => setOrderForm({ ...orderForm, driverId: e.target.value || undefined })}
                >
                  <option value="">Auto-dispatch later</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.vehicleType})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setCreateOrderOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!orderForm.recipientName || !orderForm.recipientPhone || createOrderMutation.isPending}
                onClick={() => createOrderMutation.mutate(orderForm)}
              >
                Create Order
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Driver Modal */}
        <Dialog open={createDriverOpen} onOpenChange={setCreateDriverOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Register Fleet Driver</DialogTitle>
              <DialogDescription>
                Add a new vehicle and driver to your delivery dispatch network.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-xs font-medium text-foreground">Driver Full Name</label>
                <Input
                  className="h-8 mt-1 text-xs"
                  placeholder="e.g. Dara Vong"
                  value={driverForm.name}
                  onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Phone Number</label>
                <Input
                  className="h-8 mt-1 text-xs"
                  placeholder="+855 88 991 223"
                  value={driverForm.phone}
                  onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Vehicle Type</label>
                <select
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground mt-1"
                  value={driverForm.vehicleType}
                  onChange={(e) => setDriverForm({ ...driverForm, vehicleType: e.target.value as any })}
                >
                  <option value="MOTORCYCLE">Motorcycle (Express Delivery)</option>
                  <option value="VAN">Cargo Van (Mid-size Cargo)</option>
                  <option value="TRUCK">Heavy Logistics Truck</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">License Plate</label>
                <Input
                  className="h-8 mt-1 text-xs font-mono"
                  placeholder="1AB-9981"
                  value={driverForm.licensePlate}
                  onChange={(e) => setDriverForm({ ...driverForm, licensePlate: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setCreateDriverOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!driverForm.name || !driverForm.licensePlate || createDriverMutation.isPending}
                onClick={() => createDriverMutation.mutate(driverForm)}
              >
                Register Unit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Driver Modal */}
        <Dialog open={assignDriverOpen} onOpenChange={setAssignDriverOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Assign Courier</DialogTitle>
              <DialogDescription>
                Dispatch order {activeOrderForAction?.trackingNumber} to a fleet driver.
              </DialogDescription>
            </DialogHeader>
            <div className="py-3">
              <label className="text-xs font-medium text-foreground">Select Active Driver</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground mt-1"
                value={assignDriverId}
                onChange={(e) => setAssignDriverId(e.target.value)}
              >
                <option value="">Select a driver...</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.vehicleType}) • {d.activeOrdersCount ?? 0} active
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setAssignDriverOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!assignDriverId || assignDriverMutation.isPending}
                onClick={() =>
                  assignDriverMutation.mutate({
                    orderId: activeOrderForAction!.id,
                    driverId: assignDriverId,
                  })
                }
              >
                Confirm Dispatch
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Proof of Delivery (POD) Confirmation Modal */}
        <Dialog open={podOpen} onOpenChange={setPodOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Complete Delivery (Proof of Delivery)</DialogTitle>
              <DialogDescription>
                Record final delivery handover for {activeOrderForAction?.trackingNumber}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                <span className="text-muted-foreground block text-[10px]">COD Cash Collected</span>
                <span className="text-base font-bold text-foreground font-mono">
                  ${activeOrderForAction?.codAmount.toFixed(2)}
                </span>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Handover Notes / Verification Code</label>
                <Input
                  className="h-8 mt-1 text-xs"
                  placeholder="e.g. Received by security / OTP verified"
                  value={podNotes}
                  onChange={(e) => setPodNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setPodOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500"
                onClick={() =>
                  updateStatusMutation.mutate({
                    orderId: activeOrderForAction!.id,
                    status: 'DELIVERED',
                    proofOfDelivery: `POD_${Date.now()}`,
                    notes: podNotes || 'Direct customer handover',
                  })
                }
              >
                Confirm Delivery
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </EnterpriseShell>
  );
}

export default DeliveryPage;
