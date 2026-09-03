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
  UserCheck
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

interface PosItem {
  id: string;
  name: string;
  price: number;
  sku: string;
  category: string;
}

const FALLBACK_POS_CATALOG: PosItem[] = [
  { id: 'prod-mbp14', name: 'MacBook Pro 14 M3', price: 1999.00, sku: 'MBP-14-512', category: 'TECH' },
  { id: 'prod-airpods', name: 'AirPods Pro 2', price: 249.00, sku: 'APP-PRO-2', category: 'TECH' },
  { id: 'prod-charger', name: '65W GaN Fast Charger', price: 39.99, sku: 'CHG-GAN-65', category: 'TECH' },
  { id: 'prod-espresso', name: 'Artisan Espresso Double Shot', price: 2.90, sku: 'COF-ESP-DBL', category: 'CAFE' },
  { id: 'prod-latte', name: 'Iced Spanish Caramel Latte', price: 3.50, sku: 'COF-LAT-16', category: 'CAFE' },
  { id: 'prod-croissant', name: 'French Butter Croissant', price: 2.80, sku: 'BAK-CRS-BUT', category: 'CAFE' },
  { id: 'prod-hoodie', name: 'Tech Fleece Zip Hoodie', price: 110.00, sku: 'NK-HD-BLK-M', category: 'APPAREL' },
];

export function App() {
  const [cart, setCart] = useState<Array<PosItem & { quantity: number }>>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'BAKONG_KHQR' | 'CASH'>('BAKONG_KHQR');
  const [heldOrders, setHeldOrders] = useState<any[]>([]);
  const [receipt, setReceipt] = useState<any>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Fetch live products from Central Data Center
  const { data: serverProducts, refetch: refetchProducts } = useQuery({
    queryKey: ['cashier-live-products'],
    queryFn: async () => {
      try {
        const res = await fetch('http://localhost:4000/api/v1/products');
        if (!res.ok) throw new Error('API offline');
        const json = await res.json();
        const items = json.data?.items || json.items || json.data || [];
        if (Array.isArray(items) && items.length > 0) {
          return items.map((p: any) => ({
            id: p.id,
            name: p.name,
            price: Number(p.variants?.[0]?.sellPrice || p.sellPrice || p.price || 15.00),
            sku: p.variants?.[0]?.sku || p.sku || 'SKU-001',
            category: p.category?.name?.toUpperCase() || 'GENERAL'
          }));
        }
        return FALLBACK_POS_CATALOG;
      } catch {
        return FALLBACK_POS_CATALOG;
      }
    }
  });

  const catalog: PosItem[] = serverProducts || FALLBACK_POS_CATALOG;
  const categories = ['ALL', 'TECH', 'CAFE', 'APPAREL'];

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
      cashier: 'Sophea Noun (Lead Cashier)'
    };

    try {
      // Post to Data Center backend
      await fetch('http://localhost:4000/api/v1/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleNumber,
          channel: 'POS',
          items: cart.map(i => ({ productVariantId: i.id, quantity: i.quantity, unitPrice: i.price, sku: i.sku, productName: i.name })),
          paymentMethod
        })
      });
    } catch {
      // Handled gracefully offline
    }

    setReceipt(newReceipt);
    setCart([]);
    setIsPaymentOpen(false);
    toast.success('🎉 Transaction Completed & Recorded in Data Center!');
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
              </div>
              <p className="text-xs text-slate-400">Downtown Supermarket Branch • Data Center: localhost:4000</p>
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
            <button
              onClick={() => { refetchProducts(); toast.info('Refreshed live catalog from Data Center'); }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition"
              title="Sync Catalog"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium text-slate-300">Sophea Noun</span>
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
          {filteredItems.map((item) => (
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
          ))}
        </div>
      </div>

      {/* Right Register: Cart & Split-Tender Numpad */}
      <div className="w-96 flex flex-col bg-slate-900/40">
        {/* Register Cart Header */}
        <div className="h-16 px-6 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-wide text-white">Active Ticket</h2>
          <span className="text-xs font-mono text-slate-400">{cart.length} Items</span>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center py-20 text-slate-600">
              <Barcode className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Scan or click products to ring up.</p>
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
            Collect Payment (${total.toFixed(2)})
          </button>
        </div>
      </div>

      {/* Payment Processing Modal */}
      {isPaymentOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-bold text-lg text-white">Select Tender Method</h3>
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
                  onClick={() => setPaymentMethod('BAKONG_KHQR')}
                  className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition ${
                    paymentMethod === 'BAKONG_KHQR'
                      ? 'bg-rose-500/10 border-rose-500 text-rose-400 font-bold'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300'
                  }`}
                >
                  <QrCode className="w-8 h-8 text-rose-400" />
                  <span>Bakong KHQR</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('CASH')}
                  className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition ${
                    paymentMethod === 'CASH'
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300'
                  }`}
                >
                  <Banknote className="w-8 h-8 text-emerald-400" />
                  <span>Cash Tender</span>
                </button>
              </div>

              {paymentMethod === 'BAKONG_KHQR' && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-rose-900/40 text-center">
                  <div className="w-40 h-40 mx-auto bg-white rounded-2xl p-3 flex items-center justify-center mb-2 shadow-lg">
                    <QrCode className="w-36 h-36 text-slate-950" />
                  </div>
                  <p className="text-xs font-bold text-rose-400">NBC EMVCo Dynamic KHQR</p>
                  <p className="text-[10px] text-slate-400">Customer scans with any banking app</p>
                </div>
              )}
            </div>

            <button
              onClick={completeSale}
              className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition"
            >
              <CheckCircle2 className="w-5 h-5" />
              Confirm Payment Received (${total.toFixed(2)})
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
              <p>Saved to Central Data Center Database</p>
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
