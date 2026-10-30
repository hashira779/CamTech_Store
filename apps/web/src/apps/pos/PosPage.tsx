import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, QrCode, Package } from 'lucide-react';
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
    (p.variants || []).map((v) => ({ master: p, variant: v }))
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState<any | null>(null);

  // Actually persist the sale to the backend. Price/tax are recomputed
  // server-side from the DB; we only send variant ids, quantities and payment.
  const handleCheckout = async (method: 'CASH' | 'QR' | 'CARD') => {
    if (cart.length === 0 || !token || isSubmitting) return;
    setIsSubmitting(true);
    setLastSale(null);
    try {
      const sale = await api.createSale(token, {
        channel: 'POS',
        currency: 'USD',
        idempotencyKey: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lineItems: cart.map((i) => ({ productVariantId: i.id, quantity: i.qty })),
        payments: [{ method, amount: total }],
      } as any);
      setLastSale(sale);
      setCart([]);
    } catch (e: any) {
      setLastSale({ error: e?.message || 'Checkout failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PosLayout>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]">
        
        {/* Left Side - Catalog */}
        <div className="lg:col-span-8 flex flex-col gap-4 overflow-hidden">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-success transition-colors" />
            </div>
            <input 
              type="text" 
              placeholder="Search products, scan barcode..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-card border border-border focus:border-success/50 focus:ring-4 focus:ring-success/10 rounded-lg pl-12 pr-4 py-4 text-foreground placeholder:text-muted-foreground transition-all text-lg shadow-inner outline-none"
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-2 pb-10">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {isLoading && <div className="col-span-full text-muted-foreground p-8 text-center text-lg">Loading catalog...</div>}
              {availableVariants.map((item) => {
                const img = item.master.thumbnailUrl || item.master.imageUrl || item.master.images?.find((i: any) => i.isPrimary)?.thumbnailUrl || item.master.images?.find((i: any) => i.isPrimary)?.url || item.master.images?.[0]?.url;
                return (
                  <button
                    key={item.variant.id}
                    onClick={() => addToCart(item)}
                    className="bg-card/50 hover:bg-muted border border-border hover:border-success/50 rounded-lg p-3 text-left transition-all duration-200 group flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-full h-24 rounded-lg bg-card border border-border/80 mb-2.5 flex items-center justify-center overflow-hidden relative">
                        {img ? (
                          <img src={img} alt={item.master.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <Package className="w-8 h-8 text-muted-foreground group-hover:text-success transition" />
                        )}
                      </div>
                      <h3 className="font-semibold text-foreground line-clamp-1 leading-snug group-hover:text-success transition-colors text-sm">{item.master.name}</h3>
                      {item.variant.name && <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">{item.variant.name}</p>}
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-mono border border-border">{item.variant.sku}</span>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between">
                      <span className="text-base font-bold text-foreground tabular-nums">${item.variant.sellPrice.toFixed(2)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side - Cart */}
        <div className="lg:col-span-4 flex flex-col bg-card rounded-lg border border-border shadow-lg overflow-hidden">
          <div className="p-5 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between z-10">
            <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
              <ShoppingCart className="w-5 h-5 text-success" />
              Current Order
            </h2>
            <span className="bg-muted text-foreground text-xs font-bold px-2 py-1 rounded-lg">
              {cart.length} Items
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-card/30">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <ShoppingCart className="w-12 h-12 opacity-20" />
                <p>Tap items to add to order</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="bg-card p-3 rounded-lg border border-border flex gap-3 items-center group">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-foreground font-medium truncate">{item.master.name}</h4>
                    <p className="text-success font-bold mt-0.5 tabular-nums">${item.variant.sellPrice.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-3 bg-card rounded-md p-1 border border-border">
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" onClick={() => setCart(c => c.map(i => i.id === item.id ? {...i, qty: Math.max(1, i.qty - 1)} : i))}>
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-6 text-center font-bold text-sm tabular-nums">{item.qty}</span>
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" onClick={() => setCart(c => c.map(i => i.id === item.id ? {...i, qty: i.qty + 1} : i))}>
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <button className="w-10 h-10 flex items-center justify-center rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors ml-1" onClick={() => setCart(c => c.filter(i => i.id !== item.id))}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="p-5 bg-card border-t border-border space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-muted-foreground text-sm">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-sm">
                <span>Tax (10%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-end pt-2 border-t border-border mt-2">
                <span className="text-foreground font-medium">Total</span>
                <span className="text-3xl font-bold text-foreground tabular-nums">${total.toFixed(2)}</span>
              </div>
            </div>

            {lastSale && (
              <div
                className={`rounded-md p-3 text-sm font-semibold ${
                  lastSale.error
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-success/10 text-success'
                }`}
              >
                {lastSale.error
                  ? `✕ ${lastSale.error}`
                  : `✓ Sale ${lastSale.saleNumber} — $${Number(lastSale.grandTotal).toFixed(2)} · ${lastSale.paymentStatus}`}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 pt-4">
              <button
                onClick={() => handleCheckout('CASH')}
                disabled={cart.length === 0 || isSubmitting}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-success text-success-foreground hover:bg-success/90 transition-colors shadow-lg shadow-emerald-500/20 font-bold active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Banknote className="w-6 h-6" />
                {isSubmitting ? '...' : 'Cash'}
              </button>
              <button
                onClick={() => handleCheckout('QR')}
                disabled={cart.length === 0 || isSubmitting}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-info text-info-foreground hover:bg-info/90 transition-colors shadow-lg shadow-blue-500/20 font-bold active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <QrCode className="w-6 h-6" />
                KHQR
              </button>
              <button
                onClick={() => handleCheckout('CARD')}
                disabled={cart.length === 0 || isSubmitting}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-muted text-foreground hover:bg-muted hover:text-foreground transition-colors border border-border font-bold active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
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
