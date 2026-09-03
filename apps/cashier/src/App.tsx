import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

interface PosItem {
  id: string;
  name: string;
  price: number;
  sku: string;
  category: string;
}

const POS_CATALOG: PosItem[] = [
  { id: '1', name: 'MacBook Pro 14 M3', price: 1999.00, sku: 'MBP-14', category: 'TECH' },
  { id: '2', name: 'AirPods Pro 2', price: 249.00, sku: 'APP-02', category: 'TECH' },
  { id: '3', name: '65W GaN Fast Charger', price: 39.99, sku: 'CHG-65', category: 'ACC' },
  { id: '4', name: 'USB-C to Lightning Cable', price: 19.00, sku: 'CBL-01', category: 'ACC' },
  { id: '5', name: 'Iced Latte 16oz', price: 3.50, sku: 'COF-LAT', category: 'CAFE' },
  { id: '6', name: 'Espresso Double Shot', price: 2.20, sku: 'COF-ESP', category: 'CAFE' },
  { id: '7', name: 'Bottled Mineral Water 500ml', price: 0.75, sku: 'DRK-WTR', category: 'DRINK' },
  { id: '8', name: 'Croissant Butter Fresh', price: 2.80, sku: 'BAK-CRS', category: 'CAFE' },
];

export function App() {
  const [cart, setCart] = useState<Array<PosItem & { quantity: number }>>([
    { ...POS_CATALOG[4], quantity: 2 },
    { ...POS_CATALOG[7], quantity: 1 },
  ]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [heldOrders, setHeldOrders] = useState<any[]>([]);
  const [receipt, setReceipt] = useState<any>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const categories = ['ALL', 'TECH', 'ACC', 'CAFE', 'DRINK'];

  const filteredItems = POS_CATALOG.filter((i) => {
    const matchesCat = selectedCategory === 'ALL' || i.category === selectedCategory;
    const matchesSearch =
      i.name.toLowerCase().includes(barcodeInput.toLowerCase()) ||
      i.sku.toLowerCase().includes(barcodeInput.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const tax = subtotal * 0.10; // 10% VAT
  const total = subtotal + tax;

  const addItem = (item: PosItem) => {
    const existing = cart.find((i) => i.id === item.id);
    if (existing) {
      setCart(cart.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(
      cart
        .map((i) => {
          if (i.id === id) {
            const next = i.quantity + delta;
            return next > 0 ? { ...i, quantity: next } : null;
          }
          return i;
        })
        .filter(Boolean) as Array<PosItem & { quantity: number }>
    );
  };

  const removeItem = (id: string) => {
    setCart(cart.filter((i) => i.id !== id));
  };

  const holdCurrentSale = () => {
    if (cart.length === 0) return;
    setHeldOrders([...heldOrders, { id: `held_${Date.now()}`, cart, total, time: new Date().toLocaleTimeString() }]);
    setCart([]);
    toast.info('Sale placed on hold.');
  };

  const resumeHeldSale = (index: number) => {
    const held = heldOrders[index];
    setCart(held.cart);
    setHeldOrders(heldOrders.filter((_, i) => i !== index));
    toast.success('Resumed held sale.');
  };

  const completePayment = (method: string) => {
    const saleNum = `#POS-${Math.floor(10000 + Math.random() * 90000)}`;
    setReceipt({
      saleNum,
      method,
      total,
      itemCount: cart.reduce((s, i) => s + i.quantity, 0),
      time: new Date().toLocaleTimeString(),
    });
    setCart([]);
    setIsPaymentOpen(false);
    toast.success(`Payment processed via ${method}! Cash drawer opened.`);
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none">
      <Toaster position="top-right" richColors closeButton />

      {/* ─── Top Terminal Bar ─── */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold shadow-md">
            POS
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-white">CamTech Cashier Terminal</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">
                cashier.camtech.cam
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Lane #01 • Cashier: Chem S. • Spec §232</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {heldOrders.length > 0 && (
            <button
              onClick={() => resumeHeldSale(0)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold"
            >
              <Play className="w-3.5 h-3.5" /> Resume Held ({heldOrders.length})
            </button>
          )}
          <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-mono text-[11px] border border-slate-700">
            Shift: Active (Opened 08:00)
          </span>
        </div>
      </header>

      {/* ─── Main POS Workspace ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Product Selection Grid */}
        <div className="flex-1 flex flex-col p-3 border-r border-slate-800 overflow-hidden">
          {/* Barcode & Search Input */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Barcode className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={barcodeInputRef}
                placeholder="Scan Barcode or Search Product SKU..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="w-full h-11 pl-10 pr-3 rounded-xl bg-slate-900 border border-slate-700 text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 pb-2 overflow-x-auto shrink-0 mb-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Quick-Pick Item Grid */}
          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pr-1">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => addItem(item)}
                className="p-3 rounded-xl bg-slate-900 hover:bg-slate-850 active:scale-98 border border-slate-800 hover:border-emerald-500/50 flex flex-col justify-between text-left transition-all group"
              >
                <div>
                  <span className="text-[10px] font-mono text-slate-500">{item.sku}</span>
                  <h4 className="font-bold text-xs text-white line-clamp-2 mt-0.5 group-hover:text-emerald-300">
                    {item.name}
                  </h4>
                </div>
                <div className="pt-2 border-t border-slate-800/80 mt-2 flex justify-between items-center w-full">
                  <span className="font-mono font-black text-emerald-400 text-sm">${item.price.toFixed(2)}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">+</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Cart & Payment Station */}
        <div className="w-96 bg-slate-900/90 flex flex-col justify-between p-4 border-l border-slate-800 shrink-0">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">Current Cart</h3>
              <button onClick={() => setCart([])} className="text-[11px] text-rose-400 hover:text-rose-300">
                Clear Cart
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs">
              {cart.length === 0 ? (
                <div className="text-center py-20 text-slate-500 text-xs">Cart is empty. Scan items to begin.</div>
              ) : (
                cart.map((i) => (
                  <div key={i.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-slate-200 line-clamp-1">{i.name}</span>
                      <span className="font-mono font-bold text-white">${(i.price * i.quantity).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">${i.price.toFixed(2)} each</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateQuantity(i.id, -1)}
                          className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
                        >
                          -
                        </button>
                        <span className="font-bold font-mono w-4 text-center">{i.quantity}</span>
                        <button
                          onClick={() => updateQuantity(i.id, 1)}
                          className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
                        >
                          +
                        </button>
                        <button onClick={() => removeItem(i.id)} className="text-slate-500 hover:text-rose-400 ml-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cart Financial Summary & Checkout Controls */}
          <div className="pt-3 border-t border-slate-800 space-y-2.5">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>VAT (10%):</span>
                <span className="font-mono font-semibold">${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-white pt-1 border-t border-slate-800">
                <span>Total Due:</span>
                <span className="text-xl font-mono text-emerald-400">${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={holdCurrentSale}
                disabled={cart.length === 0}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700"
              >
                <Pause className="w-3.5 h-3.5" /> Hold Sale
              </button>

              <button
                onClick={() => setIsPaymentOpen(true)}
                disabled={cart.length === 0}
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50"
              >
                <CreditCard className="w-3.5 h-3.5" /> Pay Now
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Payment Split Modal ─── */}
      {isPaymentOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white">Select Tender Method</h3>
              <button onClick={() => setIsPaymentOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-1">
              <span className="text-slate-400 text-xs">Amount Due</span>
              <div className="text-2xl font-black font-mono text-emerald-400">${total.toFixed(2)} USD</div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => completePayment('CASH')}
                className="p-3 rounded-xl bg-slate-800 hover:bg-emerald-600 text-white font-bold flex flex-col items-center gap-1.5 transition-colors border border-slate-700"
              >
                <Banknote className="w-5 h-5 text-emerald-400" />
                <span>Cash Drawer</span>
              </button>

              <button
                onClick={() => completePayment('BAKONG_KHQR')}
                className="p-3 rounded-xl bg-slate-800 hover:bg-rose-600 text-white font-bold flex flex-col items-center gap-1.5 transition-colors border border-slate-700"
              >
                <QrCode className="w-5 h-5 text-rose-400" />
                <span>Bakong KHQR</span>
              </button>

              <button
                onClick={() => completePayment('CARD')}
                className="p-3 rounded-xl bg-slate-800 hover:bg-sky-600 text-white font-bold flex flex-col items-center gap-1.5 transition-colors border border-slate-700"
              >
                <CreditCard className="w-5 h-5 text-sky-400" />
                <span>Card POS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Receipt Modal ─── */}
      {receipt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-xs w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center space-y-3 shadow-2xl text-xs">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white">Receipt Printed</h3>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-left font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Sale:</span>
                <span className="text-slate-200">{receipt.saleNum}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total:</span>
                <span className="text-emerald-400 font-bold">${receipt.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tender:</span>
                <span className="text-slate-200">{receipt.method}</span>
              </div>
            </div>
            <button
              onClick={() => setReceipt(null)}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
            >
              New Transaction
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
