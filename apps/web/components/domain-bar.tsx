'use client';

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { type AppId } from '@mystore/contracts';
import { useExperienceStore, type ExperienceType } from '@/lib/experience-store';
import { Globe, ChevronUp, ChevronDown, X } from 'lucide-react';

export function DomainBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setExperience } = useExperienceStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const domainApps: Array<{ id: AppId; name: string; domain: string; route: string; exp: ExperienceType }> = [
    { id: 'admin', name: 'Enterprise ERP', domain: 'adminconsol.camtech.cam', route: '/dashboard', exp: 'EXECUTIVE' },
    { id: 'ceo', name: 'Executive Suite', domain: 'business.camtech.cam', route: '/ceo', exp: 'EXECUTIVE' },
    { id: 'cashier', name: 'POS Terminal', domain: 'pos.camtech.cam', route: '/pos', exp: 'POS_CASHIER' },
    { id: 'warehouse', name: 'WMS Logistics', domain: 'warehouse.camtech.cam', route: '/wms', exp: 'WAREHOUSE_WMS' },
    { id: 'delivery', name: 'Fleet Dispatch', domain: 'delivery.camtech.cam', route: '/driver', exp: 'DELIVERY_DRIVER' },
    { id: 'store', name: 'Public Storefront', domain: 'store.camtech.cam', route: '/shop', exp: 'CUSTOMER_STORE' },
    { id: 'hr', name: 'HR & People', domain: 'hrms.camtech.cam', route: '/hr', exp: 'HR_OPERATIONS' },
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
        className="fixed bottom-3 right-3 z-50 p-2 rounded-md bg-card border border-border text-muted-foreground hover:text-foreground shadow-md transition-colors cursor-pointer"
        title="Show Portal Switcher"
      >
        <Globe className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-3 right-3 z-50 flex flex-col items-end">
      {/* Expanded Portal Menu */}
      {isOpen && (
        <div className="mb-2 w-64 rounded-lg border border-border bg-card p-2 shadow-lg animate-fade-up">
          <div className="flex items-center justify-between border-b border-border pb-2 mb-2 px-1">
            <span className="text-xs font-semibold text-foreground">Portals</span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-px max-h-64 overflow-y-auto">
            {domainApps.map((item) => {
              const isSelected = currentApp.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleDomainSelect(item)}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors text-left cursor-pointer ${
                    isSelected
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="truncate">
                    <p className="font-medium truncate text-[12px]">{item.name}</p>
                    <p className={`text-[10px] font-mono truncate ${isSelected ? 'text-primary/70' : 'text-muted-foreground/60'}`}>
                      {item.domain}
                    </p>
                  </div>
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-1.5 pt-1.5 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground px-1">
            <span>Subdomain Routing</span>
            <button
              onClick={() => setIsDismissed(true)}
              className="hover:underline text-muted-foreground hover:text-foreground"
            >
              Minimize
            </button>
          </div>
        </div>
      )}

      {/* Floating Trigger */}
      <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 shadow-md">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
          <span className="text-[11px] text-muted-foreground">Portal:</span>
          <span className="text-[11px] font-semibold text-primary">{currentApp.name}</span>
          {isOpen ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronUp className="w-3 h-3 text-muted-foreground" />}
        </button>
      </div>
    </div>
  );
}

export default DomainBar;
