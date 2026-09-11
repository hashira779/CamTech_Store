import React, { useState, useEffect } from 'react';
import {
  Navigation,
  MapPin,
  Battery,
  Gauge,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Truck,
  Bike,
} from 'lucide-react';
import { Map, Overlay } from 'pigeon-maps';
import type { DeliveryDriverDto, DeliveryOrderDto } from '@mystore/contracts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface LiveMapProps {
  drivers: DeliveryDriverDto[];
  orders: DeliveryOrderDto[];
  selectedDriverId?: string | null;
  selectedOrderId?: string | null;
  onSelectDriver?: (driver: DeliveryDriverDto) => void;
  onSelectOrder?: (order: DeliveryOrderDto) => void;
  isSimulating?: boolean;
}

const DEFAULT_CENTER: [number, number] = [11.5621, 104.9213]; // Phnom Penh
const DEFAULT_ZOOM = 13;

export function LiveMap({
  drivers,
  orders,
  selectedDriverId,
  selectedOrderId,
  onSelectDriver,
  onSelectOrder,
  isSimulating = false,
}: LiveMapProps) {
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  // Find active selections
  const activeDriver = drivers.find((d) => d.id === selectedDriverId);
  const activeOrder = orders.find((o) => o.id === selectedOrderId);

  // Center on active driver if selected
  useEffect(() => {
    if (activeDriver) {
      setCenter([activeDriver.currentLat, activeDriver.currentLng]);
      setZoom(15);
    }
  }, [selectedDriverId]);

  const resetView = () => {
    setCenter(DEFAULT_CENTER);
    setZoom(DEFAULT_ZOOM);
  };

  return (
    <div className="relative w-full h-[520px] rounded-2xl overflow-hidden bg-slate-950 border border-border/40 shadow-2xl select-none">
      
      {/* ─── Real Street Map (OpenStreetMap) ─── */}
      <Map 
        center={center} 
        zoom={zoom} 
        onBoundsChanged={({ center, zoom }) => { 
          setCenter(center); 
          setZoom(zoom); 
        }}
        metaWheelZoom={true} // requires cmd/ctrl to zoom to prevent scroll trapping
      >
        {/* ─── Destination Markers ─── */}
        {orders.map((ord) => {
          const isSelected = selectedOrderId === ord.id;
          const isDelivered = ord.status === 'DELIVERED';

          return (
            <Overlay key={ord.id} anchor={[ord.destLat, ord.destLng]} offset={[0, 40]}>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectOrder?.(ord);
                }}
                className="cursor-pointer group transition-transform hover:scale-110 z-10"
              >
                <div className="flex flex-col items-center">
                  {/* Floating Tag */}
                  <div
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono tracking-tight font-medium shadow-md transition-colors whitespace-nowrap mb-1 ${
                      isSelected
                        ? 'bg-sky-500 text-white shadow-sky-500/50'
                        : isDelivered
                        ? 'bg-emerald-600/80 text-white'
                        : 'bg-slate-900/90 text-slate-200 border border-slate-700'
                    }`}
                  >
                    {ord.recipientName.split(' ')[0]} • ${ord.codAmount.toFixed(2)}
                  </div>

                  {/* Drop Pin */}
                  <div className="relative">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-transform ${
                        isSelected
                          ? 'bg-sky-500 text-white scale-110 ring-4 ring-sky-500/30'
                          : isDelivered
                          ? 'bg-emerald-500 text-white'
                          : 'bg-amber-500 text-slate-950'
                      }`}
                    >
                      <MapPin className="w-4 h-4 fill-current" />
                    </div>
                    <div className="w-1.5 h-1.5 bg-sky-400 rounded-full mx-auto -mt-0.5 shadow-sm" />
                  </div>
                </div>
              </div>
            </Overlay>
          );
        })}

        {/* ─── Active Driver Markers ─── */}
        {drivers.map((drv) => {
          const isSelected = selectedDriverId === drv.id;
          const isMoving = drv.status === 'EN_ROUTE';

          return (
            <Overlay key={drv.id} anchor={[drv.currentLat, drv.currentLng]} offset={[18, 18]}>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDriver?.(drv);
                }}
                className="cursor-pointer group z-20 relative"
              >
                {/* Pulsing Live Radar Ring */}
                {isMoving && (
                  <div className="absolute -inset-4 rounded-full bg-cyan-500/25 animate-ping pointer-events-none" />
                )}
                {isSelected && (
                  <div className="absolute -inset-6 rounded-full border border-sky-400/60 animate-spin pointer-events-none" />
                )}

                {/* Vehicle Icon Circle */}
                <div
                  className={`relative w-9 h-9 rounded-full flex items-center justify-center shadow-2xl transition-all ${
                    isSelected
                      ? 'bg-gradient-to-tr from-sky-600 to-cyan-400 text-white ring-4 ring-sky-400/40 scale-110'
                      : isMoving
                      ? 'bg-gradient-to-tr from-blue-600 to-indigo-500 text-white'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                  style={{ transform: `rotate(${drv.heading ?? 0}deg)` }}
                >
                  {drv.vehicleType === 'VAN' ? (
                    <Truck className="w-4 h-4" />
                  ) : (
                    <Bike className="w-4 h-4" />
                  )}

                  {/* Heading Arrow Pip */}
                  <div className="absolute -top-1 w-2 h-2 bg-white rounded-full shadow-sm" />
                </div>

                {/* Driver Label Pill */}
                <div className="absolute top-10 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-[10px] text-slate-200 font-medium whitespace-nowrap shadow-lg flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isMoving ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  {drv.name.split(' ')[0]}
                </div>
              </div>
            </Overlay>
          );
        })}
      </Map>

      {/* ─── Glassmorphic HUD Overlays ─── */}

      {/* Top Left: System Status & Live Radar Tag */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2 pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/50 shadow-lg pointer-events-auto">
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </div>
          <span className="text-xs font-semibold tracking-wide text-slate-100 uppercase">
            Live GPS Telemetry
          </span>
          <Badge variant="outline" className="text-[10px] bg-slate-800/80 border-slate-700 text-sky-400">
            {drivers.filter((d) => d.status === 'EN_ROUTE').length} Active Units
          </Badge>
          {isSimulating && (
            <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] animate-pulse">
              Simulating Movement
            </Badge>
          )}
        </div>
      </div>

      {/* Top Right: Map Controls */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md p-1 rounded-xl border border-slate-700/50 shadow-lg">
        <Button
          size="icon"
          variant="ghost"
          className="w-8 h-8 text-slate-300 hover:text-white"
          onClick={() => setZoom((z) => Math.min(18, z + 1))}
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="w-8 h-8 text-slate-300 hover:text-white"
          onClick={() => setZoom((z) => Math.max(8, z - 1))}
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="w-8 h-8 text-slate-300 hover:text-white"
          onClick={resetView}
          title="Recenter"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* Bottom Floating Telemetry Panel (When Driver is Selected) */}
      {activeDriver && (
        <div className="absolute bottom-4 left-4 right-4 z-30 max-w-xl mx-auto bg-slate-900/90 backdrop-blur-lg border border-sky-500/30 rounded-2xl p-4 shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-4 pointer-events-auto">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                {activeDriver.vehicleType === 'VAN' ? (
                  <Truck className="w-5 h-5" />
                ) : (
                  <Bike className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-slate-100 text-sm">{activeDriver.name}</h4>
                  <Badge variant="outline" className="text-[10px] text-sky-300 border-sky-500/30">
                    {activeDriver.licensePlate}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">{activeDriver.phone}</p>
              </div>
            </div>

            {/* Telemetry Metrics */}
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="text-right">
                <span className="text-slate-400 text-[10px] uppercase block">Speed</span>
                <span className="text-emerald-400 font-bold flex items-center justify-end gap-1">
                  <Gauge className="w-3.5 h-3.5" />
                  {activeDriver.status === 'EN_ROUTE' ? '34 km/h' : '0 km/h'}
                </span>
              </div>
              <div className="text-right border-l border-slate-700/60 pl-3">
                <span className="text-slate-400 text-[10px] uppercase block">Battery</span>
                <span className="text-sky-300 font-bold flex items-center justify-end gap-1">
                  <Battery className="w-3.5 h-3.5" />
                  {activeDriver.batteryLevel ?? 95}%
                </span>
              </div>
              <div className="text-right border-l border-slate-700/60 pl-3">
                <span className="text-slate-400 text-[10px] uppercase block">Assigned</span>
                <span className="text-amber-300 font-bold">
                  {activeDriver.activeOrdersCount ?? 0} Orders
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
