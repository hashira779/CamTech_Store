import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, QrCode } from 'lucide-react';
import { PosLayout } from './PosLayout';

export function PosPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<any[]>([]);

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['pos-catalog', search],
    queryFn: () => api.listProducts(token!, { search: search || undefined }),
    enabled: Boolean(token),
  });

  const availableVariants = (productsData?.items ?? []).flatMap((p) =>
    p.variants.map((v) => ({ master: p, variant: v }))
  );

  const addToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.variant.id);
      if (existing) {
        return prev.map((i) => (i.id === item.variant.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { ...item, id: item.variant.id, qty: 1 }];
    });
  };

  const subtotal = cart.reduce((sum, item) => sum + item.variant.sellPrice * item.qty, 0);
  const tax = subtotal * 0.1; // 10% demo
  const total = subtotal + tax;

  return (
    <PosLayout>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]">
        
        {/* Left Side - Catalog */}
        <div className="lg:col-span-8 flex flex-col gap-4 overflow-hidden">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
            </div>
            <input 
              type="text" 
              placeholder="Search products, scan barcode..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl pl-12 pr-4 py-4 text-zinc-100 placeholder:text-zinc-500 transition-all text-lg shadow-inner outline-none"
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-2 pb-10">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {isLoading && <div className="col-span-full text-zinc-500 p-8 text-center text-lg">Loading catalog...</div>}
              {availableVariants.map((item) => (
                <button
                  key={item.variant.id}
                  onClick={() => addToCart(item)}
                  className="bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-500/50 rounded-2xl p-4 text-left transition-all duration-200 group flex flex-col justify-between aspect-square"
                >
                  <div>
                    <h3 className="font-semibold text-zinc-100 line-clamp-2 leading-snug group-hover:text-emerald-400 transition-colors">{item.master.name}</h3>
                    {item.variant.name && <p className="text-zinc-400 text-sm mt-1">{item.variant.name}</p>}
                    <span className="inline-block mt-2 px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-xs font-mono border border-zinc-700">{item.variant.sku}</span>
                  </div>
                  <div className="mt-4">
                    <span className="text-xl font-bold text-white tabular-nums">${item.variant.sellPrice.toFixed(2)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side - Cart */}
        <div className="lg:col-span-4 flex flex-col bg-zinc-900 rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md flex items-center justify-between z-10">
            <h2 className="text-lg font-bold flex items-center gap-2 text-white">
              <ShoppingCart className="w-5 h-5 text-emerald-400" />
              Current Order
            </h2>
            <span className="bg-zinc-800 text-zinc-300 text-xs font-bold px-2 py-1 rounded-lg">
              {cart.length} Items
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-950/30">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-3">
                <ShoppingCart className="w-12 h-12 opacity-20" />
                <p>Tap items to add to order</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="bg-zinc-900 p-3 rounded-2xl border border-zinc-800 flex gap-3 items-center group">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-zinc-100 font-medium truncate">{item.master.name}</h4>
                    <p className="text-emerald-400 font-bold mt-0.5 tabular-nums">${item.variant.sellPrice.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-3 bg-zinc-950 rounded-xl p-1 border border-zinc-800">
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors" onClick={() => setCart(c => c.map(i => i.id === item.id ? {...i, qty: Math.max(1, i.qty - 1)} : i))}>
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-6 text-center font-bold text-sm tabular-nums">{item.qty}</span>
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors" onClick={() => setCart(c => c.map(i => i.id === item.id ? {...i, qty: i.qty + 1} : i))}>
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors ml-1" onClick={() => setCart(c => c.filter(i => i.id !== item.id))}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="p-5 bg-zinc-900 border-t border-zinc-800 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-zinc-400 text-sm">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-400 text-sm">
                <span>Tax (10%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-end pt-2 border-t border-zinc-800 mt-2">
                <span className="text-zinc-300 font-medium">Total</span>
                <span className="text-3xl font-black text-white tabular-nums">${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-4">
              <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 font-bold active:scale-95">
                <Banknote className="w-6 h-6" />
                Cash
              </button>
              <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20 font-bold active:scale-95">
                <QrCode className="w-6 h-6" />
                KHQR
              </button>
              <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors border border-zinc-700 font-bold active:scale-95">
                <CreditCard className="w-6 h-6" />
                Card
              </button>
            </div>
          </div>
        </div>

      </div>
    </PosLayout>
  );
}
