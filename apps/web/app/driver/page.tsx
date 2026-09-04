'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { useExperienceStore } from '@/lib/experience-store';
import {
  Truck,
  Navigation,
  Phone,
  CheckCircle2,
  Clock,
  MapPin,
  DollarSign,
  AlertCircle,
  ArrowLeft,
  FileSignature,
  Battery,
  ShieldCheck,
  ChevronRight,
  Package,
  Smartphone,
  QrCode,
  Lock,
  Send,
  X,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { DeliveryOrderDto } from '@mystore/contracts';

export default function DriverAppPage() {
  const { token, user, setAuth, clear } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setExperience } = useExperienceStore();

  const [driverStatus, setDriverStatus] = useState<'ON_DUTY' | 'ON_BREAK' | 'OFF_DUTY'>('ON_DUTY');
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrderDto | null>(null);
  const [isPodOpen, setIsPodOpen] = useState(false);
  const [podNotes, setPodNotes] = useState('');
  const [podSignature, setPodSignature] = useState('');

  // Mobile & Desktop Detection
  const [isDesktop, setIsDesktop] = useState(false);
  const [showDesktopAlert, setShowDesktopAlert] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);

  // Login Gate inputs
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const checkViewport = () => {
      const isWide = window.innerWidth >= 768;
      const isTg = Boolean((window as any).Telegram?.WebApp?.initData);
      setIsDesktop(isWide && !isTg);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Check role authorization
  const userRoles = Array.isArray(user?.roles) ? user.roles : [];
  const isAuthorized = Boolean(
    token &&
    (userRoles.some((r: any) =>
      ['DELIVERY_DRIVER', 'STORE_MANAGER', 'ORG_ADMIN', 'WAREHOUSE_STAFF', 'CEO', 'CASHIER', 'ADMIN'].includes(r)
    ) || user?.permissions?.includes('delivery:view'))
  );

  const handleQuickLogin = async (emailToUse?: string, passwordToUse?: string) => {
    const email = emailToUse || loginEmail;
    const password = passwordToUse || loginPassword;

    if (!email || !password) {
      toast.error('Please provide email and password');
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await api.login(email, password);
      setAuth(res.accessToken, res.user);
      toast.success(`Welcome back, ${res.user.name}! Dispatch unlocked.`);
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Fetch Delivery Orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['driver-deliveries'],
    queryFn: () => api.listDeliveryOrders(token!),
    enabled: isAuthorized,
    refetchInterval: 6000,
  });

  // Update Delivery Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, podNotes, signature }: { id: string; status: string; podNotes?: string; signature?: string }) =>
      api.updateDeliveryStatus(token!, id, { status, proofOfDelivery: signature, notes: podNotes }),
    onSuccess: (updated) => {
      toast.success(`Delivery status updated to ${updated.status}`);
      queryClient.invalidateQueries({ queryKey: ['driver-deliveries'] });
      setIsPodOpen(false);
      setSelectedOrder(null);
      setPodNotes('');
      setPodSignature('');
    },
    onError: () => {
      toast.error('Failed to update delivery status');
    },
  });

  const activeOrders = orders.filter((o) => ['DISPATCHED', 'IN_TRANSIT'].includes(o.status));
  const completedOrders = orders.filter((o) => o.status === 'DELIVERED');
  const totalCodToCollect = activeOrders.reduce((sum, o) => sum + (Number(o.codAmount) > 0 ? Number(o.codAmount) : 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center">
      {/* ─── 1. Desktop / Telegram Mini App Alert Notice ─── */}
      {isDesktop && showDesktopAlert && (
        <div className="w-full bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border-b border-blue-800/40 px-4 py-2.5 text-xs text-slate-200">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-center sm:text-left">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white flex items-center gap-1.5 inline-flex">
                  Telegram Mini App & Mobile Driver Terminal
                </span>
                <span className="text-slate-400 block sm:inline sm:ml-2">
                  Optimized for on-the-road couriers. Switch to mobile view or scan QR code to run in Telegram.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowQrModal(true)}
                className="px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 font-semibold border border-blue-500/30 flex items-center gap-1.5 transition"
              >
                <QrCode className="w-3.5 h-3.5" />
                Scan QR Code
              </button>
              <button
                onClick={() => setShowDesktopAlert(false)}
                className="p-1 text-slate-400 hover:text-white rounded-md transition"
                title="Dismiss notice"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 2. Authorization Gate ─── */}
      {!isAuthorized ? (
        <div className="flex-1 flex items-center justify-center p-4 w-full max-w-md my-auto">
          <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto shadow-inner">
                <Lock className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Driver & Dispatcher Access Required
              </h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Restricted access. Only authorized <strong className="text-slate-200">Fleet Drivers</strong> and <strong className="text-slate-200">Store Managers</strong> can view live delivery routes.
              </p>
            </div>

            {/* Login Form */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Email Address</label>
                <Input
                  type="email"
                  placeholder="driver@demo.test or admin@demo.test"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Password</label>
                <Input
                  type="password"
                  placeholder="Enter your password..."
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-xs text-white"
                />
              </div>

              <Button
                onClick={() => handleQuickLogin()}
                disabled={isLoggingIn}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
              >
                {isLoggingIn ? 'Authenticating...' : 'Sign In to Courier Dispatch'}
              </Button>
            </div>

            {/* Quick Demo Access */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block text-center">
                Quick Demo Access
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleQuickLogin('admin@demo.test', 'Admin123!')}
                  disabled={isLoggingIn}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 text-left transition"
                >
                  <span className="text-[11px] font-bold text-white block">👔 Store Manager</span>
                  <span className="text-[10px] text-slate-400">admin@demo.test</span>
                </button>
                <button
                  onClick={() => handleQuickLogin('cashier@demo.test', 'Cashier123!')}
                  disabled={isLoggingIn}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 text-left transition"
                >
                  <span className="text-[11px] font-bold text-white block">🚚 Fleet Courier</span>
                  <span className="text-[10px] text-slate-400">cashier@demo.test</span>
                </button>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-xs text-slate-400 hover:text-white transition"
              >
                Return to Enterprise Dashboard
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ─── 3. Authorized Driver Mobile App View ─── */
        <div className="w-full max-w-md flex flex-col flex-1 shadow-2xl border-x border-slate-800 bg-slate-950">
          {/* Header */}
          <header className="p-4 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-sm font-bold tracking-tight">{user?.name || 'Courier Fleet'}</h1>
                    <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/30">
                      Live Route
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {user?.roles?.[0] || 'Courier Driver'} • Unit Active
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setExperience('EXECUTIVE');
                    navigate('/dashboard');
                  }}
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg transition-colors border border-slate-700"
                  title="Return to Executive Console"
                >
                  Admin
                </button>
                <button
                  onClick={() => {
                    clear();
                    toast.info('Logged out from Driver Dispatch.');
                  }}
                  className="p-1 text-slate-400 hover:text-rose-400 transition"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Duty Status Selector */}
            <div className="grid grid-cols-3 gap-1.5 mt-3 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-medium">
              {(['ON_DUTY', 'ON_BREAK', 'OFF_DUTY'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setDriverStatus(st)}
                  className={`py-1.5 rounded-lg transition-all text-center ${
                    driverStatus === st
                      ? st === 'ON_DUTY'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st === 'ON_DUTY' ? '🟢 Active' : st === 'ON_BREAK' ? '☕ Break' : '⚪ Offline'}
                </button>
              ))}
            </div>
          </header>

          {/* Route Summary Metrics */}
          <section className="p-4 grid grid-cols-3 gap-2 bg-slate-900/40 border-b border-slate-800/80">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 font-medium block">Active Stops</span>
              <span className="text-lg font-extrabold text-sky-400">{activeOrders.length}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 font-medium block">Delivered</span>
              <span className="text-lg font-extrabold text-emerald-400">{completedOrders.length}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 font-medium block">COD to Collect</span>
              <span className="text-lg font-extrabold text-amber-400">${totalCodToCollect.toFixed(2)}</span>
            </div>
          </section>

          {/* Delivery Tasks List */}
          <main className="flex-1 p-4 space-y-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Assigned Dispatch Queue</h2>
              <span className="text-[11px] text-slate-500">{activeOrders.length} pending</span>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-xs text-slate-500">Loading your route...</div>
            ) : activeOrders.length === 0 ? (
              <div className="text-center py-16 px-4 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
                <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-200">All Deliveries Complete!</h3>
                <p className="text-xs text-slate-400 mt-1">Stand by for new dispatch assignments from central warehouse.</p>
              </div>
            ) : (
              activeOrders.map((order, idx) => (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-md space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-200">{order.trackingNumber}</span>
                      </div>
                      <h4 className="text-sm font-bold text-white mt-1">{order.recipientName}</h4>
                    </div>
                    <Badge
                      className={`text-[10px] ${
                        order.status === 'IN_TRANSIT'
                          ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {order.status === 'IN_TRANSIT' ? 'On The Way' : 'Dispatched'}
                    </Badge>
                  </div>

                  <div className="flex items-start gap-2 text-xs text-slate-300">
                    <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <p className="line-clamp-2 leading-relaxed">{order.deliveryAddress}</p>
                  </div>

                  {Number(order.codAmount) > 0 && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                      <span className="font-semibold flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5" /> Collect Cash (COD)
                      </span>
                      <span className="font-mono font-bold text-sm">${Number(order.codAmount).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <a
                      href={`tel:${order.recipientPhone}`}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-400" /> Call
                    </a>

                    {order.status === 'DISPATCHED' ? (
                      <Button
                        onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'IN_TRANSIT' })}
                        disabled={updateStatusMutation.isPending}
                        className="col-span-2 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
                      >
                        <Navigation className="w-3.5 h-3.5 mr-1" /> Start Route
                      </Button>
                    ) : (
                      <Button
                        onClick={() => {
                          setSelectedOrder(order);
                          setIsPodOpen(true);
                        }}
                        className="col-span-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30"
                      >
                        <FileSignature className="w-3.5 h-3.5 mr-1" /> Deliver & Sign
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </main>
        </div>
      )}

      {/* ─── 4. Proof of Delivery (POD) Modal ─── */}
      <Dialog open={isPodOpen} onOpenChange={setIsPodOpen}>
        <DialogContent className="max-w-sm bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Proof of Delivery (POD)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Confirm package handoff for {selectedOrder?.recipientName}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500">Tracking Code</span>
                <p className="font-mono font-bold text-slate-200">{selectedOrder.trackingNumber}</p>
                {Number(selectedOrder.codAmount) > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-800 text-amber-300 font-bold flex justify-between">
                    <span>COD Collected:</span>
                    <span>${Number(selectedOrder.codAmount).toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">Recipient Name / Signature Confirmation</label>
                <Input
                  placeholder="e.g. Sokha Chem (Received personally)"
                  value={podSignature}
                  onChange={(e) => setPodSignature(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">Delivery Notes (Optional)</label>
                <Input
                  placeholder="e.g. Left at front desk with security"
                  value={podNotes}
                  onChange={(e) => setPodNotes(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                />
              </div>

              <Button
                onClick={() =>
                  updateStatusMutation.mutate({
                    id: selectedOrder.id,
                    status: 'DELIVERED',
                    podNotes: podNotes || 'Delivered successfully by courier.',
                    signature: podSignature || selectedOrder.recipientName,
                  })
                }
                disabled={updateStatusMutation.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-10 rounded-xl"
              >
                Complete Delivery
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── 5. Telegram QR Code Modal ─── */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-blue-400" />
                Telegram Mobile Courier App
              </span>
              <button
                onClick={() => setShowQrModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl w-48 h-48 mx-auto flex flex-col items-center justify-center shadow-lg">
              <div className="w-40 h-40 border-4 border-slate-950 rounded-xl p-2 flex flex-col items-center justify-center relative">
                <QrCode className="w-32 h-32 text-slate-950" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                    <Truck className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold text-white">Scan with Phone Camera or Telegram</p>
              <p className="text-[11px] text-slate-400">
                Launches the direct Telegram Mini App on iOS & Android with automatic courier telemetry.
              </p>
            </div>

            <a
              href="https://t.me/camtech_delivery_bot"
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition"
            >
              <Send className="w-3.5 h-3.5" />
              Open in Telegram Desktop (@camtech_delivery_bot)
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
