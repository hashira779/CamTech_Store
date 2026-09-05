'use client';

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { APP_REGISTRY, type AppId } from '@mystore/contracts';
import { useExperienceStore, type ExperienceType } from '@/lib/experience-store';
import { Globe, ArrowRight, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function DomainBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setExperience } = useExperienceStore();

  const domainApps: Array<{ id: AppId; domain: string; route: string; exp: ExperienceType }> = [
    { id: 'ceo', domain: 'ceo.camtech.cam', route: '/ceo', exp: 'EXECUTIVE' },
    { id: 'store', domain: 'store.camtech.cam', route: '/shop', exp: 'CUSTOMER_STORE' },
    { id: 'cashier', domain: 'cashier.camtech.cam', route: '/pos', exp: 'POS_CASHIER' },
    { id: 'delivery', domain: 'delivery.camtech.cam', route: '/driver', exp: 'DELIVERY_DRIVER' },
    { id: 'warehouse', domain: 'warehouse.camtech.cam', route: '/wms', exp: 'WAREHOUSE_WMS' },
    { id: 'hr', domain: 'hr.camtech.cam', route: '/hr', exp: 'HR_OPERATIONS' },
    { id: 'finance', domain: 'finance.camtech.cam', route: '/finance', exp: 'FINANCE_LEDGER' },
    { id: 'customer', domain: 'customer.camtech.cam', route: '/customer', exp: 'CUSTOMER_STORE' },
    { id: 'partner', domain: 'partner.camtech.cam', route: '/developers', exp: 'EXECUTIVE' },
    { id: 'support', domain: 'support.camtech.cam', route: '/tickets', exp: 'EXECUTIVE' },
    { id: 'admin', domain: 'admin.camtech.cam', route: '/dashboard', exp: 'EXECUTIVE' },
  ];

  // Detect current domain from path. Use a path-boundary match (`route + '/'`) so
  // a route like '/customer' does NOT greedily swallow the admin '/customers' page.
  const currentApp =
    domainApps.find((d) => location.pathname === d.route || (d.route !== '/dashboard' && d.route !== '/ceo' && location.pathname.startsWith(d.route + '/'))) ||
    domainApps.find((d) => d.id === 'admin') ||
    domainApps[0];

  const handleDomainSelect = (app: (typeof domainApps)[0]) => {
    setExperience(app.exp);
    navigate(app.route);
  };

  return (
    <div className="bg-card/95 border-b border-border px-4 py-1.5 text-[11px] flex items-center justify-between overflow-x-auto gap-4 text-muted-foreground select-none backdrop-blur-sm transition-colors">
      <div className="flex items-center gap-2 shrink-0">
        <Globe className="w-3.5 h-3.5 text-primary animate-pulse" />
        <span className="font-semibold text-foreground">Active Domain:</span>
        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 font-mono py-0">
          {currentApp.domain}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] text-muted-foreground hidden md:inline">Switch Portal:</span>
        {domainApps.map((item) => {
          const isSelected = currentApp.id === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleDomainSelect(item)}
              className={`px-2 py-0.5 rounded-md font-mono text-[10px] transition-all cursor-pointer ${
                isSelected
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                  : 'hover:bg-accent text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.id}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default DomainBar;
