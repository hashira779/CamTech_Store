import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingBag,
  Search,
  ShoppingCart,
  QrCode,
  Truck,
  CheckCircle2,
  X,
  Plus,
  Minus,
  Sparkles,
  Store,
  CreditCard,
  Package,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

interface ProductItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  sku: string;
  category: string;
}

const SAMPLE_STORE_PRODUCTS: ProductItem[] = [
  { id: 'p1', name: 'MacBook Pro 14 M3', price: 1999.00, sku: 'MBP-14-M3', category: 'ELECTRONICS', description: 'Apple M3 Pro chip, 18GB Unified Memory, 512GB SSD Storage' },
  { id: 'p2', name: 'Sony WH-1000XM5 Noise Canceling', price: 349.00, sku: 'SNY-WH-XM5', category: 'ELECTRONICS', description: 'Industry-leading noise canceling with Auto NC Optimizer' },
  { id: 'p3', name: 'Premium Arabica Coffee Beans 1kg', price: 28.50, sku: 'COF-ARB-1K', category: 'GROCERIES', description: 'Organic fair-trade roasted single-origin whole bean coffee' },
  { id: 'p4', name: 'Ultra-Fast 65W GaN Charger', price: 39.99, sku: 'CHG-GAN-65', category: 'ACCESSORIES', description: 'Dual USB-C Power Delivery 3.0 compact travel wall adapter' },
  { id: 'p5', name: 'Mechanical Gaming Keyboard RGB', price: 129.00, sku: 'KB-MEC-RGB', category: 'ELECTRONICS', description: 'Hot-swappable tactile switches with per-key RGB backlighting' },
  { id: 'p6', name: 'Stainless Steel Insulated Bottle 1L', price: 24.00, sku: 'BTL-SS-1L', category: 'GROCERIES', description: 'Double-wall vacuum insulation keeps cold 24h, hot 12h' },
];

