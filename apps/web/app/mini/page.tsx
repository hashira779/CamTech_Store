'use client';

import React, { useState, useEffect, useRef } from 'react';
import WebApp from '@twa-dev/sdk';
import { useQuery } from '@tanstack/react-query';
import { api, BASE_URL } from '@/lib/api-client';
import {
  Coffee,
  ShoppingBag,
  Search,
  Plus,
  Minus,
  CreditCard,
  Wallet,
  MapPin,
  Map as MapIcon,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  User,
  History,
  Receipt,
  X,
  Sparkles,
  Phone,
  Flame,
  IceCream,
  Share2,
  ExternalLink,
  Store,
  ChevronLeft
} from 'lucide-react';
import { toast } from 'sonner';

interface CartItem {
  productId: string;
  variantId: string;
  name: string;
  price: number;
  quantity: number;
  size: string;
  sugarLevel: string;
  iceLevel: string;
  addOns: string[];
  notes?: string;
  imageUrl?: string | null;
}

interface SavedOrder {
  id: string;
  saleNumber: string;
  createdAt: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    size?: string;
    sugarLevel?: string;
  }>;
  total: number;
  status: string;
  paymentMethod: string;
  deliveryAddress: string;
  paymentQrCode?: string | null;
  paymentDeeplink?: string | null;
}

const CATEGORIES = [
  { id: 'ALL', name: 'All Menu', icon: Sparkles },
  { id: 'COFFEE', name: 'Espresso & Coffee', icon: Coffee },
  { id: 'COLD', name: 'Cold Brew & Iced', icon: IceCream },
  { id: 'TEA', name: 'Tea & Matcha', icon: Flame },
  { id: 'BAKERY', name: 'Bakery & Pastry', icon: ShoppingBag },
];

const SUGAR_OPTIONS = ['100%', '75%', '50%', '25%', '0%'];
const ICE_OPTIONS = ['Normal Ice', 'Less Ice', 'No Ice', 'Hot 🔥'];
const SIZE_OPTIONS = [
  { name: 'Regular', extraPrice: 0 },
  { name: 'Large', extraPrice: 0.50 }
];
const ADD_ONS = [
  { id: 'extra_shot', name: 'Extra Espresso Shot', price: 0.75 },
  { id: 'oat_milk', name: 'Oat Milk Sub', price: 0.60 },
  { id: 'vanilla_syrup', name: 'Vanilla Syrup', price: 0.50 },
  { id: 'caramel_drizzle', name: 'Caramel Drizzle', price: 0.50 },
];

const KHR_RATE = 4100;

