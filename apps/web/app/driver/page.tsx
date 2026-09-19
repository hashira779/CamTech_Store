'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck,
  Navigation,
  Phone,
  CheckCircle2,
  Clock,
  MapPin,
  DollarSign,
  FileSignature,
  ShieldCheck,
  ChevronRight,
  Package,
  RefreshCw,
  X,
  Smartphone,
  QrCode,
  Lock,
  LogOut,
  Send,
  BellRing,
  User,
  MessageCircle,
  Map as MapIcon,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Compass,
  Layers,
  Camera,
  Check,
  AlertCircle,
  Eye,
  Share2,
  Search,
  ArrowRight,
  Zap,
  Coffee,
  Crosshair,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';

const API_BASE_URL = (() => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return window.location.origin;
    }
  }
  return (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';
})();

export const openInGoogleMaps = (address: string, lat?: number, lng?: number) => {
  let url = '';
  if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
    url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  } else {
    url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  const tg = (window as any).Telegram?.WebApp;
  if (tg?.openLink) {
    tg.openLink(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function DeliveryMiniMap({
  address,
  lat = 11.5564,
  lng = 104.9282,
  className = 'h-44',
}: {
  address: string;
  lat?: number;
  lng?: number;
  className?: string;
}) {
  const safeLat = typeof lat === 'number' && !isNaN(lat) && lat !== 0 ? lat : 11.5564;
  const safeLng = typeof lng === 'number' && !isNaN(lng) && lng !== 0 ? lng : 104.9282;
  const delta = 0.007;

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden border border-slate-200/80 bg-slate-100 shadow-inner group ${className}`}>
      <iframe
        title={`Mini-Map-${safeLat}-${safeLng}`}
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${safeLng - delta}%2C${safeLat - delta * 0.7}%2C${safeLng + delta}%2C${safeLat + delta * 0.7}&layer=mapnik&marker=${safeLat}%2C${safeLng}`}
        className="w-full h-full border-0 pointer-events-auto"
        loading="lazy"
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openInGoogleMaps(address, safeLat, safeLng);
        }}
        className="absolute top-2.5 right-2.5 px-3 py-1.5 rounded-full bg-white/95 hover:bg-white text-slate-900 shadow-md font-bold text-[11px] flex items-center gap-1.5 border border-slate-200 transition hover:scale-105 active:scale-95 cursor-pointer z-10 backdrop-blur-sm"
        title="Open destination in Google Maps"
      >
        <Navigation className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />
        <span>Open Maps</span>
        <ExternalLink className="w-3 h-3 text-slate-400" />
      </button>

      <div className="absolute bottom-2 left-2 right-2 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-xl text-[10px] font-medium text-slate-700 shadow-sm border border-slate-100 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1 truncate">
          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span className="truncate">{address}</span>
        </div>
        <span className="font-mono text-slate-400 shrink-0 ml-1">
          {safeLat.toFixed(4)}, {safeLng.toFixed(4)}
        </span>
      </div>
    </div>
  );
}

export interface DeliveryTask {
  id: string;
  trackingNumber: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  destLat?: number;
  destLng?: number;
  status: 'PREPARING' | 'PENDING' | 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';
  codAmount: number;
  paymentMethod?: string;
  proofOfDelivery?: string;
  notes?: string;
  createdAt?: string;
  deliveryFee?: number;
}

interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  roles: string[];
}

