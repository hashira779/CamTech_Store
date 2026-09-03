import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Navigation,
  MapPin,
  Compass,
  Battery,
  Zap,
  Gauge,
  Clock,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Truck,
  Bike,
  Layers,
  Crosshair,
  ShieldAlert,
} from 'lucide-react';
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

// Bounding box for Phnom Penh metro area
const MAP_BOUNDS = {
  minLat: 11.5200,
  maxLat: 11.6000,
  minLng: 104.8800,
  maxLng: 104.9600,
};

export function LiveMap({
  drivers,
  orders,
  selectedDriverId,
  selectedOrderId,
  onSelectDriver,
  onSelectOrder,
  isSimulating = false,
}: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [activeLayer, setActiveLayer] = useState<'dark' | 'satellite' | 'streets'>('dark');

  // Find active selections
  const activeDriver = drivers.find((d) => d.id === selectedDriverId);
  const activeOrder = orders.find((o) => o.id === selectedOrderId);

  // Convert GPS (lat, lng) into percentage (x%, y%) inside bounding box
  const projectCoordinates = (lat: number, lng: number) => {
    const xPct = ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * 100;
    // Latitude inverted: high lat is North (top)
    const yPct = ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * 100;
    return {
      x: Math.max(5, Math.min(95, xPct)),
      y: Math.max(5, Math.min(95, yPct)),
    };
  };

  // Pan & Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Center on active driver if selected
  useEffect(() => {
    if (activeDriver) {
      const pos = projectCoordinates(activeDriver.currentLat, activeDriver.currentLng);
      // center offset
      setPan({
        x: (50 - pos.x) * 8 * zoom,
        y: (50 - pos.y) * 6 * zoom,
      });
    }
  }, [selectedDriverId]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[520px] rounded-2xl overflow-hidden bg-slate-950 border border-border/40 shadow-2xl select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* ─── Map Background Canvas & GIS Grid ─── */}
      <div
        className="absolute inset-0 transition-transform duration-100 ease-out"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        {/* Vector Road & River Grid Simulator */}
        <svg className="w-full h-full opacity-40" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
            </pattern>
            <linearGradient id="riverGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0369a1" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Background Grid */}
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Simulated Tonle Sap & Mekong River confluence */}
          <path
            d="M 650 0 C 680 180, 710 260, 760 340 C 800 400, 890 470, 960 520 L 1000 520 L 1000 0 Z"
            fill="url(#riverGrad)"
          />
          <path
            d="M 760 340 C 720 420, 700 480, 680 520 L 630 520 C 660 460, 680 400, 730 340 Z"
            fill="url(#riverGrad)"
          />

          {/* Main Boulevards (Norodom, Monivong, Russian Blvd) */}
          <line x1="45%" y1="0%" x2="48%" y2="100%" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="3" strokeDasharray="6,6" />
          <line x1="55%" y1="0%" x2="58%" y2="100%" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="3" />
          <line x1="10%" y1="42%" x2="90%" y2="45%" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="3" />
          <circle cx="50%" cy="45%" r="18" fill="none" stroke="rgba(56, 189, 248, 0.4)" strokeWidth="2" />

          {/* Active Route Polylines from Drivers to Assigned Destinations */}
          {orders
            .filter((o) => o.status === 'DISPATCHED' || o.status === 'IN_TRANSIT')
            .map((ord) => {
              const driver = drivers.find((d) => d.id === ord.driverId);
              if (!driver) return null;
              const dPos = projectCoordinates(driver.currentLat, driver.currentLng);
              const oPos = projectCoordinates(ord.destLat, ord.destLng);

              return (
                <g key={`route-${ord.id}`}>
                  {/* Glowing line backdrop */}
                  <line
                    x1={`${dPos.x}%`}
                    y1={`${dPos.y}%`}
                    x2={`${oPos.x}%`}
                    y2={`${oPos.y}%`}
                    stroke="#38bdf8"
                    strokeWidth="3"
                    strokeOpacity="0.7"
                    strokeDasharray="8 6"
                    className="animate-pulse"
                  />
                  {/* Arrow midpoint */}
                  <circle
                    cx={`${(dPos.x + oPos.x) / 2}%`}
                    cy={`${(dPos.y + oPos.y) / 2}%`}
                    r="4"
                    fill="#38bdf8"
                    className="animate-ping"
                  />
                </g>
              );
            })}
        </svg>

        {/* ─── Destination Markers ─── */}
        {orders.map((ord) => {
          const pos = projectCoordinates(ord.destLat, ord.destLng);
          const isSelected = selectedOrderId === ord.id;
          const isDelivered = ord.status === 'DELIVERED';

          return (
            <div
              key={ord.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectOrder?.(ord);
              }}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-full cursor-pointer group transition-transform hover:scale-125 z-10"
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
                  <div className="w-1.5 h-1.5 bg-sky-400 rounded-full mx-auto -mt-0.5" />
                </div>
              </div>
            </div>
          );
        })}

        {/* ─── Active Driver Markers ─── */}
        {drivers.map((drv) => {
          const pos = projectCoordinates(drv.currentLat, drv.currentLng);
          const isSelected = selectedDriverId === drv.id;
          const isMoving = drv.status === 'EN_ROUTE';

          return (
            <div
              key={drv.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectDriver?.(drv);
              }}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
            >
              {/* Pulsing Live Radar Ring */}
              {isMoving && (
                <div className="absolute -inset-4 rounded-full bg-cyan-500/25 animate-ping" />
              )}
              {isSelected && (
                <div className="absolute -inset-6 rounded-full border border-sky-400/60 animate-spin" />
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
          );
        })}
      </div>

      {/* ─── Glassmorphic HUD Overlays ─── */}

      {/* Top Left: System Status & Live Radar Tag */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/50 shadow-lg">
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
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="w-8 h-8 text-slate-300 hover:text-white"
          onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}
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
        <div className="absolute bottom-4 left-4 right-4 z-30 max-w-xl mx-auto bg-slate-900/90 backdrop-blur-lg border border-sky-500/30 rounded-2xl p-4 shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-4">
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
