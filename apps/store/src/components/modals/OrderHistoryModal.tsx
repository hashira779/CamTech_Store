import React from 'react';
import { History, X, ShoppingBag, Receipt, Package, Truck } from 'lucide-react';

interface OrderHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelTab: 'STORE' | 'ALL';
  onTabChange: (tab: 'STORE' | 'ALL') => void;
  isLoading: boolean;
  orders: any[];
  onSelectInvoice: (order: any) => void;
  onSelectTracking: (order: any) => void;
}

export function OrderHistoryModal({
  isOpen,
  onClose,
  channelTab,
  onTabChange,
  isLoading,
  orders,
  onSelectInvoice,
  onSelectTracking
}: OrderHistoryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-xl bg-ink-850 border border-line rounded-t-3xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-6 sm:zoom-in-95">
        <div className="w-10 h-1 rounded-full bg-zinc-600 mx-auto mb-2.5 sm:hidden shrink-0" />
        <div className="flex items-center justify-between pb-3 border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base sm:text-lg ds-text">Order History & Invoices</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-ink-800 ds-text-dim hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Channel Filtering Segmented Tabs */}
        <div className="flex items-center gap-2 pt-3 pb-2 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => onTabChange('STORE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              channelTab === 'STORE'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'bg-ink-950 text-slate-400 hover:text-white border border-line'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Online Store</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              channelTab === 'ALL'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'bg-ink-950 text-slate-400 hover:text-white border border-line'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>All Invoices (POS & Online)</span>
          </button>
        </div>

        <div className="py-2 overflow-y-auto space-y-3 flex-1 overscroll-contain pr-1">
          {isLoading ? (
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
          ) : (!orders || orders.length === 0) ? (
            <div className="text-center py-10 ds-text-faint space-y-2">
              <Package className="w-10 h-10 mx-auto opacity-30 text-emerald-400" />
              <p className="text-xs font-medium">
                {channelTab === 'STORE'
                  ? 'No online storefront orders found for your account.'
                  : 'No past purchases found.'}
              </p>
              <p className="text-[11px] text-zinc-500">
                Orders placed on this device or with your phone number will appear here automatically.
              </p>
            </div>
          ) : (
            orders.slice(0, 15).map((order: any) => {
              const isOrderPaid = (order.status === 'COMPLETED' || order.deliveryStatus === 'DELIVERED') && order.status !== 'DRAFT';

              return (
              <div
                key={order.id || order.orderNumber}
                onClick={() => {
                  onSelectInvoice(order);
                  onClose();
                }}
                className="p-3 sm:p-3.5 rounded-xl bg-ink-950 border border-line hover:border-emerald-500/50 hover:bg-ink-850/90 transition cursor-pointer flex items-center justify-between group gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold ds-text group-hover:text-emerald-400 transition truncate max-w-[140px] sm:max-w-none">
                      {order.saleNumber || order.orderNumber || order.id}
                    </span>
                    <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded font-bold ${
                      isOrderPaid 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {isOrderPaid ? (order.deliveryStatus || order.status || 'COMPLETED') : 'AWAITING PAYMENT'}
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
                    <span className="font-mono font-bold text-emerald-400 sm:hidden">
                      • ${Number(order.grandTotal || order.total || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <span className="font-mono font-bold text-emerald-400 text-sm block">
                      ${Number(order.grandTotal || order.total || 0).toFixed(2)}
                    </span>
                    <span className={`text-[10px] block ${isOrderPaid ? 'ds-text-faint' : 'text-amber-400 font-semibold'}`}>
                      {isOrderPaid 
                        ? (order.payments?.[0]?.method || order.paymentMethod || 'Paid via KHQR')
                        : 'Unpaid (Awaiting Settlement)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isOrderPaid && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTracking(order);
                          onClose();
                        }}
                        className="px-2 sm:px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-[10px] sm:text-[11px] flex items-center gap-1 border border-emerald-500/30 transition cursor-pointer"
                        title="Track Live"
                      >
                        <Truck className="w-3 h-3" />
                        <span>Track</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectInvoice(order);
                        onClose();
                      }}
                      className="p-1 sm:p-1.5 rounded-lg bg-ink-850 hover:bg-ink-800 ds-text-dim hover:text-white transition border border-line cursor-pointer"
                      title={isOrderPaid ? "View Official Tax Invoice" : "View Pro-Forma Estimate"}
                    >
                      <Receipt className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
