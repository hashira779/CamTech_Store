'use client';

import React, { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { useQuery } from '@tanstack/react-query';
import { api, BASE_URL } from '@/lib/api-client';
import { Coffee, MapPin, Search, Plus, Minus, CreditCard, Wallet, Map as MapIcon, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface CartItem {
  productId: string;
  variantId: string;
  name: string;
  price: number;
  quantity: number;
  sugarLevel?: string;
  imageUrl?: string | null;
}

export default function TelegramMiniAppPage() {
  const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'checkout' | 'payment'>('menu');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sugarLevel, setSugarLevel] = useState<string>('100%');
  const [paymentMethod, setPaymentMethod] = useState<'KHQR' | 'CASH'>('KHQR');
  const [paymentQrCode, setPaymentQrCode] = useState<string | null>(null);
  const [paymentDeeplink, setPaymentDeeplink] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string>('MyStore Café');

  // Initialize Telegram Web App
  useEffect(() => {
    if (typeof window !== 'undefined' && WebApp.initData) {
      WebApp.ready();
      WebApp.expand();
      // Apply Telegram theme colors to body
      document.body.style.backgroundColor = 'var(--tg-theme-bg-color, #0f172a)'; // slate-950 fallback
      document.body.style.color = 'var(--tg-theme-text-color, #f1f5f9)'; // slate-100 fallback

      // Authenticate with backend
      fetch(`${BASE_URL}/api/v1/telegram/mini-app/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: WebApp.initData })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.token) {
          setToken(data.token);
          if (data.botName) setShopName(data.botName);
        } else {
          toast.error("Failed to verify Telegram session.");
        }
      })
      .catch(err => {
        console.error(err);
        toast.error("Network error during verification.");
      });
    }
  }, []);

  // Fetch Products via API Client with JWT Token
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', searchQuery, token],
    queryFn: () => token ? api.listProducts(token, { limit: 50, search: searchQuery || undefined }) : Promise.resolve({ items: [], meta: { page: 1, limit: 50, total: 0, totalPages: 0 }, total: 0 }),
    enabled: !!token,
  });

  const products = productsData?.items || [];
  
  const displayProducts = products;

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const addToCart = (product: any, selectedSugar: string) => {
    const variantId = product.variants?.[0]?.id || product.id;
    const price = Number(product.variants?.[0]?.sellPrice || product.price || 0);
    
    // Check if same product and sugar level exists
    const existing = cart.find(i => i.variantId === variantId && i.sugarLevel === selectedSugar);
    
    if (existing) {
      setCart(cart.map(i => i.variantId === variantId && i.sugarLevel === selectedSugar 
        ? { ...i, quantity: i.quantity + 1 } 
        : i));
    } else {
      const img = product.thumbnailUrl || product.imageUrl || product.images?.[0]?.url;
      setCart([
        ...cart,
        {
          productId: product.id,
          variantId: variantId,
          name: product.name,
          price,
          quantity: 1,
          sugarLevel: selectedSugar,
          imageUrl: img,
        }
      ]);
    }
    
    // Telegram native haptic feedback
    if (WebApp.HapticFeedback) {
      WebApp.HapticFeedback.impactOccurred('medium');
    }
    toast.success(`Added ${product.name} to cart!`);
  };

  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    newCart[index].quantity += delta;
    if (newCart[index].quantity <= 0) {
      newCart.splice(index, 1);
    }
    setCart(newCart);
    if (WebApp.HapticFeedback) {
      WebApp.HapticFeedback.selectionChanged();
    }
  };

  const requestLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setDeliveryAddress(`Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)}`);
          setLocationEnabled(true);
        },
        (err) => {
          toast.error("Please enable location access");
        }
      );
    } else {
      toast.error("Geolocation not supported");
    }
  };

  const handleCheckout = async () => {
    if (!deliveryAddress) {
      toast.error("Please set your delivery address");
      return;
    }
    
    // Send data back to Telegram bot via WebApp
    const orderData = {
      items: cart,
      total: cartTotal,
      paymentMethod,
      deliveryAddress,
      sugarLevel, // global preference
      customer: WebApp.initDataUnsafe?.user?.first_name || 'Guest'
    };

    if (WebApp.initData && token) {
      // If opened via inline button, sendData closes the app and sends data to bot
      // We can also make an API call to our backend here first.
      try {
        const res = await api.storeCheckout(token, {
          channel: 'TELEGRAM',
          orderType: 'DELIVERY',
          customerName: orderData.customer,
          deliveryAddress,
          notes: `Sugar: ${sugarLevel}`,
          paymentMethod: paymentMethod === 'KHQR' ? 'QR' : 'CASH',
          items: cart.map((i) => ({
            id: i.variantId,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          }))
        });
        if (res.id) {
          if (res.paymentQrCode) {
            setPaymentQrCode(res.paymentQrCode);
            setPaymentDeeplink(res.paymentDeeplink || null);
            setActiveTab('payment');
            return;
          }
          WebApp.showAlert('Order Placed Successfully! Returning to chat...');
          setTimeout(() => WebApp.close(), 1500);
        } else {
          toast.error("Failed to place order.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Error communicating with server.");
        // Fallback
        WebApp.sendData(JSON.stringify(orderData));
      }
    } else {
      // Web testing fallback
      toast.success("Order Placed (Test Mode)");
      setCart([]);
      setActiveTab('menu');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--tg-theme-bg-color,#0f172a)] text-[var(--tg-theme-text-color,#f1f5f9)] font-sans pb-24">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--tg-theme-bg-color,#0f172a)]/80 backdrop-blur-lg border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center">
            <Coffee className="w-4 h-4" />
          </div>
          <h1 className="font-bold text-lg">{shopName}</h1>
        </div>
        <div className="flex bg-white/5 rounded-full p-1">
          <button 
            onClick={() => setActiveTab('menu')}
            className={`px-3 py-1 rounded-full text-sm font-semibold transition-all ${activeTab === 'menu' ? 'bg-sky-500 text-white' : 'text-white/60'}`}
          >
            Menu
          </button>
          <button 
            onClick={() => setActiveTab('cart')}
            className={`px-3 py-1 rounded-full text-sm font-semibold transition-all flex items-center gap-1 ${activeTab !== 'menu' ? 'bg-sky-500 text-white' : 'text-white/60'}`}
          >
            Cart {cart.length > 0 && <span className="w-4 h-4 rounded-full bg-white text-sky-600 text-[10px] flex items-center justify-center">{cart.length}</span>}
          </button>
        </div>
      </header>

      <main className="p-4">
        {activeTab === 'menu' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Find your favorite drink..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-sky-500/50 transition-colors"
                style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color, rgba(255,255,255,0.05))', color: 'var(--tg-theme-text-color)' }}
              />
            </div>

            {/* Product List */}
            {displayProducts.length === 0 ? (
              <div className="text-center py-10 opacity-50">
                <Coffee className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No products available yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
              {displayProducts.map((p: any) => (
                <div key={p.id} className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col justify-between" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color, rgba(255,255,255,0.05))' }}>
                  <div className="w-full aspect-square rounded-xl bg-white/5 mb-3 flex items-center justify-center overflow-hidden relative">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <Coffee className="w-10 h-10 text-white/20" />
                    )}
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ${Number(p.price || p.variants?.[0]?.sellPrice || 0).toFixed(2)}
                    </div>
                  </div>
                  
                  <h3 className="font-bold text-sm leading-tight line-clamp-1">{p.name}</h3>
                  <p className="text-[10px] text-white/50 line-clamp-2 mt-1 mb-3">{p.description || 'Deliciously crafted for you.'}</p>
                  
                  {/* Mini Form for Options */}
                  <div className="mt-auto space-y-2">
                    <select 
                      onChange={(e) => setSugarLevel(e.target.value)}
                      className="w-full bg-black/20 text-[10px] rounded-lg py-1 px-2 border border-white/5 focus:outline-none"
                    >
                      <option value="100%">100% Sugar</option>
                      <option value="50%">50% Sugar</option>
                      <option value="0%">0% Sugar</option>
                    </select>
                    
                    <button 
                      onClick={() => addToCart(p, sugarLevel)}
                      className="w-full bg-[var(--tg-theme-button-color,#0ea5e9)] text-[var(--tg-theme-button-text-color,#fff)] py-1.5 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        )}

        {activeTab === 'cart' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="font-bold text-xl mb-4">Your Order</h2>
            
            {cart.length === 0 ? (
              <div className="text-center py-10 opacity-50">
                <Coffee className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Your cart is empty.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-2xl">
                    <div className="w-14 h-14 rounded-xl bg-black/20 flex items-center justify-center overflow-hidden shrink-0">
                      {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" /> : <Coffee className="w-6 h-6 text-white/20" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm">{item.name}</h4>
                      <p className="text-[10px] text-sky-400">Sugar: {item.sugarLevel}</p>
                      <p className="text-xs font-bold mt-1">${item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center bg-black/40 rounded-full border border-white/10">
                      <button onClick={() => updateQuantity(idx, -1)} className="p-2 active:bg-white/10 rounded-full"><Minus className="w-3 h-3" /></button>
                      <span className="w-4 text-center text-xs font-bold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(idx, 1)} className="p-2 active:bg-white/10 rounded-full"><Plus className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}

                <button 
                  onClick={() => setActiveTab('checkout')}
                  className="w-full mt-6 bg-[var(--tg-theme-button-color,#0ea5e9)] text-[var(--tg-theme-button-text-color,#fff)] py-3.5 rounded-2xl font-bold flex justify-between items-center px-4 active:scale-[0.98] transition-transform shadow-lg shadow-sky-500/20"
                >
                  <span>Checkout</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'checkout' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <button onClick={() => setActiveTab('cart')} className="text-xs flex items-center text-sky-400 font-semibold mb-2">
              <ChevronRight className="w-4 h-4 rotate-180" /> Back to Cart
            </button>
            <h2 className="font-bold text-xl">Checkout Details</h2>
            
            {/* Location Section */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-white/70 uppercase tracking-wider">Delivery Location</label>
              <div className="bg-white/5 border border-white/10 p-3 rounded-2xl flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <input 
                    type="text" 
                    placeholder="Enter full address..." 
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="bg-transparent border-none w-full text-sm focus:outline-none"
                  />
                </div>
                <button 
                  onClick={requestLocation}
                  className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <MapIcon className="w-3.5 h-3.5" /> Use Current Location {locationEnabled && '✓'}
                </button>
              </div>
            </div>

            {/* Payment Section */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-white/70 uppercase tracking-wider">Payment Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setPaymentMethod('KHQR')}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${paymentMethod === 'KHQR' ? 'bg-rose-500/10 border-rose-500/40 text-rose-400' : 'bg-white/5 border-white/10 text-white/50'}`}
                >
                  <Wallet className="w-6 h-6 mb-2" />
                  <span className="font-bold text-sm">Bakong KHQR</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod('CASH')}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${paymentMethod === 'CASH' ? 'bg-sky-500/10 border-sky-500/40 text-sky-400' : 'bg-white/5 border-white/10 text-white/50'}`}
                >
                  <CreditCard className="w-6 h-6 mb-2" />
                  <span className="font-bold text-sm">Cash on Delivery</span>
                </button>
              </div>
            </div>

            {/* Order Summary */}
            <div className="pt-4 border-t border-white/10">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-white/60">Subtotal</span>
                <span className="font-bold text-sm">${cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-white/60">Delivery</span>
                <span className="font-bold text-sm text-emerald-400">Free</span>
              </div>
              <button 
                onClick={handleCheckout}
                className="w-full bg-[var(--tg-theme-button-color,#0ea5e9)] text-[var(--tg-theme-button-text-color,#fff)] py-4 rounded-2xl font-bold text-sm flex justify-center items-center gap-2 active:scale-[0.98] transition-transform shadow-[0_0_20px_rgba(14,165,233,0.3)]"
              >
                Pay ${cartTotal.toFixed(2)} & Place Order
              </button>
            </div>
          </div>
        )}

        {activeTab === 'payment' && paymentQrCode && (
          <div className="space-y-6 flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="text-center">
              <h2 className="font-bold text-2xl mb-2 text-white">Scan to Pay</h2>
              <p className="text-white/60 text-sm">Amount: <span className="text-sky-400 font-bold">${cartTotal.toFixed(2)}</span></p>
            </div>
            
            <div className="bg-white p-4 rounded-3xl shadow-xl shadow-sky-500/20 max-w-[260px] mx-auto w-full">
              <img src={`data:image/png;base64,${paymentQrCode}`} alt="KHQR" className="w-full h-auto rounded-xl border border-gray-100" />
            </div>
            
            <div className="w-full max-w-[260px] mx-auto space-y-3">
              {paymentDeeplink && (
                <a 
                  href={paymentDeeplink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full block text-center bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-2xl font-bold text-sm transition-colors shadow-lg shadow-blue-500/20"
                >
                  Pay with ABA Mobile
                </a>
              )}
              
              <button 
                onClick={() => {
                  WebApp.showAlert('Waiting for payment confirmation. If paid, your order is secured!');
                  setTimeout(() => WebApp.close(), 1500);
                }}
                className="w-full bg-white/10 hover:bg-white/20 text-white py-3.5 rounded-2xl font-bold text-sm transition-colors"
              >
                I have completed payment
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
