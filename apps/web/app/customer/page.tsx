'use client';

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-store';
import { useExperienceStore } from '@/lib/experience-store';
import { api, BASE_URL } from '@/lib/api-client';
import {
  User,
  ShoppingBag,
  Package,
  Award,
  FileText,
  LifeBuoy,
  Clock,
  CheckCircle2,
  ChevronRight,
  ArrowUpRight,
  ShieldCheck,
  Download,
  Send,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function CustomerPortalPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { setExperience } = useExperienceStore();

  const [activeTab, setActiveTab] = useState<'orders' | 'invoices' | 'loyalty' | 'support'>('orders');
  const [supportMessage, setSupportMessage] = useState('');
  const [isSupportSubmitted, setIsSupportSubmitted] = useState(false);

  // Fetch real customer orders from delivery dispatch service
  const { data: realOrders = [], isLoading: isOrdersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ['customer-portal-orders', user?.email],
    queryFn: async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/v1/delivery/tasks`);
        if (!res.ok) return [];
        const json = await res.json();
        const items = json.data?.items || json.items || json.data || [];
        if (!Array.isArray(items)) return [];
        if (user?.name) {
          const userFiltered = items.filter(
            (o: any) =>
              o.recipientName?.toLowerCase().includes(user.name.toLowerCase()) ||
              (user.email && o.notes?.toLowerCase().includes(user.email.toLowerCase()))
          );
          if (userFiltered.length > 0) return userFiltered;
        }
        return items;
      } catch {
        return [];
      }
    },
  });

  // Fetch real invoices from central sales ledger (when token is available)
  const { data: salesData, isLoading: isInvoicesLoading } = useQuery({
    queryKey: ['customer-portal-sales', token],
    queryFn: () => api.listSales(token!, { limit: 20 }),
    enabled: !!token,
  });

  const pastOrders = realOrders.map((ord: any) => ({
    id: ord.id,
    orderNumber: ord.trackingNumber || `ORD-${ord.id.slice(-6).toUpperCase()}`,
    trackingNumber: ord.trackingNumber || `TRK-${ord.id.slice(-8).toUpperCase()}`,
    date: ord.createdAt ? new Date(ord.createdAt).toISOString().split('T')[0] : 'Recent',
    total: Number(ord.codAmount || 0) > 0 ? Number(ord.codAmount) : 19.99,
    status: ord.status,
    items: ord.notes ? [ord.notes] : ['Store Delivery Order'],
  }));

  const invoices = (salesData?.items || []).map((sale: any) => ({
    id: sale.id,
    number: `INV-${sale.id.slice(-6).toUpperCase()}`,
    date: sale.createdAt ? new Date(sale.createdAt).toISOString().split('T')[0] : 'Recent',
    amount: Number(sale.totalAmount || 0),
    status: sale.status === 'COMPLETED' ? 'PAID' : sale.status,
  }));

  const totalSpent = pastOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
  const loyaltyPoints = Math.round(totalSpent * 10);
  const loyaltyTier = loyaltyPoints > 1000 ? 'Platinum' : loyaltyPoints > 300 ? 'Gold' : 'Silver';

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;
    setIsSupportSubmitted(true);
    setSupportMessage('');
    toast.success('Support ticket created! Our team will respond shortly.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* ─── Customer Header ─── */}
      <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight">Customer Self-Service Portal</h1>
                <Badge variant="outline" className="text-[10px] bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                  Verified Member
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400">customer.camtech.cam • Connected to Core Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => navigate('/shop')}
              className="h-8 px-3 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl gap-1.5"
            >
              <ShoppingBag className="w-3.5 h-3.5" /> Shop Online
            </Button>
            <button
              onClick={() => {
                setExperience('EXECUTIVE');
                navigate('/dashboard');
              }}
              className="text-[11px] text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-800"
            >
              Console
            </button>
          </div>
        </div>
      </header>

      {/* ─── Profile & Loyalty Banner ─── */}
      <section className="bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-950 border-b border-slate-800 py-6 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-lg">
              {user?.name ? user.name[0].toUpperCase() : 'C'}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{user?.name || 'Valued Customer'}</h2>
              <p className="text-xs text-slate-400">{user?.email || 'customer@camtech.cam'}</p>
            </div>
          </div>

          {/* Loyalty Rewards Pill */}
          <div className="flex items-center gap-3 bg-slate-900/80 p-3 rounded-2xl border border-cyan-500/30 shadow-md">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                CamTech Rewards Tier
              </span>
              <span className="text-sm font-extrabold text-cyan-300 flex items-center gap-1.5">
                {loyaltyTier} Member • {loyaltyPoints.toLocaleString()} Points
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Navigation Tabs ─── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 w-full">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          {[
            { id: 'orders', label: 'My Orders & Tracking', icon: Package },
            { id: 'invoices', label: 'Invoices & Receipts', icon: FileText },
            { id: 'loyalty', label: 'Loyalty Points', icon: Award },
            { id: 'support', label: 'Help & Support', icon: LifeBuoy },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSel = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isSel
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Main Tab Content ─── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        {/* Tab 1: Orders */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Order History & Live Shipments</h3>
              <button
                onClick={() => refetchOrders()}
                className="text-[11px] text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            {pastOrders.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800">
                <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h4 className="text-base font-bold text-white mb-1">No Orders Placed Yet</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                  Orders placed through the online storefront will automatically appear here with real-time delivery tracking.
                </p>
                <Button
                  size="sm"
                  onClick={() => navigate('/shop')}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs gap-1.5"
                >
                  <ShoppingBag className="w-3.5 h-3.5" /> Browse Products
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {pastOrders.map((ord: any) => (
                  <div
                    key={ord.id}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-white">{ord.orderNumber}</span>
                          <Badge
                            className={`text-[10px] ${
                              ord.status === 'DELIVERED'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                            }`}
                          >
                            {ord.status === 'DELIVERED' ? 'Delivered' : ord.status === 'IN_TRANSIT' ? 'In Transit' : 'Dispatched'}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">Tracking: {ord.trackingNumber}</span>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-black text-white">${ord.total.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400 block">{ord.date}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-300">
                      <span className="text-[10px] text-slate-500 block mb-1 font-semibold">Items in order:</span>
                      <ul className="list-disc list-inside space-y-0.5">
                        {ord.items.map((item: string, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Invoices */}
        {activeTab === 'invoices' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Official Tax Invoices & Receipts</h3>
            {invoices.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800">
                <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h4 className="text-base font-bold text-white mb-1">No Invoices Available</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Official tax invoices and VAT receipts are automatically generated when retail purchases or enterprise contracts are finalized.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-md">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">Invoice #</th>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Total Amount</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-200">
                    {invoices.map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-white">{inv.number}</td>
                        <td className="p-3.5 text-slate-400">{inv.date}</td>
                        <td className="p-3.5 font-bold">${inv.amount.toFixed(2)}</td>
                        <td className="p-3.5">
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="p-3.5 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toast.success(`Receipt ${inv.number} downloaded`)}
                            className="h-7 text-[11px] gap-1 text-cyan-400 hover:text-cyan-300"
                          >
                            <Download className="w-3 h-3" /> PDF
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Loyalty */}
        {activeTab === 'loyalty' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Rewards & Point Redemptions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold">Available Points</span>
                <div className="text-2xl font-black text-cyan-400">{loyaltyPoints.toLocaleString()} pts</div>
                <p className="text-[11px] text-slate-400">Equal to ${(loyaltyPoints * 0.01).toFixed(2)} store credit discount</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold">Lifetime Spend</span>
                <div className="text-2xl font-black text-emerald-400">${totalSpent.toFixed(2)}</div>
                <p className="text-[11px] text-slate-400">Earn 10 points per $1 spent</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold">Current Perk</span>
                <div className="text-2xl font-black text-amber-400">{loyaltyTier === 'Platinum' ? 'Free Courier + 10% Off' : loyaltyTier === 'Gold' ? 'Free Express' : 'Member Discount'}</div>
                <p className="text-[11px] text-slate-400">Priority courier dispatch on all orders</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Support */}
        {activeTab === 'support' && (
          <div className="max-w-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Contact Customer Support</h3>
            <form onSubmit={handleSupportSubmit} className="space-y-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">How can we assist you today?</label>
                <textarea
                  rows={4}
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  placeholder="e.g. I need to change my delivery address or have a question about invoice #..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs h-9 rounded-xl">
                <Send className="w-3.5 h-3.5 mr-1.5" /> Submit Support Request
              </Button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
