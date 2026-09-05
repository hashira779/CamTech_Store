'use client';

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { type AppId } from '@mystore/contracts';
import { useExperienceStore, type ExperienceType } from '@/lib/experience-store';
import { Globe, ChevronUp, ChevronDown, X, ExternalLink, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function DomainBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setExperience } = useExperienceStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const domainApps: Array<{ id: AppId; name: string; domain: string; route: string; exp: ExperienceType }> = [
    { id: 'admin', name: 'Enterprise ERP', domain: 'admin.camtech.cam', route: '/dashboard', exp: 'EXECUTIVE' },
    { id: 'ceo', name: 'Executive Suite', domain: 'ceo.camtech.cam', route: '/ceo', exp: 'EXECUTIVE' },
    { id: 'cashier', name: 'POS Terminal', domain: 'cashier.camtech.cam', route: '/pos', exp: 'POS_CASHIER' },
    { id: 'warehouse', name: 'WMS Logistics', domain: 'warehouse.camtech.cam', route: '/wms', exp: 'WAREHOUSE_WMS' },
    { id: 'delivery', name: 'Fleet Dispatch', domain: 'delivery.camtech.cam', route: '/driver', exp: 'DELIVERY_DRIVER' },
    { id: 'store', name: 'Public Storefront', domain: 'store.camtech.cam', route: '/shop', exp: 'CUSTOMER_STORE' },
    { id: 'hr', name: 'HR & People', domain: 'hr.camtech.cam', route: '/hr', exp: 'HR_OPERATIONS' },
    { id: 'finance', name: 'General Ledger', domain: 'finance.camtech.cam', route: '/finance', exp: 'FINANCE_LEDGER' },
    { id: 'customer', name: 'Customer Portal', domain: 'customer.camtech.cam', route: '/customer', exp: 'CUSTOMER_STORE' },
    { id: 'partner', name: 'Developer Hub', domain: 'partner.camtech.cam', route: '/developers', exp: 'EXECUTIVE' },
    { id: 'support', name: 'Service Desk', domain: 'support.camtech.cam', route: '/tickets', exp: 'EXECUTIVE' },
  ];

  const currentApp =
    domainApps.find((d) => location.pathname === d.route || (d.route !== '/dashboard' && d.route !== '/ceo' && location.pathname.startsWith(d.route + '/'))) ||
    domainApps.find((d) => d.id === 'admin') ||
    domainApps[0];

  const handleDomainSelect = (app: (typeof domainApps)[0]) => {
    setExperience(app.exp);
    navigate(app.route);
    setIsOpen(false);
  };

  if (isDismissed) {
    return (
      <button
        onClick={() => setIsDismissed(false)}
        className="fixed bottom-3 right-3 z-50 p-2 rounded-full bg-card/90 border border-border/80 text-muted-foreground hover:text-foreground shadow-lg backdrop-blur-md transition-all hover:scale-105 cursor-pointer"
        title="Show Portal Switcher"
      >
        <Globe className="w-4 h-4 text-primary" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-3 right-3 z-50 flex flex-col items-end">
      {/* Expanded Portal Menu */}
      {isOpen && (
        <div className="mb-2 w-72 rounded-2xl border border-border/80 bg-card/95 p-3 shadow-2xl backdrop-blur-xl animate-fade-up">
          <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Multi-Experience Portals</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-1 max-h-72 overflow-y-auto pr-1">
            {domainApps.map((item) => {
              const isSelected = currentApp.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleDomainSelect(item)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all text-left cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'hover:bg-muted/70 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="truncate">
                    <p className="font-medium truncate">{item.name}</p>
                    <p className={`text-[10px] font-mono truncate ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground/70'}`}>
                      {item.domain}
                    </p>
                  </div>
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Subdomain Simulation</span>
            <button
              onClick={() => setIsDismissed(true)}
              className="hover:underline text-muted-foreground hover:text-foreground"
            >
              Minimize
            </button>
          </div>
        </div>
      )}

      {/* Floating Trigger Pill */}
      <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-card/90 px-3 py-1.5 shadow-lg backdrop-blur-md hover:bg-card transition-all">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          <span className="text-[11px] font-mono font-semibold text-muted-foreground">Portal:</span>
          <span className="text-[11px] font-semibold text-primary">{currentApp.name}</span>
          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
      </div>
    </div>
  );
}

export default DomainBar;
