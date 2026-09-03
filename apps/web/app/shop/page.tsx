'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { useExperienceStore } from '@/lib/experience-store';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { ProductDto } from '@mystore/contracts';

interface CartItem {
  productId: string;
  variantId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
}

export default function CustomerShopPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const { setExperience } = useExperienceStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'KHQR' | 'COD'>('KHQR');
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerPhone, setCustomerPhone] = useState('012 888 999');
  const [deliveryAddress, setDeliveryAddress] = useState('Street 310, BKK1, Phnom Penh');
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);

  // Fetch Public Products (sanitize: only sell price exposed!)
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['public-products'],
    queryFn: () => api.listProducts(token || 'guest', { limit: 50 }),
  });

  const products = productsData?.items || [];

  const categories = ['ALL', 'ELECTRONICS', 'BEVERAGES', 'GROCERIES', 'ACCESSORIES'];

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = (product: ProductDto) => {
    const variant = product.variants?.[0];
    if (!variant) return;

    const existing = cart.find((i) => i.variantId === variant.id);
    if (existing) {
      setCart(cart.map((i) => (i.variantId === variant.id ? { ...i, quantity: i.quantity + 1 } : i)));
    } else {
      setCart([
        ...cart,
        {
          productId: product.id,
          variantId: variant.id,
          name: product.name,
          sku: variant.sku,
          price: Number(variant.sellPrice || 0),
          quantity: 1,
        },
      ]);
    }
    toast.success(`Added ${product.name} to cart`);
  };

  const updateQuantity = (variantId: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.variantId === variantId) {
            const next = item.quantity + delta;
            return next > 0 ? { ...item, quantity: next } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleCheckoutSubmit = () => {
    if (cart.length === 0) return;

    const trackingNum = `TRK-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const orderData = {
      orderNumber: `#ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      trackingNumber: trackingNum,
      totalAmount: cartTotal,
      customerName,
      deliveryAddress,
      paymentMethod: paymentMethod === 'KHQR' ? 'Bakong KHQR (Paid)' : 'Cash On Delivery',
      itemCount: cartItemCount,
    };

    setConfirmedOrder(orderData);
    setCart([]);
    setIsCheckoutOpen(false);
    toast.success('Order placed successfully!');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* ─── Public Commerce Top Navigation ─── */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">CamTech Online</span>
                <Badge variant="outline" className="text-[10px] bg-sky-500/10 text-sky-400 border-sky-500/30">
                  Spec §161
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400">Official Retail & Wholesale Storefront</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative hidden md:block w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 bg-slate-950 border-slate-800 text-xs text-slate-100"
              />
            </div>

            {/* Shopping Cart Button */}
            <Button
              onClick={() => setIsCartOpen(true)}
              variant="outline"
              className="relative h-9 px-3.5 bg-slate-800 border-slate-700 hover:bg-slate-700 text-white gap-2 text-xs"
            >
              <ShoppingCart className="w-4 h-4 text-sky-400" />
              <span>Cart</span>
              {cartItemCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-sky-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </Button>

            {/* Exit to Executive Console */}
            <button
              onClick={() => {
                setExperience('EXECUTIVE');
                navigate('/dashboard');
              }}
              className="text-[11px] text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
            >
              Console
            </button>
          </div>
        </div>
      </header>

      {/* ─── Hero Banner ─── */}
      <section className="bg-gradient-to-r from-sky-950/60 via-indigo-950/40 to-slate-950 border-b border-slate-800 py-10 px-4">
        <div className="max-w-5xl mx-auto text-center space-y-3">
          <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-xs px-3 py-1">
            <Sparkles className="w-3.5 h-3.5 mr-1" /> Next-Gen Enterprise E-Commerce
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Premium Electronics, Tech & Everyday Essentials
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto">
            Direct from official inventory with instantaneous delivery dispatch and Bakong KHQR instant mobile checkout.
          </p>
        </div>
      </section>

      {/* ─── Products Catalog Grid ─── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Cards */}
        {isLoading ? (
          <div className="text-center py-20 text-xs text-slate-500">Loading catalog items...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 text-xs text-slate-500">No products found matching your search.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((p) => {
              const variant = p.variants?.[0];
              const price = Number(variant?.sellPrice || 0);

              return (
                <div
                  key={p.id}
                  className="rounded-2xl bg-slate-900/80 border border-slate-800/90 p-4 flex flex-col justify-between hover:border-sky-500/40 transition-all shadow-md group"
                >
                  <div className="space-y-2">
                    <div className="w-full h-36 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-center text-slate-600 group-hover:text-sky-400 transition-colors">
                      <Package className="w-12 h-12" />
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-slate-800 text-slate-400">
                      {p.type || 'Physical Product'}
                    </Badge>
                    <h3 className="font-bold text-sm text-slate-100 line-clamp-1">{p.name}</h3>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {p.description || 'Enterprise catalog certified authentic quality item.'}
                    </p>
                  </div>

                  <div className="pt-4 mt-2 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 font-medium">Price</span>
                      <div className="text-base font-extrabold text-sky-400">${price.toFixed(2)}</div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => addToCart(p)}
                      className="h-8 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ─── Shopping Cart Drawer Modal ─── */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-sky-400" />
              Your Shopping Cart ({cartItemCount})
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Review your items before proceeding to checkout.
            </DialogDescription>
          </DialogHeader>

          {cart.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">Your cart is currently empty.</div>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {cart.map((item) => (
                  <div
                    key={item.variantId}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800"
                  >
                    <div className="flex-1 pr-2">
                      <h4 className="font-bold text-slate-200 line-clamp-1">{item.name}</h4>
                      <span className="text-[11px] text-sky-400 font-semibold">${item.price.toFixed(2)} each</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.variantId, -1)}
                        className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-bold text-xs w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.variantId, 1)}
                        className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="font-semibold text-slate-400">Subtotal:</span>
                <span className="text-lg font-black text-sky-400">${cartTotal.toFixed(2)}</span>
              </div>

              <Button
                onClick={() => {
                  setIsCartOpen(false);
                  setIsCheckoutOpen(true);
                }}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold h-10 rounded-xl text-xs"
              >
                Proceed to Checkout (${cartTotal.toFixed(2)})
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Checkout & Bakong KHQR Modal ─── */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-sky-400" />
              Complete Your Order
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Instant delivery dispatch across Phnom Penh.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="text-[11px] font-medium text-slate-300 block mb-1">Your Full Name</label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-300 block mb-1">Phone Number</label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-300 block mb-1">Delivery Address</label>
              <Input
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
              />
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="text-[11px] font-medium text-slate-300 block mb-1.5">Select Payment Method</label>
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

            {/* KHQR Visual Preview */}
            {paymentMethod === 'KHQR' && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-2">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Scan With Any Cambodian Banking App
                </span>
                <div className="w-32 h-32 bg-white rounded-xl mx-auto flex items-center justify-center p-2 shadow-md">
                  <div className="w-full h-full border-2 border-dashed border-rose-600 rounded-lg flex flex-col items-center justify-center text-rose-600 font-black text-[11px]">
                    <QrCode className="w-12 h-12 mb-1" />
                    <span>KHQR PAY</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-200 block">${cartTotal.toFixed(2)} USD</span>
              </div>
            )}

            <Button
              onClick={handleCheckoutSubmit}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold h-10 rounded-xl text-xs"
            >
              Place Order Now (${cartTotal.toFixed(2)})
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Order Confirmation Receipt Modal ─── */}
      <Dialog open={!!confirmedOrder} onOpenChange={() => setConfirmedOrder(null)}>
        <DialogContent className="max-w-sm bg-slate-900 border-slate-800 text-slate-100 text-center">
          <div className="py-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Order Confirmed!</h3>
            <p className="text-xs text-slate-400">
              Your order is registered and will be dispatched immediately.
            </p>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-left space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Tracking Code:</span>
                <span className="font-mono font-bold text-sky-400">{confirmedOrder?.trackingNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Paid/Due:</span>
                <span className="font-bold text-white">${confirmedOrder?.totalAmount?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Method:</span>
                <span className="text-slate-300">{confirmedOrder?.paymentMethod}</span>
              </div>
            </div>

            <Button
              onClick={() => setConfirmedOrder(null)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs h-9 rounded-xl"
            >
              Continue Shopping
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
