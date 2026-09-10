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
  Sparkles
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
  deliveryAddress: string;
  status: 'PENDING' | 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED';
  codAmount: number;
  paymentMethod?: string;
  proofOfDelivery?: string;
  notes?: string;
}

interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  roles: string[];
}

export function App() {
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

  // UI state
  const [orderTab, setOrderTab] = useState<'AVAILABLE' | 'ACTIVE' | 'COMPLETED'>('ACTIVE');
  const [selectedOrder, setSelectedOrder] = useState<DeliveryTask | null>(null);
  const [isPodOpen, setIsPodOpen] = useState(false);
  const [podNotes, setPodNotes] = useState('');
  const [podSignature, setPodSignature] = useState('');

  // Mobile / Telegram detection
  const [isDesktop, setIsDesktop] = useState(false);
  const [showDesktopAlert, setShowDesktopAlert] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isTelegramApp, setIsTelegramApp] = useState(false);

  // 1. Initialize Telegram WebApp & check auto-login
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    const tgInitData = tg?.initData || '';
    if (tg && tgInitData) {
      setIsTelegramApp(true);
      tg.ready?.();
      tg.expand?.();
    }
    setInitData(tgInitData);

    const checkViewport = () => {
      const isWide = window.innerWidth >= 768;
      setIsDesktop(isWide && !Boolean(tgInitData));
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);

    // Check cached credentials
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
          return () => window.removeEventListener('resize', checkViewport);
        }
      }
    } catch {}

    // Auto-login via Telegram WebApp if running in bot
    if (tgInitData) {
      fetch(`${API_BASE_URL}/api/v1/delivery/auth/login/auto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_init_data: tgInitData })
      })
        .then((res) => res.json())
        .then((res) => {
          const data = res.data || res;
          if (data.auth_status === 'ACTIVE' && data.access_token) {
            setToken(data.access_token);
            setUser(data.user);
            setAuthState('ACTIVE');
            localStorage.setItem('delivery-driver-auth', JSON.stringify({ token: data.access_token, user: data.user }));
          } else if (data.auth_status === 'PENDING_APPROVAL') {
            setAuthState('PENDING_APPROVAL');
          } else {
            setAuthState('UNREGISTERED');
          }
        })
        .catch(() => {
          setAuthState('UNREGISTERED');
        });
    } else {
      setAuthState('UNREGISTERED');
    }

    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Check authorization roles
  const userRoles = Array.isArray(user?.roles) ? user.roles : [];
  const isAuthorized = Boolean(
    token &&
    (userRoles.length === 0 || userRoles.some((r: string) =>
      ['DELIVERY_DRIVER', 'STORE_MANAGER', 'BRANCH_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN', 'WAREHOUSE_STAFF', 'CEO', 'CASHIER', 'ADMIN'].includes(r)
    ))
  );

  // Send OTP handler
  const handleInitRegister = async () => {
    if (!phoneNumber) return toast.error('Please enter your registered phone number');
    setIsAuthProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/delivery/auth/register/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber, telegram_init_data: initData })
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.detail || json.message || 'Phone number not found in admin registry');
      }
      setAuthState('OTP_PENDING');
      toast.success('OTP sent to your Telegram account!');
      if ((window as any).Telegram?.WebApp?.HapticFeedback) {
        (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setIsAuthProcessing(false);
    }
  };

  // Verify OTP handler
  const handleVerifyOtp = async () => {
    if (!otpCode) return toast.error('Please enter the 6-digit OTP code');
    setIsAuthProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/delivery/auth/register/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber, otp_code: otpCode, telegram_init_data: initData })
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.detail || json.message || 'Invalid or expired OTP code');
      }
      setAuthState('PENDING_APPROVAL');
      toast.success('OTP Verified! Waiting for admin approval.');
      if ((window as any).Telegram?.WebApp?.HapticFeedback) {
        (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    } catch (err: any) {
      toast.error(err.message || 'OTP verification failed');
    } finally {
      setIsAuthProcessing(false);
    }
  };

  // Traditional Email/Password Login Fallback
  const handlePasswordLogin = async (emailArg?: string, passArg?: string) => {
    const email = emailArg || loginEmail;
    const password = passArg || loginPassword;
    if (!email || !password) return toast.error('Enter email and password');
    setIsAuthProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.detail || json.message || 'Login failed. Check credentials.');
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
    toast.success('Logged out successfully');
  };

  // Fetch Delivery Orders (Polling every 3s)
  const { data: orders = [], isLoading } = useQuery<DeliveryTask[]>({
    queryKey: ['driver-deliveries'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/v1/delivery/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      const items = json.data || json || [];
      return Array.isArray(items) ? items.map((o: any) => ({
        ...o,
        deliveryAddress: o.deliveryAddress || o.destinationAddress || 'Store Pickup / Express Delivery',
      })) : [];
    },
    enabled: Boolean(token && authState === 'ACTIVE'),
    refetchInterval: 3000,
  });

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, signature, notes }: { id: string; status: string; signature?: string; notes?: string }) => {
      const res = await fetch(`${API_BASE_URL}/api/v1/delivery/orders/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status, proofOfDelivery: signature, notes })
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.detail || json.message || 'Failed to update delivery');
      }
      return json.data || json;
    },
    onSuccess: (updated) => {
      toast.success(`Order #${updated.trackingNumber || 'updated'} marked as ${updated.status}!`);
      queryClient.invalidateQueries({ queryKey: ['driver-deliveries'] });
      setIsPodOpen(false);
      setSelectedOrder(null);
      setPodNotes('');
      setPodSignature('');
      if ((window as any).Telegram?.WebApp?.HapticFeedback) {
        (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Status update failed');
    }
  });

  const pendingOrders = orders.filter((o) => o.status === 'PENDING');
  const activeOrders = orders.filter((o) => ['DISPATCHED', 'IN_TRANSIT'].includes(o.status));
  const completedOrders = orders.filter((o) => o.status === 'DELIVERED');
  const totalCodToCollect = activeOrders.reduce((sum, o) => sum + (Number(o.codAmount) > 0 ? Number(o.codAmount) : 0), 0);

  return (
    <div className="min-h-screen bg-[#F7F7F9] text-slate-900 flex flex-col items-center relative font-sans antialiased">
      <Toaster position="top-center" richColors />

      {/* ─── 1. Desktop View Notice ─── */}
      {isDesktop && showDesktopAlert && (
        <div className="w-full bg-slate-900 px-4 py-2.5 text-xs text-white z-50 sticky top-0 shadow-md">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-amber-400" />
              <span>Optimized for Mobile & Telegram Mini App. Open via <strong>@CamTechDeliverybot</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowQrModal(true)} className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-full text-[11px] transition">
                QR Code
              </button>
              <button onClick={() => setShowDesktopAlert(false)} className="p-1 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 2. Auth Flow Gate ─── */}
      {!isAuthorized || authState !== 'ACTIVE' ? (
        <div className="flex-1 flex items-center justify-center p-4 w-full max-w-md my-auto">
          <div className="w-full bg-white rounded-[2rem] p-8 shadow-xl border border-slate-100 space-y-6">
            
            {/* 2a. Checking State */}
            {authState === 'LOADING' && (
              <div className="text-center space-y-4 py-10">
                <RefreshCw className="w-12 h-12 text-amber-500 animate-spin mx-auto" />
                <h2 className="text-base font-bold text-slate-700">Verifying Driver Credentials...</h2>
                <p className="text-xs text-slate-400">Connecting to CamTech Telegram Security Gate</p>
              </div>
            )}

            {/* 2b. Pending Admin Approval */}
            {authState === 'PENDING_APPROVAL' && (
              <div className="text-center space-y-4 py-4">
                <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-2">
                  <Clock className="w-10 h-10 text-amber-500 animate-pulse" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Pending Approval</h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Your Telegram account is verified! A store manager or administrator is reviewing your driver profile.
                </p>
                <div className="pt-4 space-y-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-full font-bold py-3.5 text-sm transition shadow-sm flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" /> Check Status
                  </button>
                  <button
                    onClick={() => setAuthState('UNREGISTERED')}
                    className="text-xs text-slate-400 hover:text-slate-600 font-medium"
                  >
                    Use different phone number
                  </button>
                </div>
              </div>
            )}

            {/* 2c. Unregistered: Input Phone for OTP */}
            {authState === 'UNREGISTERED' && !showPasswordLogin && (
              <div className="space-y-6">
                <div className="space-y-2 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <Truck className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">CamTech Delivery</h2>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Enter your authorized phone number to receive your instant Telegram verification code.
                  </p>
                </div>

                <div className="space-y-4 pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 012345678"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 h-13 text-base font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-500 focus:bg-white transition"
                    />
                  </div>

                  <button
                    onClick={handleInitRegister}
                    disabled={isAuthProcessing || phoneNumber.length < 8}
                    className="w-full h-13 rounded-full bg-[#FDCB82] hover:bg-[#fab75b] disabled:opacity-50 text-amber-950 font-bold text-base shadow-sm transition flex items-center justify-center gap-2"
                  >
                    {isAuthProcessing ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" /> Send OTP via Telegram
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      onClick={() => setShowPasswordLogin(true)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                    >
                      Or sign in with Password / Demo Login
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 2d. OTP Verification Screen */}
            {authState === 'OTP_PENDING' && !showPasswordLogin && (
              <div className="space-y-6">
                <div className="space-y-2 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">Enter OTP Code</h2>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    We sent a 6-digit code to your Telegram chat via <strong>@CamTechDeliverybot</strong>.
                  </p>
                </div>

                <div className="space-y-4 pt-1">
                  <input
                    type="text"
                    placeholder="123456"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl text-center text-3xl tracking-[0.4em] font-mono font-bold text-slate-900 h-16 outline-none focus:border-emerald-500 focus:bg-white transition"
                  />

                  <button
                    onClick={handleVerifyOtp}
                    disabled={isAuthProcessing || otpCode.length !== 6}
                    className="w-full h-13 rounded-full bg-[#FDCB82] hover:bg-[#fab75b] disabled:opacity-50 text-amber-950 font-bold text-base shadow-sm transition flex items-center justify-center gap-2"
                  >
                    {isAuthProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Verify & Continue'}
                  </button>

                  <button
                    onClick={() => setAuthState('UNREGISTERED')}
                    className="w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600"
                  >
                    Change Phone Number
                  </button>
                </div>
              </div>
            )}

            {/* 2e. Password / Demo Access Fallback */}
            {showPasswordLogin && (
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center mx-auto mb-3">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Manager & Driver Login</h2>
                  <p className="text-xs text-slate-400">Sign in with registered system credentials</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="driver@demo.test"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    onClick={() => handlePasswordLogin()}
                    disabled={isAuthProcessing}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
                  >
                    {isAuthProcessing ? 'Signing In...' : 'Sign In'}
                  </button>
                </div>

                {/* Demo Logins */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">Quick Demo Accounts</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handlePasswordLogin('admin@demo.test', 'Admin123!')}
                      className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-left text-xs"
                    >
                      <div className="font-bold text-slate-900">Store Manager</div>
                      <div className="text-[10px] text-slate-500">admin@demo.test</div>
                    </button>
                    <button
                      onClick={() => handlePasswordLogin('cashier@demo.test', 'Cashier123!')}
                      className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-left text-xs"
                    >
                      <div className="font-bold text-slate-900">Fleet Courier</div>
                      <div className="text-[10px] text-slate-500">cashier@demo.test</div>
                    </button>
                  </div>
                </div>

                <div className="text-center pt-2">
                  <button
                    onClick={() => setShowPasswordLogin(false)}
                    className="text-xs text-amber-700 font-semibold hover:underline"
                  >
                    ← Back to Telegram OTP
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      ) : (
        /* ─── 3. Authorized Modern Dribbble Delivery Terminal ─── */
        <div className="w-full max-w-md flex flex-col flex-1 bg-[#F7F7F9] relative pb-28">
          
          {/* Header */}
          <header className="px-6 pt-8 pb-4 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center shadow-sm">
                  <User className="w-6 h-6 text-slate-500" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">Driver Terminal</div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">{user?.name || 'Active Courier'}</h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['driver-deliveries'] })}
                  className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 text-slate-700 hover:text-amber-600 transition"
                  title="Refresh Orders"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={handleLogout}
                  className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 text-slate-700 hover:text-rose-600 transition"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Shipment Overview Cards */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
                <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center mb-3 text-slate-800">
                  <Package className="w-4 h-4" />
                </div>
                <div className="text-2xl font-bold text-slate-900">{orders.length}</div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">Total Orders</div>
              </div>

              <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
                <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center mb-3 text-amber-700">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div className="text-2xl font-bold text-slate-900">${totalCodToCollect.toFixed(2)}</div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">COD to Collect</div>
              </div>
            </div>
          </header>

          {/* Orders Section */}
          <main className="flex-1 px-6 space-y-4">
            <div className="flex items-center justify-between pt-1">
              <h3 className="text-base font-bold text-slate-900">
                {orderTab === 'AVAILABLE' ? 'New Requests' : orderTab === 'ACTIVE' ? 'Active Route' : 'Completed'}
              </h3>
              <span className="text-xs font-bold px-2.5 py-1 bg-slate-200/80 rounded-full text-slate-700">
                {orderTab === 'AVAILABLE' ? pendingOrders.length : orderTab === 'ACTIVE' ? activeOrders.length : completedOrders.length} Shipments
              </span>
            </div>

            {isLoading ? (
              <div className="text-center py-16 text-sm text-slate-400 font-medium flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                Syncing live telemetry...
              </div>
            ) : orderTab === 'AVAILABLE' ? (
              /* ─── AVAILABLE ORDERS ─── */
              pendingOrders.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 text-slate-400 text-sm">
                  No new delivery requests right now.
                </div>
              ) : (
                pendingOrders.map((order) => (
                  <div key={order.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-400 font-mono">#{order.trackingNumber}</span>
                        <h4 className="text-base font-bold text-slate-900 mt-0.5">{order.recipientName}</h4>
                      </div>
                      <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full">
                        Pending
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5 text-xs text-slate-600">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <p className="leading-snug">{order.deliveryAddress}</p>
                    </div>

                    {Number(order.codAmount) > 0 && (
                      <div className="flex items-center justify-between text-xs font-bold bg-slate-50 p-2.5 rounded-xl text-slate-900">
                        <span className="text-slate-500">COD Payment</span>
                        <span className="text-amber-800 font-bold">${Number(order.codAmount).toFixed(2)}</span>
                      </div>
                    )}

                    <button
                      onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'DISPATCHED' })}
                      className="w-full h-11 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition shadow-sm"
                    >
                      Accept & Claim Order
                    </button>
                  </div>
                ))
              )
            ) : orderTab === 'ACTIVE' ? (
              /* ─── ACTIVE ORDERS ─── */
              activeOrders.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 text-slate-400 text-sm">
                  No active orders in transit. Check "New Requests" tab to claim orders!
                </div>
              ) : (
                activeOrders.map((order) => (
                  <div key={order.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-400 font-mono">#{order.trackingNumber}</span>
                        <h4 className="text-base font-bold text-slate-900 mt-0.5">{order.recipientName}</h4>
                      </div>
                      <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">
                        {order.status === 'IN_TRANSIT' ? 'In Transit' : 'Dispatched'}
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5 text-xs text-slate-600">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <p className="leading-snug">{order.deliveryAddress}</p>
                    </div>

                    {Number(order.codAmount) > 0 && (
                      <div className="flex items-center justify-between text-xs font-bold bg-amber-50/70 border border-amber-100 p-2.5 rounded-xl text-amber-950">
                        <span className="text-amber-800">Collect from Customer</span>
                        <span className="text-amber-900 font-bold text-sm">${Number(order.codAmount).toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2.5 pt-1">
                      <a
                        href={`tel:${order.recipientPhone}`}
                        className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 shrink-0 transition"
                      >
                        <Phone className="w-4 h-4" />
                      </a>

                      {order.status === 'DISPATCHED' ? (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'IN_TRANSIT' })}
                          className="flex-1 h-11 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition shadow-sm"
                        >
                          Start Navigation
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setIsPodOpen(true);
                          }}
                          className="flex-1 h-11 rounded-full bg-[#FDCB82] hover:bg-[#fab75b] text-amber-950 font-bold text-xs transition shadow-sm"
                        >
                          Deliver & Collect Signature
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )
            ) : (
              /* ─── COMPLETED ORDERS ─── */
              completedOrders.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 text-slate-400 text-sm">
                  No completed deliveries yet today.
                </div>
              ) : (
                completedOrders.map((order) => (
                  <div key={order.id} className="bg-white p-4 rounded-3xl border border-slate-100 opacity-80 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-400 font-mono">#{order.trackingNumber}</span>
                      <h4 className="text-sm font-bold text-slate-800 mt-0.5">{order.recipientName}</h4>
                      <p className="text-[11px] text-slate-400 truncate max-w-[200px]">{order.deliveryAddress}</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Delivered
                    </span>
                  </div>
                ))
              )
            )}
          </main>

          {/* ─── Floating Bottom Navigation (Dribbble Pill) ─── */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-950 rounded-full px-3 py-2 flex items-center gap-2 shadow-2xl z-40 border border-slate-800">
            <button
              onClick={() => setOrderTab('AVAILABLE')}
              className={`flex items-center justify-center w-11 h-11 rounded-full transition-all relative ${
                orderTab === 'AVAILABLE' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Available"
            >
              <Package className="w-5 h-5" />
              {pendingOrders.length > 0 && orderTab !== 'AVAILABLE' && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-950"></span>
              )}
            </button>

            <button
              onClick={() => setOrderTab('ACTIVE')}
              className={`flex items-center justify-center w-11 h-11 rounded-full transition-all ${
                orderTab === 'ACTIVE' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Active Route"
            >
              <MapIcon className="w-5 h-5" />
            </button>

            <button
              onClick={() => setOrderTab('COMPLETED')}
              className={`flex items-center justify-center w-11 h-11 rounded-full transition-all ${
                orderTab === 'COMPLETED' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Completed"
            >
              <CheckCircle2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* ─── 4. Proof of Delivery (POD) Modal ─── */}
      {isPodOpen && selectedOrder && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-2"></div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Complete Delivery</h3>
                <p className="text-xs text-slate-500 font-mono">#{selectedOrder.trackingNumber} • {selectedOrder.recipientName}</p>
              </div>
              <button onClick={() => setIsPodOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {Number(selectedOrder.codAmount) > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-between text-xs">
                <span className="font-bold text-amber-900">Cash on Delivery (COD)</span>
                <span className="text-base font-bold text-amber-700">${Number(selectedOrder.codAmount).toFixed(2)}</span>
              </div>
            )}

            <div className="space-y-3 pt-1">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Recipient Name / Signature</label>
                <input
                  type="text"
                  placeholder="e.g. Sopheak Chan"
                  value={podSignature}
                  onChange={(e) => setPodSignature(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Delivery Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Handed directly to customer"
                  value={podNotes}
                  onChange={(e) => setPodNotes(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-amber-500"
                />
              </div>

              <button
                onClick={() =>
                  updateStatusMutation.mutate({
                    id: selectedOrder.id,
                    status: 'DELIVERED',
                    signature: podSignature || selectedOrder.recipientName,
                    notes: podNotes || 'Handed to recipient.'
                  })
                }
                disabled={updateStatusMutation.isPending}
                className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-bold text-xs shadow-md transition flex items-center justify-center gap-2 mt-2"
              >
                {updateStatusMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Confirm & Mark Delivered'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 5. QR Code Modal for Mobile Access ─── */}
      {showQrModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full text-center space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Open on Phone</h3>
              <button onClick={() => setShowQrModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center">
              <QrCode className="w-36 h-36 text-slate-800" />
            </div>
            <p className="text-xs text-slate-500">Scan to open the delivery terminal in Telegram</p>
          </div>
        </div>
      )}
    </div>
  );
}
