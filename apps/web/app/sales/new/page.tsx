'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PAYMENT_METHODS, type PaymentMethod } from '@mystore/contracts';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  ArrowLeft,
  CreditCard,
  DollarSign,
  QrCode,
  Building,
  Tag,
  X,
  Wifi,
  WifiOff,
  RefreshCw,
  CloudOff,
  Inbox,
  AlertTriangle,
} from 'lucide-react';
import type { PromotionEvaluationResultDto, PaymentIntentDto } from '@mystore/contracts';
import { Link } from 'react-router-dom';
import {
  enqueueOfflineSale,
  getPendingOfflineSales,
  syncOfflineSales,
  cacheCatalog,
  cacheCustomers,
} from '@/lib/offline-sync';

interface CartItem {
  productVariantId: string;
  sku: string;
  productName: string;
  variantName: string | null;
  unitPrice: number;
  taxRatePct: number;
  quantity: number;
  discount: number;
}

export default function NewSalePOSPage() {
  const { token, user } = useAuth();
  const [productSearch, setProductSearch] = useState('');
  const [customerId, setCustomerId] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [tenderedAmount, setTenderedAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<any | null>(null);

  // Promo Code State
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromotionEvaluationResultDto | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isEvaluatingPromo, setIsEvaluatingPromo] = useState(false);

  // Offline Sync State (Spec §17, §18)
  const [isOnline, setIsOnline] = useState(true);
  const [pendingOfflineSales, setPendingOfflineSales] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // KHQR Payment State (Spec §20, §21)
  const [khqrModalOpen, setKhqrModalOpen] = useState(false);
  const [khqrIntent, setKhqrIntent] = useState<PaymentIntentDto | null>(null);
  const [isGeneratingKhqr, setIsGeneratingKhqr] = useState(false);
  const [isSimulatingScan, setIsSimulatingScan] = useState(false);

  // Monitor Network & Offline Queue
  useEffect(() => {
    setIsOnline(typeof window !== 'undefined' ? navigator.onLine : true);

    const refreshPending = async () => {
      try {
        const list = await getPendingOfflineSales();
        setPendingOfflineSales(list);
      } catch (e) {
        console.error('Failed to load pending offline sales', e);
      }
    };

    refreshPending();

    const handleOnline = () => {
      setIsOnline(true);
      refreshPending();
      triggerAutoSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshPending();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const triggerAutoSync = async () => {
    if (!token || isSyncing) return;
    try {
      setIsSyncing(true);
      const res = await syncOfflineSales(token);
      if (res && res.syncedCount > 0) {
        setSyncMessage(`Synced ${res.syncedCount} offline sale(s) to server.`);
        setTimeout(() => setSyncMessage(null), 5000);
      }
      const list = await getPendingOfflineSales();
      setPendingOfflineSales(list);
    } catch (e: any) {
      console.error('Auto sync error', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Poll for KHQR Payment Confirmation
  useEffect(() => {
    if (!khqrModalOpen || !khqrIntent?.paymentId || !token) return;

    const interval = setInterval(async () => {
      try {
        const ver = await api.verifyPayment(token, khqrIntent.paymentId);
        if (ver.status === 'COMPLETED') {
          clearInterval(interval);
          setKhqrModalOpen(false);
          await handleCheckout(khqrIntent.paymentId);
        }
      } catch (e) {
        // Ignore polling error
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [khqrModalOpen, khqrIntent, token]);

  const handleOpenKhqr = async () => {
    if (cart.length === 0) return;
    setIsGeneratingKhqr(true);
    try {
      const intent = await api.createPaymentIntent(token!, {
        method: 'QR',
        provider: 'BAKONG_KHQR',
        amount: grandTotal,
        currency: 'USD',
        merchantName: user?.organizationId ? 'CAMTECH STORE' : 'MYSTORE HQ',
        merchantCity: 'Phnom Penh',
      });
      setKhqrIntent(intent);
      setKhqrModalOpen(true);
    } catch (err: any) {
      setServerError(err instanceof ApiClientError ? err.message : 'Failed to generate KHQR');
    } finally {
      setIsGeneratingKhqr(false);
    }
  };

  const handleSimulateScan = async () => {
    if (!khqrIntent?.paymentId) return;
    setIsSimulatingScan(true);
    try {
      await api.simulatePaymentWebhook('BAKONG_KHQR', {
        transactionId: khqrIntent.paymentId,
        status: 'COMPLETED',
        amount: khqrIntent.amount,
        currency: 'USD',
        externalReference: `SIM-BAKONG-${Date.now()}`,
      });
    } catch (e: any) {
      alert('Simulation error: ' + (e.message || 'Failed'));
    } finally {
      setIsSimulatingScan(false);
    }
  };

  // Fetch product catalog
  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['pos-products', productSearch],
    queryFn: () => api.listProducts(token!, { search: productSearch || undefined }),
    enabled: Boolean(token),
  });

  // Fetch customers for selector
  const { data: customersData } = useQuery({
    queryKey: ['pos-customers'],
    queryFn: () => api.listCustomers(token!, { limit: 50 }),
    enabled: Boolean(token),
  });

  // Cache catalog and customers when fresh data arrives
  useEffect(() => {
    if (productsData?.items?.length) {
      cacheCatalog(productsData.items);
    }
  }, [productsData]);

  useEffect(() => {
    if (customersData?.items?.length) {
      cacheCustomers(customersData.items);
    }
  }, [customersData]);

  // Flatten all variants from products
  const availableVariants = (productsData?.items ?? []).flatMap((p) =>
    p.variants.map((v) => ({
      master: p,
      variant: v,
    })),
  );

  // Cart operations
  const addToCart = (master: any, variant: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productVariantId === variant.id);
      if (existing) {
        return prev.map((item) =>
          item.productVariantId === variant.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...prev,
        {
          productVariantId: variant.id,
          sku: variant.sku,
          productName: master.name,
          variantName: variant.name,
          unitPrice: variant.sellPrice,
          taxRatePct: variant.taxRatePct,
          quantity: 1,
          discount: 0,
        },
      ];
    });
  };

  const updateQuantity = (variantId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productVariantId === variantId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[],
    );
  };

  const removeItem = (variantId: string) => {
    setCart((prev) => prev.filter((item) => item.productVariantId !== variantId));
  };

  // Dynamic Price Resolution for Customer / Volume breaks (spec §23)
  const { data: resolvedPricing } = useQuery({
    queryKey: ['pos-resolved-pricing', customerId, cart.map((i) => `${i.productVariantId}:${i.quantity}`).join(',')],
    queryFn: () =>
      api.resolvePrices(token!, {
        customerId: customerId || undefined,
        lines: cart.map((i) => ({
          productVariantId: i.productVariantId,
          quantity: i.quantity,
        })),
      }),
    enabled: Boolean(token) && cart.length > 0,
  });

  const getEffectivePrice = (item: CartItem) => {
    const resolved = resolvedPricing?.lines.find((l) => l.productVariantId === item.productVariantId);
    return resolved ? resolved.resolvedUnitPrice : item.unitPrice;
  };

  const getPriceInfo = (item: CartItem) => {
    return resolvedPricing?.lines.find((l) => l.productVariantId === item.productVariantId);
  };

  // Live client-side estimate (server will strictly recalculate)
  const subtotal = cart.reduce((sum, item) => sum + getEffectivePrice(item) * item.quantity, 0);
  const discountTotal = cart.reduce((sum, item) => sum + item.discount, 0);
  const estimatedTax = cart.reduce((sum, item) => {
    const taxable = getEffectivePrice(item) * item.quantity - item.discount;
    return sum + taxable * (item.taxRatePct / 100);
  }, 0);
  // Promo discount calculation
  const promoDiscount = appliedPromo?.discountTotal ?? 0;
  const grandTotal = Math.max(0, subtotal - promoDiscount + estimatedTax);
  const change = Math.max(0, (parseFloat(tenderedAmount) || 0) - grandTotal);

  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim() || cart.length === 0) return;
    setIsEvaluatingPromo(true);
    setPromoError(null);
    try {
      const result = await api.evaluatePromotion(token!, {
        promoCode: promoCodeInput.trim().toUpperCase(),
        lines: cart.map((item) => ({
          productVariantId: item.productVariantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        customerId: customerId || undefined,
      });
      if (!result.valid) {
        setPromoError(result.message || 'Invalid promo code');
        setAppliedPromo(null);
      } else {
        setAppliedPromo(result);
        setPromoError(null);
      }
    } catch (err: any) {
      setPromoError(err instanceof ApiClientError ? err.message : 'Coupon evaluation failed');
      setAppliedPromo(null);
    } finally {
      setIsEvaluatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCodeInput('');
    setPromoError(null);
  };

  const handleCheckout = async (customReference?: string) => {
    if (cart.length === 0) return;
    const amountToPay = parseFloat(tenderedAmount) || grandTotal;

    if (amountToPay < grandTotal) {
      setServerError(`Tendered amount ($${amountToPay.toFixed(2)}) is less than total ($${grandTotal.toFixed(2)})`);
      return;
    }

    setServerError(null);
    setIsSubmitting(true);

    const localId = `offline-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const idempotencyKey = `pos-${localId}`;

    const salePayload = {
      localId,
      clientCreatedAt: new Date().toISOString(),
      channel: 'POS' as const,
      customerId: customerId || null,
      currency: 'USD' as const,
      notes: notes || null,
      idempotencyKey,
      promoCode: appliedPromo?.promotion?.code ?? (promoCodeInput.trim() || undefined),
      lineItems: cart.map((item) => ({
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        discount: item.discount,
      })),
      payments: [
        {
          method: paymentMethod,
          amount: amountToPay,
          reference: customReference || null,
        },
      ],
    };

    if (!isOnline) {
      // Immediate offline persistence
      try {
        await enqueueOfflineSale(salePayload as any);
        const list = await getPendingOfflineSales();
        setPendingOfflineSales(list);
        setCompletedSale({
          id: localId,
          saleNumber: `LOCAL-${localId.slice(-6).toUpperCase()}`,
          grandTotal,
          change,
          isOffline: true,
        });
        setCart([]);
        setTenderedAmount('');
        setNotes('');
      } catch (err: any) {
        setServerError('Failed to save offline sale to local storage');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      const sale = await api.createSale(token!, salePayload);

      setCompletedSale({
        ...sale,
        change,
        isOffline: false,
      });
      setCart([]);
      setTenderedAmount('');
      setNotes('');
    } catch (err: any) {
      // If network failure, fall back to offline queue
      const isNetworkIssue =
        !navigator.onLine ||
        err.message?.toLowerCase().includes('fetch') ||
        err.message?.toLowerCase().includes('network') ||
        err.message?.toLowerCase().includes('failed');

      if (isNetworkIssue) {
        try {
          await enqueueOfflineSale(salePayload as any);
          const list = await getPendingOfflineSales();
          setPendingOfflineSales(list);
          setCompletedSale({
            id: localId,
            saleNumber: `LOCAL-${localId.slice(-6).toUpperCase()}`,
            grandTotal,
            change,
            isOffline: true,
          });
          setCart([]);
          setTenderedAmount('');
          setNotes('');
        } catch (e: any) {
          setServerError('Network error, and failed to save to offline storage.');
        }
      } else {
        setServerError(err instanceof ApiClientError ? err.message : 'Transaction failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) return null;

  return (
    <EnterpriseShell>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/sales" className="btn-ghost p-2 border border-border rounded-lg">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                Point of Sale Terminal
              </h1>
              <p className="text-xs text-muted-foreground">
                Fast order entry, barcode scanner ready, offline queue & server-side certified pricing
              </p>
            </div>
          </div>

          {/* Connection Status & Offline Queue Pill */}
          <div className="flex items-center gap-2">
            {isSyncing ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Syncing Queue...
              </span>
            ) : !isOnline || pendingOfflineSales.length > 0 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQueueModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                >
                  <WifiOff className="w-3.5 h-3.5" />
                  {!isOnline ? 'Offline Mode' : 'Pending Upload'} ({pendingOfflineSales.length})
                </button>
                {isOnline && pendingOfflineSales.length > 0 && (
                  <button
                    type="button"
                    onClick={triggerAutoSync}
                    className="btn px-2.5 py-1 text-xs flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Sync
                  </button>
                )}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Wifi className="w-3.5 h-3.5" />
                POS Online
              </span>
            )}
          </div>
        </div>

        {syncMessage && (
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{syncMessage}</span>
          </div>
        )}

        {/* Modal Success Overlay */}
        {completedSale && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-card border border-border shadow-2xl rounded-2xl p-6 text-center space-y-4">
              {completedSale.isOffline ? (
                <>
                  <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto">
                    <CloudOff className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Order Saved Locally (Offline)</h3>
                  <p className="font-mono text-sm text-amber-400 font-semibold">
                    Receipt #{completedSale.saleNumber}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Stored safely in local browser storage. Will automatically synchronize when connectivity is restored.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Transaction Completed!</h3>
                  <p className="font-mono text-sm text-primary font-semibold">
                    Receipt #{completedSale.saleNumber}
                  </p>
                </>
              )}

              <div className="bg-secondary/40 p-4 rounded-xl space-y-2 text-sm text-left">
                <div className="flex justify-between text-muted-foreground">
                  <span>Grand Total</span>
                  <span className="font-bold text-foreground">
                    ${completedSale.grandTotal.toFixed(2)}
                  </span>
                </div>
                {completedSale.change > 0 && (
                  <div className="flex justify-between text-emerald-400 font-semibold pt-2 border-t border-border">
                    <span>Change Due</span>
                    <span>${completedSale.change.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setCompletedSale(null)}
                  className="btn flex-1"
                >
                  New Order
                </button>
                <Link
                  to="/sales"
                  className="btn-ghost border border-border flex-1"
                >
                  View Ledger
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Main 2-Column POS Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Catalog (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                className="input pl-9"
                placeholder="Scan barcode or search SKU / product name..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </div>

            {/* Catalog Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
              {isLoadingProducts && (
                <div className="col-span-2 py-16 text-center text-muted-foreground animate-pulse">
                  Loading product catalog...
                </div>
              )}

              {availableVariants.map(({ master, variant }) => (
                <button
                  key={variant.id}
                  onClick={() => addToCart(master, variant)}
                  className="card p-4 text-left border border-border hover:border-primary/50 hover:bg-muted/20 transition-all flex flex-col justify-between group h-28"
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {master.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                        {variant.sku}
                      </span>
                    </div>
                    {variant.name && (
                      <p className="text-xs text-muted-foreground mt-0.5">{variant.name}</p>
                    )}
                  </div>

                  <div className="flex justify-between items-end mt-2">
                    <span className="text-xs text-muted-foreground">
                      Tax: {variant.taxRatePct}%
                    </span>
                    <span className="text-base font-bold text-foreground tabular-nums">
                      ${variant.sellPrice.toFixed(2)}
                    </span>
                  </div>
                </button>
              ))}

              {!isLoadingProducts && availableVariants.length === 0 && (
                <div className="col-span-2 py-16 text-center text-muted-foreground">
                  No products found matching your search.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Active Cart & Checkout (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="card p-5 border-border shadow-lg flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-foreground">Current Order</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block">
                      {cart.reduce((s, i) => s + i.quantity, 0)} items
                    </span>
                    {resolvedPricing?.priceListApplied && (
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        {resolvedPricing.priceListApplied.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Customer Selector */}
                <div className="mb-4">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">
                    Customer
                  </label>
                  <select
                    className="input mt-1 text-xs"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                  >
                    <option value="">Walk-in Customer (Guest)</option>
                    {customersData?.items.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.code ? `(${c.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cart Items List */}
                <div className="space-y-2.5 max-h-60 overflow-y-auto mb-4 pr-1">
                  {cart.map((item) => {
                    const effPrice = getEffectivePrice(item);
                    const priceInfo = getPriceInfo(item);
                    const hasTierSavings = priceInfo && priceInfo.priceSource !== 'BASE_PRICE';

                    return (
                      <div
                        key={item.productVariantId}
                        className="flex items-center justify-between bg-muted/20 p-2.5 rounded-lg text-xs"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="font-semibold text-foreground truncate">{item.productName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {item.variantName ? `${item.variantName} · ` : ''}
                            {item.sku} ·{' '}
                            {hasTierSavings ? (
                              <>
                                <span className="line-through text-slate-500">
                                  ${item.unitPrice.toFixed(2)}
                                </span>{' '}
                                <span className="text-emerald-400 font-bold">
                                  ${effPrice.toFixed(2)}
                                </span>
                                <span className="ml-1 px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-semibold">
                                  {priceInfo.priceSource === 'VOLUME_TIER'
                                    ? `Tier ≥${priceInfo.tierMinQty}`
                                    : 'Wholesale'}
                                </span>
                              </>
                            ) : (
                              `$${item.unitPrice.toFixed(2)}`
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center border border-border rounded-md">
                            <button
                              onClick={() => updateQuantity(item.productVariantId, -1)}
                              className="p-1 hover:bg-secondary text-muted-foreground hover:text-foreground"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2 font-mono font-semibold">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.productVariantId, 1)}
                              className="p-1 hover:bg-secondary text-muted-foreground hover:text-foreground"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="font-bold text-foreground tabular-nums w-14 text-right">
                            ${(effPrice * item.quantity).toFixed(2)}
                          </span>
                          <button
                            onClick={() => removeItem(item.productVariantId)}
                            className="p-1 text-muted-foreground hover:text-red-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {cart.length === 0 && (
                    <div className="py-10 text-center text-muted-foreground text-xs">
                      Cart is empty. Click items from the catalog on the left to add.
                    </div>
                  )}
                </div>
              </div>

              {/* Checkout Controls */}
              <div className="border-t border-border pt-4 space-y-4">
                {/* Math Summary */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  {appliedPromo && appliedPromo.discountTotal > 0 && (
                    <div className="flex justify-between text-emerald-400 font-semibold">
                      <span>Promo Discount ({appliedPromo.promotion?.code})</span>
                      <span>-${appliedPromo.discountTotal.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Est. Tax</span>
                    <span>+${estimatedTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-foreground pt-2 border-t border-border">
                    <span>Grand Total</span>
                    <span className="text-primary">${grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Promo Coupon Box */}
                <div className="p-2.5 rounded-lg border border-border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-primary" />
                      Promo / Coupon Code
                    </span>
                    {appliedPromo && (
                      <button
                        type="button"
                        onClick={handleRemovePromo}
                        className="text-[11px] text-red-400 hover:underline flex items-center gap-0.5"
                      >
                        <X className="w-3 h-3" /> Remove
                      </button>
                    )}
                  </div>

                  {!appliedPromo ? (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="e.g. SUMMER20"
                        value={promoCodeInput}
                        onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                        disabled={cart.length === 0 || isEvaluatingPromo}
                        className="input flex-1 text-xs font-mono uppercase h-8"
                      />
                      <button
                        type="button"
                        onClick={handleApplyPromo}
                        disabled={!promoCodeInput.trim() || cart.length === 0 || isEvaluatingPromo}
                        className="btn px-3 text-xs h-8"
                      >
                        {isEvaluatingPromo ? '...' : 'Apply'}
                      </button>
                    </div>
                  ) : (
                    <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex justify-between items-center">
                      <div>
                        <strong>{appliedPromo.promotion?.code}</strong> applied!
                      </div>
                      <span className="font-bold">-${appliedPromo.discountTotal.toFixed(2)}</span>
                    </div>
                  )}

                  {promoError && (
                    <div className="text-[11px] text-red-400 font-medium">
                      {promoError}
                    </div>
                  )}
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {(['CASH', 'CARD', 'QR'] as PaymentMethod[]).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                          paymentMethod === method
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:bg-secondary'
                        }`}
                      >
                        {method === 'CASH' && <DollarSign className="w-3.5 h-3.5" />}
                        {method === 'CARD' && <CreditCard className="w-3.5 h-3.5" />}
                        {method === 'QR' && <QrCode className="w-3.5 h-3.5" />}
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tendered Cash Amount */}
                {paymentMethod === 'CASH' && (
                  <div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-muted-foreground uppercase">
                        Tendered Cash ($)
                      </span>
                      {change > 0 && (
                        <span className="text-emerald-400 font-bold">
                          Change: ${change.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-1">
                      <input
                        className="input flex-1"
                        type="number"
                        step="0.01"
                        placeholder={grandTotal > 0 ? grandTotal.toFixed(2) : '0.00'}
                        value={tenderedAmount}
                        onChange={(e) => setTenderedAmount(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setTenderedAmount(grandTotal.toFixed(2))}
                        className="btn-ghost border border-border text-xs px-2.5"
                      >
                        Exact
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setTenderedAmount(String(Math.ceil(grandTotal / 5) * 5 || 5))
                        }
                        className="btn-ghost border border-border text-xs px-2.5"
                      >
                        Round $
                      </button>
                    </div>
                  </div>
                )}

                {serverError && <p className="text-xs text-red-400">{serverError}</p>}

                {/* Submit / QR Action */}
                {paymentMethod === 'QR' ? (
                  <button
                    type="button"
                    onClick={handleOpenKhqr}
                    disabled={cart.length === 0 || isGeneratingKhqr || isSubmitting}
                    className="btn w-full h-11 text-base font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 border-none text-white"
                  >
                    <QrCode className="w-5 h-5" />
                    {isGeneratingKhqr ? 'Generating KHQR...' : `Generate KHQR ($${grandTotal.toFixed(2)})`}
                  </button>
                ) : (
                  <button
                    onClick={() => handleCheckout()}
                    disabled={cart.length === 0 || isSubmitting}
                    className="btn w-full h-11 text-base font-bold shadow-lg shadow-primary/20"
                  >
                    {isSubmitting
                      ? 'Processing...'
                      : `Charge $${grandTotal.toFixed(2)} (${paymentMethod})`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Offline Queue Modal */}
        {queueModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="card max-w-lg w-full p-6 border-border shadow-xl">
              <div className="flex justify-between items-center border-b border-border pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Inbox className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-bold text-foreground">Offline Sales Queue</h3>
                </div>
                <button
                  onClick={() => setQueueModalOpen(false)}
                  className="p-1 hover:bg-muted/30 rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-muted-foreground mb-4">
                {pendingOfflineSales.length === 0
                  ? 'All local transactions are synchronized with the central cloud database.'
                  : `${pendingOfflineSales.length} transaction(s) queued in browser storage awaiting upload.`}
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                {pendingOfflineSales.map((item, idx) => (
                  <div
                    key={item.localId || idx}
                    className="p-3 rounded-lg border border-border bg-muted/20 text-xs flex justify-between items-center"
                  >
                    <div>
                      <div className="font-semibold text-foreground font-mono">
                        {item.localId}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(item.clientCreatedAt).toLocaleTimeString()} · {item.lineItems?.length} items
                      </div>
                    </div>
                    <span className="font-bold text-amber-400">
                      ${item.payments?.reduce((s: number, p: any) => s + (p.amount || 0), 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-border">
                <span className="text-[11px] text-muted-foreground">
                  Status: {isOnline ? '🟢 Connected' : '🟠 Offline'}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setQueueModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted/30 text-xs"
                  >
                    Close
                  </button>
                  {isOnline && pendingOfflineSales.length > 0 && (
                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={async () => {
                        await triggerAutoSync();
                        setQueueModalOpen(false);
                      }}
                      className="btn px-4 py-1.5 text-xs flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      Sync Now
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* KHQR Modal (Bakong EMVCo standard - Spec §20, §21) */}
        {khqrModalOpen && khqrIntent && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="card max-w-sm w-full p-6 border-border shadow-2xl bg-card flex flex-col items-center text-center">
              {/* Official KHQR Branded Header */}
              <div className="w-full bg-red-600 text-white rounded-t-xl py-2 px-4 mb-4 flex items-center justify-between">
                <span className="font-extrabold tracking-widest text-sm flex items-center gap-1.5">
                  <QrCode className="w-4 h-4" />
                  KHQR
                </span>
                <span className="text-[10px] font-mono tracking-wider opacity-90">BAKONG EMVCo</span>
              </div>

              <h3 className="font-bold text-base text-foreground mb-0.5">
                {khqrIntent.reference ? `Bill #${khqrIntent.reference}` : 'CAMTECH STORE'}
              </h3>
              <div className="text-2xl font-black text-foreground font-mono mt-1">
                ${khqrIntent.amount.toFixed(2)} USD
              </div>
              <div className="text-xs font-mono text-muted-foreground mb-4">
                ≈ ៛{(khqrIntent.amount * 4100).toLocaleString()} KHR
              </div>

              {/* Dynamic QR Graphic */}
              <div className="p-4 bg-white rounded-xl border border-border shadow-inner mb-4 flex flex-col items-center justify-center w-52 h-52 relative group">
                <div className="w-44 h-44 grid grid-cols-6 grid-rows-6 gap-1 p-2 bg-slate-900 rounded-lg relative">
                  <div className="col-span-2 row-span-2 bg-white rounded-xs p-1">
                    <div className="w-full h-full bg-slate-900 rounded-xs" />
                  </div>
                  <div className="col-start-5 col-span-2 row-span-2 bg-white rounded-xs p-1">
                    <div className="w-full h-full bg-slate-900 rounded-xs" />
                  </div>
                  <div className="row-start-5 col-span-2 row-span-2 bg-white rounded-xs p-1">
                    <div className="w-full h-full bg-slate-900 rounded-xs" />
                  </div>
                  <div className="col-start-3 row-start-2 bg-white rounded-xs" />
                  <div className="col-start-4 row-start-2 bg-white rounded-xs" />
                  <div className="col-start-3 row-start-4 bg-white rounded-xs" />
                  <div className="col-start-4 row-start-5 bg-white rounded-xs" />
                  <div className="col-start-5 row-start-4 bg-white rounded-xs" />
                  <div className="col-start-6 row-start-3 bg-white rounded-xs" />

                  <div className="absolute inset-0 m-auto w-10 h-10 bg-red-600 rounded-full flex items-center justify-center border-2 border-white text-white font-black text-xs">
                    KH
                  </div>
                </div>
              </div>

              {/* Status Polling Indicator */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Waiting for customer scan... (Polling)</span>
              </div>

              {/* Action Buttons */}
              <div className="w-full space-y-2">
                <button
                  type="button"
                  disabled={isSimulatingScan}
                  onClick={handleSimulateScan}
                  className="btn w-full text-xs py-2 bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSimulatingScan ? 'Verifying...' : 'Simulate Customer Scan (Webhook)'}
                </button>

                <button
                  type="button"
                  onClick={() => setKhqrModalOpen(false)}
                  className="w-full py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </EnterpriseShell>
  );
}
