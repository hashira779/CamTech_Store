import React, { useState, useEffect } from 'react';
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
  User,
  History,
  LogOut,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Phone,
  MapPin
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

const FALLBACK_PRODUCTS: ProductItem[] = [
  { id: 'prod-mbp14', name: 'MacBook Pro 14 M3', price: 1999.00, sku: 'MBP-14-512', category: 'TECH', description: 'Apple M3 Pro chip, 18GB RAM, 512GB SSD Storage' },
  { id: 'prod-airpods', name: 'AirPods Pro 2 (USB-C)', price: 249.00, sku: 'APP-PRO-2', category: 'TECH', description: 'Active Noise Cancellation with Adaptive Audio.' },
  { id: 'prod-charger', name: '65W GaN Dual Fast Charger', price: 39.99, sku: 'CHG-GAN-65', category: 'TECH', description: 'Dual USB-C fast charging for laptops & phones.' },
  { id: 'prod-espresso', name: 'Artisan Espresso Double Shot', price: 2.90, sku: 'COF-ESP-DBL', category: 'CAFE', description: 'Locally sourced Mondulkiri Arabica beans.' },
  { id: 'prod-latte', name: 'Iced Spanish Caramel Latte', price: 3.50, sku: 'COF-LAT-16', category: 'CAFE', description: 'Rich espresso with fresh milk and condensed caramel.' },
  { id: 'prod-croissant', name: 'French Butter Croissant', price: 2.80, sku: 'BAK-CRS-BUT', category: 'BAKERY', description: 'Freshly baked daily with 100% Normandy butter.' },
  { id: 'prod-hoodie', name: 'Tech Fleece Zip Hoodie', price: 110.00, sku: 'NK-HD-BLK-M', category: 'APPAREL', description: 'Premium lightweight warmth with tailored fit.' },
];

