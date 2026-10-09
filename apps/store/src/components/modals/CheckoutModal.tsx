import React from 'react';
import { ShieldCheck, X, User, Navigation, MapPin, QrCode, Truck, CheckCircle2 } from 'lucide-react';

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: any;
  setCustomer: (c: any) => void;
  guestName: string;
  setGuestName: (n: string) => void;
  guestPhone: string;
  setGuestPhone: (p: string) => void;
  setIsAuthModalOpen: (open: boolean) => void;
  handleGoogleSignIn: () => void;
  deliveryAddress: string;
  setDeliveryAddress: (a: string) => void;
  handleCaptureLocation: () => void;
  isLocating: boolean;
  coords: { lat: number; lng: number } | null;
  paymentMethod: string;
  setPaymentMethod: (m: string) => void;
  cartTotal: number;
  handleCheckout: () => void;
  syncCustomerWithDatabase: (data: any) => void;
  toast: any;
}

export function CheckoutModal({
  isOpen, onClose, customer, setCustomer, guestName, setGuestName,
  guestPhone, setGuestPhone, setIsAuthModalOpen, handleGoogleSignIn,
  deliveryAddress, setDeliveryAddress, handleCaptureLocation,
  isLocating, coords, paymentMethod, setPaymentMethod,
  cartTotal, handleCheckout, syncCustomerWithDatabase, toast
}: CheckoutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-ink-850 border border-line rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <h3 className="font-bold text-lg ds-text flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Secure Checkout
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-ink-800 ds-text-dim hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          {/* Customer / Guest Identity */}
          {customer ? (
            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold ds-text flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    Ordering as <span className="text-emerald-300 font-bold">{customer.name}</span>
                  </p>
                  <p className="text-[10px] ds-text-dim mt-0.5">{customer.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCustomer(null);
                    toast.info('Switched to Guest Checkout');
                  }}
                  className="text-[11px] ds-text-dim hover:text-emerald-400 underline"
                >
                  Buy as Guest
                </button>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold ds-text-dim block mb-1">
                  Phone Number (For Driver Contact) *
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 012 345 678 or +855..."
                  value={customer.phone || guestPhone}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGuestPhone(val);
                    setCustomer((prev: any) => (prev ? { ...prev, phone: val } : null));
                    localStorage.setItem('camtech_customer_phone', val);
                    if (customer?.email) {
                      syncCustomerWithDatabase({
                        name: customer.name,
                        email: customer.email,
                        phone: val,
                      });
                    }
                  }}
                  className="w-full px-3 py-2 bg-ink-850 border border-line-strong focus:border-emerald-500 rounded-lg text-xs ds-text placeholder-slate-500 focus:outline-none transition"
                />
                {!(customer.phone || guestPhone) && (
                  <p className="text-[11px] text-brand-400 mt-1 flex items-center gap-1">
                    <span>⚠️</span> Please enter your phone number so our driver can contact you.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-ink-950/70 p-3.5 rounded-xl border border-line space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Guest Checkout
                </span>
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="text-[11px] ds-text-dim hover:text-white underline"
                >
                  Have an account? Sign In
                </button>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs transition flex items-center justify-center gap-2 border border-slate-200 shadow-sm"
              >
                <GoogleIcon className="w-4 h-4" />
                <span>Auto-fill details with Google</span>
              </button>

              <div className="relative text-center my-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-line"></div>
                </div>
                <span className="relative bg-ink-950 px-2 text-[10px] ds-text-faint uppercase">or enter manually</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-semibold ds-text-dim block mb-1">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dara Pich"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full px-3 py-2 bg-ink-800 border border-line-strong rounded-lg text-xs ds-text placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-semibold ds-text-dim block mb-1">
                    Phone (For Delivery) *
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +855 12 345 678"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-ink-800 border border-line-strong rounded-lg text-xs ds-text placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold ds-text-dim">Delivery Destination *</label>
              <button
                type="button"
                onClick={handleCaptureLocation}
                disabled={isLocating}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition"
              >
                <Navigation className="w-3 h-3" />
                {isLocating ? 'Locating...' : coords ? `GPS Locked (${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)})` : 'Use Current GPS'}
              </button>
            </div>
            <div className="relative">
              <MapPin className="w-4 h-4 ds-text-faint absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Enter street, building, or district..."
                className="w-full pl-9 pr-3 py-2 bg-ink-800 border border-line-strong rounded-lg text-xs ds-text"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold ds-text-dim block mb-2">Select Payment Method</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod('KHQR')}
                className={`p-3 rounded-xl border flex items-center gap-2 transition ${
                  paymentMethod === 'KHQR'
                    ? 'bg-rose-500/10 border-rose-500 text-rose-400 font-bold'
                    : 'bg-ink-800/80 border-line-strong ds-text-dim'
                }`}
              >
                <QrCode className="w-5 h-5 text-rose-400" />
                <div className="text-left">
                  <p className="text-xs">Bakong KHQR</p>
                  <p className="text-[10px] ds-text-dim font-normal">Scan & Pay Any Bank</p>
                </div>
              </button>

              <button
                onClick={() => setPaymentMethod('COD')}
                className={`p-3 rounded-xl border flex items-center gap-2 transition ${
                  paymentMethod === 'COD'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
                    : 'bg-ink-800/80 border-line-strong ds-text-dim'
                }`}
              >
                <Truck className="w-5 h-5 text-emerald-400" />
                <div className="text-left">
                  <p className="text-xs">Cash on Delivery</p>
                  <p className="text-[10px] ds-text-dim font-normal">Pay Driver Upon Arrival</p>
                </div>
              </button>
            </div>
          </div>

          {/* Dynamic KHQR Integration Notice */}
          {paymentMethod === 'KHQR' && (
            <div className="p-3.5 rounded-xl bg-gradient-to-b from-rose-950/20 to-ink-950/80 border border-rose-800/20 text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600 text-white font-bold text-[10px] tracking-wider uppercase shadow-md shadow-rose-600/30">
                <span>KHQR</span> • <span>ABA PayWay Integration</span>
              </div>
              <p className="text-xs ds-text-dim px-2">
                Your official ABA PayWay QR code and deep link will be generated securely on the next screen once your order is placed.
              </p>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-line flex items-center justify-between">
          <div>
            <span className="text-xs ds-text-dim block">Total Due</span>
            <span className="text-lg font-bold text-emerald-400 font-mono">${(cartTotal * 1.1).toFixed(2)}</span>
          </div>
          <button
            onClick={handleCheckout}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-500/20"
          >
            <CheckCircle2 className="w-4 h-4" />
            {paymentMethod === 'KHQR' ? 'Place Order & Get QR' : 'Place Order Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
