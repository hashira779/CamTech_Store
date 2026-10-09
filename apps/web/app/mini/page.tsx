'use client';

import React, { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, BASE_URL } from '@/lib/api-client';
import { 
  Coffee, MapPin, Search, Plus, Minus, CreditCard, Wallet, 
  Map as MapIcon, ChevronRight, History, ShoppingBag, CheckCircle2, 
  Clock, ArrowLeft, X, Sparkles, AlertCircle, RefreshCw, Phone, User,
  Flame, Snowflake, Check, Share2, Receipt
} from 'lucide-react';
import { toast } from 'sonner';

interface CartItem {
  productId: string;
  variantId: string;
  name: string;
  price: number;
  quantity: number;
  size?: 'Regular (M)' | 'Large (L)';
  temperature?: 'Iced' | 'Hot';
  sugarLevel?: string;
  iceLevel?: string;
  notes?: string;
  imageUrl?: string | null;
}

interface LocalOrder {
  id: string;
  saleNumber?: string;
  createdAt: string;
  total: number;
  status: 'PENDING' | 'PAID' | 'PREPARING' | 'DELIVERING' | 'COMPLETED' | 'CANCELLED';
  paymentMethod: 'KHQR' | 'CASH';
  paymentQrCode?: string | null;
  paymentDeeplink?: string | null;
  deliveryAddress: string;
  customerName: string;
  items: CartItem[];
  organizationId?: string;
}

