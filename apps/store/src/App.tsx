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
  MapPin,
  Navigation
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { supabase, signInWithGoogle, signOut as supabaseSignOut } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function GoogleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

interface ProductItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  sku: string;
  category: string;
}

export function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cart, setCart] = useState<Array<ProductItem & { quantity: number }>>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'KHQR' | 'COD'>('KHQR');

  // Customer session state (null = Guest)
  const [customer, setCustomer] = useState<{ name: string; email: string; phone: string } | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authNameInput, setAuthNameInput] = useState('');
  const [authEmailInput, setAuthEmailInput] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('Street 310, BKK1, Phnom Penh');
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const handleCaptureLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsLocating(false);
        toast.success(`📍 Live GPS Locked: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
      },
      () => {
        setIsLocating(false);
        toast.info('Using standard delivery district coordinates');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Listen for Supabase Google session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const metadata = session.user.user_metadata || {};
        setCustomer({
          name: metadata.full_name || metadata.name || session.user.email?.split('@')[0] || 'Google User',
          email: session.user.email || '',
          phone: session.user.phone || metadata.phone || '+855 12 888 999',
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const metadata = session.user.user_metadata || {};
        setCustomer({
          name: metadata.full_name || metadata.name || session.user.email?.split('@')[0] || 'Google User',
          email: session.user.email || '',
          phone: session.user.phone || metadata.phone || '+855 12 888 999',
        });
        toast.success(`Signed in with Google as ${metadata.full_name || session.user.email}!`);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      toast.loading('Redirecting to Google Sign-In...');
      await signInWithGoogle();
    } catch (err: any) {
      toast.dismiss();
      toast.error(err?.message || 'Failed to initialize Google Sign In');
    }
  };

  const handleSignOut = async () => {
    try {
      await supabaseSignOut();
    } catch {
      // ignore
    }
    setCustomer(null);
    toast.info('Signed out. You can still shop and checkout as a guest!');
  };

  // 1. Fetch live products from Central Data Center API
  const { data: serverProducts, isLoading: isProductsLoading, refetch: refetchProducts } = useQuery({
    queryKey: ['store-live-products'],
    queryFn: async () => {
      try {
        // Try public products endpoint
        const res = await fetch(`${API_BASE_URL}/api/v1/public/products`);
        if (res.ok) {
          setIsBackendConnected(true);
          const json = await res.json();
          const items = json.data?.items || json.items || json.data || [];
          if (Array.isArray(items) && items.length > 0) {
            return items.map((p: any) => {
              const catRaw = `${p.categoryId || ''} ${p.category?.name || ''} ${p.name || ''}`.toUpperCase();
              let category = 'TECH';
              if (catRaw.includes('CAFE') || catRaw.includes('COFFEE') || catRaw.includes('ESPRESSO') || catRaw.includes('LATTE')) {
                category = 'CAFE';
              } else if (catRaw.includes('BAKERY') || catRaw.includes('CROISSANT') || catRaw.includes('BREAD')) {
                category = 'BAKERY';
              } else if (catRaw.includes('APPAREL') || catRaw.includes('SHIRT') || catRaw.includes('HOODIE') || catRaw.includes('FLEECE') || catRaw.includes('T-SHIRT')) {
                category = 'APPAREL';
              }
              return {
                id: p.id,
                name: p.name,
                description: p.description || '',
                price: Number(p.variants?.[0]?.sellPrice || p.sellPrice || p.price || 19.99),
                sku: p.variants?.[0]?.sku || p.sku || 'SKU-001',
                category
              };
            });
          }
          return [];
        }

        setIsBackendConnected(false);
        return [];
      } catch {
        setIsBackendConnected(false);
        return [];
      }
    },
    staleTime: 10000,
    retry: 1
  });

  // 2. Fetch customer orders from Central Data Center API (only when signed in)
  const { data: orderHistory, isLoading: isHistoryLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['store-order-history', customer?.email],
    queryFn: async () => {
      if (!customer) return [];
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/sales`);
        if (!res.ok) return [];
        const json = await res.json();
        return json.data?.items || json.items || json.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!customer
  });

  const products: ProductItem[] = serverProducts || [];

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
    const buyerName = customer ? customer.name : guestName.trim();
    const buyerPhone = customer ? customer.phone : guestPhone.trim();
    const buyerEmail = customer ? customer.email : (guestEmail.trim() || 'guest@camtech.cam');

    if (!buyerName) {
      toast.error('Please enter your full name for delivery');
      return;
    }
    if (!buyerPhone) {
      toast.error('Please enter your phone number so our driver can contact you');
      return;
    }
    if (!deliveryAddress.trim()) {
      toast.error('Please enter a delivery destination');
      return;
    }

    const orderPayload = {
      recipientName: buyerName,
      recipientPhone: buyerPhone,
      deliveryAddress: deliveryAddress,
      destLat: coords?.lat ?? 11.5564,
      destLng: coords?.lng ?? 104.9282,
      codAmount: paymentMethod === 'COD' ? cartTotal * 1.1 : 0.0,
      deliveryFee: 2.50,
      notes: `Store Order: ${cart.map((i) => `${i.name} x${i.quantity}`).join(', ')}`
    };

    const loadingToast = toast.loading('Submitting order to Fleet Dispatch...');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/delivery/orders/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      toast.dismiss(loadingToast);

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const json = await res.json();
      const serverOrder = json.data || json;

      const newOrder = {
        orderNumber: serverOrder.trackingNumber || (serverOrder.id ? `ORD-${serverOrder.id.slice(-6).toUpperCase()}` : 'ORD-2026-ONLINE'),
        id: serverOrder.id,
        items: [...cart],
        total: (serverOrder.codAmount && serverOrder.codAmount > 0) ? serverOrder.codAmount : cartTotal * 1.1,
        paymentMethod,
        customer: {
          name: buyerName,
          email: buyerEmail,
          phone: buyerPhone
        },
        address: deliveryAddress,
        date: serverOrder.createdAt || new Date().toISOString(),
        status: serverOrder.status || 'CONFIRMED'
      };

      setConfirmedOrder(newOrder);
      setCart([]);
      setIsCheckoutOpen(false);
      setIsCartOpen(false);
      toast.success(customer ? '🎉 Order Placed & Dispatched to Fleet!' : '🎉 Guest Order Placed & Dispatched to Fleet!');
      refetchHistory();
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error(`Order failed: ${err.message || 'Dispatch Center unreachable'}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-black">
      <Toaster position="top-right" richColors />

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white text-xs py-1.5 px-4 text-center font-medium tracking-wide flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-black/20 px-2 py-0.5 rounded text-[10px] font-mono">STOREFRONT</span>
          <span>🚀 CamTech Storefront Online • Next-Day Delivery across Phnom Penh</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          {isBackendConnected ? (
            <span className="flex items-center gap-1.5 text-emerald-100 bg-black/20 px-2.5 py-0.5 rounded font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Data Center Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-200 bg-amber-950/60 px-2.5 py-0.5 rounded border border-amber-500/30 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              Backend Offline (Autonomous Mode)
            </span>
          )}
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
                  <span className="text-[10px] text-emerald-400 font-mono">Member</span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-[11px] text-slate-400">Guest Shopper</span>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-white transition flex items-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sign In</span>
                </button>
              </div>
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
          <span className="text-xs text-slate-400">
            {isBackendConnected ? (
              <span className="text-emerald-400 font-medium">● Live from Central Data Center</span>
            ) : (
              <span className="text-amber-400/90 font-medium">○ Local Autonomous Catalog (Run `pnpm py:dev` for live DB)</span>
            )}
          </span>
        </div>

        {isProductsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, n) => (
              <div
                key={n}
                className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between animate-pulse"
              >
                <div>
                  <div className="w-full h-40 bg-slate-800/70 rounded-xl mb-4 relative flex items-center justify-center">
                    <div className="w-10 h-10 rounded-lg bg-slate-700/40" />
                    <div className="absolute top-2 right-2 h-4 w-14 rounded bg-slate-700/50" />
                  </div>
                  <div className="h-3 bg-slate-800 rounded w-16 mb-2" />
                  <div className="h-5 bg-slate-800 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-slate-800/60 rounded w-full mb-1" />
                  <div className="h-3 bg-slate-800/40 rounded w-2/3" />
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="h-2.5 bg-slate-800 rounded w-8" />
                    <div className="h-5 bg-slate-800 rounded w-16" />
                  </div>
                  <div className="h-8 w-24 bg-slate-800 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 my-4">
            <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">No Products Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
              There are currently no items matching your filter in this category. Catalog refreshes automatically from the central data center.
            </p>
            <button
              onClick={() => refetchProducts()}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync Catalog
            </button>
          </div>
        ) : (
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
        )}
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
              {/* Customer / Guest Identity */}
              {customer ? (
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-emerald-400" />
                      Ordering as <span className="text-emerald-300 font-bold">{customer.name}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Phone: {customer.phone} • {customer.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomer(null);
                      toast.info('Switched to Guest Checkout');
                    }}
                    className="text-[11px] text-slate-400 hover:text-emerald-400 underline"
                  >
                    Buy as Guest
                  </button>
                </div>
              ) : (
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Guest Checkout (No Account Needed)
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAuthModalOpen(true)}
                      className="text-[11px] text-slate-400 hover:text-white underline"
                    >
                      Have an account? Sign In
                    </button>
                  </div>

                  {/* 1-Click Google Sign In */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="w-full py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs transition flex items-center justify-center gap-2 border border-slate-200 shadow-sm"
                  >
                    <GoogleIcon className="w-4 h-4" />
                    <span>Auto-fill details with Google</span>
                  </button>

                  <div className="relative text-center my-1">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-800"></div>
                    </div>
                    <span className="relative bg-slate-950 px-2 text-[10px] text-slate-500 uppercase">or enter manually</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                        Your Full Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Dara Pich"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                        Phone (For Delivery) *
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. +855 12 345 678"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-400">Delivery Destination *</label>
                  <button
                    type="button"
                    onClick={handleCaptureLocation}
                    disabled={isLocating}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition"
                  >
                    <Navigation className="w-3 h-3" />
                    {isLocating ? 'Locating...' : coords ? `GPS Locked (${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)})` : 'Use Current GPS'}
                  </button>
                </div>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Enter street, building, or district..."
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
                <div className="p-4 rounded-2xl bg-gradient-to-b from-rose-950/40 to-slate-950 border border-rose-800/40 text-center space-y-2.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600 text-white font-bold text-[10px] tracking-wider uppercase shadow-md shadow-rose-600/30">
                    <span>KHQR</span> • <span>National Bank of Cambodia</span>
                  </div>
                  <div className="w-44 h-44 mx-auto bg-white rounded-2xl p-2.5 flex flex-col items-center justify-center shadow-xl shadow-rose-950/50 relative border-2 border-rose-500">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                        `00020101021229380016bakong@nbc.org.kh0108CAMTECH1520459995303840540${(cartTotal * 1.1).toFixed(2)}5802KH5912CAMTECH_STORE6010Phnom_Penh6304`
                      )}`}
                      alt="NBC Bakong KHQR"
                      className="w-36 h-36 object-contain"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-white font-mono">${(cartTotal * 1.1).toFixed(2)} USD</p>
                    <p className="text-[10px] text-rose-300/80 font-medium">Scan with ABA Mobile, Wing, ACLEDA, or any Bakong App</p>
                  </div>
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
              {isHistoryLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between animate-pulse">
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-28 bg-slate-800 rounded" />
                      <div className="h-2.5 w-16 bg-slate-800/60 rounded" />
                    </div>
                    <div className="space-y-1.5 text-right flex flex-col items-end">
                      <div className="h-4 w-16 bg-slate-800 rounded" />
                      <div className="h-2.5 w-12 bg-slate-800/60 rounded" />
                    </div>
                  </div>
                ))
              ) : (!orderHistory || orderHistory.length === 0) ? (
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

      {/* Customer Sign In / Account Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">Customer Sign In</h3>
              </div>
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              {/* Google Sign In Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs transition flex items-center justify-center gap-2.5 shadow-sm border border-slate-200"
              >
                <GoogleIcon className="w-4 h-4" />
                <span>Continue with Google</span>
              </button>

              <div className="relative my-3 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800"></div>
                </div>
                <span className="relative bg-slate-900 px-2 text-[10px] text-slate-500 uppercase">or with name & email</span>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!authNameInput.trim()) {
                    toast.error('Please enter your name');
                    return;
                  }
                  setCustomer({
                    name: authNameInput.trim(),
                    email: authEmailInput.trim() || `${authNameInput.toLowerCase().replace(/\s+/g, '')}@camtech.cam`,
                    phone: '+855 12 888 999'
                  });
                  setIsAuthModalOpen(false);
                  toast.success(`Welcome, ${authNameInput.trim()}!`);
                }}
                className="space-y-3"
              >
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Your Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Dara Pich"
                    value={authNameInput}
                    onChange={(e) => setAuthNameInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. dara.pich@gmail.com"
                    value={authEmailInput}
                    onChange={(e) => setAuthEmailInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
                >
                  Sign In to Account
                </button>
              </form>

              <div className="relative my-2 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800"></div>
                </div>
                <span className="relative bg-slate-900 px-2 text-[10px] text-slate-500 uppercase">demo</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCustomer({
                    name: 'Sokha Chem',
                    email: 'sokha.chem@gmail.com',
                    phone: '+855 12 889 900'
                  });
                  setIsAuthModalOpen(false);
                  toast.success('Signed in with Demo Account (Sokha Chem)');
                }}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 font-medium transition flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Quick Demo Login (Sokha Chem)
              </button>

              <p className="text-[11px] text-slate-500 text-center pt-2">
                Don't have an account? You can simply checkout as a guest without signing in.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
