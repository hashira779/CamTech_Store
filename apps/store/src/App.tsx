import React, { useState, useEffect, useRef } from 'react';
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
  Compass,
  Receipt,
  Printer,
  Copy,
  Check,
  MessageSquare,
  Star,
  ArrowLeft,
  MoreVertical,
  Clock,
  Bike,
  Loader2,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { ThemeToggle } from '@mystore/ui';
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
  variantId?: string;
  variantName?: string;
}

export function App() {
  const queryClient = useQueryClient();
  const lastProcessedEmailRef = useRef<string>('');
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
  const [historyChannelTab, setHistoryChannelTab] = useState<'STORE' | 'ALL'>('STORE');
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<any>(null);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState<any>(null);
  const [activeTip, setActiveTip] = useState<number | null>(null);
  const [isTrackLookupOpen, setIsTrackLookupOpen] = useState(false);
  const [trackLookupQuery, setTrackLookupQuery] = useState('');
  const [isSearchingTracking, setIsSearchingTracking] = useState(false);
  const [copiedInvoiceId, setCopiedInvoiceId] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'KHQR' | 'COD'>('KHQR');

  // Real-time tracking polling when tracking modal is open
  useEffect(() => {
    if (!selectedOrderForTracking) return;
    const identifier = selectedOrderForTracking.trackingNumber || selectedOrderForTracking.saleNumber || selectedOrderForTracking.orderNumber || selectedOrderForTracking.id;
    if (!identifier) return;

    let isMounted = true;
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/delivery/track/${encodeURIComponent(identifier)}`);
        if (res.ok) {
          const json = await res.json();
          const liveData = json.data || json;
          if (liveData && isMounted) {
            setSelectedOrderForTracking((prev: any) => {
              if (!prev) return null;
              return {
                ...prev,
                deliveryStatus: liveData.status || prev.deliveryStatus || prev.status,
                status: liveData.status || prev.status,
                driverName: liveData.driverName || prev.driverName,
                driverPhone: liveData.driverPhone || prev.driverPhone,
                driverVehicle: liveData.driverVehicle || prev.driverVehicle,
                destLat: liveData.destLat ?? prev.destLat,
                destLng: liveData.destLng ?? prev.destLng,
                distanceKm: liveData.distanceKm ?? prev.distanceKm,
                etaMinutes: liveData.etaMinutes ?? prev.etaMinutes,
                trackingNumber: liveData.trackingNumber || prev.trackingNumber,
                items: liveData.items || prev.items || prev.lineItems,
                saleNumber: liveData.saleNumber || prev.saleNumber,
                totalAmount: liveData.totalAmount || prev.totalAmount || prev.grandTotal,
              };
            });
          }
        }
      } catch {
        // network silent fallback
      }
    }, 3500);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [selectedOrderForTracking?.id, selectedOrderForTracking?.trackingNumber, selectedOrderForTracking?.orderNumber]);


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

      // Keep database in sync with merged cart only if merged items differ from server
      const isCartDifferent = JSON.stringify(serverItems) !== JSON.stringify(merged);
      if (isCartDifferent) {
        await syncCartWithDatabase(email, merged);
      }

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
      const email = session.user.email || '';
      if (!email) return;

      // Prevent redundant concurrent executions on mount
      if (lastProcessedEmailRef.current === email) return;
      lastProcessedEmailRef.current = email;

      const metadata = session.user.user_metadata || {};
      const savedPhone = localStorage.getItem('camtech_customer_phone') || '';
      const phone = session.user.phone || metadata.phone || savedPhone || '';
      const name = metadata.full_name || metadata.name || email.split('@')[0] || 'Google User';

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        processSession(session);
        if (event === 'SIGNED_IN') {
          const metadata = session.user.user_metadata || {};
          toast.success(`Signed in with Google as ${metadata.full_name || session.user.email}!`);
        }
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
    lastProcessedEmailRef.current = '';
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
              const categoryName = p.category?.name || (typeof p.category === 'string' ? p.category : '') || p.categoryName || 'GENERAL';
              const firstVariant = p.variants?.[0];
              
              return {
                id: p.id,
                variantId: firstVariant?.id,
                variantName: firstVariant?.name || 'Standard',
                name: p.name,
                description: p.description || '',
                price: Number(firstVariant?.sellPrice || p.sellPrice || p.price || 0),
                sku: firstVariant?.sku || p.sku || `SKU-${p.id.substring(0,6)}`,
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
    staleTime: 60 * 1000,
    retry: 1
  });

  // 2. Fetch customer orders directly from Central PostgreSQL Database
  const activeCustomerEmail = customer?.email || (typeof window !== 'undefined' ? localStorage.getItem('camtech_customer_email') : null);
  const activeCustomerPhone = customer?.phone || (typeof window !== 'undefined' ? localStorage.getItem('camtech_customer_phone') : null);

  const { data: serverOrderHistory, isLoading: isHistoryLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['store-order-history', activeCustomerEmail, activeCustomerPhone, historyChannelTab],
    queryFn: async () => {
      const email = activeCustomerEmail;
      const phone = activeCustomerPhone;
      if (!email && !phone) return [];
      try {
        const queryParams = new URLSearchParams();
        if (email) queryParams.set('email', email);
        if (phone) queryParams.set('phone', phone);
        if (historyChannelTab === 'STORE') queryParams.set('channel', 'STORE');

        const res = await fetch(`${API_BASE_URL}/api/v1/sales/customer-orders?${queryParams.toString()}`);
        if (!res.ok) return [];
        const json = await res.json();
        return json.data?.items || json.items || json.data || [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(activeCustomerEmail || activeCustomerPhone),
    staleTime: 30 * 1000,
  });

  // Local device cache for instant receipt retrieval across sessions
  const localOrders = (() => {
    try {
      return typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('camtech_store_orders') || '[]') : [];
    } catch {
      return [];
    }
  })();

  const orderHistory = (() => {
    const serverList = Array.isArray(serverOrderHistory) ? serverOrderHistory : [];
    const serverIds = new Set(serverList.map((o: any) => o.id || o.saleNumber));
    const missingLocal = localOrders.filter((lo: any) => !serverIds.has(lo.id) && !serverIds.has(lo.orderNumber));
    const combined = [...serverList, ...missingLocal];
    if (historyChannelTab === 'STORE') {
      return combined.filter((o: any) => !o.channel || o.channel === 'STORE');
    }
    return combined;
  })();

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
    const buyerPhoneClean = buyerPhone.replace(/\s+/g, '');
    const buyerEmail = customer ? customer.email : (guestEmail.trim() || (buyerPhoneClean ? `${buyerPhoneClean}@customer.camtech.cam` : 'guest@customer.camtech.cam'));

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
    if (buyerEmail) {
      localStorage.setItem('camtech_customer_email', buyerEmail);
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
            id: i.variantId || i.id,
            variantId: i.variantId || i.id,
            productId: i.id,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            sku: i.sku,
            category: i.variantName || i.category,
          })),
          notes: `Store Order for ${buyerName}`,
        }),
      });

      if (!saleRes.ok) {
        throw new Error(`Order checkout failed with status ${saleRes.status}`);
      }

      const saleJson = await saleRes.json();
      const serverSale = saleJson.data || saleJson;

      toast.dismiss(loadingToast);

      const newOrder = {
        orderNumber: serverSale.saleNumber || (serverSale.id ? `ORD-${serverSale.id.slice(-6).toUpperCase()}` : 'ORD-2026-ONLINE'),
        id: serverSale.id,
        items: [...cart],
        total: serverSale.grandTotal || cartTotal * 1.1,
        paymentMethod,
        channel: 'STORE',
        customer: {
          name: buyerName,
          email: buyerEmail,
          phone: buyerPhone,
        },
        address: deliveryAddress,
        date: serverSale.createdAt || new Date().toISOString(),
        status: serverSale.status || 'COMPLETED',
      };

      // Save order to local device cache
      try {
        const localList = JSON.parse(localStorage.getItem('camtech_store_orders') || '[]');
        const updatedList = [newOrder, ...localList.filter((o: any) => (o.id || o.orderNumber) !== (newOrder.id || newOrder.orderNumber))].slice(0, 30);
        localStorage.setItem('camtech_store_orders', JSON.stringify(updatedList));
      } catch {}

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
    <div className="min-h-screen bg-ink-950 ds-text font-sans antialiased selection:bg-brand-500 selection:text-white relative overflow-x-hidden bg-dot-grid pb-24">
      <Toaster position="top-right" richColors />

      {/* Ambient Glow Orbs */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-gradient-to-r from-brand-500/15 via-brand-500/20 to-brand-600/15 blur-[120px] rounded-full animate-pulse-glow" />
      <div className="pointer-events-none absolute top-[750px] -right-40 w-[600px] h-[400px] bg-gradient-to-tr from-brand-600/10 via-brand-600/10 to-brand-500/10 blur-[130px] rounded-full" />

      {/* Top Ambient Status Ribbon */}
      <div className="max-w-6xl mx-auto pt-3 px-4 flex items-center justify-between text-[11px] ds-text-dim font-mono">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse"></span>
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
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400"></span>
              Offline Mode
            </span>
          )}
        </div>
      </div>

      {/* Floating Glassmorphic Capsule Navbar (Lightswind Style) */}
      <header className="sticky top-3 z-40 max-w-6xl mx-auto px-3 sm:px-4 mt-2">
        <div className="h-14 px-3 sm:px-5 rounded-full bg-ink-950/75 backdrop-blur-2xl border border-line/80 shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-500 via-brand-500 to-brand-400 flex items-center justify-center text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]">
              <Store className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-extrabold ds-text tracking-tight">CamTech</span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-brand-500/20 text-brand-300 font-bold border border-brand-500/30 hidden sm:inline-flex">
                STORE
              </span>
            </div>
          </div>

          {/* Quick Search Capsule with Keyboard Shortcut */}
          <div className="flex-1 max-w-md relative hidden md:block">
            <Search className="w-3.5 h-3.5 ds-text-dim absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search MacBook, AirPods, Coffee, Charger..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-12 py-1.5 bg-ink-850/60 border border-line rounded-full text-xs ds-text placeholder-zinc-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono ds-text-faint bg-ink-800/60 px-1.5 py-0.5 rounded border border-line-strong/50">
              ⌘K
            </span>
          </div>

          {/* Customer Auth & Cart Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            {customer ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => setIsTrackLookupOpen(true)}
                  className="px-2.5 sm:px-3 py-1.5 rounded-full bg-ink-850 hover:bg-ink-800 text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 border border-line transition cursor-pointer"
                  title="Track Order Status"
                >
                  <Truck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Track</span>
                </button>
                <button
                  onClick={() => setIsHistoryOpen(true)}
                  className="px-2.5 sm:px-3 py-1.5 rounded-full bg-ink-850 hover:bg-ink-800 text-xs font-medium ds-text-dim flex items-center gap-1.5 border border-line transition cursor-pointer"
                  title="View Purchase History"
                >
                  <History className="w-3.5 h-3.5 text-brand-400" />
                  <span className="hidden sm:inline">Orders</span>
                </button>
                <div className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full bg-ink-850/80 border border-line">
                  <div className="w-5 h-5 rounded-full bg-brand-500/30 text-brand-300 font-bold text-[10px] flex items-center justify-center">
                    {customer.name.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold ds-text max-w-[80px] truncate hidden sm:inline">
                    {customer.name}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-1.5 rounded-full hover:bg-ink-850 ds-text-dim hover:text-rose-400 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => setIsTrackLookupOpen(true)}
                  className="px-2.5 sm:px-3 py-1.5 rounded-full bg-ink-850 hover:bg-ink-800 text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 border border-line transition cursor-pointer"
                  title="Track Order Status"
                >
                  <Truck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Track</span>
                </button>
                <button
                  onClick={() => setIsHistoryOpen(true)}
                  className="px-2.5 sm:px-3 py-1.5 rounded-full bg-ink-850 hover:bg-ink-800 text-xs font-medium ds-text-dim flex items-center gap-1.5 border border-line transition cursor-pointer"
                  title="View Purchase History"
                >
                  <History className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Orders</span>
                </button>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-3 py-1.5 rounded-full bg-ink-850 hover:bg-ink-800 border border-line text-xs font-medium ds-text-dim transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <GoogleIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign In</span>
                </button>
              </div>
            )}

            {/* Floating High-Contrast Cart Pill */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative px-3 sm:px-4 py-1.5 rounded-full ds-btn-solid font-bold text-xs flex items-center gap-2 shadow-lg shadow-white/10 transition active:scale-95 cursor-pointer"
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

      {/* Compact product-first hero */}
      <section className="max-w-6xl mx-auto px-4 pt-8 pb-6">
        <div className="relative overflow-hidden rounded-3xl border border-line/80 bg-gradient-to-br from-ink-850/70 to-ink-950/80 p-6 sm:p-8">
          <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 bg-brand-500/15 blur-[90px] rounded-full" />
          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ink-950/70 border border-line text-[11px] ds-text-dim">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              Live &bull; Instant NBC Bakong KHQR &bull; 15-min delivery
            </span>
            <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight ds-text leading-[1.1]">
              Shop tech &amp; coffee,{' '}
              <span className="bg-gradient-to-r from-brand-300 to-brand-400 bg-clip-text text-transparent">delivered in minutes</span>
            </h1>
            <p className="mt-2 text-sm ds-text-dim max-w-lg">
              Genuine Apple, Sony &amp; Anker hardware and artisan Mondulkiri roast &mdash; pay instantly with Bakong KHQR.
            </p>
            <div className="mt-5 relative max-w-xl">
              <Search className="w-4 h-4 ds-text-dim absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search MacBook, AirPods, coffee…"
                className="w-full pl-11 pr-4 py-3 bg-ink-950/70 border border-line rounded-2xl text-sm ds-text placeholder-zinc-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <a href="#catalog" className="px-5 py-2.5 rounded-full ds-btn-solid font-bold text-sm transition inline-flex items-center gap-2 cursor-pointer">
                <span>Shop now</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <button
                onClick={() => setIsHistoryOpen(true)}
                className="px-4 py-2.5 rounded-full bg-ink-850/80 hover:bg-ink-800 ds-text-dim font-semibold text-sm border border-line transition inline-flex items-center gap-2 cursor-pointer"
              >
                <Compass className="w-4 h-4 text-brand-400" />
                <span>Track delivery</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Products Catalog Section */}
      <main id="catalog" className="max-w-6xl mx-auto px-4 scroll-mt-20">
        {/* Category Pills & Refresh Action */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 p-2 bg-ink-950/70 border border-line/80 rounded-2xl backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'ds-btn-solid shadow-md shadow-white/10'
                    : 'ds-text-dim hover:text-white hover:bg-ink-850'
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
            className="text-[11px] font-mono ds-text-dim hover:text-brand-400 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ink-850 border border-line transition cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sync Catalog</span>
          </button>
        </div>

        {/* Catalog Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-extrabold ds-text">Featured Catalog</h3>
            <p className="text-xs ds-text-dim">
              Showing {filteredProducts.length} verified item(s) in category {selectedCategory}
            </p>
          </div>
          <span className="text-xs font-mono">
            {isBackendConnected ? (
              <span className="text-emerald-400 font-semibold">● Central Data Center</span>
            ) : (
              <span className="text-brand-400 font-semibold">○ Container Autonomous</span>
            )}
          </span>
        </div>

        {isProductsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, n) => (
              <div
                key={n}
                className="bg-ink-850/50 border border-line/80 rounded-[2rem] p-5 flex flex-col justify-between animate-pulse space-y-4"
              >
                <div>
                  <div className="w-full h-40 bg-ink-800/60 rounded-2xl mb-4" />
                  <div className="h-3 bg-ink-800 rounded w-16 mb-2" />
                  <div className="h-5 bg-ink-800 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-ink-800/60 rounded w-full mb-1" />
                </div>
                <div className="pt-3 border-t border-line/80 flex items-center justify-between">
                  <div className="h-5 bg-ink-800 rounded w-16" />
                  <div className="h-8 w-24 bg-ink-800 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-16 text-center rounded-[2.5rem] bg-ink-950/60 border border-line/80 my-4 shadow-xl">
            <Package className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-base font-bold ds-text mb-1">Nothing here yet</h3>
            <p className="text-xs ds-text-dim max-w-sm mx-auto mb-4">
              We&apos;re loading fresh stock into this category. Try another category, or refresh to pull the latest catalog.
            </p>
            <button
              onClick={() => refetchProducts()}
              className="px-5 py-2.5 rounded-full ds-btn-solid text-xs font-bold inline-flex items-center gap-2 transition"
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
                className="group bg-ink-850/50 border border-line/80 hover:border-brand-500/50 rounded-[2rem] p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1.5 relative overflow-hidden"
              >
                <div>
                  <div className="w-full h-40 rounded-2xl bg-ink-950/80 border border-line/80 mb-4 flex items-center justify-center relative overflow-hidden group-hover:border-brand-500/40 transition">
                    <Package className="w-12 h-12 text-zinc-600 group-hover:text-brand-400 transition transform group-hover:scale-110 duration-300" />
                    <span className="absolute top-2.5 right-2.5 text-[10px] font-mono px-2 py-0.5 rounded-full bg-ink-850 ds-text-dim border border-line">
                      {product.sku}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-brand-400 tracking-wider uppercase">
                    {product.category}
                  </span>
                  <h4 className="text-base font-bold ds-text mt-1 group-hover:text-brand-300 transition line-clamp-1">
                    {product.name}
                  </h4>
                  <p className="text-xs ds-text-dim mt-1 line-clamp-2">
                    {product.description || 'Premium standard verified inventory with instant NBC Bakong settlement.'}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-line/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono ds-text-faint block">PRICE</span>
                    <span className="text-lg font-extrabold ds-text font-mono">
                      ${product.price.toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={() => addToCart(product)}
                    className="px-3.5 py-2 rounded-full ds-btn-solid text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-white/5 active:scale-95 cursor-pointer"
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


      {/* Why shop with us — trust strip (relocated below catalog) */}
      <section className="max-w-6xl mx-auto px-4 mt-14">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: QrCode, tint: '#fb7185', title: 'Instant Bakong KHQR', sub: '0.4s settlement · 0% fee' },
            { icon: Truck, tint: '#818cf8', title: '15-min fleet dispatch', sub: 'Live GPS courier tracking' },
            { icon: ShieldCheck, tint: '#34d399', title: '100% genuine stock', sub: 'Manufacturer warranty' },
            { icon: Store, tint: '#a5b4fc', title: 'Offline resilience', sub: 'Zero data loss' },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="rounded-2xl bg-ink-850/50 border border-line/80 p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${f.tint}1a`, color: f.tint }}>
                  <Icon style={{ width: 18, height: 18 }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold ds-text leading-tight">{f.title}</p>
                  <p className="text-[11px] ds-text-faint mt-0.5">{f.sub}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* VIP loyalty CTA (compact — replaces the hero member pass) */}
      <section className="max-w-6xl mx-auto px-4 mt-4">
        <div className="rounded-2xl border border-line/80 bg-gradient-to-r from-brand-600/15 to-ink-950/50 p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-300 flex items-center justify-center font-mono font-bold text-xs shrink-0">CT</div>
            <div>
              <p className="text-sm font-bold ds-text">CamTech VIP &mdash; earn points on every order</p>
              <p className="text-[11px] ds-text-dim">
                {customer
                  ? `${(customer.loyaltyPoints ?? 500).toLocaleString()} pts · ${customer.loyaltyTier ?? 'Executive Gold'}`
                  : 'Sign in to start earning loyalty rewards on every purchase.'}
              </p>
            </div>
          </div>
          {!customer && (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-4 py-2 rounded-full ds-btn-solid text-xs font-bold transition shrink-0"
            >
              Join VIP
            </button>
          )}
        </div>
      </section>

      {/* Floating Bottom Quick Action Dock (Lightswind Style) */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 rounded-full bg-ink-950/85 backdrop-blur-2xl border border-line/90 shadow-[0_12px_40px_rgba(0,0,0,0.8)] flex items-center gap-1.5 sm:gap-2">
        <a
          href="#catalog"
          className="p-2 rounded-full hover:bg-ink-800/80 ds-text-dim hover:text-white transition"
          title="Products Catalog"
        >
          <Package className="w-4 h-4" />
        </a>
        <button
          onClick={() => setIsHistoryOpen(true)}
          className="p-2 rounded-full hover:bg-ink-800/80 ds-text-dim hover:text-white transition"
          title="My Orders"
        >
          <History className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-ink-800" />
        <button
          onClick={() => setIsCartOpen(true)}
          className="px-3 py-1.5 rounded-full ds-btn-solid font-bold text-xs flex items-center gap-1.5 transition shadow-md cursor-pointer"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>${cartTotal.toFixed(2)}</span>
          {cartCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
              {cartCount}
            </span>
          )}
        </button>
        <div className="w-px h-4 bg-ink-800" />
        <button
          onClick={() => (customer ? setIsHistoryOpen(true) : setIsAuthModalOpen(true))}
          className="p-2 rounded-full hover:bg-ink-800/80 ds-text-dim hover:text-white transition"
          title={customer ? customer.name : 'Sign In'}
        >
          <User className="w-4 h-4" />
        </button>
      </div>

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-ink-850 border-l border-line h-full flex flex-col p-6 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-base ds-text">Your Shopping Cart</h3>
                  <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {customer ? '☁️ Cloud Synced with Account' : '💾 Saved to Device Storage'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1 rounded-lg hover:bg-ink-800 ds-text-dim hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-16 ds-text-faint">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Your cart is currently empty.</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-ink-800/60 border border-line-strong/60"
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <p className="text-sm font-semibold ds-text truncate">{item.name}</p>
                      <p className="text-xs text-emerald-400 font-mono">${item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-6 h-6 rounded-md bg-ink-700 hover:bg-slate-600 flex items-center justify-center text-xs ds-text-dim cursor-pointer"
                        title="Decrease"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-4 text-center ds-text">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-6 h-6 rounded-md bg-ink-700 hover:bg-slate-600 flex items-center justify-center text-xs ds-text-dim cursor-pointer"
                        title="Increase"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="p-1 rounded hover:bg-rose-950/40 ds-text-faint hover:text-rose-400 text-xs ml-1 cursor-pointer transition"
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
              <div className="pt-4 border-t border-line space-y-3">
                <div className="flex justify-between text-xs ds-text-dim">
                  <span>Subtotal</span>
                  <span className="ds-text-dim font-mono">${cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs ds-text-dim">
                  <span>Tax (10% VAT)</span>
                  <span className="ds-text-dim font-mono">${(cartTotal * 0.1).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold ds-text pt-2 border-t border-line">
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
          <div className="w-full max-w-lg bg-ink-850 border border-line rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <h3 className="font-bold text-lg ds-text flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Secure Checkout
              </h3>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1 rounded-lg hover:bg-ink-800 ds-text-dim hover:text-white"
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
                      <p className="text-xs font-semibold ds-text flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-emerald-400" />
                        Ordering as <span className="text-emerald-300 font-bold">{customer.name}</span>
                      </p>
                      <p className="text-[10px] ds-text-dim mt-0.5">
                        {customer.email}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomer(null);
                        toast.info('Switched to Guest Checkout');
                      }}
                      className="text-[11px] ds-text-dim hover:text-emerald-400 underline"
                    >
                      Buy as Guest
                    </button>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-semibold ds-text-dim block mb-1">
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
                      className="w-full px-3 py-2 bg-ink-850 border border-line-strong focus:border-emerald-500 rounded-lg text-xs ds-text placeholder-slate-500 focus:outline-none transition"
                    />
                    {!(customer.phone || guestPhone) && (
                      <p className="text-[11px] text-brand-400 mt-1 flex items-center gap-1">
                        <span>⚠️</span> Please enter your phone number so our driver can contact you.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-ink-950/70 p-3.5 rounded-xl border border-line space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Guest Checkout (No Account Needed)
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAuthModalOpen(true)}
                      className="text-[11px] ds-text-dim hover:text-white underline"
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
                      <div className="w-full border-t border-line"></div>
                    </div>
                    <span className="relative bg-ink-950 px-2 text-[10px] ds-text-faint uppercase">or enter manually</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-semibold ds-text-dim block mb-1">
                        Your Full Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Dara Pich"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        className="w-full px-3 py-2 bg-ink-800 border border-line-strong rounded-lg text-xs ds-text placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-semibold ds-text-dim block mb-1">
                        Phone (For Delivery) *
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. +855 12 345 678"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-ink-800 border border-line-strong rounded-lg text-xs ds-text placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold ds-text-dim">Delivery Destination *</label>
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
                  <MapPin className="w-4 h-4 ds-text-faint absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Enter street, building, or district..."
                    className="w-full pl-9 pr-3 py-2 bg-ink-800 border border-line-strong rounded-lg text-xs ds-text"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold ds-text-dim block mb-2">Select Payment Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod('KHQR')}
                    className={`p-3 rounded-xl border flex items-center gap-2 transition ${
                      paymentMethod === 'KHQR'
                        ? 'bg-rose-500/10 border-rose-500 text-rose-400 font-bold'
                        : 'bg-ink-800/80 border-line-strong ds-text-dim'
                    }`}
                  >
                    <QrCode className="w-5 h-5 text-rose-400" />
                    <div className="text-left">
                      <p className="text-xs">Bakong KHQR</p>
                      <p className="text-[10px] ds-text-dim font-normal">Scan & Pay Any Bank</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('COD')}
                    className={`p-3 rounded-xl border flex items-center gap-2 transition ${
                      paymentMethod === 'COD'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
                        : 'bg-ink-800/80 border-line-strong ds-text-dim'
                    }`}
                  >
                    <Truck className="w-5 h-5 text-emerald-400" />
                    <div className="text-left">
                      <p className="text-xs">Cash on Delivery</p>
                      <p className="text-[10px] ds-text-dim font-normal">Pay Driver Upon Arrival</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* KHQR Preview */}
              {paymentMethod === 'KHQR' && (
                <div className="p-4 rounded-2xl bg-gradient-to-b from-rose-950/40 to-ink-950 border border-rose-800/40 text-center space-y-2.5">
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
                    <p className="text-sm font-extrabold ds-text font-mono">${(cartTotal * 1.1).toFixed(2)} USD</p>
                    <p className="text-[10px] text-rose-300/80 font-medium">Scan with ABA Mobile, Wing, ACLEDA, or any Bakong App</p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-line flex items-center justify-between">
              <div>
                <span className="text-xs ds-text-dim block">Total Due</span>
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
          <div className="w-full max-w-md bg-ink-850 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/40">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold ds-text">Order Confirmed!</h3>
            <p className="text-xs text-emerald-400 font-mono mt-1">{confirmedOrder.orderNumber}</p>
            <p className="text-xs ds-text-dim mt-2">
              Thank you, {confirmedOrder.customer.name}! We have routed your dispatch request to our nearest delivery fleet.
            </p>

            <div className="mt-4 p-3 rounded-xl bg-ink-950 text-left text-xs space-y-1.5 border border-line">
              <div className="flex justify-between">
                <span className="ds-text-dim">Total Charged:</span>
                <span className="font-bold text-emerald-400">${confirmedOrder.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="ds-text-dim">Destination:</span>
                <span className="ds-text-dim truncate">{confirmedOrder.address}</span>
              </div>
              <div className="flex justify-between">
                <span className="ds-text-dim">Method:</span>
                <span className="ds-text-dim">{confirmedOrder.paymentMethod}</span>
              </div>
            </div>

            <div className="mt-6 space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedOrderForTracking(confirmedOrder);
                  setConfirmedOrder(null);
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition active:scale-95 cursor-pointer"
              >
                <Truck className="w-4 h-4" />
                <span>Track Order Live (Real-Time GPS)</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrderForInvoice(confirmedOrder);
                    setConfirmedOrder(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-ink-800 hover:bg-ink-700 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 border border-line-strong transition cursor-pointer"
                >
                  <Receipt className="w-4 h-4" />
                  View Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmedOrder(null)}
                  className="flex-1 py-2.5 rounded-xl bg-ink-950 hover:bg-ink-800 text-slate-300 font-bold text-xs border border-line transition cursor-pointer"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Purchase History Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-ink-850 border border-line rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-lg ds-text">Order History & Invoices</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="p-1 rounded-lg hover:bg-ink-800 ds-text-dim hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Channel Filtering Segmented Tabs */}
            <div className="flex items-center gap-2 pt-3 pb-1">
              <button
                type="button"
                onClick={() => setHistoryChannelTab('STORE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  historyChannelTab === 'STORE'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'bg-ink-950 text-slate-400 hover:text-white border border-line'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Online Store Orders</span>
              </button>
              <button
                type="button"
                onClick={() => setHistoryChannelTab('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  historyChannelTab === 'ALL'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'bg-ink-950 text-slate-400 hover:text-white border border-line'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>All Invoices (POS & Online)</span>
              </button>
            </div>

            <div className="py-3 max-h-96 overflow-y-auto space-y-3">
              {isHistoryLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-ink-950 border border-line flex items-center justify-between animate-pulse">
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-28 bg-ink-800 rounded" />
                      <div className="h-2.5 w-16 bg-ink-800/60 rounded" />
                    </div>
                    <div className="space-y-1.5 text-right flex flex-col items-end">
                      <div className="h-4 w-16 bg-ink-800 rounded" />
                      <div className="h-2.5 w-12 bg-ink-800/60 rounded" />
                    </div>
                  </div>
                ))
              ) : (!orderHistory || orderHistory.length === 0) ? (
                <div className="text-center py-10 ds-text-faint space-y-2">
                  <Package className="w-10 h-10 mx-auto opacity-30 text-emerald-400" />
                  <p className="text-xs font-medium">
                    {historyChannelTab === 'STORE'
                      ? 'No online storefront orders found for your account.'
                      : 'No past purchases found.'}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Orders placed on this device or with your phone number will appear here automatically.
                  </p>
                </div>
              ) : (
                orderHistory.slice(0, 15).map((order: any) => (
                  <div
                    key={order.id || order.orderNumber}
                    onClick={() => {
                      setSelectedOrderForInvoice(order);
                      setIsHistoryOpen(false);
                    }}
                    className="p-3.5 rounded-xl bg-ink-950 border border-line hover:border-emerald-500/50 hover:bg-ink-850/90 transition cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold ds-text group-hover:text-emerald-400 transition">
                          {order.saleNumber || order.orderNumber || order.id}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                          {order.status || 'COMPLETED'}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                          (order.channel === 'STORE' || !order.channel)
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                            : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                        }`}>
                          {(order.channel === 'STORE' || !order.channel) ? '🛍️ STORE' : '🏪 POS'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] ds-text-dim">
                        <span>{order.createdAt || order.date ? new Date(order.createdAt || order.date).toLocaleDateString() : 'Recent'}</span>
                        <span>•</span>
                        <span>{order.lineItems?.length || order.items?.length || order.itemCount || 1} item(s)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <span className="font-mono font-bold text-emerald-400 text-sm block">
                          ${Number(order.grandTotal || order.total || 0).toFixed(2)}
                        </span>
                        <span className="text-[10px] block ds-text-faint">
                          {order.payments?.[0]?.method || order.paymentMethod || 'Paid via KHQR'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderForTracking(order);
                            setIsHistoryOpen(false);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-[11px] flex items-center gap-1 border border-emerald-500/30 transition cursor-pointer"
                          title="Track Live"
                        >
                          <Truck className="w-3 h-3" />
                          <span>Track</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderForInvoice(order);
                            setIsHistoryOpen(false);
                          }}
                          className="p-1 rounded-lg bg-ink-850 hover:bg-ink-800 ds-text-dim hover:text-white transition border border-line cursor-pointer"
                          title="View Invoice"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Official Tax Invoice & Order Detail Modal */}
      {selectedOrderForInvoice && (() => {
        const order = selectedOrderForInvoice;
        const invoiceNumber = order.saleNumber || order.orderNumber || (order.id ? `ORD-${String(order.id).slice(-6).toUpperCase()}` : 'ORD-2026-INV');
        const orderDate = order.createdAt || order.date || new Date().toISOString();
        const customerName = order.customerName || order.customer?.name || customer?.name || guestName || 'Valued Customer';
        const customerEmail = order.customerEmail || order.customer?.email || customer?.email || guestEmail || 'customer@camtech.store';
        const customerPhone = order.customerPhone || order.customer?.phone || customer?.phone || guestPhone || '';
        const orderAddress = order.deliveryAddress || order.address || deliveryAddress || 'Phnom Penh Urban Area, Cambodia';
        const method = order.payments?.[0]?.method || order.paymentMethod || 'KHQR (Bakong)';
        const grandTotal = Number(order.grandTotal || order.total || 0);
        const subtotal = order.subtotal !== undefined ? Number(order.subtotal) : (grandTotal / 1.1);
        const taxTotal = order.taxTotal !== undefined ? Number(order.taxTotal) : (grandTotal - subtotal);
        const khrTotal = Math.round(grandTotal * 4100).toLocaleString();
        const lineItems = (order.lineItems && order.lineItems.length > 0)
          ? order.lineItems
          : (order.items && order.items.length > 0)
          ? order.items
          : [];

        const handleCopyInvoiceNumber = () => {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(invoiceNumber);
            setCopiedInvoiceId(true);
            toast.success(`Copied ${invoiceNumber} to clipboard`);
            setTimeout(() => setCopiedInvoiceId(false), 2000);
          }
        };

        return (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-xl bg-ink-850 border border-line rounded-2xl shadow-2xl overflow-hidden my-6 animate-in zoom-in-95">
              {/* Modal Control Header (Hidden when printing) */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-ink-950/80 print:hidden">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-base ds-text">Order Details & Tax Invoice</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrderForTracking(order);
                      setSelectedOrderForInvoice(null);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-bold flex items-center gap-1.5 transition border border-emerald-500/30 cursor-pointer"
                    title="Switch to Real-Time Tracking"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Live Tracking</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-1.5 rounded-xl bg-ink-800 hover:bg-ink-700 ds-text-dim text-xs font-semibold flex items-center gap-1.5 transition border border-line-strong cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Print Invoice</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderForInvoice(null)}
                    className="p-1.5 rounded-lg hover:bg-ink-800 ds-text-dim hover:text-white transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Invoice Sheet */}
              <div id="printable-invoice" className="p-6 sm:p-8 space-y-6 ds-text-dim text-xs">
                {/* Brand Header */}
                <div className="flex items-start justify-between pb-6 border-b border-line">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-brand-400 flex items-center justify-center text-slate-950 shadow-md">
                        <Store className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="font-black text-lg ds-text tracking-tight">CamTech Store</h2>
                        <p className="text-[10px] text-emerald-400 font-mono">OFFICIAL TAX INVOICE • វិក្កយបត្រពន្ធ</p>
                      </div>
                    </div>
                    <p className="text-[10px] ds-text-dim mt-2">
                      Kingdom of Cambodia • Ministry of Commerce Reg. #00084920
                    </p>
                    <p className="text-[10px] ds-text-dim">
                      Vattanac Capital Tower, Level 14, Preah Monivong Blvd, Phnom Penh
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold font-mono">
                      <CheckCircle2 className="w-3 h-3" />
                      {order.status || 'PAID & COMPLETED'}
                    </span>
                    <div className="flex items-center justify-end gap-1.5 mt-2">
                      <span className="font-mono text-xs font-bold ds-text">{invoiceNumber}</span>
                      <button
                        type="button"
                        onClick={handleCopyInvoiceNumber}
                        className="ds-text-dim hover:text-white print:hidden cursor-pointer"
                        title="Copy Invoice Number"
                      >
                        {copiedInvoiceId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[10px] ds-text-dim font-mono">
                      {new Date(orderDate).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                {/* Customer & Delivery Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-ink-950 border border-line/80">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider ds-text-dim block">Billed To</span>
                    <p className="font-bold ds-text text-sm">{customerName}</p>
                    <p className="text-[11px] ds-text-dim">{customerEmail}</p>
                    {customerPhone && <p className="text-[11px] ds-text-dim font-mono">{customerPhone}</p>}
                  </div>
                  <div className="space-y-1 sm:text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider ds-text-dim block">Delivery Destination</span>
                    <p className="text-[11px] ds-text-dim line-clamp-2">{orderAddress}</p>
                    <div className="flex items-center sm:justify-end gap-2 pt-0.5">
                      <p className="text-[10px] text-emerald-400 font-medium">⚡ Express Fleet Dispatch</p>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(orderAddress)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-medium underline transition print:hidden"
                      >
                        <span>📍 Open Map</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Itemized Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-line text-[10px] uppercase font-bold ds-text-dim">
                        <th className="pb-2.5">Item Description</th>
                        <th className="pb-2.5 text-center">Qty</th>
                        <th className="pb-2.5 text-right">Price</th>
                        <th className="pb-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-800/60 font-mono">
                      {lineItems.length > 0 ? (
                        lineItems.map((item: any, idx: number) => {
                          const itemName = item.name || item.productName || 'Store Product';
                          const itemQty = Number(item.quantity || 1);
                          const itemPrice = Number(item.unitPrice || item.price || 0);
                          const itemTotal = Number(item.lineTotal || (itemQty * itemPrice));
                          const itemSku = item.sku || (item.id ? `SKU-${String(item.id).substring(0, 6)}` : 'GEN-01');

                          return (
                            <tr key={idx} className="hover:bg-ink-950/40">
                              <td className="py-2.5 font-sans">
                                <span className="font-semibold ds-text block">{itemName}</span>
                                <span className="text-[10px] ds-text-dim font-mono">{itemSku}</span>
                              </td>
                              <td className="py-2.5 text-center ds-text-dim">{itemQty}</td>
                              <td className="py-2.5 text-right ds-text-dim">${itemPrice.toFixed(2)}</td>
                              <td className="py-2.5 text-right font-bold ds-text">${itemTotal.toFixed(2)}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td className="py-3 font-sans">
                            <span className="font-semibold ds-text block">Central Store Merchandise</span>
                            <span className="text-[10px] ds-text-dim font-mono">ORDER-{invoiceNumber}</span>
                          </td>
                          <td className="py-3 text-center ds-text-dim">{order.itemCount || 1}</td>
                          <td className="py-3 text-right ds-text-dim">${subtotal.toFixed(2)}</td>
                          <td className="py-3 text-right font-bold ds-text">${subtotal.toFixed(2)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary */}
                <div className="pt-3 border-t border-line space-y-1.5">
                  <div className="flex justify-between ds-text-dim text-xs">
                    <span>Subtotal</span>
                    <span className="font-mono ds-text-dim">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between ds-text-dim text-xs">
                    <span>VAT / Tax (10% included)</span>
                    <span className="font-mono ds-text-dim">${taxTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between ds-text-dim text-xs">
                    <span>Fleet Delivery & Handling</span>
                    <span className="font-mono text-emerald-400 font-semibold">FREE / INCLUDED</span>
                  </div>
                  <div className="flex items-baseline justify-between pt-3 border-t border-line">
                    <div>
                      <span className="font-bold text-sm ds-text block">Grand Total Due</span>
                      <span className="text-[10px] ds-text-dim font-mono">1 USD ≈ 4,100 KHR</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-black text-xl text-emerald-400 block">
                        ${grandTotal.toFixed(2)} USD
                      </span>
                      <span className="font-mono text-xs ds-text-dim">
                        {khrTotal} KHR
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment & Verification Footer */}
                <div className="p-3.5 rounded-xl bg-ink-950 border border-line/80 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold ds-text block">Settlement Method</span>
                      <span className="ds-text-dim font-mono">{method}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-400 font-bold block">Transaction Verified</span>
                    <span className="ds-text-faint font-mono text-[10px]">National Bakong Network</span>
                  </div>
                </div>

                {/* Thank you note */}
                <div className="text-center pt-2 text-[10px] ds-text-dim">
                  <p>Thank you for choosing CamTech Store! For customer support, contact support@camtech.store.</p>
                </div>
              </div>

              {/* Bottom Actions (hidden during print) */}
              <div className="p-4 border-t border-line bg-ink-950/80 flex items-center justify-between print:hidden">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrderForInvoice(null);
                    setIsHistoryOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold ds-text-dim hover:text-white hover:bg-ink-800 transition cursor-pointer"
                >
                  ← Back to Order History
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Receipt
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderForInvoice(null)}
                    className="px-4 py-2 rounded-xl bg-ink-800 hover:bg-ink-700 ds-text font-semibold text-xs transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Real-Time Customer Order Tracking Modal (Reference Image 1) ─── */}
      {selectedOrderForTracking && (() => {
        const order = selectedOrderForTracking;
        const trackingNum = order.trackingNumber || (order.id ? `TRK-${String(order.id).slice(-4).toUpperCase()}` : 'TRK-2026-LIVE');
        const destLat = typeof order.destLat === 'number' && order.destLat !== 0 ? order.destLat : (coords?.lat ?? 11.5564);
        const destLng = typeof order.destLng === 'number' && order.destLng !== 0 ? order.destLng : (coords?.lng ?? 104.9282);

        // 4-digit verification code (matching Image 1 "2045 Your code")
        const verificationCode = order.deliveryPin || (order.id ? order.id.replace(/\D/g, '').slice(-4) || '2045' : '2045');

        // Status determination
        const rawStatus = String(order.deliveryStatus || order.status || 'PENDING').toUpperCase();
        let statusTitle = 'Order Confirmed';
        let statusSubtitle = 'Merchant is preparing order';
        let activeStep = 1; // 1: Accepted, 2: Processing, 3: Pickup / In Transit, 4: Delivered

        if (rawStatus === 'PENDING' || rawStatus === 'DRAFT') {
          statusTitle = 'Order Accepted';
          statusSubtitle = 'Merchant confirmed your order';
          activeStep = 1;
        } else if (rawStatus === 'DISPATCHED' || rawStatus === 'PACKING') {
          statusTitle = 'Processing & Packing';
          statusSubtitle = 'Driver arriving at store for pickup';
          activeStep = 2;
        } else if (rawStatus === 'IN_TRANSIT') {
          statusTitle = 'Out For delivery';
          const eta = order.etaMinutes ? `Arriving in ~${order.etaMinutes} mins` : 'Arriving at 12:45';
          statusSubtitle = eta;
          activeStep = 3;
        } else if (rawStatus === 'DELIVERED' || rawStatus === 'COMPLETED') {
          statusTitle = 'Package Delivered';
          statusSubtitle = 'Successfully handed to recipient';
          activeStep = 4;
        }

        const driverName = order.driverName || 'James Williams';
        const driverRating = '4.8';
        const driverPhone = order.driverPhone || '+85512888999';

        const handleSelectTip = (amount: number) => {
          setActiveTip(amount);
          toast.success(`🎉 Added $${amount.toFixed(2)} tip for ${driverName}! Everyone deserves a little kindness.`);
        };

        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;

        return (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            {/* Phone/Device Container Card */}
            <div className="w-full max-w-md bg-ink-900 border border-line rounded-[36px] shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 flex flex-col relative text-zinc-100">
              
              {/* Top Navigation Bar */}
              <div className="px-5 py-3.5 bg-ink-950/80 backdrop-blur-md border-b border-line flex items-center justify-between z-20 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForTracking(null)}
                  className="w-9 h-9 rounded-full bg-ink-850 hover:bg-ink-800 border border-line flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer"
                  title="Back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h3 className="font-extrabold text-sm tracking-tight text-white">Tracking Order</h3>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrderForInvoice(order);
                      setSelectedOrderForTracking(null);
                    }}
                    className="w-9 h-9 rounded-full bg-ink-850 hover:bg-ink-800 border border-line flex items-center justify-center text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                    title="View Tax Invoice"
                  >
                    <Receipt className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Live Map Header Section with Route Simulation (Image 1) */}
              <div className="relative w-full h-72 bg-slate-950 overflow-hidden shrink-0 border-b border-line">
                {/* Real Street Map (OpenStreetMap) */}
                <iframe
                  title={`Tracking-Map-${destLat}-${destLng}`}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${destLng - 0.009}%2C${destLat - 0.006}%2C${destLng + 0.009}%2C${destLat + 0.006}&layer=mapnik&marker=${destLat}%2C${destLng}`}
                  className="w-full h-full border-0 opacity-80 pointer-events-auto"
                  loading="lazy"
                />

                {/* Simulated Visual Route Line (Curved Green Line from Image 1) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                  <defs>
                    <linearGradient id="routeGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#059669" stopOpacity="0.95" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 130 220 Q 150 170 200 150 T 260 70"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray="6 6"
                    className="animate-pulse"
                  />
                </svg>

                {/* Courier / Shopper Scooter Marker on Route */}
                <div 
                  className="absolute z-20 flex flex-col items-center pointer-events-none"
                  style={{ left: '46%', top: '48%', transform: 'translate(-50%, -50%)' }}
                >
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-white shadow-xl flex items-center justify-center text-lg border-2 border-emerald-500 animate-bounce">
                      🛵
                    </div>
                    <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                  </div>
                  <span className="mt-1 px-2 py-0.5 rounded-md bg-slate-950/90 text-white font-mono text-[9px] font-bold border border-slate-700 shadow-md whitespace-nowrap">
                    {driverName.split(' ')[0]} • En Route
                  </span>
                </div>

                {/* Destination Marker with Glowing Pin */}
                <div
                  className="absolute z-20 flex flex-col items-center pointer-events-none"
                  style={{ left: '68%', top: '22%', transform: 'translate(-50%, -50%)' }}
                >
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center animate-pulse">
                      <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg text-slate-950 font-black text-xs">
                        📍
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating "Open with Google Maps" Button */}
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-900 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-lg border border-slate-700/80 transition hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
                >
                  <Navigation className="w-3.5 h-3.5 text-sky-400 fill-sky-400" />
                  <span>Google Maps</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>

                {/* Tracking ID Badge */}
                <div className="absolute bottom-2 left-3 z-20 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[10px] font-mono font-bold text-emerald-400">
                  #{trackingNum}
                </div>
              </div>

              {/* Floating Status & Milestone Card (Bottom - Matching Reference Image 1) */}
              <div className="p-5 space-y-5 bg-ink-950 flex-1 overflow-y-auto">
                
                {/* Status Header + 4-digit code */}
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-xl font-black text-white tracking-tight">{statusTitle}</h4>
                    <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{statusSubtitle}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xl font-black text-emerald-400 block tracking-wider">
                      {verificationCode}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                      Your code
                    </span>
                  </div>
                </div>

                {/* 4-Stage Visual Progress Stepper (Image 1) */}
                <div className="relative pt-2 pb-1">
                  {/* Background track */}
                  <div className="absolute top-6 left-6 right-6 h-1 bg-ink-800 rounded-full z-0" />
                  
                  {/* Progressive Green Track */}
                  <div 
                    className="absolute top-6 left-6 h-1 bg-emerald-500 rounded-full transition-all duration-500 z-0"
                    style={{
                      width: activeStep === 1 ? '10%' : activeStep === 2 ? '40%' : activeStep === 3 ? '72%' : '92%'
                    }}
                  />

                  {/* 4 Checkpoint Nodes */}
                  <div className="relative z-10 flex items-center justify-between">
                    {/* Stage 1: Accepted */}
                    <div className="flex flex-col items-center text-center w-16">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        activeStep >= 1
                          ? 'bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/30'
                          : 'bg-ink-850 text-zinc-500 border border-line'
                      }`}>
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                      <span className={`text-[10px] font-bold mt-2 ${
                        activeStep >= 1 ? 'text-white' : 'text-zinc-500'
                      }`}>
                        Accepted
                      </span>
                    </div>

                    {/* Stage 2: Processing */}
                    <div className="flex flex-col items-center text-center w-16">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        activeStep >= 2
                          ? 'bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/30'
                          : 'bg-ink-850 text-zinc-500 border border-line'
                      }`}>
                        {activeStep === 2 ? (
                          <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
                        ) : (
                          <Package className="w-4 h-4" />
                        )}
                      </div>
                      <span className={`text-[10px] font-bold mt-2 ${
                        activeStep >= 2 ? 'text-white' : 'text-zinc-500'
                      }`}>
                        Processing
                      </span>
                    </div>

                    {/* Stage 3: Pickup / Out for Delivery */}
                    <div className="flex flex-col items-center text-center w-16">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        activeStep >= 3
                          ? 'bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/30'
                          : 'bg-ink-850 text-zinc-500 border border-line'
                      }`}>
                        <Truck className="w-4 h-4" />
                      </div>
                      <span className={`text-[10px] font-bold mt-2 ${
                        activeStep >= 3 ? 'text-white' : 'text-zinc-500'
                      }`}>
                        Pickup
                      </span>
                    </div>

                    {/* Stage 4: Delivered */}
                    <div className="flex flex-col items-center text-center w-16">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        activeStep >= 4
                          ? 'bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/30'
                          : 'bg-ink-850 text-zinc-500 border border-line'
                      }`}>
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span className={`text-[10px] font-bold mt-2 ${
                        activeStep >= 4 ? 'text-white' : 'text-zinc-500'
                      }`}>
                        Delivered
                      </span>
                    </div>
                  </div>
                </div>

                {/* ─── Ordered Items Breakdown Card ─── */}
                {((order.items && order.items.length > 0) || (order.lineItems && order.lineItems.length > 0)) && (
                  <div className="p-4 rounded-2xl bg-ink-900 border border-line space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="font-extrabold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Items in this Order</span>
                      </h5>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-ink-800 text-emerald-400 border border-emerald-500/20">
                        {(order.items || order.lineItems).length} item{(order.items || order.lineItems).length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="divide-y divide-line/60">
                      {(order.items || order.lineItems).map((item: any, idx: number) => {
                        const name = item.productName || item.name || 'Item';
                        const qty = item.quantity || 1;
                        const price = item.unitPrice || item.price || (item.lineTotal ? item.lineTotal / qty : 0);
                        const total = item.lineTotal || (qty * price);
                        return (
                          <div key={item.id || idx} className="py-2.5 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-6 h-6 rounded-md bg-emerald-500/15 text-emerald-400 font-black text-[11px] flex items-center justify-center shrink-0 border border-emerald-500/30">
                                {qty}x
                              </span>
                              <div className="min-w-0">
                                <span className="font-bold text-white block truncate">{name}</span>
                                <span className="text-[10px] text-zinc-400 font-mono">${Number(price).toFixed(2)} each</span>
                              </div>
                            </div>
                            <span className="font-mono font-bold text-emerald-400 shrink-0 ml-2">
                              ${Number(total).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Order Total */}
                    <div className="pt-2.5 border-t border-line flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-400">Total Charged</span>
                      <span className="text-emerald-400 font-mono font-black text-sm">
                        ${Number(order.grandTotal || order.totalAmount || order.codAmount || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Assigned Driver Profile Card (Image 1) */}
                <div className="p-3.5 rounded-2xl bg-ink-900 border border-line flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Avatar photo */}
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-emerald-500/40 bg-ink-800 shrink-0 flex items-center justify-center">
                      <img
                        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                        alt={driverName}
                        className="w-full h-full object-cover"
                        onError={(e: any) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      <User className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h5 className="font-extrabold text-sm text-white">{driverName}</h5>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-zinc-400">
                        <span>Coming to you</span>
                        <span className="text-amber-400 font-bold flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {driverRating}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Communication Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        toast.info(`Direct chat with ${driverName} is active via Telegram Fleet Dispatch.`);
                      }}
                      className="w-10 h-10 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 flex items-center justify-center transition active:scale-95 cursor-pointer"
                      title="Chat with courier"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <a
                      href={`tel:${driverPhone}`}
                      className="w-10 h-10 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 flex items-center justify-center transition active:scale-95 cursor-pointer"
                      title="Call courier"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Tip Your Shopper Section (Image 1) */}
                <div className="p-4 rounded-2xl bg-ink-900 border border-line space-y-3">
                  <div>
                    <h5 className="font-extrabold text-xs text-white">Tip your shopper</h5>
                    <p className="text-[11px] text-zinc-400 mt-0.5">Everyone deserve a little kindness</p>
                  </div>
                  
                  {/* Tip quick amount buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    {[2.00, 5.00, 10.00, 15.00].map((amt) => {
                      const isSelected = activeTip === amt;
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => handleSelectTip(amt)}
                          className={`py-2 rounded-xl text-xs font-mono font-bold transition active:scale-95 cursor-pointer border ${
                            isSelected
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                              : 'bg-ink-850 hover:bg-ink-800 text-zinc-300 border-line hover:border-emerald-500/40'
                          }`}
                        >
                          ${amt.toFixed(2)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Controls: Switch to Invoice or Close */}
                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrderForInvoice(order);
                      setSelectedOrderForTracking(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-ink-850 hover:bg-ink-800 text-zinc-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-line transition cursor-pointer"
                  >
                    <Receipt className="w-4 h-4 text-emerald-400" />
                    <span>View Tax Invoice</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedOrderForTracking(null)}
                    className="flex-1 py-2.5 rounded-xl bg-ink-850 hover:bg-ink-800 text-zinc-300 hover:text-white font-bold text-xs transition border border-line cursor-pointer"
                  >
                    Close
                  </button>
                </div>

              </div>
            </div>
          </div>
        );
      })()}

      {/* Track Order Quick Lookup Modal */}
      {isTrackLookupOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-ink-850 border border-line rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base ds-text">Track Your Order</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTrackLookupOpen(false)}
                className="p-1 rounded-lg hover:bg-ink-800 ds-text-dim hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <p className="ds-text-dim">
                Enter your order number or tracking number to see real-time delivery status:
              </p>
              <input
                type="text"
                placeholder="e.g. TRK-2026-1001 or ORD-..."
                value={trackLookupQuery}
                onChange={(e) => setTrackLookupQuery(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-ink-950 border border-line ds-text placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono text-xs"
              />
              <button
                type="button"
                disabled={!trackLookupQuery.trim() || isSearchingTracking}
                onClick={async () => {
                  if (!trackLookupQuery.trim()) return;
                  setIsSearchingTracking(true);
                  try {
                    const res = await fetch(`${API_BASE_URL}/api/v1/delivery/track/${encodeURIComponent(trackLookupQuery.trim())}`);
                    if (res.ok) {
                      const json = await res.json();
                      const trackData = json.data || json;
                      setSelectedOrderForTracking(trackData);
                      setIsTrackLookupOpen(false);
                      toast.success(`Found live tracking for #${trackData.trackingNumber || trackLookupQuery}`);
                    } else {
                      toast.error(`No order found matching "${trackLookupQuery}". Please check the number.`);
                    }
                  } catch (err: any) {
                    toast.error(`Lookup failed: ${err.message || 'Server unreachable'}`);
                  } finally {
                    setIsSearchingTracking(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
              >
                {isSearchingTracking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>Find Live Tracking</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Sign In / Account Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-ink-850 border border-line rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base ds-text">Customer Sign In</h3>
              </div>
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="p-1 rounded-lg hover:bg-ink-800 ds-text-dim hover:text-white"
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
                  <div className="w-full border-t border-line"></div>
                </div>
                <span className="relative bg-ink-850 px-2 text-[10px] ds-text-faint uppercase">or with name & email</span>
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
                  <label className="text-xs font-semibold ds-text-dim block mb-1">Your Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Dara Pich"
                    value={authNameInput}
                    onChange={(e) => setAuthNameInput(e.target.value)}
                    className="w-full px-3 py-2 bg-ink-800 border border-line-strong rounded-lg text-xs ds-text placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold ds-text-dim block mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    placeholder="e.g. +855 12 345 678"
                    value={authPhoneInput}
                    onChange={(e) => setAuthPhoneInput(e.target.value)}
                    className="w-full px-3 py-2 bg-ink-800 border border-line-strong rounded-lg text-xs ds-text placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold ds-text-dim block mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. dara.pich@gmail.com"
                    value={authEmailInput}
                    onChange={(e) => setAuthEmailInput(e.target.value)}
                    className="w-full px-3 py-2 bg-ink-800 border border-line-strong rounded-lg text-xs ds-text placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
                >
                  Sign In to Account
                </button>
              </form>

              <p className="text-[11px] ds-text-faint text-center pt-3 border-t border-line">
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
