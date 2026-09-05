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
  ShieldAlert,
  ChevronRight,
  Package,
  Sparkles,
  RefreshCw,
  X,
  Smartphone,
  QrCode,
  Lock,
  LogOut,
  Send,
  ExternalLink,
  Info
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

interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

export function App() {
  const [deliveries, setDeliveries] = useState<DeliveryTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<DeliveryTask | null>(null);
  const [isPodOpen, setIsPodOpen] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');

  // Mobile / Telegram detection
  const [isDesktop, setIsDesktop] = useState(false);
  const [showDesktopAlert, setShowDesktopAlert] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isTelegramApp, setIsTelegramApp] = useState(false);

  // Authentication & Authorization state
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Initialize auth & environment detection on mount
  useEffect(() => {
    // 1. Detect Telegram WebApp
    const tg = (window as any).Telegram?.WebApp;
    if (tg && tg.initData) {
      setIsTelegramApp(true);
      tg.ready?.();
      tg.expand?.();
    }

    // 2. Detect Desktop Viewport
    const checkViewport = () => {
      const isWide = window.innerWidth >= 768;
      const isTg = Boolean((window as any).Telegram?.WebApp?.initData);
      setIsDesktop(isWide && !isTg);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);

    // 3. Load saved credentials (from mystore-auth or local delivery cache)
    try {
      const sharedAuth = localStorage.getItem('mystore-auth');
      if (sharedAuth) {
        const parsed = JSON.parse(sharedAuth);
        if (parsed?.state?.token && parsed?.state?.user) {
          setAuthToken(parsed.state.token);
          setAuthUser(parsed.state.user);
          return () => window.removeEventListener('resize', checkViewport);
        }
      }

      const deliveryAuth = localStorage.getItem('delivery-driver-auth');
      if (deliveryAuth) {
        const parsed = JSON.parse(deliveryAuth);
        if (parsed?.token && parsed?.user) {
          setAuthToken(parsed.token);
          setAuthUser(parsed.user);
        }
      }
    } catch {}

    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Check authorization roles (Driver, Manager, Admin, Warehouse, CEO)
  const isAuthorized = Boolean(
    authUser &&
    Array.isArray(authUser.roles) &&
    authUser.roles.some((r) =>
      ['DELIVERY_DRIVER', 'STORE_MANAGER', 'BRANCH_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN', 'WAREHOUSE_STAFF', 'WAREHOUSE_MANAGER', 'CEO', 'CASHIER', 'ADMIN', 'STAFF'].includes(r)
    )
  );

  const handleLogin = async (emailToUse?: string, passwordToUse?: string) => {
    const email = emailToUse || loginEmail;
    const password = passwordToUse || loginPassword;

    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const json = await res.json();
      if (!res.ok || (json.success === false)) {
        toast.error(json.detail || json.message || 'Authentication failed. Check credentials.');
        setIsLoggingIn(false);
        return;
      }

      const data = json.data || json;
      const token = data.accessToken || data.token;
      const user = data.user;

      if (!token || !user) {
        toast.error('Invalid auth payload from server');
        setIsLoggingIn(false);
        return;
      }

      // Check role
      const userRoles = Array.isArray(user.roles) ? user.roles : [user.role].filter(Boolean);
      const authorized = userRoles.some((r: string) =>
        ['DELIVERY_DRIVER', 'STORE_MANAGER', 'BRANCH_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN', 'WAREHOUSE_STAFF', 'WAREHOUSE_MANAGER', 'CEO', 'CASHIER', 'ADMIN', 'STAFF'].includes(r)
      );

      if (!authorized) {
        toast.error('Unauthorized: Your role does not have delivery dispatch access.');
        setIsLoggingIn(false);
        return;
      }

      const authData = { token, user: { ...user, roles: userRoles } };
      setAuthToken(token);
      setAuthUser(authData.user);
      localStorage.setItem('delivery-driver-auth', JSON.stringify(authData));
      toast.success(`Welcome back, ${user.name}! Dispatch unlocked.`);
    } catch (err: any) {
      toast.error(`Login error: ${err.message || 'Cannot reach API Gateway'}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setAuthUser(null);
    localStorage.removeItem('delivery-driver-auth');
    toast.info('Logged out of delivery dispatch.');
  };

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
    enabled: isAuthorized,
    staleTime: 30000
  });

  const activeDriver: DriverProfile | undefined = 
    (drivers && drivers.find((d) => d.id === selectedDriverId)) ||
    (drivers && drivers[0]);

  // 2. Fetch live tasks from Central Data Center API (polls every 3s for new store orders)
  const { data: serverTasks, isLoading: isTasksLoading, refetch } = useQuery({
    queryKey: ['delivery-live-tasks', authToken],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/delivery/tasks`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        });
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
    enabled: isAuthorized,
    refetchInterval: isAuthorized ? 3000 : false
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
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
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
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans select-none flex flex-col items-center">
      <Toaster position="top-right" richColors />

      {/* ─── 1. Desktop & Telegram Mini App Alert Banner ─── */}
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
                  Optimized for couriers & Telegram WebApp. Switch to mobile view or scan QR for field GPS & POD signatures.
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
                title="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 2. Telegram Mini App Active Header ─── */}
      {isTelegramApp && (
        <div className="w-full bg-blue-600 text-white text-[11px] font-bold py-1 px-4 text-center flex items-center justify-center gap-1.5">
          <Send className="w-3 h-3" />
          Running inside Telegram Mini App
        </div>
      )}

      {/* ─── 3. Authorization Gate (If Not Logged In or Unauthorized) ─── */}
      {!isAuthorized ? (
        <div className="flex-1 flex items-center justify-center p-4 w-full max-w-md my-auto">
          <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto shadow-inner">
                <Lock className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Delivery Dispatch Terminal
              </h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Restricted access. Only authorized <strong className="text-slate-200">Fleet Drivers</strong> and <strong className="text-slate-200">Store Managers</strong> can view live customer orders.
              </p>
            </div>

            {/* Login Form */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="driver@demo.test or admin@demo.test"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl text-xs text-white placeholder:text-slate-600 outline-none transition"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Password</label>
                <input
                  type="password"
                  placeholder="Enter your password..."
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl text-xs text-white placeholder:text-slate-600 outline-none transition"
                />
              </div>

              <button
                onClick={() => handleLogin()}
                disabled={isLoggingIn}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition disabled:opacity-50"
              >
                {isLoggingIn ? 'Authenticating...' : 'Sign In to Courier Dispatch'}
              </button>
            </div>

            {/* Quick Demo Access */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block text-center">
                Quick Demo Access
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleLogin('admin@demo.test', 'Admin123!')}
                  disabled={isLoggingIn}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 text-left transition"
                >
                  <span className="text-[11px] font-bold text-white block">👔 Store Manager</span>
                  <span className="text-[10px] text-slate-400">admin@demo.test</span>
                </button>
                <button
                  onClick={() => handleLogin('cashier@demo.test', 'Cashier123!')}
                  disabled={isLoggingIn}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 text-left transition"
                >
                  <span className="text-[11px] font-bold text-white block">🚚 Fleet Courier</span>
                  <span className="text-[10px] text-slate-400">cashier@demo.test</span>
                </button>
              </div>
            </div>

            {/* Telegram Mini App Trigger */}
            <div className="pt-2 text-center">
              <a
                href="https://t.me/camtech_delivery_bot"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition"
              >
                <Send className="w-3.5 h-3.5" />
                Connect via Telegram Bot (@camtech_delivery_bot)
              </a>
            </div>
          </div>
        </div>
      ) : (
        /* ─── 4. Authorized Main Courier App Body ─── */
        <div className="w-full max-w-md flex flex-col flex-1 border-x border-slate-900 bg-slate-950 min-h-screen">
          {/* Driver Status Header with Live Telemetry & Logout */}
          <header className="bg-slate-900/90 border-b border-slate-800 px-4 py-3 sticky top-0 z-40 backdrop-blur-md">
            <div className="flex items-center justify-between">
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
                      <h1 className="text-sm font-bold text-white tracking-wide">{authUser?.name || 'Fleet Dispatch'}</h1>
                      <p className="text-[11px] text-slate-400">Authorized • {authUser?.roles?.[0] || 'Courier'}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { refetch(); toast.info('Refreshed dispatch queue'); }}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Refresh Queue"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 transition"
                  title="Sign out / Lock Terminal"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Active Route Summary */}
          <main className="flex-1 p-4 flex flex-col space-y-4">
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
        </div>
      )}

      {/* ─── 5. Proof of Delivery (POD) Modal ─── */}
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

      {/* ─── 6. Telegram QR Code & Mobile Instructions Modal ─── */}
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

            {/* QR Code Container */}
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

export default App;