export function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cart, setCart] = useState<Array<ProductItem & { quantity: number }>>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'KHQR' | 'COD'>('KHQR');
  const [customerName, setCustomerName] = useState('Customer');
  const [customerPhone, setCustomerPhone] = useState('012 999 888');
  const [deliveryAddress, setDeliveryAddress] = useState('Street 310, BKK1, Phnom Penh');
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);

  const categories = ['ALL', 'ELECTRONICS', 'GROCERIES', 'ACCESSORIES'];

  const filteredProducts = SAMPLE_STORE_PRODUCTS.filter((p) => {
    const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const addToCart = (product: ProductItem) => {
    const existing = cart.find((i) => i.id === product.id);
    if (existing) {
      setCart(cart.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    toast.success(`Added ${product.name} to cart`);
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
        .filter(Boolean) as Array<ProductItem & { quantity: number }>
    );
  };

  const handleCheckoutSubmit = () => {
    const trackingNum = `TRK-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    setConfirmedOrder({
      orderNumber: `#ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      trackingNumber: trackingNum,
      totalAmount: cartTotal,
      customerName,
      deliveryAddress,
      paymentMethod: paymentMethod === 'KHQR' ? 'Bakong KHQR (Paid)' : 'Cash On Delivery',
      itemCount: cartCount,
    });
    setCart([]);
    setIsCheckoutOpen(false);
    toast.success('Order placed successfully! Dispatched for delivery.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Toaster position="top-right" richColors closeButton />

      {/* ─── Store Navigation Bar ─── */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">CamTech Store</span>
                <span className="text-[10px] bg-sky-500/20 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded-md font-mono">
                  store.camtech.cam
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Independent E-Commerce Web System (Spec §230)</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative hidden md:block w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Shopping Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 h-9 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors"
            >
              <ShoppingCart className="w-4 h-4 text-sky-400" />
              <span>Cart</span>
              {cartCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-sky-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ─── Hero Banner ─── */}
      <section className="bg-gradient-to-r from-sky-950/60 via-indigo-950/40 to-slate-950 border-b border-slate-800 py-12 px-4 text-center">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Standalone Customer E-Commerce Experience
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Official CamTech Store Online
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto">
            Zero ERP clutter. Direct instant shopping with automated Phnom Penh courier delivery dispatch and Bakong KHQR QR-pay.
          </p>
        </div>
      </section>

      {/* ─── Catalog Section ─── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 flex flex-col justify-between hover:border-sky-500/40 transition-all shadow-md group"
            >
              <div className="space-y-3">
                <div className="w-full h-40 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-center text-slate-600 group-hover:text-sky-400 transition-colors">
                  <Package className="w-14 h-14" />
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  {p.category}
                </span>
                <h3 className="font-bold text-base text-white">{p.name}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{p.description}</p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block">Retail Price</span>
                  <div className="text-lg font-black text-sky-400">${p.price.toFixed(2)}</div>
                </div>
                <button
                  onClick={() => addToCart(p)}
                  className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* ─── Cart Drawer Modal ─── */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-slate-900 h-full p-6 flex flex-col justify-between border-l border-slate-800 shadow-2xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-sky-400" />
                  Your Cart ({cartCount})
                </h3>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-20 text-xs text-slate-500">Your cart is currently empty.</div>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800"
                    >
                      <div>
                        <h4 className="font-bold text-sm text-slate-200">{item.name}</h4>
                        <span className="text-xs text-sky-400">${item.price.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-slate-300"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-slate-300"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Total Due:</span>
                  <span className="text-xl font-black text-sky-400">${cartTotal.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    setIsCheckoutOpen(true);
                  }}
                  className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-lg"
                >
                  Proceed to Checkout (${cartTotal.toFixed(2)})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Checkout Modal ─── */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-sky-400" />
                Checkout & Instant Dispatch
              </h3>
              <button onClick={() => setIsCheckoutOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Customer Full Name</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full h-9 rounded-xl bg-slate-950 border border-slate-800 px-3 text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Phone Number (for courier delivery)</label>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full h-9 rounded-xl bg-slate-950 border border-slate-800 px-3 text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Delivery Address</label>
                <input
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full h-9 rounded-xl bg-slate-950 border border-slate-800 px-3 text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1.5">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('KHQR')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      paymentMethod === 'KHQR'
                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <QrCode className="w-4 h-4 mx-auto mb-1 text-rose-400" />
                    Bakong KHQR
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('COD')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      paymentMethod === 'COD'
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Truck className="w-4 h-4 mx-auto mb-1 text-amber-400" />
                    Cash On Delivery
                  </button>
                </div>
              </div>

              {paymentMethod === 'KHQR' && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-2">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                    Scan With Any Cambodian Banking App
                  </span>
                  <div className="w-28 h-28 bg-white rounded-xl mx-auto flex flex-col items-center justify-center p-2 text-rose-600">
                    <QrCode className="w-12 h-12 mb-1" />
                    <span className="text-[9px] font-black">KHQR SCAN</span>
                  </div>
                  <span className="text-xs font-bold text-white">${cartTotal.toFixed(2)} USD</span>
                </div>
              )}

              <button
                onClick={handleCheckoutSubmit}
                className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-lg mt-2"
              >
                Confirm Order (${cartTotal.toFixed(2)})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Order Confirmation Modal ─── */}
      {confirmedOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-3 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Order Confirmed!</h3>
            <p className="text-xs text-slate-400">
              Dispatched to Phnom Penh driver fleet with live telemetry tracking.
            </p>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-left space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Tracking Code:</span>
                <span className="font-mono font-bold text-sky-400">{confirmedOrder.trackingNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total:</span>
                <span className="font-bold text-white">${confirmedOrder.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment:</span>
                <span className="text-slate-300">{confirmedOrder.paymentMethod}</span>
              </div>
            </div>

            <button
              onClick={() => setConfirmedOrder(null)}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
