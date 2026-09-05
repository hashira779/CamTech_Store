import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Store,
  Barcode,
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  QrCode,
  CheckCircle2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Printer,
  X,
  RefreshCw,
  UserCheck,
  Wifi,
  WifiOff,
  CloudOff,
  Database,
  Package,
  Lock,
  Unlock,
  LogOut,
  Key,
  ShieldCheck,
  AlertCircle,
  Loader2,
  User
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

interface PosItem {
  id: string;
  variantId: string;
  name: string;
  price: number;
  sku: string;
  category: string;
}

interface CashierUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

const API_BASE_URL = (() => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return window.location.origin;
    }
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:4000';
})();

export function App() {
  const [cart, setCart] = useState<Array<PosItem & { quantity: number }>>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'BAKONG_KHQR' | 'CASH'>('CASH');
  const [receipt, setReceipt] = useState<any>(null);

  // Cashier Authentication & Shift State
  const [cashierUser, setCashierUser] = useState<CashierUser | null>(() => {
    try {
      const saved = localStorage.getItem('mystore_pos_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [cashierToken, setCashierToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('mystore_pos_token') || null;
    } catch {
      return null;
    }
  });

  const [cashierName, setCashierName] = useState<string>(() => {
    try {
      const savedUser = localStorage.getItem('mystore_pos_user');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        if (u?.name) return u.name;
      }
      return localStorage.getItem('mystore_pos_cashier_name') || 'Cashier Operator';
    } catch {
      return 'Cashier Operator';
    }
  });

  // Shift Lock Gate: If not authenticated, require shift login
  const [isRegisterLocked, setIsRegisterLocked] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('mystore_pos_token') && !localStorage.getItem('mystore_pos_user');
    } catch {
      return true;
    }
  });

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [offlineOperatorName, setOfflineOperatorName] = useState('');
  const [loginMode, setLoginMode] = useState<'CREDENTIALS' | 'OFFLINE_EMERGENCY'>('CREDENTIALS');

  // Offline-First Fault Isolation & Outbox State
  const [isServerOnline, setIsServerOnline] = useState<boolean>(true);
  const [offlineQueue, setOfflineQueue] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('mystore_pos_offline_queue') || '[]');
    } catch {
      return [];
    }
  });

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Monitor Central Database / API Gateway Health
  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(1500),
        });
        if (res.ok) {
          setIsServerOnline(true);
          // Auto-sync offline queue if items exist
          syncOfflineQueue();
        } else {
          setIsServerOnline(false);
        }
      } catch {
        setIsServerOnline(false);
      }
    };

    checkServerHealth();
    const interval = setInterval(checkServerHealth, 4000);
    return () => clearInterval(interval);
  }, []);

  const syncOfflineQueue = async () => {
    const queue = JSON.parse(localStorage.getItem('mystore_pos_offline_queue') || '[]');
    if (queue.length === 0) return;

    const token = localStorage.getItem('mystore_pos_token');
    let syncedCount = 0;
    const remaining = [];

    for (const sale of queue) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(`${API_BASE_URL}/api/v1/sales`, {
          method: 'POST',
          headers,
          body: JSON.stringify(sale),
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
          syncedCount++;
        } else if (res.status >= 400 && res.status < 500) {
          // Client error (bad payload, auth issues) — drop from queue, don't retry forever
          console.warn(`Dropping invalid offline sale (HTTP ${res.status}):`, sale.saleNumber);
          syncedCount++; // Count as handled
        } else {
          remaining.push(sale);
        }
      } catch {
        remaining.push(sale);
      }
    }

    localStorage.setItem('mystore_pos_offline_queue', JSON.stringify(remaining));
    setOfflineQueue(remaining);

    if (syncedCount > 0) {
      toast.success(`⚡ Auto-Synced ${syncedCount} offline sale(s) to Central Database!`);
    }
  };

  // Fetch live products from Central Data Center
  const { data: serverProducts, isLoading: isCatalogLoading, refetch: refetchProducts } = useQuery({
    queryKey: ['cashier-live-products'],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/public/products`, { signal: AbortSignal.timeout(2000) });
        if (!res.ok) throw new Error('API offline');
        const json = await res.json();
        const items = json.data?.items || json.items || json.data || [];
        if (Array.isArray(items)) {
          const mapped = items.map((p: any) => ({
            id: p.id,
            variantId: p.variants?.[0]?.id || p.id,
            name: p.name,
            price: Number(p.variants?.[0]?.sellPrice ?? p.sellPrice ?? p.price ?? 0),
            sku: p.variants?.[0]?.sku || p.sku || `SKU-${p.id.slice(0, 6)}`,
            category: p.category?.name?.toUpperCase() || p.category?.toUpperCase() || 'GENERAL'
          }));
          localStorage.setItem('mystore_pos_cached_catalog', JSON.stringify(mapped));
          return mapped;
        }
        return [];
      } catch {
        // Fallback to local offline catalog cached in browser/container
        const cached = localStorage.getItem('mystore_pos_cached_catalog');
        return cached ? JSON.parse(cached) : [];
      }
    }
  });

  const catalog: PosItem[] = serverProducts || [];
  const categories = React.useMemo(() => {
    const set = new Set(catalog.map((i) => i.category).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [catalog]);

  const filteredItems = catalog.filter((i) => {
    const matchesCat = selectedCategory === 'ALL' || i.category.includes(selectedCategory);
    const matchesSearch =
      i.name.toLowerCase().includes(barcodeInput.toLowerCase()) ||
      i.sku.toLowerCase().includes(barcodeInput.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const tax = subtotal * 0.10;
  const total = subtotal + tax;

  const addToCart = (item: PosItem) => {
    setCart((prev) => {
      const exists = prev.find((i) => i.id === item.id);
      if (exists) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const found = catalog.find(
      (i) => i.sku.toLowerCase() === barcodeInput.trim().toLowerCase()
    );

    if (found) {
      addToCart(found);
      toast.success(`Scanned: ${found.name}`);
      setBarcodeInput('');
    } else {
      toast.error(`Barcode / SKU "${barcodeInput}" not found!`);
    }
  };

  const handleCashierLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('Please enter both email and password.');
      return;
    }
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
        signal: AbortSignal.timeout(5000),
      });

      const json = await res.json();
      const data = json.data || json;

      if (!res.ok || !data?.accessToken) {
        throw new Error(data?.detail || json?.detail || 'Invalid email or password');
      }

      const user: CashierUser = {
        id: data.user?.id || 'cashier-user',
        email: data.user?.email || loginEmail.trim(),
        name: data.user?.name || loginEmail.trim().split('@')[0],
        roles: data.user?.roles || ['CASHIER'],
      };

      setCashierToken(data.accessToken);
      setCashierUser(user);
      setCashierName(user.name);
      localStorage.setItem('mystore_pos_token', data.accessToken);
      localStorage.setItem('mystore_pos_user', JSON.stringify(user));
      localStorage.setItem('mystore_pos_cashier_name', user.name);
      localStorage.setItem('mystore_pos_shift_start', new Date().toISOString());

      setIsRegisterLocked(false);
      setLoginPassword('');
      toast.success(`👋 Welcome, ${user.name}! Shift active.`);
    } catch (err: any) {
      console.error('POS Cashier login failed:', err);
      setLoginError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleOfflineEmergencyUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!offlineOperatorName.trim()) {
      setLoginError('Please enter operator name for offline shift.');
      return;
    }
    const operator: CashierUser = {
      id: `offline-${Date.now()}`,
      email: `${offlineOperatorName.trim().toLowerCase().replace(/\s+/g, '.')}@offline.pos`,
      name: offlineOperatorName.trim(),
      roles: ['CASHIER', 'OFFLINE_OPERATOR'],
    };
    setCashierUser(operator);
    setCashierName(operator.name);
    localStorage.setItem('mystore_pos_user', JSON.stringify(operator));
    localStorage.setItem('mystore_pos_cashier_name', operator.name);
    localStorage.setItem('mystore_pos_shift_start', new Date().toISOString());
    setIsRegisterLocked(false);
    toast.warning(`⚡ Registered as Offline Operator: ${operator.name}`);
  };

  const handleLockRegister = () => {
    setIsRegisterLocked(true);
    toast.info('🔒 Register locked. Shift paused.');
  };

  const handleSwitchCashier = () => {
    localStorage.removeItem('mystore_pos_token');
    localStorage.removeItem('mystore_pos_user');
    localStorage.removeItem('mystore_pos_shift_start');
    setCashierToken(null);
    setCashierUser(null);
    setIsRegisterLocked(true);
    toast.info('👋 Cashier shift ended. Register locked.');
  };

  const completeSale = async () => {
    const saleNumber = `POS-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const newReceipt = {
      saleNumber,
      items: [...cart],
      subtotal,
      tax,
      total,
      method: paymentMethod,
      timestamp: new Date().toLocaleTimeString(),
      cashier: cashierName,
      isOffline: !isServerOnline
    };

    const salePayload = {
      saleNumber,
      channel: 'POS',
      items: cart.map(i => ({ variantId: i.variantId, quantity: i.quantity })),
      payments: [{ method: paymentMethod, amount: total }],
      timestamp: new Date().toISOString(),
      cashierId: cashierUser?.id,
      cashierName: cashierName
    };

    let synced = false;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cashierToken) {
        headers['Authorization'] = `Bearer ${cashierToken}`;
      }
      const res = await fetch(`${API_BASE_URL}/api/v1/sales`, {
        method: 'POST',
        headers,
        body: JSON.stringify(salePayload),
        signal: AbortSignal.timeout(2000)
      });
      if (res.ok) {
        synced = true;
        try {
          const json = await res.json();
          if (json?.saleNumber) {
            newReceipt.saleNumber = json.saleNumber;
          }
        } catch {}
      }
    } catch {
      synced = false;
    }

    if (!synced) {
      // Offline-First Outbox Queue: Save to local isolated container storage!
      const currentQueue = JSON.parse(localStorage.getItem('mystore_pos_offline_queue') || '[]');
      const updatedQueue = [...currentQueue, salePayload];
      localStorage.setItem('mystore_pos_offline_queue', JSON.stringify(updatedQueue));
      setOfflineQueue(updatedQueue);
      toast.warning('⚠️ Central Database is DOWN! Transaction saved safely in POS Local Container.');
    } else {
      toast.success('🎉 Transaction Completed & Synced to Data Center!');
    }

    setReceipt(newReceipt);
    setCart([]);
    setIsPaymentOpen(false);
  };

  return (
    <div className="flex h-screen text-slate-100 overflow-hidden select-none">
      <Toaster position="top-right" richColors />

      {/* Main Terminal Left: Catalog & Quick Actions */}
      <div className="flex-1 flex flex-col relative z-10">
        {/* POS Top Header */}
        <header className="h-16 px-6 glass flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/30 to-emerald-900/30 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center justify-center font-bold">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-wide">Terminal POS-01</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">
                  PORT 5003
                </span>
                {/* Fault Isolation Status Badge */}
                {isServerOnline ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Server: ONLINE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                    <CloudOff className="w-3 h-3" />
                    Server: DOWN (Running Locally in Container)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Downtown Supermarket Branch • Isolated POS Container</p>
            </div>
          </div>

          {/* Barcode Quick Scanner Form */}
          <form onSubmit={handleBarcodeSubmit} className="flex-1 max-w-sm mx-6 relative">
            <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan Barcode / SKU (e.g. MBP-14-512)..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </form>

          <div className="flex items-center gap-3">
            {offlineQueue.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold">
                <Database className="w-3.5 h-3.5" />
                <span>{offlineQueue.length} Queued Locally</span>
              </div>
            )}
            <button
              onClick={() => { refetchProducts(); toast.info('Refreshed local catalog cache'); }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition"
              title="Sync Catalog"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {/* Cashier Badge & Lock Register Controls */}
            {cashierUser ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    <UserCheck className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-white leading-tight max-w-[120px] truncate">{cashierUser.name}</p>
                    <p className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      {cashierUser.roles?.[0] || 'CASHIER'} • ACTIVE
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLockRegister}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700/50"
                  title="Lock Register / Pause Shift"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Lock</span>
                </button>
                <button
                  onClick={handleSwitchCashier}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 text-xs transition border border-slate-700/50"
                  title="Log Out Cashier / Switch Shift"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsRegisterLocked(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 text-xs font-bold transition"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Unlock Register</span>
              </button>
            )}
          </div>
        </header>

        {/* Category Filter Bar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/30 flex items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 p-6 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {isCatalogLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between animate-pulse space-y-4 shadow-sm"
              >
                <div>
                  <div className="w-16 h-3.5 bg-slate-800 rounded mb-2.5"></div>
                  <div className="w-3/4 h-5 bg-slate-800 rounded mb-1.5"></div>
                  <div className="w-1/2 h-3.5 bg-slate-800/60 rounded"></div>
                </div>
                <div className="mt-4 pt-2.5 border-t border-slate-800/60 flex items-center justify-between w-full">
                  <div className="w-12 h-3 bg-slate-800/50 rounded"></div>
                  <div className="w-16 h-5 bg-emerald-500/20 rounded"></div>
                </div>
              </div>
            ))
          ) : filteredItems.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-500">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-30 animate-pulse" />
              <p className="text-xs font-medium">No items found matching filter</p>
            </div>
          ) : (
            filteredItems.map((item, index) => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                style={{ animationDelay: `${index * 50}ms` }}
                className="product-card animate-fade-in-up p-5 rounded-2xl flex flex-col justify-between text-left cursor-pointer"
              >
                <div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                    {item.sku}
                  </span>
                  <h4 className="text-sm font-bold text-white mt-2 group-hover:text-amber-400 transition line-clamp-2">
                    {item.name}
                  </h4>
                </div>
                <div className="mt-4 pt-2 border-t border-slate-800/80 flex items-center justify-between w-full">
                  <span className="text-xs text-slate-500">{item.category}</span>
                  <span className="text-base font-mono font-bold text-emerald-400">
                    ${item.price.toFixed(2)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Register: Cart & Split-Tender Numpad */}
      <div className="w-[400px] flex flex-col glass-panel z-20 border-l border-white/10 relative shadow-[-20px_0_40px_rgba(0,0,0,0.3)]">
        {/* Register Cart Header */}
        <div className="h-16 px-6 border-b border-white/5 flex items-center justify-between bg-white/5">
          <h2 className="text-sm font-bold tracking-wide text-white">Active Register Cart</h2>
          <span className="text-xs font-mono text-slate-400">{cart.length} Items</span>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center py-20 text-slate-600">
              <Barcode className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Scan or click products to ring up.</p>
              {!isServerOnline && (
                <p className="text-[10px] text-amber-400/80 mt-1">Autonomous container mode active.</p>
              )}
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-xs font-bold text-white truncate">{item.name}</p>
                  <p className="text-[10px] font-mono text-emerald-400">${item.price.toFixed(2)} each</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-bold font-mono w-4 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals & Quick Action Bar */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/80 space-y-3">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Subtotal</span>
            <span className="font-mono text-slate-200">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>10% Tax</span>
            <span className="font-mono text-slate-200">${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800">
            <span>Total Payable</span>
            <span className="font-mono text-emerald-400 text-xl">${total.toFixed(2)}</span>
          </div>

          <button
            disabled={cart.length === 0}
            onClick={() => setIsPaymentOpen(true)}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 disabled:grayscale text-slate-950 font-extrabold text-base flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all active:scale-[0.98]"
          >
            <Banknote className="w-5 h-5" />
            Collect Tender (${total.toFixed(2)})
          </button>
        </div>
      </div>

      {/* Payment Processing Modal */}
      {isPaymentOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-lg text-white">Select Tender Method</h3>
                {!isServerOnline && (
                  <p className="text-[11px] text-amber-400">⚡ Server Down: Cash payment & receipt work 100% offline.</p>
                )}
              </div>
              <button
                onClick={() => setIsPaymentOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentMethod('CASH')}
                  className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition ${
                    paymentMethod === 'CASH'
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300'
                  }`}
                >
                  <Banknote className="w-8 h-8 text-emerald-400" />
                  <span>Cash Payment</span>
                  <span className="text-[10px] text-slate-400 font-normal">Offline Ready</span>
                </button>

                <button
                  onClick={() => setPaymentMethod('BAKONG_KHQR')}
                  className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition ${
                    paymentMethod === 'BAKONG_KHQR'
                      ? 'bg-rose-500/10 border-rose-500 text-rose-400 font-bold'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300'
                  }`}
                >
                  <QrCode className="w-8 h-8 text-rose-400" />
                  <span>Bakong KHQR</span>
                  <span className="text-[10px] text-slate-400 font-normal">Static / Offline EMVCo</span>
                </button>
              </div>

              {paymentMethod === 'BAKONG_KHQR' && (
                <div className="p-4 rounded-2xl bg-gradient-to-b from-rose-950/40 to-slate-950 border border-rose-800/40 text-center space-y-2.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600 text-white font-bold text-[10px] tracking-wider uppercase shadow-md shadow-rose-600/30">
                    <span>KHQR</span> • <span>National Bank of Cambodia</span>
                  </div>
                  <div className="w-48 h-48 mx-auto bg-white rounded-2xl p-3 flex flex-col items-center justify-center shadow-xl shadow-rose-950/50 relative border-2 border-rose-500">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                        `00020101021229380016bakong@nbc.org.kh0108CAMTECH1520459995303840540${total.toFixed(2)}5802KH5912CAMTECH_STORE6010Phnom_Penh6304`
                      )}`}
                      alt="NBC Bakong KHQR"
                      className="w-40 h-40 object-contain"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-white font-mono">${total.toFixed(2)} USD</p>
                    <p className="text-[10px] text-rose-300/80">Scan with ABA Mobile, Wing, ACLEDA, or any Bakong App</p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={completeSale}
              className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition"
            >
              <CheckCircle2 className="w-5 h-5" />
              Complete Sale (${total.toFixed(2)})
            </button>
          </div>
        </div>
      )}

      {/* Digital Receipt Modal */}
      {receipt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white text-slate-900 rounded-3xl p-6 shadow-2xl font-mono text-xs">
            <div className="text-center pb-4 border-b border-dashed border-slate-300">
              <h3 className="text-base font-extrabold uppercase">CamTech Supermarket</h3>
              <p className="text-[11px] text-slate-500">Downtown BKK1 Branch • Phnom Penh</p>
              <p className="text-[10px] text-slate-400 mt-1">{receipt.saleNumber} • {receipt.timestamp}</p>
              {receipt.isOffline && (
                <span className="inline-block mt-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                  ⚡ PROCESSED IN OFFLINE CONTAINER MODE
                </span>
              )}
            </div>

            <div className="py-4 space-y-2 border-b border-dashed border-slate-300">
              {receipt.items.map((i: any) => (
                <div key={i.id} className="flex justify-between">
                  <span className="truncate max-w-[180px]">{i.name} x{i.quantity}</span>
                  <span className="font-bold">${(i.price * i.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="py-3 space-y-1 border-b border-dashed border-slate-300">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${receipt.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>VAT (10%):</span>
                <span>${receipt.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-1">
                <span>TOTAL:</span>
                <span>${receipt.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Tender:</span>
                <span>{receipt.method}</span>
              </div>
            </div>

            <div className="text-center pt-4 text-[10px] text-slate-400">
              <p>Thank you for shopping with CamTech!</p>
              <p>{receipt.isOffline ? 'Queued in Local POS Container' : 'Saved to Central Database'}</p>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Receipt
              </button>
              <button
                onClick={() => setReceipt(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cashier Shift Login & Register Lock Gate Modal */}
      {isRegisterLocked && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 flex flex-col space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10">
                <Lock className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-wide">Register POS-01 Shift Gate</h2>
              <p className="text-xs text-slate-400">
                Authorized staff sign-in required to unlock cashier register and issue sales receipts.
              </p>
              
              {/* Server Connectivity Pill */}
              <div className="pt-1 flex justify-center">
                {isServerOnline ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Central Data Center: Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <CloudOff className="w-3.5 h-3.5" />
                    Container Mode: Offline Resilient
                  </span>
                )}
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setLoginMode('CREDENTIALS'); setLoginError(null); }}
                className={`py-2 rounded-lg transition ${
                  loginMode === 'CREDENTIALS'
                    ? 'bg-amber-500 text-slate-950 shadow font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Staff Credentials
              </button>
              <button
                type="button"
                onClick={() => { setLoginMode('OFFLINE_EMERGENCY'); setLoginError(null); }}
                className={`py-2 rounded-lg transition ${
                  loginMode === 'OFFLINE_EMERGENCY'
                    ? 'bg-amber-500 text-slate-950 shadow font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Offline Operator
              </button>
            </div>

            {/* Error Message */}
            {loginError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {loginMode === 'CREDENTIALS' ? (
              <form onSubmit={handleCashierLogin} className="space-y-4">
                <div className="space-y-1 text-left">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Email or Staff ID</label>
                  <input
                    type="text"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="cashier@demo.test"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"
                  />
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Password / PIN</label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"
                  />
                </div>

                {/* Quick Autofill Presets */}
                <div className="pt-1 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginEmail('cashier@demo.test');
                      setLoginPassword('Cashier123!');
                    }}
                    className="text-[10px] font-medium px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  >
                    Quick: Demo Cashier
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginEmail('admin@demo.test');
                      setLoginPassword('Admin123!');
                    }}
                    className="text-[10px] font-medium px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  >
                    Quick: Super Admin
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full mt-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Authenticating Shift...</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4" />
                      <span>Unlock Register & Start Shift</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleOfflineEmergencyUnlock} className="space-y-4">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-relaxed">
                  ⚡ <strong>Emergency Standalone Mode:</strong> When Central Database is unreachable, sign in as a local operator. Sales will be safely queued in local container storage and synced automatically once online.
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Cashier Operator Name</label>
                  <input
                    type="text"
                    required
                    value={offlineOperatorName}
                    onChange={(e) => setOfflineOperatorName(e.target.value)}
                    placeholder="e.g. Sokha Vathanak"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Unlock Offline Register</span>
                </button>
              </form>
            )}

            {/* Footer reassurance */}
            <div className="text-center pt-2 border-t border-slate-800/80">
              <p className="text-[10px] text-slate-500">
                CamTech Multi-Store Commerce • Protected Register Terminal POS-01
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
