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
    { id: 'ceo', domain: 'ceo.camtech.cam', route: '/dashboard', exp: 'EXECUTIVE' },
    { id: 'store', domain: 'store.camtech.cam', route: '/shop', exp: 'CUSTOMER_STORE' },
    { id: 'cashier', domain: 'cashier.camtech.cam', route: '/sales/new', exp: 'POS_CASHIER' },
    { id: 'delivery', domain: 'delivery.camtech.cam', route: '/driver', exp: 'DELIVERY_DRIVER' },
    { id: 'warehouse', domain: 'warehouse.camtech.cam', route: '/transfers', exp: 'WAREHOUSE_WMS' },
    { id: 'hr', domain: 'hr.camtech.cam', route: '/hr', exp: 'HR_OPERATIONS' },
    { id: 'finance', domain: 'finance.camtech.cam', route: '/finance', exp: 'FINANCE_LEDGER' },
    { id: 'customer', domain: 'customer.camtech.cam', route: '/customer', exp: 'CUSTOMER_STORE' },
    { id: 'partner', domain: 'partner.camtech.cam', route: '/developers', exp: 'EXECUTIVE' },
    { id: 'support', domain: 'support.camtech.cam', route: '/tickets', exp: 'EXECUTIVE' },
    { id: 'admin', domain: 'admin.camtech.cam', route: '/settings', exp: 'EXECUTIVE' },
  ];

  // Detect current domain from path
  const currentApp =
    domainApps.find((d) => location.pathname === d.route || (d.route !== '/dashboard' && location.pathname.startsWith(d.route))) ||
    domainApps[0];

  const handleDomainSelect = (app: (typeof domainApps)[0]) => {
    setExperience(app.exp);
    navigate(app.route);
  };

  return (
    <div className="bg-slate-950/95 border-b border-slate-800 px-4 py-1.5 text-[11px] flex items-center justify-between overflow-x-auto gap-4 text-slate-400 select-none">
      <div className="flex items-center gap-2 shrink-0">
        <Globe className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
        <span className="font-semibold text-slate-300">Active Domain:</span>
        <Badge variant="outline" className="text-[10px] bg-sky-500/10 text-sky-300 border-sky-500/30 font-mono py-0">
          {currentApp.domain}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] text-slate-500 hidden md:inline">Switch Subdomain (Spec §228):</span>
        {domainApps.map((item) => {
          const isSelected = currentApp.id === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleDomainSelect(item)}
              className={`px-2 py-0.5 rounded-md font-mono text-[10px] transition-all ${
                isSelected
                  ? 'bg-sky-500 text-white font-bold shadow-xs'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
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