export function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cart, setCart] = useState<Array<ProductItem & { quantity: number }>>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'KHQR' | 'COD'>('KHQR');

  // Customer session state
  const [customer, setCustomer] = useState<{ name: string; email: string; phone: string } | null>({
    name: 'Sokha Chem',
    email: 'sokha.chem@gmail.com',
    phone: '+855 12 889 900'
  });
  const [deliveryAddress, setDeliveryAddress] = useState('Street 310, BKK1, Phnom Penh');
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);

  // 1. Fetch live products from Central Data Center API
  const { data: serverProducts, isLoading: isProductsLoading, refetch: refetchProducts } = useQuery({
    queryKey: ['store-live-products'],
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
            description: p.description || '',
            price: Number(p.variants?.[0]?.sellPrice || p.sellPrice || p.price || 19.99),
            sku: p.variants?.[0]?.sku || p.sku || 'SKU-001',
            category: p.category?.name?.toUpperCase() || 'TECH'
          }));
        }
        return FALLBACK_PRODUCTS;
      } catch (err) {
        return FALLBACK_PRODUCTS;
      }
    },
    staleTime: 10000
  });

  // 2. Fetch customer orders from Central Data Center API
  const { data: orderHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['store-order-history'],
    queryFn: async () => {
      try {
        const res = await fetch('http://localhost:4000/api/v1/sales');
        if (!res.ok) return [];
        const json = await res.json();
        return json.data?.items || json.items || json.data || [];
      } catch {
        return [];
      }
    }
  });

  const products: ProductItem[] = serverProducts || FALLBACK_PRODUCTS;

  const categories = ['ALL', 'TECH', 'CAFE', 'BAKERY', 'APPAREL'];

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'ALL' || p.category.includes(selectedCategory);
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const addToCart = (product: ProductItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    toast.success(`Added ${product.name} to cart!`);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const handleCheckout = async () => {
    if (!customer) {
      toast.error('Please sign in to complete your purchase');
      return;
    }

    const newOrder = {
      orderNumber: `ORD-2026-${Math.floor(100000 + Math.random() * 900000)}`,
      items: cart,
      total: cartTotal * 1.1, // with 10% VAT
      paymentMethod,
      customer,
      address: deliveryAddress,
      date: new Date().toISOString(),
      status: 'CONFIRMED'
    };

    setConfirmedOrder(newOrder);
    setCart([]);
    setIsCheckoutOpen(false);
    setIsCartOpen(false);
    toast.success('🎉 Order Placed Successfully!');
    refetchHistory();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-black">
      <Toaster position="top-right" richColors />

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white text-xs py-1.5 px-4 text-center font-medium tracking-wide flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-black/20 px-2 py-0.5 rounded text-[10px] font-mono">PORT 5001</span>
          <span>🚀 CamTech Storefront Online • Next-Day Delivery across Phnom Penh</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1 text-emerald-100">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping"></span>
            Data Center: localhost:4000
          </span>
        </div>
      </div>

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                CamTech Store
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">Live</span>
              </h1>
              <p className="text-xs text-slate-400">customer.camtech.cam (Port 5001)</p>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex-1 max-w-md relative hidden sm:block">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search MacBook, AirPods, Coffee, Charger..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </div>

          {/* Customer & Cart Actions */}
          <div className="flex items-center gap-3">
            {customer ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsHistoryOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 flex items-center gap-1.5 border border-slate-700 transition"
                  title="View Purchase History"
                >
                  <History className="w-3.5 h-3.5 text-emerald-400" />
                  <span>My Orders</span>
                </button>
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-xs font-semibold text-white">{customer.name}</span>
                  <span className="text-[10px] text-emerald-400 font-mono">PLATINUM VIP</span>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCustomer({ name: 'Sokha Chem', email: 'sokha@camtech.cam', phone: '+855 12 889 900' })}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition"
              >
                Sign In
              </button>
            )}

            {/* Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="hidden sm:inline text-xs font-bold">${cartTotal.toFixed(2)}</span>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full text-[11px] font-bold flex items-center justify-center border-2 border-slate-950">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Category Pills */}
      <div className="border-b border-slate-800 bg-slate-900/40 py-3">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1 rounded-full text-xs font-medium transition ${
                  selectedCategory === cat
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <button
            onClick={() => { refetchProducts(); toast.info('Catalog refreshed from Data Center!'); }}
            className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            Sync Products
          </button>
        </div>
      </div>

      {/* Hero Banner */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950/40 p-8 border border-slate-800 relative overflow-hidden">
          <div className="relative z-10 max-w-xl">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3 border border-emerald-500/30">
              <Sparkles className="w-3.5 h-3.5" /> 2026 Modern Commerce Standard
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2">
              Next-Gen Tech, Artisan Coffee & Daily Essentials.
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Instant checkout with Bakong KHQR, live stock reservation, and real-time courier tracking right to your doorstep.
            </p>
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Featured Products ({filteredProducts.length})</h3>
          <span className="text-xs text-slate-400">Direct from Central Data Center</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="group bg-slate-900/70 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/5"
            >
              <div>
                <div className="w-full h-40 rounded-xl bg-slate-800/80 mb-4 flex items-center justify-center relative overflow-hidden group-hover:bg-slate-800 transition">
                  <Package className="w-12 h-12 text-slate-600 group-hover:text-emerald-400 transition transform group-hover:scale-110 duration-300" />
                  <span className="absolute top-2 right-2 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950/80 text-slate-300 border border-slate-800">
                    {product.sku}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-400 tracking-wider uppercase">
                  {product.category}
                </span>
                <h4 className="text-base font-bold text-white mt-1 group-hover:text-emerald-300 transition">
                  {product.name}
                </h4>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {product.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block">Price</span>
                  <span className="text-lg font-bold text-emerald-400">
                    ${product.price.toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => addToCart(product)}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col p-6 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-lg text-white">Your Shopping Cart</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Your cart is currently empty.</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60"
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                      <p className="text-xs text-emerald-400 font-mono">${item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-6 h-6 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-xs text-slate-200"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-4 text-center text-white">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-6 h-6 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-xs text-slate-200"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Subtotal</span>
                  <span className="text-slate-200 font-mono">${cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Tax (10% VAT)</span>
                  <span className="text-slate-200 font-mono">${(cartTotal * 0.1).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-800">
                  <span>Total Due</span>
                  <span className="text-emerald-400 font-mono text-base">${(cartTotal * 1.1).toFixed(2)}</span>
                </div>

                <button
                  onClick={() => setIsCheckoutOpen(true)}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20"
                >
                  <CreditCard className="w-4 h-4" />
                  Proceed to Checkout (${(cartTotal * 1.1).toFixed(2)})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Secure Checkout
              </h3>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Delivery Destination</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-2">Select Payment Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod('KHQR')}
                    className={`p-3 rounded-xl border flex items-center gap-2 transition ${
                      paymentMethod === 'KHQR'
                        ? 'bg-rose-500/10 border-rose-500 text-rose-400 font-bold'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300'
                    }`}
                  >
                    <QrCode className="w-5 h-5 text-rose-400" />
                    <div className="text-left">
                      <p className="text-xs">Bakong KHQR</p>
                      <p className="text-[10px] text-slate-400 font-normal">Scan & Pay Any Bank</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('COD')}
                    className={`p-3 rounded-xl border flex items-center gap-2 transition ${
                      paymentMethod === 'COD'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300'
                    }`}
                  >
                    <Truck className="w-5 h-5 text-emerald-400" />
                    <div className="text-left">
                      <p className="text-xs">Cash on Delivery</p>
                      <p className="text-[10px] text-slate-400 font-normal">Pay Driver Upon Arrival</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* KHQR Preview */}
              {paymentMethod === 'KHQR' && (
                <div className="p-4 rounded-xl bg-slate-950 border border-rose-900/40 text-center">
                  <div className="w-32 h-32 mx-auto bg-white rounded-xl p-2 flex items-center justify-center mb-2 shadow-lg">
                    <QrCode className="w-28 h-28 text-slate-900" />
                  </div>
                  <p className="text-xs font-bold text-rose-400">National Bank of Cambodia Bakong</p>
                  <p className="text-[10px] text-slate-400">Supported by ABA, Wing, Acleda & 40+ banks</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block">Total Due</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">${(cartTotal * 1.1).toFixed(2)}</span>
              </div>
              <button
                onClick={handleCheckout}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                Place Order Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Confirmed View */}
      {confirmedOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/40">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">Order Confirmed!</h3>
            <p className="text-xs text-emerald-400 font-mono mt-1">{confirmedOrder.orderNumber}</p>
            <p className="text-xs text-slate-400 mt-2">
              Thank you, {confirmedOrder.customer.name}! We have routed your dispatch request to our nearest delivery fleet.
            </p>

            <div className="mt-4 p-3 rounded-xl bg-slate-950 text-left text-xs space-y-1.5 border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Charged:</span>
                <span className="font-bold text-emerald-400">${confirmedOrder.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Destination:</span>
                <span className="text-slate-200 truncate">{confirmedOrder.address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Method:</span>
                <span className="text-slate-200">{confirmedOrder.paymentMethod}</span>
              </div>
            </div>

            <button
              onClick={() => setConfirmedOrder(null)}
              className="mt-6 w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}

      {/* Customer Purchase History Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-lg text-white">Order History & Invoices</h3>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 max-h-96 overflow-y-auto space-y-3">
              {(!orderHistory || orderHistory.length === 0) ? (
                <div className="text-center py-8 text-slate-500">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No past sales found in Central Data Center.</p>
                </div>
              ) : (
                orderHistory.slice(0, 8).map((order: any) => (
                  <div key={order.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">{order.saleNumber || order.id}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                          {order.status || 'COMPLETED'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Recent'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        ${Number(order.grandTotal || order.total || 0).toFixed(2)}
                      </span>
                      <span className="text-[10px] block text-slate-500">Paid via KHQR</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
