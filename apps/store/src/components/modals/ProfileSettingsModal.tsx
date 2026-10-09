import React, { useState, useEffect } from 'react';
import { User, X, Save, Navigation, Loader2 } from 'lucide-react';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: any;
  setCustomer: (c: any) => void;
  syncCustomerWithDatabase: (data: any) => void;
  toast: any;
}

export function ProfileSettingsModal({
  isOpen,
  onClose,
  customer,
  setCustomer,
  syncCustomerWithDatabase,
  toast,
}: ProfileSettingsModalProps) {
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (isOpen && customer) {
      setPhone(customer.phone || '');
      setAddress(customer.defaultAddress || '');
      setLat(customer.defaultLat || null);
      setLng(customer.defaultLng || null);
    }
  }, [isOpen, customer]);

  if (!isOpen || !customer) return null;

  const handleCaptureLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLat(latitude);
        setLng(longitude);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            if (data.display_name) {
              setAddress(data.display_name);
            }
          }
        } catch (e) {
          console.warn('Geocoding failed', e);
        }
        setIsLocating(false);
        toast.success('Location captured!');
      },
      (error) => {
        setIsLocating(false);
        toast.error('Could not get your location. Please enable GPS.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSave = () => {
    const updatedCustomer = {
      ...customer,
      phone,
      defaultAddress: address,
      defaultLat: lat,
      defaultLng: lng,
    };
    setCustomer(updatedCustomer);
    localStorage.setItem('camtech_customer_phone', phone);
    
    syncCustomerWithDatabase({
      name: customer.name,
      email: customer.email,
      phone,
      defaultAddress: address,
      defaultLat: lat,
      defaultLng: lng,
    });
    toast.success('Profile settings updated successfully!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-ink-850 border border-line rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base ds-text">Profile Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-ink-800 ds-text-dim hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold ds-text-dim block mb-1">Default Phone Number</label>
            <input
              type="tel"
              placeholder="e.g. 012 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 bg-ink-800 border border-line-strong rounded-lg text-xs ds-text placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold ds-text-dim">Default Delivery Address</label>
              <button
                type="button"
                onClick={handleCaptureLocation}
                disabled={isLocating}
                className="text-[10px] text-brand-400 font-medium hover:text-brand-300 flex items-center gap-1 transition"
              >
                {isLocating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                {lat ? `GPS Locked` : 'Get Current GPS'}
              </button>
            </div>
            <textarea
              placeholder="Enter your default delivery address..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-ink-800 border border-line-strong rounded-lg text-xs ds-text placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            {lat && lng && (
              <div className="mt-2 w-full h-32 rounded-lg overflow-hidden border border-line">
                <iframe
                  title="Profile-Map-Preview"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005}%2C${lat - 0.003}%2C${lng + 0.005}%2C${lat + 0.003}&layer=mapnik&marker=${lat}%2C${lng}`}
                  className="w-full h-full border-0 pointer-events-none"
                />
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition"
        >
          <Save className="w-4 h-4" />
          Save Settings
        </button>
      </div>
    </div>
  );
}
