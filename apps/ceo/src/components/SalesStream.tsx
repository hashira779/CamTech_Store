import { DollarSign } from 'lucide-react';

export function SalesStream({ sales, loading }: { sales: any[]; loading: boolean }) {
  return (
    <section className="ds-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white">Sales &amp; invoicing stream</h3>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">Live feed from POS and online storefront</p>
        </div>
        <span className="ds-chip bg-emerald-500/12 text-emerald-400 font-mono shrink-0">Central DB</span>
      </div>
      <div className="ds-divide">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="py-3 flex items-center justify-between animate-pulse">
              <div className="space-y-1.5">
                <div className="w-28 h-3.5 bg-ink-700 rounded" />
                <div className="w-16 h-3 bg-ink-700/60 rounded" />
              </div>
              <div className="w-16 h-4 bg-ink-700 rounded" />
            </div>
          ))
        ) : !sales.length ? (
          <div className="py-10 text-center text-xs text-slate-500">
            No sales recorded yet. Ring up a sale on POS or Store to see the live feed.
          </div>
        ) : (
          sales.slice(0, 6).map((sale: any) => (
            <div key={sale.id} className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-ink-800 border border-line flex items-center justify-center shrink-0">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <span className="font-mono text-xs font-bold text-white block truncate">
                    {sale.saleNumber || sale.id}
                  </span>
                  <span className="text-[11px] text-slate-500 block truncate">{sale.channel || 'POS'} checkout</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="ds-figure text-emerald-400 text-sm">
                  ${Number(sale.grandTotal || sale.total || 0).toFixed(2)}
                </span>
                <span className="text-[10px] block text-emerald-500/70 font-semibold">PAID · KHQR</span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
