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
  Package
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

interface PosItem {
  id: string;
  name: string;
  price: number;
  sku: string;
  category: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function App() {
  const [cart, setCart] = useState<Array<PosItem & { quantity: number }>>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'BAKONG_KHQR' | 'CASH'>('CASH');
  const [receipt, setReceipt] = useState<any>(null);
  const [cashierName, setCashierName] = useState<string>(() => {
    try {
      return localStorage.getItem('mystore_pos_cashier_name') || 'Lead Cashier (POS-01)';
    } catch {
      return 'Lead Cashier (POS-01)';
    }
  });

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

    let syncedCount = 0;
    const remaining = [];

    for (const sale of queue) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/sales`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sale),
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
          syncedCount++;
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
      items: cart.map(i => ({ productVariantId: i.id, quantity: i.quantity, unitPrice: i.price, sku: i.sku, productName: i.name })),
      paymentMethod,
      timestamp: new Date().toISOString()
    };

    let synced = false;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      <Toaster position="top-right" richColors />

      {/* Main Terminal Left: Catalog & Quick Actions */}
      <div className="flex-1 flex flex-col border-r border-slate-800">
        {/* POS Top Header */}
        <header className="h-16 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
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
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <input
                type="text"
                value={cashierName}
                onChange={(e) => {
                  setCashierName(e.target.value);
                  localStorage.setItem('mystore_pos_cashier_name', e.target.value);
                }}
                className="text-xs font-medium text-slate-300 bg-transparent border-none focus:outline-none w-36"
                title="POS Cashier Operator Name"
                placeholder="Cashier Operator"
              />
            </div>
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
            filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 flex flex-col justify-between text-left transition transform active:scale-95 group shadow-sm hover:shadow-lg hover:shadow-amber-500/5"
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
      <div className="w-96 flex flex-col bg-slate-900/40">
        {/* Register Cart Header */}
        <div className="h-16 px-6 border-b border-slate-800 flex items-center justify-between">
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
            className="w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition active:scale-98"
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
    </div>
  );
}

export default App;
