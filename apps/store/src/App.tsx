import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  Navigation,
  Zap,
  Award,
  ExternalLink,
  ArrowRight,
  Compass
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { supabase, signInWithGoogle, signOut as supabaseSignOut } from './supabase';

const API_BASE_URL = (() => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return window.location.origin;
    }
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:4000';
})();

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
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cart, setCart] = useState<Array<ProductItem & { quantity: number }>>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('camtech_store_cart') : null;
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'KHQR' | 'COD'>('KHQR');

  // Automatically keep localStorage in sync with cart state
  useEffect(() => {
    try {
      localStorage.setItem('camtech_store_cart', JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  // Customer session state (null = Guest)
  const [customer, setCustomer] = useState<{
    id?: string;
    code?: string;
    name: string;
    email: string;
    phone: string;
    loyaltyPoints?: number;
    loyaltyTier?: string;
    storeCredit?: number;
  } | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authNameInput, setAuthNameInput] = useState('');
  const [authEmailInput, setAuthEmailInput] = useState('');
  const [authPhoneInput, setAuthPhoneInput] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
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

  // Sync authenticated customer with central PostgreSQL database
  const syncCustomerWithDatabase = async (info: {
    name: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
  }) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/customers/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: info.name,
          email: info.email,
          phone: info.phone || '',
          avatarUrl: info.avatarUrl || '',
          authProvider: 'google',
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setCustomer({
          id: data.id,
          code: data.code,
          name: data.name || info.name,
          email: data.email || info.email,
          phone: data.phone || info.phone || '',
          loyaltyPoints: data.loyaltyPoints ?? 500,
          loyaltyTier: data.loyaltyTier || 'Executive Gold',
          storeCredit: data.storeCredit ?? 0.0,
        });
        if (data.phone) {
          setGuestPhone(data.phone);
          localStorage.setItem('camtech_customer_phone', data.phone);
        }
        return data;
      }
    } catch (err) {
      console.warn('Central DB customer sync fallback:', err);
    }
    return null;
  };

  // Synchronize cart with PostgreSQL Database for logged in customer
  const syncCartWithDatabase = async (email: string, items: Array<ProductItem & { quantity: number }>) => {
    if (!email) return;
    try {
      await fetch(`${API_BASE_URL}/api/v1/customers/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, items }),
      });
    } catch (err) {
      console.warn('Central DB customer cart sync fallback:', err);
    }
  };

  // Smart Merge local cart with database cart following global e-commerce standard
  const mergeAndSyncCart = async (email: string) => {
    if (!email) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/customers/cart?email=${encodeURIComponent(email)}`);
      let serverItems: Array<ProductItem & { quantity: number }> = [];
      if (res.ok) {
        const json = await res.json();
        serverItems = json.data?.items || json.items || [];
      }

      // Read current local storage items
      let localItems: Array<ProductItem & { quantity: number }> = [];
      try {
        const saved = localStorage.getItem('camtech_store_cart');
        localItems = saved ? JSON.parse(saved) : cart;
      } catch {
        localItems = cart;
      }

      // If local items exist and server items exist, merge them
      const itemMap = new Map<string, ProductItem & { quantity: number }>();

      // 1. Put server items (the cloud database cart for this account)
      for (const item of serverItems) {
        if (item && item.id) {
          itemMap.set(item.id, { ...item });
        }
      }

      // 2. Merge local items (guest items added before sign in)
      for (const item of localItems) {
        if (item && item.id) {
          if (itemMap.has(item.id)) {
            const existing = itemMap.get(item.id)!;
            itemMap.set(item.id, { ...existing, quantity: Math.max(existing.quantity, item.quantity) });
          } else {
            itemMap.set(item.id, { ...item });
          }
        }
      }

      const merged = Array.from(itemMap.values());
      setCart(merged);
      try {
        localStorage.setItem('camtech_store_cart', JSON.stringify(merged));
      } catch {}

      // Keep database in sync with merged cart
      await syncCartWithDatabase(email, merged);

      if (merged.length > 0) {
        toast.success(`🛒 Cart synchronized with your account (${merged.length} item${merged.length > 1 ? 's' : ''})`);
      }
    } catch (err) {
      console.warn('Central DB customer cart merge fallback:', err);
    }
  };

  // Listen for Supabase Google session and dynamically link with Central Database
  useEffect(() => {
    const processSession = (session: any) => {
      if (!session?.user) return;
      const metadata = session.user.user_metadata || {};
      const savedPhone = localStorage.getItem('camtech_customer_phone') || '';
      const phone = session.user.phone || metadata.phone || savedPhone || '';
      const name = metadata.full_name || metadata.name || session.user.email?.split('@')[0] || 'Google User';
      const email = session.user.email || '';

      setCustomer({
        name,
        email,
        phone,
        loyaltyPoints: 500,
        loyaltyTier: 'Executive Gold',
      });
      if (phone) setGuestPhone(phone);

      syncCustomerWithDatabase({
        name,
        email,
        phone,
        avatarUrl: metadata.avatar_url,
      }).then(() => {
        mergeAndSyncCart(email);
      });
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      processSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        processSession(session);
        const metadata = session.user.user_metadata || {};
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
    setCart([]);

    // Clear local storage customer session & local cart (account cart is safely retained in PostgreSQL)
    localStorage.removeItem('camtech_store_cart');
    localStorage.removeItem('camtech_customer_phone');
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-') || key.startsWith('camtech_')) {
        localStorage.removeItem(key);
      }
    });

    // Clear React Query cache and session storage
    sessionStorage.clear();
    queryClient.clear();

    toast.info('Signed out. Your cart is preserved in your cloud account.');

    // Hard refresh/reload the page to ensure completely clean cache and memory
    window.location.href = window.location.origin + window.location.pathname;
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
              const categoryName = p.category?.name || p.categoryId || 'UNCATEGORIZED';
              
              return {
                id: p.id,
                name: p.name,
                description: p.description || '',
                price: Number(p.variants?.[0]?.sellPrice || p.sellPrice || p.price || 0),
                sku: p.variants?.[0]?.sku || p.sku || `SKU-${p.id.substring(0,6)}`,
                category: categoryName.toUpperCase()
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
  // 2. Fetch customer orders directly from Central PostgreSQL Database
  const { data: orderHistory, isLoading: isHistoryLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['store-order-history', customer?.email],
    queryFn: async () => {
      const email = customer?.email || (typeof window !== 'undefined' ? localStorage.getItem('camtech_customer_email') : null);
      if (!email) return [];
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/sales/customer-orders?email=${encodeURIComponent(email)}`);
        if (!res.ok) return [];
        const json = await res.json();
        return json.data?.items || json.items || json.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!customer?.email
  });

  const products: ProductItem[] = serverProducts || [];
  
  // Extract categories dynamically from the actual database products
  const uniqueCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  const categories = ['ALL', ...uniqueCategories];

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
      const newCart = existing
        ? prev.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [...prev, { ...product, quantity: 1 }];
      try {
        localStorage.setItem('camtech_store_cart', JSON.stringify(newCart));
      } catch {}
      if (customer?.email) {
        syncCartWithDatabase(customer.email, newCart);
      }
      return newCart;
    });
    toast.success(`Added ${product.name} to cart!`);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) => {
      const newCart = prev
        .map((i) => (i.id === id ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0);
      try {
        localStorage.setItem('camtech_store_cart', JSON.stringify(newCart));
      } catch {}
      if (customer?.email) {
        syncCartWithDatabase(customer.email, newCart);
      }
      return newCart;
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const newCart = prev.filter((i) => i.id !== id);
      try {
        localStorage.setItem('camtech_store_cart', JSON.stringify(newCart));
      } catch {}
      if (customer?.email) {
        syncCartWithDatabase(customer.email, newCart);
      }
      return newCart;
    });
    toast.info('Item removed from cart');
  };

  const handleCheckout = async () => {
    const buyerName = customer ? customer.name : guestName.trim();
    const buyerPhone = (customer?.phone || guestPhone).trim();
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

    if (buyerPhone) {
      localStorage.setItem('camtech_customer_phone', buyerPhone);
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

    const loadingToast = toast.loading('Confirming and dispatching order...');

    try {
      // 1. Record official Sale, Line Items, and Payment in Central PostgreSQL
      const saleRes = await fetch(`${API_BASE_URL}/api/v1/sales/store-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: buyerEmail,
          customerName: buyerName,
          customerPhone: buyerPhone,
          deliveryAddress: deliveryAddress,
          paymentMethod: paymentMethod,
          items: cart.map((i) => ({
            id: i.id,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            sku: i.sku,
            category: i.category,
          })),
          notes: `Store Order for ${buyerName}`,
        }),
      });

      if (!saleRes.ok) {
        throw new Error(`Order checkout failed with status ${saleRes.status}`);
      }

      const saleJson = await saleRes.json();
      const serverSale = saleJson.data || saleJson;

      // 2. Also dispatch delivery courier fleet
      try {
        await fetch(`${API_BASE_URL}/api/v1/delivery/orders/public`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientName: buyerName,
            recipientPhone: buyerPhone,
            deliveryAddress: deliveryAddress,
            destLat: coords?.lat ?? 11.5564,
            destLng: coords?.lng ?? 104.9282,
            codAmount: paymentMethod === 'COD' ? cartTotal * 1.1 : 0.0,
            deliveryFee: 2.50,
            notes: `Store Order ${serverSale.saleNumber}: ${cart.map((i) => `${i.name} x${i.quantity}`).join(', ')}`,
          }),
        });
      } catch (err) {
        console.warn('Fleet delivery dispatch non-blocking fallback:', err);
      }

      toast.dismiss(loadingToast);

      const newOrder = {
        orderNumber: serverSale.saleNumber || (serverSale.id ? `ORD-${serverSale.id.slice(-6).toUpperCase()}` : 'ORD-2026-ONLINE'),
        id: serverSale.id,
        items: [...cart],
        total: serverSale.grandTotal || cartTotal * 1.1,
        paymentMethod,
        customer: {
          name: buyerName,
          email: buyerEmail,
          phone: buyerPhone,
        },
        address: deliveryAddress,
        date: serverSale.createdAt || new Date().toISOString(),
        status: serverSale.status || 'COMPLETED',
      };

      setConfirmedOrder(newOrder);
      if (customer?.email) {
        syncCartWithDatabase(customer.email, []);
      }
      setCart([]);
      try {
        localStorage.removeItem('camtech_store_cart');
      } catch {}
      setIsCheckoutOpen(false);
      setIsCartOpen(false);
      toast.success('🎉 Order confirmed! Dispatched to delivery fleet.');
      refetchHistory();
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error(`Checkout failed: ${err.message || 'Central Data Center unreachable'}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white relative overflow-x-hidden bg-dot-grid pb-24">
      <Toaster position="top-right" richColors />

      {/* Ambient Glow Orbs */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-gradient-to-r from-blue-600/15 via-indigo-500/20 to-purple-600/15 blur-[120px] rounded-full animate-pulse-glow" />
      <div className="pointer-events-none absolute top-[750px] -right-40 w-[600px] h-[400px] bg-gradient-to-tr from-purple-600/10 via-indigo-600/10 to-cyan-500/10 blur-[130px] rounded-full" />

      {/* Top Ambient Status Ribbon */}
      <div className="max-w-6xl mx-auto pt-3 px-4 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
          <span className="hidden sm:inline">CAMTECH COMMERCE CLOUD • NEXT-DAY FLEET IN PHNOM PENH</span>
          <span className="sm:hidden">CAMTECH CLOUD</span>
        </div>
        <div className="flex items-center gap-2">
          {isBackendConnected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Online • Express Dispatch
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              Offline Mode
            </span>
          )}
        </div>
      </div>

      {/* Floating Glassmorphic Capsule Navbar (Lightswind Style) */}
      <header className="sticky top-3 z-40 max-w-6xl mx-auto px-4 mt-2">
        <div className="h-14 px-3 sm:px-5 rounded-full bg-zinc-950/75 backdrop-blur-2xl border border-zinc-800/80 shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]">
              <Store className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-extrabold text-white tracking-tight">CamTech</span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                STORE
              </span>
            </div>
          </div>

          {/* Quick Search Capsule with Keyboard Shortcut */}
          <div className="flex-1 max-w-md relative hidden md:block">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search MacBook, AirPods, Coffee, Charger..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-12 py-1.5 bg-zinc-900/60 border border-zinc-800 rounded-full text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded border border-zinc-700/50">
              ⌘K
            </span>
          </div>

          {/* Customer Auth & Cart Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {customer ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => setIsHistoryOpen(true)}
                  className="px-2.5 sm:px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-300 flex items-center gap-1.5 border border-zinc-800 transition"
                  title="View Purchase History"
                >
                  <History className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Orders</span>
                </button>
                <div className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full bg-zinc-900/80 border border-zinc-800">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/30 text-indigo-300 font-bold text-[10px] flex items-center justify-center">
                    {customer.name.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-white max-w-[80px] truncate hidden sm:inline">
                    {customer.name}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-1.5 rounded-full hover:bg-zinc-900 text-zinc-400 hover:text-rose-400 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 transition flex items-center gap-1.5 shadow-sm"
              >
                <GoogleIcon className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}

            {/* Floating High-Contrast Cart Pill */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative px-3 sm:px-4 py-1.5 rounded-full bg-white text-zinc-950 hover:bg-zinc-100 font-bold text-xs flex items-center gap-2 shadow-lg shadow-white/10 transition active:scale-95 cursor-pointer"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span className="font-mono">${cartTotal.toFixed(2)}</span>
              {cartCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section with Signature 3D Hanging Lanyard VIP Pass */}
      <section className="max-w-6xl mx-auto px-4 pt-12 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Typography & Action CTA */}
          <div className="lg:col-span-7 text-left space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 backdrop-blur-md shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span className="font-medium text-[11px] sm:text-xs">
                Live Enterprise Commerce • Instant NBC Bakong KHQR
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08]">
              Elevate Daily Living with{' '}
              <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                CamTech Store
              </span>
            </h1>

            <p className="text-sm sm:text-base text-zinc-400 max-w-xl leading-relaxed">
              Next-gen Apple silicon, high-fidelity audio, and artisan roast coffee delivered to your doorstep in Phnom Penh with instant Bakong KHQR settlement.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="#catalog"
                className="px-6 py-3 rounded-full bg-white text-zinc-950 font-bold text-xs sm:text-sm hover:scale-105 transition shadow-[0_0_25px_rgba(255,255,255,0.25)] flex items-center gap-2 cursor-pointer"
              >
                <span>Shop Catalog</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <button
                onClick={() => (customer ? setIsHistoryOpen(true) : setIsAuthModalOpen(true))}
                className="px-5 py-3 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 font-bold text-xs sm:text-sm border border-zinc-800 transition flex items-center gap-2"
              >
                <Compass className="w-4 h-4 text-indigo-400" />
                <span>Track Live Delivery</span>
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-zinc-800/60 max-w-lg">
              <div>
                <div className="text-xl sm:text-2xl font-black text-white flex items-center">
                  <span>0.4s</span>
                </div>
                <div className="text-[11px] text-zinc-500 font-medium">Instant KHQR</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black text-white">100%</div>
                <div className="text-[11px] text-zinc-500 font-medium">Genuine Warranty</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black text-white">GPS</div>
                <div className="text-[11px] text-zinc-500 font-medium">Courier Fleet</div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Digital NFC Member Pass */}
          <div className="lg:col-span-5 relative flex justify-center items-center w-full">
            {/* Ambient Background Glow behind pass */}
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 via-purple-500/10 to-pink-500/20 blur-3xl rounded-3xl" />

            <div className="relative w-full max-w-[350px] rounded-3xl p-6 bg-gradient-to-b from-zinc-900/90 to-zinc-950/95 border border-zinc-700/60 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl flex flex-col gap-5">
              {/* Lanyard Clip Header */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-3 bg-zinc-700/80 rounded-full border border-zinc-600/60 flex items-center justify-center">
                <div className="w-8 h-1 bg-zinc-900 rounded-full"></div>
              </div>

              {/* Pass Top Branding */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="text-[9px] font-mono tracking-widest text-indigo-400 uppercase font-semibold block">
                    CAMTECH COMMERCE
                  </span>
                  <span className="text-xs font-bold text-white tracking-tight">VIP Member Pass</span>
                </div>
                <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-mono font-bold text-xs">
                  CT
                </div>
              </div>

              {/* Member Identification Card */}
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white truncate">
                  {customer?.name || 'VIP Guest Member'}
                </h3>
                <p className="text-xs text-zinc-400 font-mono truncate">
                  {customer?.email || 'guest.vip@camtech.cam'}
                </p>
              </div>

              {/* Member Tier & Live Loyalty Engine */}
              <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/80">
                <div>
                  <span className="text-zinc-500 text-[10px] block uppercase font-mono">TIER</span>
                  <span className="font-extrabold text-xs text-amber-300">
                    {customer?.loyaltyTier || 'Executive Gold'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block uppercase font-mono">LOYALTY PTS</span>
                  <span className="font-extrabold text-xs text-emerald-400 font-mono">
                    {customer?.loyaltyPoints ? `${customer.loyaltyPoints.toLocaleString()} PTS` : '500 PTS'}
                  </span>
                </div>
              </div>

              {/* Account Code & Live Backend Status */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-zinc-500 text-[10px] block uppercase font-mono">ACCOUNT CODE</span>
                  <span className="font-bold text-zinc-300 font-mono">{customer?.code || 'CT-ONLINE'}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block uppercase font-mono">STATUS</span>
                  <span className="font-bold text-indigo-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                    {customer?.id ? 'Verified Member' : (customer ? 'Active Member' : 'Guest')}
                  </span>
                </div>
              </div>

              {/* Digital Waveform Barcode */}
              <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                <div className="flex items-center gap-0.5 h-5">
                  {[16, 8, 22, 12, 28, 6, 20, 14, 26, 10, 18, 24, 12, 16, 20, 8, 24, 14, 18, 10].map((h, i) => (
                    <div
                      key={i}
                      className="w-1 bg-zinc-600 rounded-full"
                      style={{ height: `${h}px` }}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-mono text-zinc-500">
                  {customer?.code ? `CAMTECH-${customer.code}` : 'CAMTECH-2026-VIP'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Infinite Horizontal Tech & Partner Marquee */}
      <div className="w-full overflow-hidden py-4 border-y border-zinc-800/80 bg-zinc-950/40 backdrop-blur-md my-8">
        <div className="animate-marquee flex items-center gap-3">
          {[
            '⚡ NBC Bakong KHQR Instant Checkout',
            '🍎 100% Genuine Apple Warranty',
            '📦 15-Minute Courier Dispatch',
            '🛡️ Authentic Hardware & Audio',
            '☕ Artisan Roast Mondulkiri Coffee',
            '🔒 Secure 256-Bit Encrypted Checkout',
            '🚀 Same-Day Phnom Penh Delivery',
            '✨ VIP Member Loyalty Rewards',
            '⚡ NBC Bakong KHQR Instant Checkout',
            '🍎 100% Genuine Apple Warranty',
            '📦 15-Minute Courier Dispatch',
            '🛡️ Authentic Hardware & Audio',
            '☕ Artisan Roast Mondulkiri Coffee',
            '🔒 Secure 256-Bit Encrypted Checkout',
            '🚀 Same-Day Phnom Penh Delivery',
            '✨ VIP Member Loyalty Rewards',
          ].map((item, idx) => (
            <div
              key={idx}
              className="px-4 py-1.5 rounded-full bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 font-medium whitespace-nowrap flex items-center gap-2 shrink-0 shadow-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Bento Stat Grid (4 Core Platform Pillars) */}
      <section className="max-w-6xl mx-auto px-4 mb-14">
        <div className="text-center max-w-xl mx-auto mb-8">
          <span className="text-[11px] font-mono uppercase tracking-wider text-indigo-400 font-bold px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
            Architected for Speed & Reliability
          </span>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white mt-3">
            Enterprise Retail Infrastructure
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: NBC Bakong KHQR */}
          <div className="rounded-[2rem] bg-zinc-900/50 border border-zinc-800/80 p-6 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 group">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <QrCode className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white mb-1">Instant Bakong KHQR</h4>
            <p className="text-xs text-zinc-400 leading-relaxed mb-3">
              0.4-second settlement via NBC Bakong. Pay directly with ABA Mobile, Wing, ACLEDA, or any KHQR app.
            </p>
            <span className="text-[10px] font-mono text-rose-400 font-bold">0% Transaction Fee</span>
          </div>

          {/* Card 2: 15-Minute Fleet Dispatch */}
          <div className="rounded-[2rem] bg-zinc-900/50 border border-zinc-800/80 p-6 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 group">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <Truck className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white mb-1">15-Min Fleet Dispatch</h4>
            <p className="text-xs text-zinc-400 leading-relaxed mb-3">
              Automated dispatch from downtown BKK1 and Toul Kork micro-warehouses straight to your coordinates.
            </p>
            <span className="text-[10px] font-mono text-indigo-400 font-bold">Live GPS Courier Track</span>
          </div>

          {/* Card 3: 100% Genuine Guaranteed */}
          <div className="rounded-[2rem] bg-zinc-900/50 border border-zinc-800/80 p-6 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 group">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white mb-1">100% Verified Stock</h4>
            <p className="text-xs text-zinc-400 leading-relaxed mb-3">
              Direct manufacturer warranty on Apple, Sony, and Anker hardware, plus fresh daily artisan roasts.
            </p>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">Original Verified</span>
          </div>

          {/* Card 4: Autonomous Offline Container */}
          <div className="rounded-[2rem] bg-zinc-900/50 border border-zinc-800/80 p-6 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 group">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <Store className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white mb-1">Offline Resilience</h4>
            <p className="text-xs text-zinc-400 leading-relaxed mb-3">
              Stores and POS continue ringing up sales even during internet outages, auto-syncing when reconnected.
            </p>
            <span className="text-[10px] font-mono text-amber-400 font-bold">Zero Data Loss</span>
          </div>
        </div>
      </section>

      {/* Main Products Catalog Section */}
      <main id="catalog" className="max-w-6xl mx-auto px-4 scroll-mt-20">
        {/* Category Pills & Refresh Action */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 p-2 bg-zinc-950/70 border border-zinc-800/80 rounded-2xl backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-white text-zinc-950 shadow-md shadow-white/10'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              refetchProducts();
              toast.info('Catalog refreshed from Central Data Center!');
            }}
            className="text-[11px] font-mono text-zinc-400 hover:text-indigo-400 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 transition cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sync Catalog</span>
          </button>
        </div>

        {/* Catalog Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-extrabold text-white">Featured Catalog</h3>
            <p className="text-xs text-zinc-400">
              Showing {filteredProducts.length} verified item(s) in category {selectedCategory}
            </p>
          </div>
          <span className="text-xs font-mono">
            {isBackendConnected ? (
              <span className="text-emerald-400 font-semibold">● Central Data Center</span>
            ) : (
              <span className="text-amber-400 font-semibold">○ Container Autonomous</span>
            )}
          </span>
        </div>

        {isProductsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, n) => (
              <div
                key={n}
                className="bg-zinc-900/50 border border-zinc-800/80 rounded-[2rem] p-5 flex flex-col justify-between animate-pulse space-y-4"
              >
                <div>
                  <div className="w-full h-40 bg-zinc-800/60 rounded-2xl mb-4" />
                  <div className="h-3 bg-zinc-800 rounded w-16 mb-2" />
                  <div className="h-5 bg-zinc-800 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-zinc-800/60 rounded w-full mb-1" />
                </div>
                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                  <div className="h-5 bg-zinc-800 rounded w-16" />
                  <div className="h-8 w-24 bg-zinc-800 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-16 text-center rounded-[2.5rem] bg-zinc-950/60 border border-zinc-800/80 my-4 shadow-xl">
            <Package className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">No Products Found</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-4">
              There are currently no items matching your filter in this category. Catalog refreshes automatically from the central data center.
            </p>
            <button
              onClick={() => refetchProducts()}
              className="px-5 py-2.5 rounded-full bg-white text-zinc-950 text-xs font-bold inline-flex items-center gap-2 hover:bg-zinc-200 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Catalog</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="group bg-zinc-900/50 border border-zinc-800/80 hover:border-indigo-500/50 rounded-[2rem] p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1.5 relative overflow-hidden"
              >
                <div>
                  <div className="w-full h-40 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 mb-4 flex items-center justify-center relative overflow-hidden group-hover:border-indigo-500/40 transition">
                    <Package className="w-12 h-12 text-zinc-600 group-hover:text-indigo-400 transition transform group-hover:scale-110 duration-300" />
                    <span className="absolute top-2.5 right-2.5 text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800">
                      {product.sku}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-400 tracking-wider uppercase">
                    {product.category}
                  </span>
                  <h4 className="text-base font-bold text-white mt-1 group-hover:text-indigo-300 transition line-clamp-1">
                    {product.name}
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                    {product.description || 'Premium standard verified inventory with instant NBC Bakong settlement.'}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-zinc-500 block">PRICE</span>
                    <span className="text-lg font-extrabold text-white font-mono">
                      ${product.price.toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={() => addToCart(product)}
                    className="px-3.5 py-2 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-white/5 active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Bottom Quick Action Dock (Lightswind Style) */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 rounded-full bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/90 shadow-[0_12px_40px_rgba(0,0,0,0.8)] flex items-center gap-1.5 sm:gap-2">
        <a
          href="#catalog"
          className="p-2 rounded-full hover:bg-zinc-800/80 text-zinc-400 hover:text-white transition"
          title="Products Catalog"
        >
          <Package className="w-4 h-4" />
        </a>
        <button
          onClick={() => setIsHistoryOpen(true)}
          className="p-2 rounded-full hover:bg-zinc-800/80 text-zinc-400 hover:text-white transition"
          title="My Orders"
        >
          <History className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-zinc-800" />
        <button
          onClick={() => setIsCartOpen(true)}
          className="px-3 py-1.5 rounded-full bg-white text-zinc-950 font-bold text-xs flex items-center gap-1.5 hover:bg-zinc-200 transition shadow-md cursor-pointer"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>${cartTotal.toFixed(2)}</span>
          {cartCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
              {cartCount}
            </span>
          )}
        </button>
        <div className="w-px h-4 bg-zinc-800" />
        <button
          onClick={() => (customer ? setIsHistoryOpen(true) : setIsAuthModalOpen(true))}
          className="p-2 rounded-full hover:bg-zinc-800/80 text-zinc-400 hover:text-white transition"
          title={customer ? customer.name : 'Sign In'}
        >
          <User className="w-4 h-4" />
        </button>
      </div>

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col p-6 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-base text-white">Your Shopping Cart</h3>
                  <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {customer ? '☁️ Cloud Synced with Account' : '💾 Saved to Device Storage'}
                  </p>
                </div>
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
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-6 h-6 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-xs text-slate-200 cursor-pointer"
                        title="Decrease"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-4 text-center text-white">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-6 h-6 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-xs text-slate-200 cursor-pointer"
                        title="Increase"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="p-1 rounded hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 text-xs ml-1 cursor-pointer transition"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
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
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-emerald-400" />
                        Ordering as <span className="text-emerald-300 font-bold">{customer.name}</span>
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {customer.email}
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

                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                      Phone Number (For Driver Contact) *
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 012 345 678 or +855..."
                      value={customer.phone || guestPhone}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGuestPhone(val);
                        setCustomer((prev) => (prev ? { ...prev, phone: val } : null));
                        localStorage.setItem('camtech_customer_phone', val);
                        if (customer?.email) {
                          syncCustomerWithDatabase({
                            name: customer.name,
                            email: customer.email,
                            phone: val,
                          });
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none transition"
                    />
                    {!(customer.phone || guestPhone) && (
                      <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
                        <span>⚠️</span> Please enter your phone number so our driver can contact you.
                      </p>
                    )}
                  </div>
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
                  if (!authPhoneInput.trim()) {
                    toast.error('Please enter your phone number');
                    return;
                  }
                  const newEmail = authEmailInput.trim() || `${authNameInput.toLowerCase().replace(/\s+/g, '')}@camtech.cam`;
                  const newPhone = authPhoneInput.trim();
                  const newName = authNameInput.trim();
                  setCustomer({
                    name: newName,
                    email: newEmail,
                    phone: newPhone,
                    loyaltyPoints: 500,
                    loyaltyTier: 'Executive Gold',
                  });
                  syncCustomerWithDatabase({
                    name: newName,
                    email: newEmail,
                    phone: newPhone,
                  }).then(() => {
                    mergeAndSyncCart(newEmail);
                  });
                  setIsAuthModalOpen(false);
                  toast.success(`Welcome, ${newName}!`);
                }}
                className="space-y-3"
              >
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Your Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Dara Pich"
                    value={authNameInput}
                    onChange={(e) => setAuthNameInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    placeholder="e.g. +855 12 345 678"
                    value={authPhoneInput}
                    onChange={(e) => setAuthPhoneInput(e.target.value)}
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

              <p className="text-[11px] text-slate-500 text-center pt-3 border-t border-slate-800">
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