export default function TelegramMiniAppPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'checkout' | 'payment' | 'history'>('menu');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('camtech_mini_cart');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  // Customization Modal State for Coffee / Beverage Options
  const [customizingProduct, setCustomizingProduct] = useState<any | null>(null);
  const [optSize, setOptSize] = useState<'Regular (M)' | 'Large (L)'>('Regular (M)');
  const [optTemp, setOptTemp] = useState<'Iced' | 'Hot'>('Iced');
  const [optSugar, setOptSugar] = useState<string>('100%');
  const [optIce, setOptIce] = useState<string>('Normal Ice');
  const [optNote, setOptNote] = useState<string>('');

  // Checkout State
  const [paymentMethod, setPaymentMethod] = useState<'KHQR' | 'CASH'>('KHQR');
  const [paymentQrCode, setPaymentQrCode] = useState<string | null>(null);
  const [paymentDeeplink, setPaymentDeeplink] = useState<string | null>(null);
  const [activePaymentOrderId, setActivePaymentOrderId] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('camtech_mini_phone')) || '012345678';
  });
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string>('CamTech Café & Store');

  // Order Detail Modal State
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<LocalOrder | null>(null);

  // Extract optional org param for multi-store routing
  const orgParam = typeof window !== 'undefined' 
    ? (new URLSearchParams(window.location.search).get('org') || new URLSearchParams(window.location.search).get('store') || undefined) 
    : undefined;

  // Local Order History
  const historyStorageKey = `camtech_mini_orders_${orgParam || 'default'}`;
  const [orderHistory, setOrderHistory] = useState<LocalOrder[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(historyStorageKey);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  // Persist cart
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('camtech_mini_cart', JSON.stringify(cart));
    }
  }, [cart]);

  // Persist order history
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(historyStorageKey, JSON.stringify(orderHistory));
    }
  }, [orderHistory, historyStorageKey]);

  // Persist customer phone
  useEffect(() => {
    if (typeof window !== 'undefined' && customerPhone) {
      localStorage.setItem('camtech_mini_phone', customerPhone);
    }
  }, [customerPhone]);

  // Initialize Telegram Web App
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        if (WebApp.initData) {
          WebApp.ready();
          WebApp.expand();
          // Apply Telegram theme colors
          document.body.style.backgroundColor = 'var(--tg-theme-bg-color, #0f172a)';
          document.body.style.color = 'var(--tg-theme-text-color, #f1f5f9)';

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
          .catch(() => {});
        }
      } catch (e) {
        console.error("Telegram WebApp init error", e);
      }
    }
  }, [orgParam]);

  // Telegram BackButton integration
  useEffect(() => {
    if (typeof window !== 'undefined' && WebApp.BackButton) {
      if (activeTab !== 'menu') {
        WebApp.BackButton.show();
        const handleBack = () => {
          if (activeTab === 'checkout' || activeTab === 'payment') setActiveTab('cart');
          else setActiveTab('menu');
        };
        WebApp.BackButton.onClick(handleBack);
        return () => {
          WebApp.BackButton.offClick(handleBack);
          WebApp.BackButton.hide();
        };
      } else {
        WebApp.BackButton.hide();
      }
    }
  }, [activeTab]);

  // Fetch Public Products Scoped to Store
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['mini-products', searchQuery, token, orgParam],
    queryFn: () => token 
      ? api.listProducts(token, { limit: 100, search: searchQuery || undefined }) 
      : api.getPublicProducts({ limit: 100, search: searchQuery || undefined, organizationId: orgParam }),
  });

  const products = productsData?.items || [];

  // Derive unique categories from products
  const categories = ['ALL', ...Array.from(new Set(
    products.map((p: any) => p.category?.name || (typeof p.category === 'string' ? p.category : null) || 'COFFEE')
  ))];

  const filteredProducts = products.filter((p: any) => {
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const catName = p.category?.name || (typeof p.category === 'string' ? p.category : 'COFFEE');
    const matchesCat = selectedCategory === 'ALL' || catName === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Open Customization Modal
  const openCustomizer = (product: any) => {
    setCustomizingProduct(product);
    setOptSize('Regular (M)');
    setOptTemp('Iced');
    setOptSugar('100%');
    setOptIce('Normal Ice');
    setOptNote('');
    if (WebApp.HapticFeedback) WebApp.HapticFeedback.selectionChanged();
  };

  // Add customized item to cart
  const commitAddToCart = () => {
    if (!customizingProduct) return;
    const basePrice = Number(customizingProduct.variants?.[0]?.sellPrice || customizingProduct.price || 0);
    const price = optSize === 'Large (L)' ? basePrice + 0.50 : basePrice;
    const variantId = customizingProduct.variants?.[0]?.id || customizingProduct.id;
    const img = customizingProduct.thumbnailUrl || customizingProduct.imageUrl || customizingProduct.images?.[0]?.url;

    const newItem: CartItem = {
      productId: customizingProduct.id,
      variantId: variantId,
      name: customizingProduct.name,
      price,
      quantity: 1,
      size: optSize,
      temperature: optTemp,
      sugarLevel: optSugar,
      iceLevel: optTemp === 'Iced' ? optIce : undefined,
      notes: optNote.trim() || undefined,
      imageUrl: img,
    };

    setCart(prev => [...prev, newItem]);
    setCustomizingProduct(null);

    if (WebApp.HapticFeedback) WebApp.HapticFeedback.notificationOccurred('success');
    toast.success(`Added ${customizingProduct.name} to cart!`);
  };

  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    newCart[index].quantity += delta;
    if (newCart[index].quantity <= 0) {
      newCart.splice(index, 1);
    }
    setCart(newCart);
    if (WebApp.HapticFeedback) WebApp.HapticFeedback.selectionChanged();
  };

  const requestLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setDeliveryAddress(`Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)} (Phnom Penh)`);
          setLocationEnabled(true);
          if (WebApp.HapticFeedback) WebApp.HapticFeedback.notificationOccurred('success');
          toast.success("Location retrieved!");
        },
        () => {
          toast.error("Please enable location access");
        }
      );
    } else {
      toast.error("Geolocation not supported");
    }
  };

  // Place Order / Checkout
  const handleCheckout = async () => {
    if (!deliveryAddress) {
      toast.error("Please provide a delivery address");
      return;
    }

    const customerName = WebApp.initDataUnsafe?.user?.first_name || 'Telegram Guest';

    const checkoutPayload = {
      channel: 'TELEGRAM',
      orderType: 'DELIVERY',
      customerName: customerName,
      customerPhone: customerPhone || '012345678',
      deliveryAddress: deliveryAddress,
      notes: `Order via Telegram Mini App · ${shopName}`,
      paymentMethod: paymentMethod === 'KHQR' ? 'QR' : 'COD',
      organizationId: orgParam,
      items: cart.map((i) => ({
        id: i.variantId,
        name: `${i.name} (${i.size || 'M'}, ${i.sugarLevel || '100%'} Sugar)`,
        price: i.price,
        quantity: i.quantity,
      }))
    };

    const loadToast = toast.loading("Processing your order with store...");

    try {
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
      toast.dismiss(loadToast);

      if (res && res.id) {
        const newOrder: LocalOrder = {
          id: res.id,
          saleNumber: res.saleNumber || `#ORD-${res.id.slice(-6).toUpperCase()}`,
          createdAt: new Date().toISOString(),
          total: cartTotal,
          status: paymentMethod === 'KHQR' ? 'PENDING' : 'PAID',
          paymentMethod,
          paymentQrCode: res.paymentQrCode || null,
          paymentDeeplink: res.paymentDeeplink || null,
          deliveryAddress,
          customerName,
          items: [...cart],
          organizationId: orgParam,
        };

        setOrderHistory(prev => [newOrder, ...prev]);

        if (paymentMethod === 'KHQR' && res.paymentQrCode) {
          setPaymentQrCode(res.paymentQrCode);
          setPaymentDeeplink(res.paymentDeeplink || null);
          setActivePaymentOrderId(res.id);
          setActiveTab('payment');
          setCart([]);
          if (WebApp.HapticFeedback) WebApp.HapticFeedback.notificationOccurred('warning');
          return;
        }

        // Cash on delivery
        setCart([]);
        setActiveTab('history');
        if (WebApp.HapticFeedback) WebApp.HapticFeedback.notificationOccurred('success');
        toast.success("Order Placed Successfully!");
      } else {
        toast.error("Failed to place order.");
      }
    } catch (err: any) {
      toast.dismiss(loadToast);
      toast.error(err?.message || "Order placement failed.");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--tg-theme-bg-color,#0f172a)] text-[var(--tg-theme-text-color,#f1f5f9)] font-sans pb-28">
      
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[var(--tg-theme-bg-color,#0f172a)]/90 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-sm">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight tracking-tight">{shopName}</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-emerald-400 font-medium">Open · Express Delivery</span>
            </div>
          </div>
        </div>

        {/* History Quick Shortcut */}
        <button 
          onClick={() => setActiveTab('history')}
          className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold ${
            activeTab === 'history' 
              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm' 
              : 'bg-white/5 border-white/10 text-white/70 active:bg-white/10'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Orders</span>
          {orderHistory.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold flex items-center justify-center">
              {orderHistory.length}
            </span>
          )}
        </button>
      </header>

      {/* ── MAIN CONTENT BY TAB ─────────────────────────────────────────────── */}
      <main className="p-4 max-w-lg mx-auto">
        
        {/* ── TAB: MENU ─────────────────────────────────────────────────────── */}
        {activeTab === 'menu' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            
            {/* Search Box */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search coffee, drinks, bakery..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-amber-500/50 transition-colors placeholder:text-white/30"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    if (WebApp.HapticFeedback) WebApp.HapticFeedback.selectionChanged();
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                    selectedCategory === cat
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-white/5 text-white/60 border-white/10 active:bg-white/10'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Products Grid */}
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 pt-2">
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className="bg-white/5 border border-white/10 rounded-2xl p-3 animate-pulse h-52" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12 opacity-60">
                <Coffee className="w-12 h-12 mx-auto mb-3 opacity-40 text-amber-400" />
                <p className="text-sm font-semibold">No items found</p>
                <p className="text-xs text-white/40 mt-1">Try searching for a different drink or category</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-1">
                {filteredProducts.map((p: any) => {
                  const price = Number(p.price || p.variants?.[0]?.sellPrice || 0);
                  const img = p.thumbnailUrl || p.imageUrl || p.images?.[0]?.url;

                  return (
                    <div 
                      key={p.id} 
                      className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col justify-between hover:border-amber-500/40 transition-all shadow-sm"
                    >
                      <div className="w-full aspect-square rounded-xl bg-black/30 mb-2.5 flex items-center justify-center overflow-hidden relative">
                        {img ? (
                          <img src={img} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <Coffee className="w-10 h-10 text-white/20" />
                        )}
                        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md text-[11px] font-black px-2 py-0.5 rounded-full text-amber-400 border border-white/10">
                          ${price.toFixed(2)}
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="font-bold text-sm leading-snug line-clamp-1">{p.name}</h3>
                        <p className="text-[11px] text-white/40 line-clamp-1 mt-0.5 mb-2.5">
                          {p.description || 'Artisan handcrafted recipe'}
                        </p>
                      </div>
                      
                      <button 
                        onClick={() => openCustomizer(p)}
                        className="w-full bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" /> Customize & Add
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: CART ─────────────────────────────────────────────────────── */}
        {activeTab === 'cart' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-400" /> Your Cart
              </h2>
              {cart.length > 0 && (
                <button 
                  onClick={() => setCart([])} 
                  className="text-xs text-rose-400 active:underline"
                >
                  Clear All
                </button>
              )}
            </div>
            
            {cart.length === 0 ? (
              <div className="text-center py-16 opacity-60">
                <Coffee className="w-12 h-12 mx-auto mb-3 opacity-30 text-amber-400" />
                <p className="font-semibold text-sm">Your cart is empty</p>
                <button 
                  onClick={() => setActiveTab('menu')}
                  className="mt-4 px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
                >
                  Explore Menu
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item, idx) => (
                  <div key={idx} className="bg-white/5 border border-white/10 p-3 rounded-2xl flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-black/30 overflow-hidden shrink-0 flex items-center justify-center">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <Coffee className="w-6 h-6 text-white/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm truncate">{item.name}</h4>
                      <div className="flex flex-wrap gap-1.5 mt-0.5 text-[10px] text-white/50">
                        {item.size && <span className="bg-white/10 px-1.5 py-0.5 rounded">{item.size}</span>}
                        {item.temperature && <span className="bg-white/10 px-1.5 py-0.5 rounded">{item.temperature}</span>}
                        {item.sugarLevel && <span className="bg-white/10 px-1.5 py-0.5 rounded">{item.sugarLevel} Sugar</span>}
                      </div>
                      <p className="text-xs font-black text-amber-400 mt-1">${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center bg-black/40 rounded-xl border border-white/10 shrink-0">
                      <button onClick={() => updateQuantity(idx, -1)} className="p-2 active:bg-white/10 rounded-l-xl"><Minus className="w-3.5 h-3.5" /></button>
                      <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(idx, 1)} className="p-2 active:bg-white/10 rounded-r-xl"><Plus className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}

                {/* Subtotal & Checkout Button */}
                <div className="pt-4 border-t border-white/10 space-y-3">
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-white/60">Subtotal ({cart.length} items)</span>
                    <span className="text-amber-400 font-black text-base">${cartTotal.toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={() => setActiveTab('checkout')}
                    className="w-full bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 py-3.5 rounded-2xl font-black text-sm flex justify-between items-center px-4 shadow-lg shadow-amber-500/20 transition-all"
                  >
                    <span>Proceed to Delivery</span>
                    <span>${cartTotal.toFixed(2)} →</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: CHECKOUT ─────────────────────────────────────────────────── */}
        {activeTab === 'checkout' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <button onClick={() => setActiveTab('cart')} className="text-xs flex items-center text-amber-400 font-bold mb-1">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Cart
            </button>
            <h2 className="font-bold text-lg">Delivery & Payment</h2>

            {/* Recipient Contact */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-white/60 uppercase tracking-wider">Contact Phone</label>
              <div className="bg-white/5 border border-white/10 p-3 rounded-2xl flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-400" />
                <input 
                  type="tel"
                  placeholder="012 345 678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="bg-transparent border-none w-full text-sm font-semibold focus:outline-none"
                />
              </div>
            </div>

            {/* Location Section */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-white/60 uppercase tracking-wider">Delivery Address</label>
              <div className="bg-white/5 border border-white/10 p-3 rounded-2xl space-y-2.5">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                  <input 
                    type="text" 
                    placeholder="Enter street, building, or room number..." 
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="bg-transparent border-none w-full text-sm focus:outline-none placeholder:text-white/30"
                  />
                </div>
                <button 
                  onClick={requestLocation}
                  className="w-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:bg-emerald-500/20 transition-colors"
                >
                  <MapIcon className="w-3.5 h-3.5" /> Use Current GPS Location {locationEnabled && '✓'}
                </button>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-white/60 uppercase tracking-wider">Payment Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setPaymentMethod('KHQR')}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all ${
                    paymentMethod === 'KHQR' 
                      ? 'bg-rose-500/10 border-rose-500/50 text-rose-400 ring-1 ring-rose-500/50' 
                      : 'bg-white/5 border-white/10 text-white/50 active:bg-white/10'
                  }`}
                >
                  <Wallet className="w-6 h-6 mb-1.5" />
                  <span className="font-black text-xs">ABA PayWay (KHQR)</span>
                  <span className="text-[10px] text-rose-300 mt-0.5">Instant Scan</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod('CASH')}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all ${
                    paymentMethod === 'CASH' 
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 ring-1 ring-emerald-500/50' 
                      : 'bg-white/5 border-white/10 text-white/50 active:bg-white/10'
                  }`}
                >
                  <CreditCard className="w-6 h-6 mb-1.5" />
                  <span className="font-black text-xs">Cash on Delivery</span>
                  <span className="text-[10px] text-emerald-300 mt-0.5">Pay on Arrival</span>
                </button>
              </div>
            </div>

            {/* Summary */}
            <div className="pt-3 border-t border-white/10 space-y-1.5 text-sm">
              <div className="flex justify-between text-white/60">
                <span>Items Subtotal</span>
                <span>${cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Express Delivery</span>
                <span className="text-emerald-400 font-bold">FREE</span>
              </div>
              <div className="flex justify-between text-base font-black pt-1 border-t border-white/5">
                <span>Total Amount</span>
                <span className="text-amber-400">${cartTotal.toFixed(2)}</span>
              </div>
            </div>

            <button 
              onClick={handleCheckout}
              className="w-full mt-2 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
            >
              <span>Confirm & Place Order (${cartTotal.toFixed(2)})</span>
            </button>
          </div>
        )}

        {/* ── TAB: PAYMENT MODAL (KHQR) ─────────────────────────────────────── */}
        {activeTab === 'payment' && paymentQrCode && (
          <div className="space-y-5 text-center py-4 animate-in fade-in duration-200">
            <div>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 text-xs font-bold border border-rose-500/30">
                Bakong KHQR Active
              </span>
              <h2 className="font-black text-2xl mt-2 text-white">Scan to Pay</h2>
              <p className="text-xs text-white/60 mt-1">
                Amount Due: <span className="text-amber-400 font-black text-base">${cartTotal.toFixed(2)}</span>
              </p>
            </div>
            
            <div className="bg-white p-4 rounded-3xl shadow-2xl max-w-[250px] mx-auto w-full border-4 border-amber-500/40">
              <img 
                src={`data:image/png;base64,${paymentQrCode}`} 
                alt="Bakong KHQR" 
                className="w-full h-auto rounded-xl"
              />
              <p className="text-[10px] text-gray-500 font-bold mt-2 uppercase tracking-wider">ABA PayWay · Bakong</p>
            </div>
            
            <div className="max-w-[260px] mx-auto space-y-2.5">
              {paymentDeeplink && (
                <a 
                  href={paymentDeeplink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full block bg-blue-600 hover:bg-blue-500 active:scale-95 text-white py-3 rounded-2xl font-bold text-xs shadow-lg shadow-blue-600/30 transition-all"
                >
                  Open in ABA Mobile App
                </a>
              )}
              
              <button 
                onClick={() => {
                  toast.success("Payment recorded! Checking status...");
                  if (activePaymentOrderId) {
                    setOrderHistory(prev => prev.map(o => o.id === activePaymentOrderId ? { ...o, status: 'PAID' } : o));
                  }
                  setActiveTab('history');
                }}
                className="w-full bg-white/10 hover:bg-white/20 active:scale-95 text-white py-3 rounded-2xl font-bold text-xs border border-white/10 transition-colors"
              >
                I Have Completed Payment
              </button>
            </div>
          </div>
        )}

        {/* ── TAB: ORDER HISTORY ────────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" /> Order History
              </h2>
              <span className="text-xs text-white/40">{orderHistory.length} orders placed</span>
            </div>

            {orderHistory.length === 0 ? (
              <div className="text-center py-16 opacity-60">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30 text-amber-400" />
                <p className="font-semibold text-sm">No past orders yet</p>
                <p className="text-xs text-white/40 mt-1">Orders placed from this Telegram account appear here</p>
                <button 
                  onClick={() => setActiveTab('menu')}
                  className="mt-4 px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
                >
                  Order Now
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {orderHistory.map((ord) => (
                  <div 
                    key={ord.id} 
                    onClick={() => setSelectedOrderForDetail(ord)}
                    className="bg-white/5 border border-white/10 p-3.5 rounded-2xl hover:border-amber-500/40 active:bg-white/10 cursor-pointer transition-all space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-amber-400">{ord.saleNumber || ord.id.slice(0, 8)}</span>
                        <span className="text-[11px] text-white/40">
                          {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        ord.status === 'PAID' || ord.status === 'COMPLETED'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : ord.status === 'PENDING'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      }`}>
                        {ord.status}
                      </span>
                    </div>

                    <div className="text-xs text-white/70 line-clamp-1">
                      {ord.items.map(i => `${i.name} x${i.quantity}`).join(', ')}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
                      <span className="text-white/50">{ord.paymentMethod === 'KHQR' ? 'Bakong KHQR' : 'Cash'}</span>
                      <span className="font-black text-amber-400">${ord.total.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* ── PRODUCT CUSTOMIZATION MODAL (COFFEE / BEVERAGE) ───────────────── */}
      {customizingProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center p-0 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-t border-white/10 rounded-t-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
            
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-black text-lg text-white">{customizingProduct.name}</h3>
                <p className="text-xs text-white/50 mt-0.5">{customizingProduct.description || 'Artisan handcrafted recipe'}</p>
              </div>
              <button onClick={() => setCustomizingProduct(null)} className="p-1 rounded-full bg-white/10 text-white/60">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Size Options */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-white/60 uppercase">Cup Size</label>
              <div className="grid grid-cols-2 gap-2">
                {(['Regular (M)', 'Large (L)'] as const).map(size => (
                  <button
                    key={size}
                    onClick={() => setOptSize(size)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex justify-between items-center ${
                      optSize === size
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-white/5 border-white/10 text-white/70'
                    }`}
                  >
                    <span>{size}</span>
                    <span className="text-[10px] opacity-80">{size === 'Large (L)' ? '+$0.50' : 'Standard'}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Temperature Options */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-white/60 uppercase">Temperature</label>
              <div className="grid grid-cols-2 gap-2">
                {(['Iced', 'Hot'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setOptTemp(t)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      optTemp === t
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-white/5 border-white/10 text-white/70'
                    }`}
                  >
                    {t === 'Iced' ? <Snowflake className="w-3.5 h-3.5" /> : <Flame className="w-3.5 h-3.5" />}
                    <span>{t}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sugar Level */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-white/60 uppercase">Sweetness / Sugar</label>
              <div className="grid grid-cols-5 gap-1.5">
                {['100%', '70%', '50%', '30%', '0%'].map(sugar => (
                  <button
                    key={sugar}
                    onClick={() => setOptSugar(sugar)}
                    className={`py-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                      optSugar === sugar
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-white/5 border-white/10 text-white/70'
                    }`}
                  >
                    {sugar}
                  </button>
                ))}
              </div>
            </div>

            {/* Ice Level (if iced) */}
            {optTemp === 'Iced' && (
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-white/60 uppercase">Ice Amount</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Normal Ice', 'Less Ice', 'No Ice'].map(ice => (
                    <button
                      key={ice}
                      onClick={() => setOptIce(ice)}
                      className={`py-1.5 rounded-xl border text-xs font-bold transition-all ${
                        optIce === ice
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-white/5 border-white/10 text-white/70'
                      }`}
                    >
                      {ice}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add to Cart Submit */}
            <button
              onClick={commitAddToCart}
              className="w-full mt-3 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 py-3.5 rounded-2xl font-black text-sm flex justify-between items-center px-4 shadow-lg shadow-amber-500/20"
            >
              <span>Add to Order</span>
              <span>
                ${(
                  (Number(customizingProduct.variants?.[0]?.sellPrice || customizingProduct.price || 0)) + 
                  (optSize === 'Large (L)' ? 0.50 : 0)
                ).toFixed(2)}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ── ORDER DETAIL / RECEIPT MODAL ──────────────────────────────────── */}
      {selectedOrderForDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Receipt #{selectedOrderForDetail.saleNumber || selectedOrderForDetail.id.slice(0, 8)}</h3>
              </div>
              <button onClick={() => setSelectedOrderForDetail(null)} className="text-white/50 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Order Items */}
            <div className="space-y-2 text-xs">
              {selectedOrderForDetail.items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-white/80">{it.name} x{it.quantity}</span>
                  <span className="font-mono text-amber-400 font-bold">${(it.price * it.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Address */}
            <div className="pt-2 border-t border-white/5 text-[11px] text-white/60">
              <p className="font-bold text-white/80">Delivery Address:</p>
              <p className="truncate mt-0.5">{selectedOrderForDetail.deliveryAddress}</p>
            </div>

            {/* Pay Button if Pending */}
            {selectedOrderForDetail.status === 'PENDING' && selectedOrderForDetail.paymentQrCode && (
              <button
                onClick={() => {
                  setPaymentQrCode(selectedOrderForDetail.paymentQrCode!);
                  setPaymentDeeplink(selectedOrderForDetail.paymentDeeplink || null);
                  setSelectedOrderForDetail(null);
                  setActiveTab('payment');
                }}
                className="w-full bg-rose-500 hover:bg-rose-400 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <Wallet className="w-4 h-4" /> Open ABA PayWay KHQR
              </button>
            )}

            <button
              onClick={() => setSelectedOrderForDetail(null)}
              className="w-full bg-white/10 text-white font-bold py-2 rounded-xl text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── BOTTOM NAVIGATION DOCK ────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--tg-theme-bg-color,#0f172a)]/95 backdrop-blur-lg border-t border-white/10 px-6 py-2.5 max-w-lg mx-auto flex items-center justify-around shadow-2xl">
        <button
          onClick={() => {
            setActiveTab('menu');
            if (WebApp.HapticFeedback) WebApp.HapticFeedback.selectionChanged();
          }}
          className={`flex flex-col items-center gap-1 text-xs font-bold transition-all ${
            activeTab === 'menu' ? 'text-amber-400 scale-105' : 'text-white/40 hover:text-white/70'
          }`}
        >
          <Coffee className="w-5 h-5" />
          <span>Menu</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('cart');
            if (WebApp.HapticFeedback) WebApp.HapticFeedback.selectionChanged();
          }}
          className={`relative flex flex-col items-center gap-1 text-xs font-bold transition-all ${
            activeTab === 'cart' || activeTab === 'checkout' ? 'text-amber-400 scale-105' : 'text-white/40 hover:text-white/70'
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
          <span>Cart</span>
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-2 bg-amber-400 text-slate-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
              {cart.length}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab('history');
            if (WebApp.HapticFeedback) WebApp.HapticFeedback.selectionChanged();
          }}
          className={`relative flex flex-col items-center gap-1 text-xs font-bold transition-all ${
            activeTab === 'history' ? 'text-amber-400 scale-105' : 'text-white/40 hover:text-white/70'
          }`}
        >
          <History className="w-5 h-5" />
          <span>Orders</span>
          {orderHistory.length > 0 && (
            <span className="absolute -top-1 -right-2 bg-white/20 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {orderHistory.length}
            </span>
          )}
        </button>
      </nav>

    </div>
  );
}