export default function TelegramMiniAppPage() {
  // Navigation tabs: 'menu' | 'cart' | 'orders' | 'profile' | 'payment'
  const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'orders' | 'profile' | 'payment'>('menu');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Customization modal state
  const [customizingProduct, setCustomizingProduct] = useState<any | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('Regular');
  const [selectedSugar, setSelectedSugar] = useState<string>('100%');
  const [selectedIce, setSelectedIce] = useState<string>('Normal Ice');
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [itemNotes, setItemNotes] = useState<string>('');
  const [modalQuantity, setModalQuantity] = useState<number>(1);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('camtech_mini_cart') : null;
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Customer contact state (persisted)
  const [customerName, setCustomerName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('camtech_mini_name') || WebApp.initDataUnsafe?.user?.first_name || 'Guest Customer';
    }
    return 'Guest Customer';
  });
  const [customerPhone, setCustomerPhone] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('camtech_mini_phone') || '012 345 678';
    }
    return '012 345 678';
  });
  const [deliveryAddress, setDeliveryAddress] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('camtech_mini_address') || 'Phnom Penh, Cambodia';
    }
    return 'Phnom Penh, Cambodia';
  });
  const [locationEnabled, setLocationEnabled] = useState(false);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<'KHQR' | 'CASH'>('KHQR');
  const [activePaymentSale, setActivePaymentSale] = useState<any | null>(null);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const paymentPollIntervalRef = useRef<any>(null);

  // Order history state
  const [pastOrders, setPastOrders] = useState<SavedOrder[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('camtech_mini_orders_history') : null;
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [viewingReceiptOrder, setViewingReceiptOrder] = useState<SavedOrder | null>(null);

  // Tenant / Organization state
  const orgParam = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('org') || undefined) : undefined;
  const [token, setToken] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string>('CamTech Specialty Café');

  // Save cart to local storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('camtech_mini_cart', JSON.stringify(cart));
    }
  }, [cart]);

  // Save customer details
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('camtech_mini_name', customerName);
      localStorage.setItem('camtech_mini_phone', customerPhone);
      localStorage.setItem('camtech_mini_address', deliveryAddress);
    }
  }, [customerName, customerPhone, deliveryAddress]);

  // Save past orders
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('camtech_mini_orders_history', JSON.stringify(pastOrders));
    }
  }, [pastOrders]);

  // Initialize Telegram Web App
  useEffect(() => {
    if (typeof window !== 'undefined' && WebApp.initData) {
      try {
        WebApp.ready();
        WebApp.expand();
        WebApp.enableClosingConfirmation();
        if (WebApp.initDataUnsafe?.user?.first_name) {
          setCustomerName(WebApp.initDataUnsafe.user.first_name);
        }
      } catch (e) {
        console.warn('Telegram SDK initialization note:', e);
      }

      // Authenticate with backend
      fetch(`${BASE_URL}/api/v1/telegram/mini-app/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: WebApp.initData, organizationId: orgParam })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.token) {
          setToken(data.token);
          if (data.botName) setShopName(data.botName);
        }
      })
      .catch(err => {
        console.error('Telegram auth warning:', err);
      });
    }
  }, [orgParam]);

  // Query store products
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['mini-products', searchQuery, token, orgParam],
    queryFn: () => token 
      ? api.listProducts(token, { limit: 50, search: searchQuery || undefined }) 
      : api.getPublicProducts({ limit: 50, search: searchQuery || undefined, organizationId: orgParam }),
  });

  const products = productsData?.items || [];

  // Filter products by category & search
  const filteredProducts = products.filter((p: any) => {
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedCategory === 'ALL') return true;
    const cat = (p.category?.name || p.categoryName || '').toUpperCase();
    if (selectedCategory === 'COFFEE') return cat.includes('COFFEE') || cat.includes('ESPRESSO') || cat.includes('LATTE');
    if (selectedCategory === 'COLD') return cat.includes('COLD') || cat.includes('ICED') || cat.includes('BREW');
    if (selectedCategory === 'TEA') return cat.includes('TEA') || cat.includes('MATCHA');
    if (selectedCategory === 'BAKERY') return cat.includes('BAKERY') || cat.includes('PASTRY') || cat.includes('FOOD');
    return true;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Trigger Haptic feedback safely
  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'selection' | 'success') => {
    if (typeof window !== 'undefined' && WebApp.HapticFeedback) {
      if (type === 'selection') {
        WebApp.HapticFeedback.selectionChanged();
      } else if (type === 'success') {
        WebApp.HapticFeedback.notificationOccurred('success');
      } else {
        WebApp.HapticFeedback.impactOccurred(type);
      }
    }
  };

  // Open customization modal
  const openCustomizer = (product: any) => {
    triggerHaptic('light');
    setCustomizingProduct(product);
    setSelectedSize('Regular');
    setSelectedSugar('100%');
    setSelectedIce('Normal Ice');
    setSelectedAddOns([]);
    setItemNotes('');
    setModalQuantity(1);
  };

  // Calculate customized modal unit price
  const calculateModalUnitPrice = () => {
    if (!customizingProduct) return 0;
    const basePrice = Number(customizingProduct.variants?.[0]?.sellPrice || customizingProduct.price || 0);
    const sizeExtra = selectedSize === 'Large' ? 0.50 : 0;
    const addOnsExtra = selectedAddOns.reduce((sum, id) => {
      const match = ADD_ONS.find(a => a.id === id);
      return sum + (match?.price || 0);
    }, 0);
    return basePrice + sizeExtra + addOnsExtra;
  };

  // Confirm and add customized item to cart
  const confirmAddToCart = () => {
    if (!customizingProduct) return;
    triggerHaptic('medium');
    const unitPrice = calculateModalUnitPrice();
    const variantId = customizingProduct.variants?.[0]?.id || customizingProduct.id;
    const img = customizingProduct.thumbnailUrl || customizingProduct.imageUrl || customizingProduct.images?.[0]?.url;

    const newItem: CartItem = {
      productId: customizingProduct.id,
      variantId,
      name: customizingProduct.name,
      price: unitPrice,
      quantity: modalQuantity,
      size: selectedSize,
      sugarLevel: selectedSugar,
      iceLevel: selectedIce,
      addOns: [...selectedAddOns],
      notes: itemNotes.trim() || undefined,
      imageUrl: img,
    };

    setCart(prev => [...prev, newItem]);
    setCustomizingProduct(null);
    toast.success(`Added ${customizingProduct.name} to cart!`);
  };

  const updateCartQuantity = (index: number, delta: number) => {
    triggerHaptic('selection');
    const next = [...cart];
    next[index].quantity += delta;
    if (next[index].quantity <= 0) {
      next.splice(index, 1);
    }
    setCart(next);
  };

  // Request HTML5 / Telegram Location
  const requestLocation = () => {
    triggerHaptic('light');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const locStr = `Lat ${pos.coords.latitude.toFixed(4)}, Lng ${pos.coords.longitude.toFixed(4)}`;
          setDeliveryAddress(locStr);
          setLocationEnabled(true);
          toast.success("Location updated!");
        },
        () => {
          toast.error("Please allow location access");
        }
      );
    } else {
      toast.error("Geolocation not supported by device");
    }
  };

  // Handle Checkout & generate real ABA PayWay KHQR
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    if (!deliveryAddress.trim()) {
      toast.error("Please enter a delivery destination");
      return;
    }

    triggerHaptic('heavy');
    const toastId = toast.loading("Connecting to Coffee Shop payment engine...");

    try {
      const checkoutPayload = {
        channel: 'TELEGRAM',
        orderType: 'DELIVERY',
        customerName: customerName,
        customerPhone: customerPhone,
        deliveryAddress: deliveryAddress,
        notes: `Mini App Order (${cart.map(c => `${c.name} [${c.size}, ${c.sugarLevel} sugar]`).join(', ')})`,
        paymentMethod: paymentMethod === 'KHQR' ? 'ABA_PAYWAY' : 'COD',
        organizationId: orgParam,
        items: cart.map(i => ({
          id: i.variantId,
          variantId: i.variantId,
          productId: i.productId,
          name: `${i.name} (${i.size}, ${i.sugarLevel})`,
          price: i.price,
          quantity: i.quantity,
        }))
      };

      let res: any;
      if (token) {
        res = await api.storeCheckout(token, checkoutPayload);
      } else {
        const resp = await fetch(`${BASE_URL}/api/v1/sales/store-checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(checkoutPayload)
        });
        const body = await resp.json();
        res = body.data || body;
      }

      toast.dismiss(toastId);

      if (res && res.id) {
        const newOrder: SavedOrder = {
          id: res.id,
          saleNumber: res.saleNumber || `#ORD-${res.id.slice(0, 6).toUpperCase()}`,
          createdAt: new Date().toISOString(),
          items: cart.map(c => ({
            name: c.name,
            quantity: c.quantity,
            price: c.price,
            size: c.size,
            sugarLevel: c.sugarLevel
          })),
          total: cartTotal,
          status: paymentMethod === 'KHQR' ? 'PENDING' : 'CONFIRMED',
          paymentMethod: paymentMethod === 'KHQR' ? 'Bakong KHQR' : 'Cash on Delivery',
          deliveryAddress: deliveryAddress,
          paymentQrCode: res.paymentQrCode || null,
          paymentDeeplink: res.paymentDeeplink || null,
        };

        // Save into local history
        setPastOrders(prev => [newOrder, ...prev]);

        if (paymentMethod === 'KHQR' && res.paymentQrCode) {
          setActivePaymentSale({ ...newOrder, saleId: res.id });
          setActiveTab('payment');
          setCart([]);
          startPaymentPolling(res.id);
        } else {
          setCart([]);
          triggerHaptic('success');
          toast.success("Order Placed Successfully!");
          setActiveTab('orders');
        }
      } else {
        toast.error("Could not place order. Please try again.");
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      console.error(err);
      toast.error(err?.message || "Order placement failed.");
    }
  };

  // Real-time payment verification polling
  const startPaymentPolling = (saleId: string) => {
    if (paymentPollIntervalRef.current) {
      clearInterval(paymentPollIntervalRef.current);
    }

    setIsVerifyingPayment(true);
    let attempts = 0;
    const maxAttempts = 60; // 2.5 minutes timeout

    paymentPollIntervalRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const resp = await api.getOrderPaymentStatus(saleId);
        if (resp && resp.paid) {
          clearInterval(paymentPollIntervalRef.current);
          setIsVerifyingPayment(false);
          triggerHaptic('success');
          toast.success("🎉 Payment Confirmed! Preparing your drinks...");
          
          // Update order status in history
          setPastOrders(prev => prev.map(o => o.id === saleId ? { ...o, status: 'PAID' } : o));
          setActivePaymentSale((prev: any) => prev ? { ...prev, status: 'PAID' } : null);

          setTimeout(() => {
            setActiveTab('orders');
          }, 2000);
        }
      } catch (e) {
        console.warn('Poll error:', e);
      }

      if (attempts >= maxAttempts) {
        clearInterval(paymentPollIntervalRef.current);
        setIsVerifyingPayment(false);
      }
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (paymentPollIntervalRef.current) {
        clearInterval(paymentPollIntervalRef.current);
      }
    };
  }, []);

  // 1-Click Reorder
  const handleReorder = (order: SavedOrder) => {
    triggerHaptic('medium');
    const itemsToReorder: CartItem[] = order.items.map((item, idx) => ({
      productId: `reorder-${idx}`,
      variantId: `reorder-v-${idx}`,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      size: item.size || 'Regular',
      sugarLevel: item.sugarLevel || '100%',
      iceLevel: 'Normal Ice',
      addOns: [],
    }));

    setCart(prev => [...prev, ...itemsToReorder]);
    toast.success(`Added ${order.items.length} items from ${order.saleNumber} to cart!`);
    setActiveTab('cart');
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--tg-theme-bg-color,#0f172a)] text-[var(--tg-theme-text-color,#f1f5f9)] font-sans flex flex-col pb-20 select-none">
      
      {/* ── Top Bar / Header ────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[var(--tg-theme-bg-color,#0f172a)]/90 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-base leading-tight tracking-tight">{shopName}</h1>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Open Now" />
            </div>
            <p className="text-[10px] text-white/50 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Open Daily 7:00 AM – 8:00 PM
            </p>
          </div>
        </div>

        {/* Quick Cart Pill */}
        <button
          onClick={() => { triggerHaptic('selection'); setActiveTab('cart'); }}
          className="relative flex items-center gap-1.5 bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-transform"
        >
          <ShoppingBag className="w-4 h-4 text-amber-400" />
          <span>${cartTotal.toFixed(2)}</span>
          {cartItemCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-black text-[10px] font-extrabold flex items-center justify-center">
              {cartItemCount}
            </span>
          )}
        </button>
      </header>

      {/* ── Main View Container ─────────────────────────────────── */}
      <main className="flex-1 p-4 overflow-y-auto">

        {/* TAB 1: MENU ────────────────────────────────────────── */}
        {activeTab === 'menu' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search coffee, drinks, bakery..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-amber-500/50 transition-colors placeholder:text-white/30"
              />
            </div>

            {/* Category Pills (Horizontal Scroll) */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => { triggerHaptic('selection'); setSelectedCategory(cat.id); }}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      isSelected 
                        ? 'bg-amber-500 text-black shadow-md shadow-amber-500/25 scale-100 font-bold' 
                        : 'bg-white/5 text-white/70 border border-white/5 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Product Grid */}
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 pt-4">
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className="bg-white/5 rounded-3xl h-48 animate-pulse border border-white/5" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-16 opacity-60">
                <Coffee className="w-12 h-12 mx-auto mb-2 text-white/30" />
                <p className="text-sm font-medium">No items found in this section</p>
                <button 
                  onClick={() => { setSelectedCategory('ALL'); setSearchQuery(''); }}
                  className="mt-3 text-xs text-amber-400 font-semibold"
                >
                  View All Menu
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map((p: any) => {
                  const price = Number(p.variants?.[0]?.sellPrice || p.price || 0);
                  const img = p.thumbnailUrl || p.imageUrl || p.images?.[0]?.url;

                  return (
                    <div 
                      key={p.id}
                      onClick={() => openCustomizer(p)}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl p-3 flex flex-col justify-between active:scale-[0.98] transition-all cursor-pointer group"
                    >
                      <div className="w-full aspect-square rounded-2xl bg-black/20 mb-2.5 flex items-center justify-center overflow-hidden relative">
                        {img ? (
                          <img src={img} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <Coffee className="w-10 h-10 text-white/20" />
                        )}
                        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur text-[10px] font-bold px-2 py-0.5 rounded-full text-amber-300 border border-white/10">
                          ${price.toFixed(2)}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-bold text-sm leading-snug line-clamp-1">{p.name}</h3>
                        <p className="text-[10px] text-white/50 line-clamp-1">
                          {p.description || 'Artisan handcrafted beverage'}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-extrabold text-amber-400">${price.toFixed(2)}</span>
                          <span className="text-[9px] text-white/40 block">{(price * KHR_RATE).toLocaleString()} ៛</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); openCustomizer(p); }}
                          className="w-7 h-7 rounded-xl bg-amber-500 text-black flex items-center justify-center shadow-sm shadow-amber-500/20 active:scale-90 transition-transform"
                        >
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CART ────────────────────────────────────────── */}
        {activeTab === 'cart' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                <span>Your Order</span>
              </h2>
              {cart.length > 0 && (
                <button 
                  onClick={() => { setCart([]); toast.info("Cart cleared"); }}
                  className="text-xs text-rose-400 hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-16 space-y-3 opacity-60">
                <Coffee className="w-16 h-16 mx-auto text-white/20" />
                <p className="font-semibold text-sm">Your order is empty</p>
                <button
                  onClick={() => setActiveTab('menu')}
                  className="px-5 py-2.5 rounded-2xl bg-amber-500 text-black font-bold text-xs shadow-md shadow-amber-500/20"
                >
                  Browse Delicious Coffee
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* Cart Items List */}
                <div className="space-y-2.5">
                  {cart.map((item, idx) => (
                    <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl bg-black/30 overflow-hidden shrink-0 flex items-center justify-center">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} className="w-full h-full object-cover" />
                        ) : (
                          <Coffee className="w-6 h-6 text-white/20" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs truncate">{item.name}</h4>
                        <div className="flex flex-wrap gap-1 mt-0.5 text-[9px] text-white/60">
                          <span className="bg-white/10 px-1.5 py-0.5 rounded">{item.size}</span>
                          <span className="bg-white/10 px-1.5 py-0.5 rounded">{item.sugarLevel} sugar</span>
                          <span className="bg-white/10 px-1.5 py-0.5 rounded">{item.iceLevel}</span>
                          {item.addOns.map((a, i) => (
                            <span key={i} className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">+{a}</span>
                          ))}
                        </div>
                        <p className="text-xs font-bold text-amber-400 mt-1">${(item.price * item.quantity).toFixed(2)}</p>
                      </div>

                      <div className="flex items-center bg-black/40 rounded-full border border-white/10">
                        <button 
                          onClick={() => updateCartQuantity(idx, -1)}
                          className="w-7 h-7 flex items-center justify-center active:bg-white/10 rounded-full"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                        <button 
                          onClick={() => updateCartQuantity(idx, 1)}
                          className="w-7 h-7 flex items-center justify-center active:bg-white/10 rounded-full"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recipient / Delivery Info */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-4 space-y-3">
                  <h3 className="font-bold text-xs text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Delivery Destination
                  </h3>
                  
                  <div className="space-y-2">
                    <input 
                      type="text"
                      placeholder="Your Full Name..."
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50"
                    />
                    <input 
                      type="tel"
                      placeholder="Phone Number (e.g. 012 345 678)..."
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50"
                    />
                    <textarea 
                      placeholder="Detailed address (Street, Khan, Sangkat)..."
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      rows={2}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50 resize-none"
                    />
                    <button
                      onClick={requestLocation}
                      className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <MapIcon className="w-3.5 h-3.5" />
                      {locationEnabled ? 'Location Pin Saved ✓' : 'Pin My Current Location'}
                    </button>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-2">
                  <h3 className="font-bold text-xs text-white/70 uppercase tracking-wider">Select Payment</h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => { triggerHaptic('selection'); setPaymentMethod('KHQR'); }}
                      className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                        paymentMethod === 'KHQR'
                          ? 'bg-rose-500/15 border-rose-500 text-rose-300 shadow-md shadow-rose-500/15'
                          : 'bg-white/5 border-white/10 text-white/50'
                      }`}
                    >
                      <Wallet className="w-5 h-5" />
                      <span className="font-bold text-xs">Bakong / ABA KHQR</span>
                    </button>

                    <button
                      onClick={() => { triggerHaptic('selection'); setPaymentMethod('CASH'); }}
                      className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                        paymentMethod === 'CASH'
                          ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-md shadow-amber-500/15'
                          : 'bg-white/5 border-white/10 text-white/50'
                      }`}
                    >
                      <CreditCard className="w-5 h-5" />
                      <span className="font-bold text-xs">Cash on Delivery</span>
                    </button>
                  </div>
                </div>

                {/* Bill Summary & Order Button */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-4 space-y-2">
                  <div className="flex justify-between text-xs text-white/60">
                    <span>Subtotal</span>
                    <span>${cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-white/60">
                    <span>Delivery Fee</span>
                    <span className="text-emerald-400 font-bold">Free (Promotion)</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 flex justify-between items-baseline">
                    <span className="font-bold text-sm">Total Amount</span>
                    <div className="text-right">
                      <span className="font-extrabold text-lg text-amber-400">${cartTotal.toFixed(2)}</span>
                      <span className="text-[10px] text-white/40 block">{(cartTotal * KHR_RATE).toLocaleString()} ៛</span>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckout}
                    className="w-full mt-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-[0.98] transition-transform"
                  >
                    <span>Place Order & Pay</span>
                    <ChevronRight className="w-4 h-4 stroke-[3]" />
                  </button>
                </div>

              </div>
            )}
          </div>
        )}

        {/* TAB 3: ORDER HISTORY ("មាន history មានអីមួយចប់ ដូចជា application អញ្ចឹង") ─── */}
        {activeTab === 'orders' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                <span>Order History</span>
              </h2>
              <span className="text-xs text-white/40">{pastOrders.length} orders</span>
            </div>

            {pastOrders.length === 0 ? (
              <div className="text-center py-16 space-y-3 opacity-60">
                <Receipt className="w-16 h-16 mx-auto text-white/20" />
                <p className="font-semibold text-sm">No previous orders yet</p>
                <button
                  onClick={() => setActiveTab('menu')}
                  className="px-5 py-2.5 rounded-2xl bg-amber-500 text-black font-bold text-xs"
                >
                  Order Fresh Coffee Now
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {pastOrders.map((ord) => {
                  const isPaid = ord.status === 'PAID' || ord.status === 'COMPLETED';
                  const isPending = ord.status === 'PENDING';

                  return (
                    <div 
                      key={ord.id}
                      className="bg-white/5 border border-white/10 rounded-3xl p-4 space-y-3 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-white">{ord.saleNumber}</span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              isPaid ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                              isPending ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                              'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            }`}>
                              {ord.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-white/40 mt-0.5">
                            {new Date(ord.createdAt).toLocaleDateString()} at {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="font-bold text-sm text-amber-400">${ord.total.toFixed(2)}</span>
                          <span className="text-[9px] text-white/40 block">{(ord.total * KHR_RATE).toLocaleString()} ៛</span>
                        </div>
                      </div>

                      {/* Items Summary */}
                      <div className="bg-black/30 rounded-2xl p-2.5 space-y-1 text-xs">
                        {ord.items.map((it, i) => (
                          <div key={i} className="flex justify-between text-white/80 text-[11px]">
                            <span>{it.name} x{it.quantity}</span>
                            <span className="font-medium">${(it.price * it.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Actions: Reorder & View Receipt */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleReorder(ord)}
                          className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Re-order
                        </button>

                        <button
                          onClick={() => setViewingReceiptOrder(ord)}
                          className="flex-1 bg-white/10 hover:bg-white/15 text-white border border-white/10 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Receipt className="w-3.5 h-3.5" /> View Receipt
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PROFILE / STORE INFO ────────────────────────── */}
        {activeTab === 'profile' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-amber-400" />
              <span>Customer Profile</span>
            </h2>

            {/* Profile Card */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-700 text-black font-extrabold text-lg flex items-center justify-center">
                  {customerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-sm">{customerName}</h3>
                  <p className="text-xs text-white/50">{customerPhone}</p>
                  <span className="inline-block mt-1 bg-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Coffee VIP Member ☕
                  </span>
                </div>
              </div>
            </div>

            {/* Store Information */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-4 space-y-3">
              <h3 className="font-bold text-xs text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-amber-400" /> Store Information
              </h3>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-white/60">Store Name</span>
                  <span className="font-bold">{shopName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-white/60">Tenant ID</span>
                  <span className="font-mono text-[10px] text-white/70 truncate max-w-[150px]">{orgParam || 'Default Store'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-white/60">Currency</span>
                  <span className="font-bold">USD / KHR</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-white/60">Operating Status</span>
                  <span className="text-emerald-400 font-bold">Open for Orders 🟢</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ACTIVE KHQR PAYMENT SCREEN ──────────────────── */}
        {activeTab === 'payment' && activePaymentSale && (
          <div className="space-y-6 flex flex-col items-center justify-center py-6 animate-in fade-in duration-300">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold border border-rose-500/30 mb-2">
                <Wallet className="w-3.5 h-3.5" /> Bakong KHQR
              </div>
              <h2 className="font-black text-2xl text-white">Scan with any Bank App</h2>
              <p className="text-xs text-white/60">
                Order <span className="font-bold text-white">{activePaymentSale.saleNumber}</span>
              </p>
              <p className="text-lg font-black text-amber-400 mt-1">
                ${activePaymentSale.total.toFixed(2)} / {(activePaymentSale.total * KHR_RATE).toLocaleString()} ៛
              </p>
            </div>

            {/* QR Card */}
            {activePaymentSale.paymentQrCode ? (
              <div className="bg-white p-5 rounded-3xl shadow-2xl shadow-rose-500/20 max-w-[270px] w-full text-center space-y-2">
                <img 
                  src={`data:image/png;base64,${activePaymentSale.paymentQrCode}`} 
                  alt="Bakong KHQR" 
                  className="w-full aspect-square rounded-2xl border border-gray-100 object-contain" 
                />
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  Supported by ABA, ACLEDA, Wing, Canadia
                </p>
              </div>
            ) : (
              <div className="bg-white/5 p-8 rounded-3xl text-center">
                <AlertCircle className="w-10 h-10 mx-auto text-amber-400 mb-2" />
                <p className="text-sm">Preparing merchant QR code...</p>
              </div>
            )}

            {/* Deeplink & Verification Controls */}
            <div className="w-full max-w-[280px] space-y-2.5">
              {activePaymentSale.paymentDeeplink && (
                <a 
                  href={activePaymentSale.paymentDeeplink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-2xl font-bold text-xs shadow-lg shadow-blue-500/25 transition-transform active:scale-95"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open in ABA Mobile App</span>
                </a>
              )}

              <div className="flex items-center justify-center gap-2 text-xs text-white/50 pt-1">
                <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingPayment ? 'animate-spin text-amber-400' : ''}`} />
                <span>Auto-detecting payment confirmation...</span>
              </div>

              <button
                onClick={() => setActiveTab('orders')}
                className="w-full bg-white/10 hover:bg-white/15 text-white py-3 rounded-2xl font-semibold text-xs transition-colors mt-2"
              >
                I will pay later / View Orders
              </button>
            </div>
          </div>
        )}

      </main>

      {/* ── DRINK CUSTOMIZATION MODAL (COFFEE SPECIALTIES) ────────── */}
      {customizingProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center animate-in fade-in duration-200">
          <div className="bg-[var(--tg-theme-bg-color,#0f172a)] border-t sm:border border-white/15 w-full max-w-md max-h-[85vh] rounded-t-3xl sm:rounded-3xl p-5 overflow-y-auto space-y-4 shadow-2xl">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-extrabold text-lg text-white">{customizingProduct.name}</h3>
                <p className="text-xs text-white/50">{customizingProduct.description || 'Customize sweetness, ice, and size'}</p>
              </div>
              <button 
                onClick={() => setCustomizingProduct(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 active:scale-90"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. Size Choice */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/70 uppercase tracking-wider">Cup Size</label>
              <div className="grid grid-cols-2 gap-2">
                {SIZE_OPTIONS.map((sz) => (
                  <button
                    key={sz.name}
                    onClick={() => { triggerHaptic('selection'); setSelectedSize(sz.name); }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex justify-between items-center transition-all ${
                      selectedSize === sz.name 
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300' 
                        : 'bg-white/5 border-white/10 text-white/60'
                    }`}
                  >
                    <span>{sz.name}</span>
                    <span>{sz.extraPrice > 0 ? `+$${sz.extraPrice.toFixed(2)}` : 'Standard'}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Sugar Level */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/70 uppercase tracking-wider">Sweetness / Sugar Level</label>
              <div className="grid grid-cols-5 gap-1.5">
                {SUGAR_OPTIONS.map((sug) => (
                  <button
                    key={sug}
                    onClick={() => { triggerHaptic('selection'); setSelectedSugar(sug); }}
                    className={`py-2 rounded-xl text-[11px] font-bold border transition-all ${
                      selectedSugar === sug 
                        ? 'bg-amber-500 border-amber-500 text-black' 
                        : 'bg-white/5 border-white/10 text-white/60'
                    }`}
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Ice Level */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/70 uppercase tracking-wider">Ice / Temperature</label>
              <div className="grid grid-cols-2 gap-2">
                {ICE_OPTIONS.map((ice) => (
                  <button
                    key={ice}
                    onClick={() => { triggerHaptic('selection'); setSelectedIce(ice); }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      selectedIce === ice 
                        ? 'bg-sky-500/20 border-sky-500 text-sky-300' 
                        : 'bg-white/5 border-white/10 text-white/60'
                    }`}
                  >
                    {ice}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Extra Add-ons */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/70 uppercase tracking-wider">Extra Add-ons</label>
              <div className="space-y-1.5">
                {ADD_ONS.map((ao) => {
                  const isChecked = selectedAddOns.includes(ao.id);
                  return (
                    <button
                      key={ao.id}
                      onClick={() => {
                        triggerHaptic('selection');
                        setSelectedAddOns(prev => 
                          isChecked ? prev.filter(x => x !== ao.id) : [...prev, ao.id]
                        );
                      }}
                      className={`w-full py-2 px-3 rounded-xl border text-xs font-medium flex justify-between items-center transition-all ${
                        isChecked 
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' 
                          : 'bg-white/5 border-white/5 text-white/60'
                      }`}
                    >
                      <span>{ao.name}</span>
                      <span className="font-bold">+${ao.price.toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Special Notes */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-white/70 uppercase tracking-wider">Special Instructions</label>
              <input
                type="text"
                placeholder="e.g. Extra hot, separate cup..."
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* Modal Bottom Confirm Bar */}
            <div className="pt-2 border-t border-white/10 flex items-center gap-3">
              <div className="flex items-center bg-black/40 rounded-full border border-white/10">
                <button 
                  onClick={() => setModalQuantity(q => Math.max(1, q - 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-full active:bg-white/10"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center text-xs font-bold">{modalQuantity}</span>
                <button 
                  onClick={() => setModalQuantity(q => q + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-full active:bg-white/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={confirmAddToCart}
                className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-extrabold py-3 rounded-2xl text-xs flex justify-between px-4 items-center shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-transform"
              >
                <span>Add to Bag</span>
                <span>${(calculateModalUnitPrice() * modalQuantity).toFixed(2)}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── RECEIPT MODAL ────────────────────────────────────────── */}
      {viewingReceiptOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--tg-theme-bg-color,#0f172a)] border border-white/15 w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Official Receipt</h3>
              </div>
              <button 
                onClick={() => setViewingReceiptOrder(null)}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-white/50">Order Number</span>
                <span className="font-mono font-bold">{viewingReceiptOrder.saleNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Date & Time</span>
                <span>{new Date(viewingReceiptOrder.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Payment Method</span>
                <span className="font-bold">{viewingReceiptOrder.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Delivery Address</span>
                <span className="text-right max-w-[180px] truncate">{viewingReceiptOrder.deliveryAddress}</span>
              </div>

              {/* Items */}
              <div className="border-t border-white/10 pt-2 space-y-1.5">
                {viewingReceiptOrder.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{it.name} x{it.quantity}</span>
                    <span className="font-bold">${(it.price * it.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Grand Total */}
              <div className="border-t border-white/10 pt-2 flex justify-between items-baseline font-black">
                <span>Grand Total</span>
                <span className="text-base text-amber-400">${viewingReceiptOrder.total.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => {
                handleReorder(viewingReceiptOrder);
                setViewingReceiptOrder(null);
              }}
              className="w-full bg-amber-500 text-black py-2.5 rounded-xl font-bold text-xs"
            >
              Order Again
            </button>
          </div>
        </div>
      )}

      {/* ── NATIVE BOTTOM NAVIGATION BAR ─────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--tg-theme-bg-color,#0f172a)]/95 backdrop-blur-xl border-t border-white/10 px-3 py-2 flex items-center justify-around shadow-2xl">
        
        {/* Tab 1: Menu */}
        <button
          onClick={() => { triggerHaptic('selection'); setActiveTab('menu'); }}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
            activeTab === 'menu' ? 'text-amber-400 font-bold' : 'text-white/40 hover:text-white/70'
          }`}
        >
          <Coffee className="w-5 h-5" />
          <span className="text-[10px]">Menu</span>
        </button>

        {/* Tab 2: Cart */}
        <button
          onClick={() => { triggerHaptic('selection'); setActiveTab('cart'); }}
          className={`relative flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
            activeTab === 'cart' ? 'text-amber-400 font-bold' : 'text-white/40 hover:text-white/70'
          }`}
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5" />
            {cartItemCount > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1 min-w-[16px] h-4 rounded-full bg-amber-500 text-black text-[9px] font-black flex items-center justify-center">
                {cartItemCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Cart</span>
        </button>

        {/* Tab 3: Order History */}
        <button
          onClick={() => { triggerHaptic('selection'); setActiveTab('orders'); }}
          className={`relative flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
            activeTab === 'orders' ? 'text-amber-400 font-bold' : 'text-white/40 hover:text-white/70'
          }`}
        >
          <History className="w-5 h-5" />
          <span className="text-[10px]">Orders</span>
        </button>

        {/* Tab 4: Profile / Info */}
        <button
          onClick={() => { triggerHaptic('selection'); setActiveTab('profile'); }}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
            activeTab === 'profile' ? 'text-amber-400 font-bold' : 'text-white/40 hover:text-white/70'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px]">Profile</span>
        </button>

      </nav>

    </div>
  );
}
