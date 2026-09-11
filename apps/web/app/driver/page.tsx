'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { useExperienceStore } from '@/lib/experience-store';
import {
  Truck, Navigation, Phone, CheckCircle2, Clock, MapPin, DollarSign,
  FileSignature, ShieldCheck, ChevronRight, Package, Smartphone, QrCode, 
  Send, X, RefreshCw, LogOut, BellRing, User, MessageCircle, Map as MapIcon, RotateCcw,
  ExternalLink, Compass
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { DeliveryOrderDto } from '@mystore/contracts';

// Open Google Maps turn-by-turn navigation or search
export const openInGoogleMaps = (address: string, lat?: number, lng?: number) => {
  let url = '';
  if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
    url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  } else {
    url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  const tg = (window as any).Telegram?.WebApp;
  if (tg?.openLink) {
    tg.openLink(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

// Embedded Mini Map Component with Google Maps Launcher
export function DeliveryMiniMap({
  address,
  lat = 11.5564,
  lng = 104.9282,
  className = "h-44",
}: {
  address: string;
  lat?: number;
  lng?: number;
  className?: string;
}) {
  const safeLat = typeof lat === 'number' && !isNaN(lat) && lat !== 0 ? lat : 11.5564;
  const safeLng = typeof lng === 'number' && !isNaN(lng) && lng !== 0 ? lng : 104.9282;
  const delta = 0.007;

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-inner group ${className}`}>
      <iframe
        title={`Mini-Map-${safeLat}-${safeLng}`}
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${safeLng - delta}%2C${safeLat - delta * 0.7}%2C${safeLng + delta}%2C${safeLat + delta * 0.7}&layer=mapnik&marker=${safeLat}%2C${safeLng}`}
        className="w-full h-full border-0 pointer-events-auto"
        loading="lazy"
      />
      {/* Floating Google Maps button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openInGoogleMaps(address, safeLat, safeLng);
        }}
        className="absolute top-2.5 right-2.5 px-3 py-1.5 rounded-full bg-white/95 hover:bg-white text-slate-900 shadow-md font-bold text-[11px] flex items-center gap-1.5 border border-slate-200 transition hover:scale-105 active:scale-95 cursor-pointer z-10"
        title="Open destination in Google Maps"
      >
        <Navigation className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />
        <span>Open in Google Maps</span>
        <ExternalLink className="w-3 h-3 text-slate-400" />
      </button>

      {/* Destination address badge at bottom */}
      <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-xl text-[10px] font-medium text-slate-700 shadow-sm border border-slate-100 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1 truncate">
          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span className="truncate">{address}</span>
        </div>
        <span className="font-mono text-slate-400 shrink-0 ml-1">
          {safeLat.toFixed(4)}, {safeLng.toFixed(4)}
        </span>
      </div>
    </div>
  );
}

export default function DriverAppPage() {
  const { token, user, setAuth, clear } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setExperience } = useExperienceStore();

  const [driverStatus, setDriverStatus] = useState<'ON_DUTY' | 'ON_BREAK' | 'OFF_DUTY'>('ON_DUTY');
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrderDto | null>(null);
  const [isPodOpen, setIsPodOpen] = useState(false);
  const [podNotes, setPodNotes] = useState('');
  const [podSignature, setPodSignature] = useState('');
  const [orderTab, setOrderTab] = useState<'AVAILABLE' | 'ACTIVE' | 'COMPLETED'>('ACTIVE');

  // Mobile & Desktop Detection
  const [isDesktop, setIsDesktop] = useState(false);
  const [showDesktopAlert, setShowDesktopAlert] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);

  // Telegram Auth State
  const [authState, setAuthState] = useState<'LOADING' | 'UNREGISTERED' | 'OTP_PENDING' | 'PENDING_APPROVAL' | 'ACTIVE'>('LOADING');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);
  const [initData, setInitData] = useState('');

  useEffect(() => {
    const checkTelegramAuth = async () => {
      const data = (window as any).Telegram?.WebApp?.initData || '';
      setInitData(data);
      try {
        const res = await api.deliveryAuthAutoLogin(data);
        if (res.auth_status === 'ACTIVE' && res.access_token) {
          setAuth(res.access_token, res.user);
          setAuthState('ACTIVE');
        } else {
          setAuthState(res.auth_status as any);
        }
      } catch (err) {
        setAuthState('UNREGISTERED');
      }
    };
    if (!token) {
      checkTelegramAuth();
    } else {
      setAuthState('ACTIVE');
    }
  }, [token]);

  const handleInitRegister = async () => {
    if (!phoneNumber) return toast.error('Enter phone number');
    setIsAuthProcessing(true);
    try {
      await api.deliveryAuthInit(phoneNumber, initData);
      setAuthState('OTP_PENDING');
      toast.success('OTP sent via Telegram Bot');
      if ((window as any).Telegram?.WebApp?.HapticFeedback) {
        (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setIsAuthProcessing(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode) return toast.error('Enter OTP');
    setIsAuthProcessing(true);
    try {
      await api.deliveryAuthVerify(phoneNumber, otpCode, initData);
      setAuthState('PENDING_APPROVAL');
      toast.success('OTP Verified. Waiting for Admin Approval.');
      if ((window as any).Telegram?.WebApp?.HapticFeedback) {
        (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    } catch (err: any) {
      toast.error(err.message || 'OTP Verification failed');
    } finally {
      setIsAuthProcessing(false);
    }
  };

  useEffect(() => {
    const checkViewport = () => {
      const isWide = window.innerWidth >= 768;
      const isTg = Boolean((window as any).Telegram?.WebApp?.initData);
      setIsDesktop(isWide && !isTg);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Check role authorization
  const userRoles = Array.isArray(user?.roles) ? user.roles : [];
  const isAuthorized = Boolean(
    token &&
    (userRoles.some((r: any) =>
      ['DELIVERY_DRIVER', 'STORE_MANAGER', 'ORG_ADMIN', 'WAREHOUSE_STAFF', 'CEO', 'CASHIER', 'ADMIN'].includes(r)
    ) || user?.permissions?.includes('delivery:view'))
  );

  // Fetch Delivery Orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['driver-deliveries'],
    queryFn: () => api.listDeliveryOrders(token!),
    enabled: isAuthorized && authState === 'ACTIVE',
    refetchInterval: 2000,
  });

  // Update Delivery Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, podNotes, signature }: { id: string; status: string; podNotes?: string; signature?: string }) =>
      api.updateDeliveryStatus(token!, id, { status, proofOfDelivery: signature, notes: podNotes }),
    onSuccess: (updated) => {
      toast.success(`Delivery status updated to ${updated.status}`);
      queryClient.invalidateQueries({ queryKey: ['driver-deliveries'] });
      setIsPodOpen(false);
      setSelectedOrder(null);
      setPodNotes('');
      setPodSignature('');
    },
    onError: () => {
      toast.error('Failed to update delivery status');
    },
  });

  const acceptOrderMutation = useMutation({
    mutationFn: (id: string) =>
      api.updateDeliveryStatus(token!, id, { status: 'DISPATCHED' }),
    onSuccess: (updated) => {
      toast.success(`Order #${updated.trackingNumber} claimed!`);
      queryClient.invalidateQueries({ queryKey: ['driver-deliveries'] });
      setOrderTab('ACTIVE');
    },
    onError: () => {
      toast.error('Failed to claim delivery order');
    },
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevPendingRef = useRef<number>(0);

  const pendingOrders = orders.filter((o) => o.status === 'PENDING');
  const activeOrders = orders.filter((o) => ['DISPATCHED', 'IN_TRANSIT'].includes(o.status));
  const completedOrders = orders.filter((o) => o.status === 'DELIVERED');
  const totalCodToCollect = activeOrders.reduce((sum, o) => sum + (Number(o.codAmount) > 0 ? Number(o.codAmount) : 0), 0);

  useEffect(() => {
    if (pendingOrders.length > prevPendingRef.current && prevPendingRef.current > 0) {
      toast.info(`New Order! (${pendingOrders.length} unassigned)`);
    }
    prevPendingRef.current = pendingOrders.length;
  }, [pendingOrders.length, soundEnabled]);

  return (
    <div className="min-h-screen bg-[#F7F7F9] text-slate-900 flex flex-col items-center relative font-sans">
      {/* ─── 1. Desktop / Telegram Mini App Alert Notice ─── */}
      {isDesktop && showDesktopAlert && (
        <div className="w-full bg-slate-900 px-4 py-2 text-xs text-white z-50 fixed top-0">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
             <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-slate-400" />
                <span>Optimized for mobile. Open in Telegram.</span>
             </div>
             <button onClick={() => setShowQrModal(true)} className="px-3 py-1 bg-white text-black rounded-full font-semibold">QR Code</button>
             <button onClick={() => setShowDesktopAlert(false)} className="p-1"><X className="w-4 h-4"/></button>
          </div>
        </div>
      )}

      {/* ─── 2. Telegram Auth Gate ─── */}
      {!isAuthorized || authState !== 'ACTIVE' ? (
        <div className="flex-1 flex items-center justify-center p-4 w-full max-w-md my-auto">
          <div className="w-full bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 space-y-6">
            {authState === 'LOADING' && (
              <div className="text-center space-y-4 py-8">
                <RefreshCw className="w-10 h-10 text-slate-300 animate-spin mx-auto" />
                <h2 className="text-sm font-bold text-slate-500">Authenticating Identity...</h2>
              </div>
            )}

            {authState === 'PENDING_APPROVAL' && (
              <div className="text-center space-y-4 py-4">
                <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-2">
                  <Clock className="w-10 h-10 text-amber-400 animate-pulse" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Pending Approval</h2>
                <p className="text-sm text-slate-500">
                  Your device and Telegram account have been verified. Please wait while an administrator approves your delivery profile.
                </p>
                <div className="pt-4">
                  <Button onClick={() => window.location.reload()} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-full font-bold py-6">
                    Refresh Status
                  </Button>
                </div>
              </div>
            )}

            {authState === 'UNREGISTERED' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="w-16 h-16 rounded-3xl bg-amber-100 flex items-center justify-center mb-6">
                    <Phone className="w-8 h-8 text-amber-600" />
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900">Driver Registration</h2>
                  <p className="text-sm text-slate-500">Enter your pre-registered phone number to receive your secure login link.</p>
                </div>
                <div className="space-y-4 pt-2">
                  <Input
                    type="tel"
                    placeholder="e.g. 012345678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="bg-slate-50 border-slate-200 rounded-2xl px-6 h-14 text-lg font-medium text-slate-900 placeholder:text-slate-400"
                  />
                  <Button
                    onClick={handleInitRegister}
                    disabled={isAuthProcessing || phoneNumber.length < 8}
                    className="w-full h-14 rounded-full bg-[#FDCB82] hover:bg-[#fab75b] text-amber-950 text-lg font-bold shadow-sm"
                  >
                    {isAuthProcessing ? 'Sending...' : 'Send OTP via Bot'}
                  </Button>
                </div>
              </div>
            )}

            {authState === 'OTP_PENDING' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-100 flex items-center justify-center mb-6">
                    <ShieldCheck className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900">Enter OTP</h2>
                  <p className="text-sm text-slate-500">
                    We sent a code to your Telegram chat via <strong className="text-slate-900">@camtech_delivery_bot</strong>.
                  </p>
                </div>
                <div className="space-y-4 pt-2">
                  <Input
                    type="text"
                    placeholder="123456"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="bg-slate-50 border-slate-200 rounded-2xl text-center text-3xl tracking-[0.5em] font-mono font-bold text-slate-900 h-16"
                  />
                  <Button
                    onClick={handleVerifyOtp}
                    disabled={isAuthProcessing || otpCode.length !== 6}
                    className="w-full h-14 rounded-full bg-[#FDCB82] hover:bg-[#fab75b] text-amber-950 text-lg font-bold shadow-sm"
                  >
                    {isAuthProcessing ? 'Verifying...' : 'Verify Secure OTP'}
                  </Button>
                  <button onClick={() => setAuthState('UNREGISTERED')} className="w-full text-center text-sm font-semibold text-slate-400 hover:text-slate-600 mt-2">
                    Change Phone Number
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ─── 3. Authorized Driver App View (Dribbble Style) ─── */
        <div className="w-full max-w-md flex flex-col flex-1 bg-[#F7F7F9] relative pb-24">
          
          {/* Top Header Section */}
          <header className="px-6 pt-12 pb-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center shadow-sm">
                   {/* Avatar Placeholder */}
                   <User className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <div className="text-sm text-slate-500 font-medium flex items-center gap-1">
                    Good Morning
                  </div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">{user?.name || 'Courier'}</h1>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-1.5 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-100 text-sm font-bold text-slate-900">
                  <MessageCircle className="w-4 h-4" />
                  Chat
                </button>
                <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 relative text-slate-900">
                  <BellRing className="w-4 h-4" />
                  {pendingOrders.length > 0 && (
                    <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 leading-tight">
                Today's Shipment<br/>
                <span className="text-slate-500 font-medium">Status Update.</span>
              </h2>
            </div>

            {/* Metrics Overview */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Shipment Overview</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-3xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100">
                   <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-4 text-slate-900">
                      <Package className="w-5 h-5" />
                   </div>
                   <div className="text-2xl font-bold text-slate-900">{orders.length}</div>
                   <div className="text-xs text-slate-500 mt-1 font-medium">Today's Shipments</div>
                </div>
                <div className="bg-white p-5 rounded-3xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100">
                   <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-4 text-slate-900">
                      <DollarSign className="w-5 h-5" />
                   </div>
                   <div className="text-2xl font-bold text-slate-900">${totalCodToCollect.toFixed(2)}</div>
                   <div className="text-xs text-slate-500 mt-1 font-medium">COD Collection</div>
                </div>
              </div>
            </div>
          </header>

          {/* List Content */}
          <main className="flex-1 px-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-slate-900">
                {orderTab === 'AVAILABLE' ? 'New Requests' : orderTab === 'ACTIVE' ? 'Active Route' : 'Completed Deliveries'}
              </h3>
              <span className="text-sm font-bold text-slate-400">
                 {orderTab === 'AVAILABLE' ? pendingOrders.length : orderTab === 'ACTIVE' ? activeOrders.length : completedOrders.length} Shipments
              </span>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-sm text-slate-400 font-medium">Syncing telemetry...</div>
            ) : orderTab === 'AVAILABLE' ? (
              /* ─── AVAILABLE ORDERS ─── */
              pendingOrders.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-sm">
                  <CheckCircle2 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-slate-900">No Pending Requests</h3>
                  <p className="text-sm text-slate-500 mt-1">You're all caught up for now.</p>
                </div>
              ) : (
                pendingOrders.map((order) => (
                  <div key={order.id} className="bg-white p-5 rounded-3xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                         <span className="text-xs font-bold text-slate-500">{order.trackingNumber}</span>
                         <h4 className="text-base font-bold text-slate-900 mt-1">{order.recipientName}</h4>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-bold uppercase bg-amber-50 text-amber-600 border-amber-100 py-1 px-2 rounded-full">
                        New Order
                      </Badge>
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-2xl flex items-start gap-3">
                       <MapPin className="w-5 h-5 text-slate-400 shrink-0" />
                       <p className="text-sm font-medium text-slate-700 leading-tight">{order.deliveryAddress}</p>
                    </div>

                    {/* Mini Map Preview for Available Requests */}
                    <DeliveryMiniMap
                      address={order.deliveryAddress}
                      lat={order.destLat}
                      lng={order.destLng}
                      className="h-36 my-1"
                    />

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openInGoogleMaps(order.deliveryAddress, order.destLat, order.destLng)}
                        className="h-11 px-3.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
                        title="Open with Google Maps"
                      >
                        <Navigation className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />
                        <span>Google Maps</span>
                      </button>

                      <Button
                        onClick={() => acceptOrderMutation.mutate(order.id)}
                        disabled={acceptOrderMutation.isPending}
                        className="flex-1 h-11 rounded-full bg-[#FDCB82] hover:bg-[#fab75b] text-amber-950 font-bold text-xs shadow-sm"
                      >
                        Accept & Route
                      </Button>
                    </div>
                  </div>
                ))
              )
            ) : orderTab === 'ACTIVE' ? (
              /* ─── ACTIVE ORDERS ─── */
              activeOrders.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-sm">
                  <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-slate-900">Route is Empty</h3>
                  <p className="text-sm text-slate-500 mt-1">Accept pending orders to start your route.</p>
                </div>
              ) : (
                activeOrders.map((order) => (
                  <div key={order.id} className="bg-white p-5 rounded-3xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                         <span className="text-xs font-bold text-slate-500">{order.trackingNumber}</span>
                         <h4 className="text-base font-bold text-slate-900 mt-1">{order.recipientName}</h4>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-bold uppercase bg-[#FDCB82]/20 text-amber-700 border-transparent py-1 px-2 rounded-full">
                        {order.status === 'IN_TRANSIT' ? 'In Transit' : 'Dispatched'}
                      </Badge>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl flex items-start gap-3">
                       <MapPin className="w-5 h-5 text-slate-400 shrink-0" />
                       <p className="text-sm font-medium text-slate-700 leading-tight">{order.deliveryAddress}</p>
                    </div>

                    {/* Embedded Mini Map for Active Route */}
                    <DeliveryMiniMap
                      address={order.deliveryAddress}
                      lat={order.destLat}
                      lng={order.destLng}
                      className="h-44 my-1"
                    />

                    {Number(order.codAmount) > 0 && (
                      <div className="flex items-center justify-between text-sm font-bold text-slate-900 px-2">
                        <span className="flex items-center gap-1.5 text-slate-500"><DollarSign className="w-4 h-4"/> COD to Collect</span>
                        <span>${Number(order.codAmount).toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <a
                        href={`tel:${order.recipientPhone}`}
                        className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center border border-slate-200 text-slate-700 shrink-0 transition"
                        title="Call Customer"
                      >
                        <Phone className="w-4 h-4" />
                      </a>

                      <button
                        type="button"
                        onClick={() => openInGoogleMaps(order.deliveryAddress, order.destLat, order.destLng)}
                        className="h-11 px-3.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 shadow-sm flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0"
                        title="Navigate with Google Maps"
                      >
                        <Navigation className="w-4 h-4 text-blue-600 fill-blue-600" />
                        <span>Google Maps</span>
                      </button>

                      {order.status === 'DISPATCHED' ? (
                        <Button
                          onClick={() => {
                            updateStatusMutation.mutate({ id: order.id, status: 'IN_TRANSIT' });
                            openInGoogleMaps(order.deliveryAddress, order.destLat, order.destLng);
                          }}
                          className="flex-1 h-11 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Compass className="w-4 h-4 text-amber-400" />
                          <span>Start Route</span>
                        </Button>
                      ) : (
                        <Button
                          onClick={() => {
                            setSelectedOrder(order);
                            setIsPodOpen(true);
                          }}
                          className="flex-1 h-11 rounded-full bg-[#FDCB82] hover:bg-[#fab75b] text-amber-950 font-bold text-xs shadow-sm cursor-pointer"
                        >
                          Deliver & Sign
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )
            ) : (
              /* ─── COMPLETED ORDERS ─── */
              completedOrders.map((order) => (
                <div key={order.id} className="bg-white p-5 rounded-3xl border border-slate-100 space-y-3 opacity-75">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-400">{order.trackingNumber}</span>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">{order.recipientName}</h4>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border-transparent py-1 px-2 rounded-full">
                      Delivered
                    </Badge>
                  </div>
                </div>
              ))
            )}
            
            {/* Pad the bottom for the floating nav */}
            <div className="h-12"></div>
          </main>

          {/* ─── Floating Bottom Navigation (Dribbble Style Black Pill) ─── */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-950 rounded-full px-2 py-2 flex items-center gap-2 shadow-2xl z-40 border border-slate-800">
             <button 
               onClick={() => setOrderTab('AVAILABLE')}
               className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${orderTab === 'AVAILABLE' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}
             >
               <Package className="w-5 h-5" />
               {pendingOrders.length > 0 && orderTab !== 'AVAILABLE' && (
                 <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-950"></span>
               )}
             </button>
             <button 
               onClick={() => setOrderTab('ACTIVE')}
               className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${orderTab === 'ACTIVE' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}
             >
               <MapIcon className="w-5 h-5" />
             </button>
             <button 
               onClick={() => setOrderTab('COMPLETED')}
               className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${orderTab === 'COMPLETED' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}
             >
               <CheckCircle2 className="w-5 h-5" />
             </button>
             <button 
               onClick={() => {
                 clear();
                 toast.success('Logged out');
               }}
               className="flex items-center justify-center w-12 h-12 rounded-full text-slate-400 hover:text-rose-400 transition-all ml-4"
             >
               <LogOut className="w-5 h-5" />
             </button>
          </div>
        </div>
      )}

      {/* ─── 4. Proof of Delivery (POD) Bottom Sheet Modal ─── */}
      <Dialog open={isPodOpen} onOpenChange={setIsPodOpen}>
        <DialogContent className="max-w-sm bg-white border-slate-100 rounded-t-[2rem] rounded-b-none sm:rounded-[2rem] text-slate-900 mt-auto mb-0 sm:my-auto p-8 border-b-0 shadow-2xl">
          <DialogHeader className="text-left space-y-1 mb-4">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
            <DialogTitle className="text-2xl font-bold tracking-tight">Complete Delivery</DialogTitle>
            <DialogDescription className="text-sm font-medium text-slate-500">
              {selectedOrder?.trackingNumber} • {selectedOrder?.recipientName}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-5">
              {Number(selectedOrder.codAmount) > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-amber-900">COD to Collect</span>
                  <span className="text-xl font-bold text-amber-700">${Number(selectedOrder.codAmount).toFixed(2)}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recipient Signature Name</label>
                <Input
                  placeholder="e.g. Sokha Chem"
                  value={podSignature}
                  onChange={(e) => setPodSignature(e.target.value)}
                  className="bg-slate-50 border-slate-200 rounded-xl h-12 font-medium text-slate-900"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Delivery Notes</label>
                <Input
                  placeholder="e.g. Left at front desk"
                  value={podNotes}
                  onChange={(e) => setPodNotes(e.target.value)}
                  className="bg-slate-50 border-slate-200 rounded-xl h-12 font-medium text-slate-900"
                />
              </div>

              <Button
                onClick={() =>
                  updateStatusMutation.mutate({
                    id: selectedOrder.id,
                    status: 'DELIVERED',
                    podNotes: podNotes || 'Delivered successfully by courier.',
                    signature: podSignature || selectedOrder.recipientName,
                  })
                }
                disabled={updateStatusMutation.isPending}
                className="w-full bg-[#FDCB82] hover:bg-[#fab75b] text-amber-950 font-bold text-base h-14 rounded-full shadow-sm mt-4"
              >
                Confirm Drop-off
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