export function DriverMiniAppPage() {
  const queryClient = useQueryClient();

  // Auth State
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authState, setAuthState] = useState<'LOADING' | 'UNREGISTERED' | 'OTP_PENDING' | 'PENDING_APPROVAL' | 'ACTIVE'>('LOADING');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);
  const [initData, setInitData] = useState('');

  // Traditional password login fallback
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Driver Shift & Status
  const [shiftStatus, setShiftStatus] = useState<'ONLINE' | 'BREAK' | 'OFFLINE'>('ONLINE');
  const [driverGps, setDriverGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // UI state
  const [orderTab, setOrderTab] = useState<'AVAILABLE' | 'ACTIVE' | 'COMPLETED' | 'STATS'>('AVAILABLE');
  const [selectedOrder, setSelectedOrder] = useState<DeliveryTask | null>(null);
  const [isPodOpen, setIsPodOpen] = useState(false);
  const [podNotes, setPodNotes] = useState('');
  const [podSignature, setPodSignature] = useState('');
  const [podPaymentMode, setPodPaymentMode] = useState<'CASH' | 'KHQR'>('CASH');
  const [cashReceived, setCashReceived] = useState('');

  // Order Details Modal State
  const [viewingDetailOrder, setViewingDetailOrder] = useState<DeliveryTask | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);

  // Real-Time Incoming Order Popup Alert State
  const [incomingOrder, setIncomingOrder] = useState<DeliveryTask | null>(null);
  const [isIncomingModalOpen, setIsIncomingModalOpen] = useState(false);
  const knownOrderStatusesRef = useRef<Map<string, DeliveryTask['status']>>(new Map());
  const isInitialLoadRef = useRef(true);

  // Signature canvas ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // 1. Live GPS Watcher
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setDriverGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // 2. Initialize Telegram WebApp & check auto-login
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    const tgInitData = tg?.initData || '';
    if (tg && tgInitData) {
      tg.ready?.();
      tg.expand?.();
    }
    setInitData(tgInitData);

    // Check cached credentials
    let hasValidToken = false;
    try {
      const savedAuth = localStorage.getItem('delivery-driver-auth') || localStorage.getItem('mystore-auth');
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth);
        const savedToken = parsed.token || parsed?.state?.token;
        const savedUser = parsed.user || parsed?.state?.user;
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(savedUser);
          setAuthState('ACTIVE');
          hasValidToken = true;
        }
      }
    } catch {}

    if (!hasValidToken) {
      setAuthState('UNREGISTERED');
    }
  }, []);

  const handlePasswordLogin = async (emailArg?: string, passArg?: string) => {
    const email = emailArg || loginEmail;
    const password = passArg || loginPassword;
    if (!email || !password) return toast.error('Enter email and password');
    setIsAuthProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.detail || json.message || 'Login failed.');
      }
      const data = json.data || json;
      const t = data.accessToken || data.token;
      const u = data.user;
      setToken(t);
      setUser(u);
      setAuthState('ACTIVE');
      localStorage.setItem('delivery-driver-auth', JSON.stringify({ token: t, user: u }));
      toast.success(`Welcome, ${u.name}! Dispatch unlocked.`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsAuthProcessing(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setAuthState('UNREGISTERED');
    localStorage.removeItem('delivery-driver-auth');
    localStorage.removeItem('mystore-auth');
    toast.success('Logged out');
  };

  // Fetch Delivery Orders
  const { data: orders = [], isLoading } = useQuery<DeliveryTask[]>({
    queryKey: ['driver-deliveries-web'],
    queryFn: async () => {
      if (!token) return [];
      const res = await fetch(`${API_BASE_URL}/api/v1/delivery/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      const items = json.data || json || [];
      return Array.isArray(items)
        ? items.map((o: any) => ({
            ...o,
            deliveryAddress: o.deliveryAddress || o.destinationAddress || 'Store Pickup / Express Delivery',
            destLat: typeof o.destLat === 'number' && !isNaN(o.destLat) && o.destLat !== 0 ? o.destLat : 11.5564,
            destLng: typeof o.destLng === 'number' && !isNaN(o.destLng) && o.destLng !== 0 ? o.destLng : 104.9282,
          }))
        : [];
    },
    enabled: Boolean(token && authState === 'ACTIVE'),
    refetchInterval: 3000,
  });

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      signature,
      notes,
    }: {
      id: string;
      status: string;
      signature?: string;
      notes?: string;
    }) => {
      const res = await fetch(`${API_BASE_URL}/api/v1/delivery/orders/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, proofOfDelivery: signature, notes }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.detail || json.message || 'Failed to update delivery');
      }
      return json.data || json;
    },
    onSuccess: (updated) => {
      toast.success(`Order #${updated.trackingNumber || 'updated'} marked as ${updated.status}!`);
      queryClient.invalidateQueries({ queryKey: ['driver-deliveries-web'] });
      setIsPodOpen(false);
      setSelectedOrder(null);
      setPodNotes('');
      setPodSignature('');
      setCashReceived('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Status update failed');
    },
  });

  // Canvas drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setPodSignature(canvas.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setPodSignature('');
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      o.trackingNumber.toLowerCase().includes(term) ||
      o.recipientName.toLowerCase().includes(term) ||
      o.deliveryAddress.toLowerCase().includes(term) ||
      o.recipientPhone.includes(term)
    );
  });

  const pendingOrders = filteredOrders.filter((o) => o.status === 'PENDING');
  const activeOrders = filteredOrders.filter((o) => ['DISPATCHED', 'IN_TRANSIT'].includes(o.status));
  const completedOrders = filteredOrders.filter((o) => o.status === 'DELIVERED');
  const totalCodToCollect = activeOrders.reduce(
    (sum, o) => sum + (Number(o.codAmount) > 0 ? Number(o.codAmount) : 0),
    0
  );
  const totalEarnedToday = completedOrders.reduce((sum, o) => sum + (Number(o.deliveryFee) || 2.5), 0);

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col items-center relative font-sans antialiased selection:bg-amber-500/30 selection:text-amber-200">
      {!token || authState !== 'ACTIVE' ? (
        <div className="flex-1 flex items-center justify-center p-4 w-full max-w-md my-auto">
          <div className="w-full bg-slate-900/90 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-2xl border border-slate-800 space-y-6">
            <div className="space-y-2 text-center">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/10">
                <Truck className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white">CamTech Delivery</h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Sign in to open the driver terminal and start claiming delivery routes.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <input
                type="email"
                placeholder="driver@demo.test"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-amber-500 font-mono"
              />
              <input
                type="password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-amber-500 font-mono"
              />
              <button
                onClick={() => handlePasswordLogin()}
                disabled={isAuthProcessing}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer shadow-md"
              >
                {isAuthProcessing ? 'Signing In...' : 'Sign In as Driver'}
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 text-center font-mono">
                Quick Demo Courier
              </div>
              <button
                onClick={() => handlePasswordLogin('cashier@demo.test', 'Cashier123!')}
                className="w-full p-2.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-950/60 text-left text-xs cursor-pointer transition flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-white">Fleet Courier</div>
                  <div className="text-[10px] text-slate-500 font-mono">cashier@demo.test</div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-md flex flex-col flex-1 bg-[#0b0f17] relative pb-28">
          {/* Header */}
          <header className="px-5 pt-6 pb-3 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
                    <User className="w-6 h-6 text-slate-950" />
                  </div>
                  <span
                    className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0b0f17] ${
                      shiftStatus === 'ONLINE'
                        ? 'bg-emerald-500'
                        : shiftStatus === 'BREAK'
                        ? 'bg-amber-500'
                        : 'bg-zinc-600'
                    }`}
                  />
                </div>
                <div>
                  <h1 className="text-base font-black text-white tracking-tight capitalize flex items-center gap-1.5">
                    {user?.name || 'Active Courier'}
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      PRO
                    </span>
                  </h1>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Crosshair className="w-3 h-3 text-emerald-400" />
                      {driverGps ? `GPS ±${driverGps.accuracy}m` : 'GPS Active'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  value={shiftStatus}
                  onChange={(e) => setShiftStatus(e.target.value as any)}
                  className="px-2 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-bold font-mono text-slate-300 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="ONLINE">🟢 Online</option>
                  <option value="BREAK">🟡 Break</option>
                  <option value="OFFLINE">🔴 Offline</option>
                </select>

                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['driver-deliveries-web'] })}
                  className="p-2 bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleLogout}
                  className="p-2 bg-slate-900 hover:bg-rose-950/40 rounded-xl border border-slate-800 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800/80">
                <div className="text-[10px] text-slate-400 font-mono mb-1">Active Routes</div>
                <div className="text-xl font-black text-white font-mono">{activeOrders.length}</div>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800/80">
                <div className="text-[10px] text-amber-400 font-mono mb-1">COD to Collect</div>
                <div className="text-xl font-black text-amber-400 font-mono">${totalCodToCollect.toFixed(2)}</div>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800/80">
                <div className="text-[10px] text-emerald-400 font-mono mb-1">Earned Today</div>
                <div className="text-xl font-black text-emerald-400 font-mono">${totalEarnedToday.toFixed(2)}</div>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search recipient, tracking #, address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-amber-500 font-mono transition"
              />
            </div>
          </header>

          {/* Orders Section */}
          <main className="flex-1 px-5 space-y-4">
            <div className="flex items-center justify-between pt-1">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                {orderTab === 'AVAILABLE'
                  ? 'Incoming Dispatch Requests'
                  : orderTab === 'ACTIVE'
                  ? 'Current Delivery Route'
                  : orderTab === 'COMPLETED'
                  ? 'Completed Deliveries'
                  : 'Courier Shift Statistics'}
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
                {orderTab === 'AVAILABLE'
                  ? `${pendingOrders.length} Available`
                  : orderTab === 'ACTIVE'
                  ? `${activeOrders.length} In-Route`
                  : orderTab === 'COMPLETED'
                  ? `${completedOrders.length} Delivered`
                  : 'Today'}
              </span>
            </div>

            {isLoading ? (
              <div className="text-center py-16 text-xs text-slate-500 font-mono flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                Syncing live delivery telemetry...
              </div>
            ) : orderTab === 'AVAILABLE' ? (
              pendingOrders.length === 0 ? (
                <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-dashed border-slate-800 text-slate-500 text-xs font-mono space-y-2">
                  <Package className="w-8 h-8 text-slate-600 mx-auto" />
                  <p>No new delivery requests right now.</p>
                </div>
              ) : (
                pendingOrders.map((order) => {
                  const distKm =
                    driverGps && order.destLat && order.destLng
                      ? calculateDistanceKm(driverGps.lat, driverGps.lng, order.destLat, order.destLng)
                      : null;

                  return (
                    <div
                      key={order.id}
                      className="bg-slate-900/90 rounded-3xl border border-slate-800 p-5 space-y-3.5 shadow-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-amber-400">#{order.trackingNumber}</span>
                            {distKm !== null && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                📍 ~{distKm} km away
                              </span>
                            )}
                          </div>
                          <h4 className="text-base font-bold text-white mt-0.5">{order.recipientName}</h4>
                        </div>
                        <span className="text-[10px] font-bold font-mono uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full">
                          Pending
                        </span>
                      </div>

                      <div className="flex items-start gap-2 text-xs text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                        <p className="leading-snug">{order.deliveryAddress}</p>
                      </div>

                      <DeliveryMiniMap
                        address={order.deliveryAddress}
                        lat={order.destLat}
                        lng={order.destLng}
                        className="h-36 my-1"
                      />

                      <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono">
                        <span className="text-slate-400">Payment:</span>
                        <span className="text-amber-400 font-bold">
                          {Number(order.codAmount) > 0 ? `COD $${Number(order.codAmount).toFixed(2)}` : 'Prepaid (KHQR)'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setViewingDetailOrder(order)}
                          className="h-10 px-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                          title="View Order Details"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-400" />
                          <span>Details</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openInGoogleMaps(order.deliveryAddress, order.destLat, order.destLng)}
                          className="h-10 px-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <Navigation className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
                          <span>Maps</span>
                        </button>
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'DISPATCHED' })}
                          disabled={updateStatusMutation.isPending}
                          className="flex-1 h-10 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Accept &amp; Claim Task</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )
            ) : orderTab === 'ACTIVE' ? (
              activeOrders.length === 0 ? (
                <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-dashed border-slate-800 text-slate-500 text-xs font-mono space-y-2">
                  <Truck className="w-8 h-8 text-slate-600 mx-auto" />
                  <p>No active orders currently in transit.</p>
                </div>
              ) : (
                activeOrders.map((order) => {
                  const distKm =
                    driverGps && order.destLat && order.destLng
                      ? calculateDistanceKm(driverGps.lat, driverGps.lng, order.destLat, order.destLng)
                      : null;
                  const estimatedMinutes = distKm !== null ? Math.max(3, Math.round(distKm * 2.8)) : null;

                  return (
                    <div key={order.id} className="bg-slate-900 rounded-3xl border border-slate-800 p-5 space-y-4 shadow-xl">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-amber-400">#{order.trackingNumber}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              {order.status === 'IN_TRANSIT' ? '⚡ En Route' : '📦 Dispatched'}
                            </span>
                          </div>
                          <h4 className="text-lg font-bold text-white mt-1">{order.recipientName}</h4>
                        </div>
                        {distKm !== null && (
                          <div className="text-right font-mono">
                            <div className="text-sm font-black text-emerald-400">~{distKm} km</div>
                            <div className="text-[10px] text-slate-400">~{estimatedMinutes} mins</div>
                          </div>
                        )}
                      </div>

                      {/* Stepper */}
                      <div className="grid grid-cols-3 gap-1.5 py-1 text-center font-mono text-[10px]">
                        <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                          ✓ Accepted
                        </div>
                        <div
                          className={`p-1.5 rounded-xl font-bold ${
                            order.status === 'IN_TRANSIT'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 animate-pulse'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {order.status === 'IN_TRANSIT' ? '● In Transit' : '○ Pending Start'}
                        </div>
                        <div className="p-1.5 rounded-xl bg-slate-800 text-slate-500">○ Delivered</div>
                      </div>

                      <div className="flex items-start gap-2 text-xs text-slate-300">
                        <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <p className="leading-snug">{order.deliveryAddress}</p>
                      </div>

                      <DeliveryMiniMap
                        address={order.deliveryAddress}
                        lat={order.destLat}
                        lng={order.destLng}
                        className="h-44 my-1"
                      />

                      {Number(order.codAmount) > 0 && (
                        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-amber-400" />
                            <div>
                              <div className="text-[10px] font-bold uppercase text-amber-400 font-mono">Collect COD</div>
                              <div className="text-xs text-slate-300">Cash on Delivery</div>
                            </div>
                          </div>
                          <div className="text-lg font-black text-amber-300 font-mono">
                            ${Number(order.codAmount).toFixed(2)}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setViewingDetailOrder(order)}
                          className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white shrink-0 transition cursor-pointer"
                          title="View Full Details"
                        >
                          <Eye className="w-4 h-4 text-amber-400" />
                        </button>

                        {order.recipientPhone && (
                          <a
                            href={`tel:${order.recipientPhone}`}
                            className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200 shrink-0 transition"
                          >
                            <Phone className="w-4 h-4 text-emerald-400" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => openInGoogleMaps(order.deliveryAddress, order.destLat, order.destLng)}
                          className="h-10 px-3 rounded-full bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 font-bold text-xs border border-blue-500/30 flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
                        >
                          <Navigation className="w-3.5 h-3.5 fill-blue-400" />
                          <span>Maps</span>
                        </button>

                        {order.status === 'DISPATCHED' ? (
                          <button
                            onClick={() => {
                              updateStatusMutation.mutate({ id: order.id, status: 'IN_TRANSIT' });
                              openInGoogleMaps(order.deliveryAddress, order.destLat, order.destLng);
                            }}
                            className="flex-1 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Compass className="w-4 h-4" />
                            <span>Start Navigation</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsPodOpen(true);
                            }}
                            className="flex-1 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <FileSignature className="w-4 h-4" />
                            <span>Complete &amp; Sign</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )
            ) : orderTab === 'COMPLETED' ? (
              completedOrders.length === 0 ? (
                <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-dashed border-slate-800 text-slate-500 text-xs font-mono">
                  No completed deliveries yet today.
                </div>
              ) : (
                completedOrders.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => setViewingDetailOrder(order)}
                    className="bg-slate-900/60 hover:bg-slate-900/90 p-4 rounded-3xl border border-slate-800/80 hover:border-slate-700 flex items-center justify-between transition cursor-pointer group shadow-sm"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-400 font-mono">#{order.trackingNumber}</span>
                        <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition" />
                      </div>
                      <h4 className="text-sm font-bold text-white mt-0.5">{order.recipientName}</h4>
                      <p className="text-[11px] text-slate-400 truncate max-w-[200px]">{order.deliveryAddress}</p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <span className="text-[10px] font-bold font-mono uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 group-hover:text-amber-400 transition">
                        Tap for details →
                      </span>
                    </div>
                  </div>
                ))
              )
            ) : (
              /* Stats */
              <div className="space-y-4 font-mono text-xs">
                <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Today's Dispatch Summary
                  </h4>
                  <div className="space-y-2 text-slate-400">
                    <div className="flex justify-between">
                      <span>Total Assigned Shipments:</span>
                      <strong className="text-white">{orders.length}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Delivered &amp; Completed:</span>
                      <strong className="text-emerald-400">{completedOrders.length}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Total COD Cash Collected:</span>
                      <strong className="text-amber-400">${totalCodToCollect.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-2">
                      <span>Courier Earnings:</span>
                      <strong className="text-emerald-400 text-sm">${totalEarnedToday.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>

          {/* Floating Bottom Nav */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-950/95 backdrop-blur-xl rounded-full px-3 py-2 flex items-center gap-2 shadow-2xl z-40 border border-slate-800">
            <button
              onClick={() => setOrderTab('AVAILABLE')}
              className={`flex items-center justify-center w-11 h-11 rounded-full transition-all relative cursor-pointer ${
                orderTab === 'AVAILABLE' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Package className="w-5 h-5" />
              {pendingOrders.length > 0 && orderTab !== 'AVAILABLE' && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-950 animate-pulse"></span>
              )}
            </button>
            <button
              onClick={() => setOrderTab('ACTIVE')}
              className={`flex items-center justify-center w-11 h-11 rounded-full transition-all relative cursor-pointer ${
                orderTab === 'ACTIVE' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapIcon className="w-5 h-5" />
              {activeOrders.length > 0 && orderTab !== 'ACTIVE' && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-slate-950"></span>
              )}
            </button>
            <button
              onClick={() => setOrderTab('COMPLETED')}
              className={`flex items-center justify-center w-11 h-11 rounded-full transition-all cursor-pointer ${
                orderTab === 'COMPLETED' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setOrderTab('STATS')}
              className={`flex items-center justify-center w-11 h-11 rounded-full transition-all cursor-pointer ${
                orderTab === 'STATS' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* POD Modal */}
      {isPodOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-2"></div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Proof of Delivery (POD)</h3>
                <p className="text-xs text-slate-400 font-mono">
                  #{selectedOrder.trackingNumber} • {selectedOrder.recipientName}
                </p>
              </div>
              <button onClick={() => setIsPodOpen(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {Number(selectedOrder.codAmount) > 0 && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2 font-mono">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-400 uppercase">Amount to Collect</span>
                  <span className="text-lg font-black text-amber-300">${Number(selectedOrder.codAmount).toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPodPaymentMode('CASH')}
                    className={`py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      podPaymentMode === 'CASH'
                        ? 'bg-amber-500 text-slate-950 border-amber-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    💵 Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPodPaymentMode('KHQR')}
                    className={`py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      podPaymentMode === 'KHQR'
                        ? 'bg-amber-500 text-slate-950 border-amber-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    📱 Bakong KHQR
                  </button>
                </div>

                {podPaymentMode === 'CASH' ? (
                  <div className="pt-2">
                    <label className="text-[10px] text-slate-400 block mb-1">Cash Received ($):</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={`e.g. ${Number(selectedOrder.codAmount).toFixed(2)}`}
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-amber-500"
                    />
                    {parseFloat(cashReceived) > Number(selectedOrder.codAmount) && (
                      <div className="text-[11px] text-emerald-400 mt-1">
                        Change to return: ${(parseFloat(cashReceived) - Number(selectedOrder.codAmount)).toFixed(2)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center p-3 bg-white rounded-xl space-y-1 my-1">
                    <div className="text-[11px] font-bold text-slate-900">Scan Bakong KHQR to Pay</div>
                    <div className="w-28 h-28 bg-slate-100 border border-slate-200 rounded-lg mx-auto flex items-center justify-center">
                      <QrCode className="w-24 h-24 text-slate-900" />
                    </div>
                    <div className="text-[10px] text-slate-500">Pay ${Number(selectedOrder.codAmount).toFixed(2)}</div>
                  </div>
                )}
              </div>
            )}

            {/* Signature Canvas */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <FileSignature className="w-3.5 h-3.5 text-amber-400" />
                  Customer Signature (Sign Below)
                </label>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="text-[10px] text-slate-500 hover:text-amber-400 font-mono cursor-pointer"
                >
                  Clear Pad
                </button>
              </div>
              <div className="bg-white rounded-2xl overflow-hidden border border-slate-700 shadow-inner">
                <canvas
                  ref={canvasRef}
                  width={380}
                  height={130}
                  className="w-full touch-none cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">Delivery Notes</label>
              <input
                type="text"
                placeholder="e.g. Handed directly to customer"
                value={podNotes}
                onChange={(e) => setPodNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <button
              onClick={() =>
                updateStatusMutation.mutate({
                  id: selectedOrder.id,
                  status: 'DELIVERED',
                  signature: podSignature || selectedOrder.recipientName,
                  notes: podNotes || 'Delivered directly to recipient.',
                })
              }
              disabled={updateStatusMutation.isPending}
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-full font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-50"
            >
              {updateStatusMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Delivery &amp; Close Task</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
      {/* ─── 7. COMPREHENSIVE ORDER DETAIL MODAL ─── */}
      {viewingDetailOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-1"></div>

            {/* Header with Tracking & Status */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-amber-400">
                    #{viewingDetailOrder.trackingNumber}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(viewingDetailOrder.trackingNumber);
                      setCopiedTracking(true);
                      setTimeout(() => setCopiedTracking(false), 2000);
                      toast.success('Tracking number copied!');
                    }}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
                    title="Copy tracking number"
                  >
                    {copiedTracking ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <h3 className="text-lg font-bold text-white mt-0.5">Order Details</h3>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold font-mono uppercase px-2.5 py-1 rounded-full border ${
                    viewingDetailOrder.status === 'DELIVERED'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : viewingDetailOrder.status === 'IN_TRANSIT'
                      ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                      : viewingDetailOrder.status === 'DISPATCHED'
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                  }`}
                >
                  {viewingDetailOrder.status.replace('_', ' ')}
                </span>
                <button
                  onClick={() => setViewingDetailOrder(null)}
                  className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Recipient & Contact */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-500 font-mono">Recipient</div>
                  <div className="text-base font-bold text-white">{viewingDetailOrder.recipientName}</div>
                  <div className="text-xs font-mono text-slate-400 mt-0.5">{viewingDetailOrder.recipientPhone || 'No phone provided'}</div>
                </div>
                {viewingDetailOrder.recipientPhone && (
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${viewingDetailOrder.recipientPhone}`}
                      className="w-9 h-9 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 flex items-center justify-center transition cursor-pointer"
                      title="Call customer"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                    <a
                      href={`https://t.me/+855${viewingDetailOrder.recipientPhone.replace(/^0/, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-full bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30 flex items-center justify-center transition cursor-pointer"
                      title="Telegram customer"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  </div>
                )}
              </div>

              {/* Delivery Address */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="text-[10px] font-bold uppercase text-slate-500 font-mono mb-1">Destination Address</div>
                <div className="flex items-start gap-2 text-xs text-slate-200">
                  <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{viewingDetailOrder.deliveryAddress}</span>
                </div>
              </div>
            </div>

            {/* Embedded Mini Map Preview */}
            <DeliveryMiniMap
              address={viewingDetailOrder.deliveryAddress}
              lat={viewingDetailOrder.destLat}
              lng={viewingDetailOrder.destLng}
              className="h-40"
            />

            {/* Financials & Payment Breakdown */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 font-mono text-xs">
              <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Payment &amp; Fees</div>
              <div className="flex justify-between text-slate-400">
                <span>Payment Method:</span>
                <span className="text-white font-bold">
                  {Number(viewingDetailOrder.codAmount) > 0 ? 'Cash on Delivery (COD)' : 'Prepaid (KHQR)'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Amount to Collect:</span>
                <span className="text-amber-400 font-bold">
                  ${Number(viewingDetailOrder.codAmount || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Courier Delivery Fee:</span>
                <span className="text-emerald-400 font-bold">
                  ${Number(viewingDetailOrder.deliveryFee || 2.5).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Proof of Delivery / Signature if DELIVERED */}
            {viewingDetailOrder.status === 'DELIVERED' && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Proof of Delivery (Verified)</span>
                </div>
                {viewingDetailOrder.notes && (
                  <div className="text-xs text-slate-300">
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Delivery Notes:</span>
                    {viewingDetailOrder.notes}
                  </div>
                )}
                {viewingDetailOrder.proofOfDelivery && (
                  <div className="pt-2">
                    <span className="text-slate-500 font-mono text-[10px] uppercase block mb-1">Customer Signature / Receipt:</span>
                    {viewingDetailOrder.proofOfDelivery.startsWith('data:image') ? (
                      <div className="p-2 bg-white rounded-xl max-w-xs">
                        <img
                          src={viewingDetailOrder.proofOfDelivery}
                          alt="Customer Signature"
                          className="w-full h-24 object-contain"
                        />
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
                        ✍️ Signed by: {viewingDetailOrder.proofOfDelivery}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  openInGoogleMaps(
                    viewingDetailOrder.deliveryAddress,
                    viewingDetailOrder.destLat,
                    viewingDetailOrder.destLng
                  )
                }
                className="w-full h-11 rounded-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-bold text-xs border border-blue-500/30 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Navigation className="w-4 h-4 fill-blue-400" />
                <span>Navigate in Google Maps</span>
              </button>

              {viewingDetailOrder.status === 'PENDING' && (
                <button
                  onClick={() => {
                    updateStatusMutation.mutate({ id: viewingDetailOrder.id, status: 'DISPATCHED' });
                    setViewingDetailOrder(null);
                  }}
                  disabled={updateStatusMutation.isPending}
                  className="w-full h-11 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Truck className="w-4 h-4" />
                  <span>Accept &amp; Claim Task</span>
                </button>
              )}

              {viewingDetailOrder.status === 'DISPATCHED' && (
                <button
                  onClick={() => {
                    updateStatusMutation.mutate({ id: viewingDetailOrder.id, status: 'IN_TRANSIT' });
                    openInGoogleMaps(viewingDetailOrder.deliveryAddress, viewingDetailOrder.destLat, viewingDetailOrder.destLng);
                    setViewingDetailOrder(null);
                  }}
                  disabled={updateStatusMutation.isPending}
                  className="w-full h-11 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Compass className="w-4 h-4" />
                  <span>Start Navigation (In Transit)</span>
                </button>
              )}

              {viewingDetailOrder.status === 'IN_TRANSIT' && (
                <button
                  onClick={() => {
                    setSelectedOrder(viewingDetailOrder);
                    setIsPodOpen(true);
                    setViewingDetailOrder(null);
                  }}
                  className="w-full h-11 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <FileSignature className="w-4 h-4" />
                  <span>Complete &amp; Sign (POD)</span>
                </button>
              )}

              <button
                onClick={() => setViewingDetailOrder(null)}
                className="w-full h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DriverMiniAppPage;
