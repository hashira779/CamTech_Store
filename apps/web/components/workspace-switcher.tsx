'use client';

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useExperienceStore, EXPERIENCE_CONFIGS, type ExperienceType } from '@/lib/experience-store';
import {
  Crown,
  Store,
  ShoppingBag,
  Truck,
  Boxes,
  Users,
  Landmark,
  Sparkles,
  ChevronDown,
  Layers,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

const ICON_MAP = {
  Crown,
  Store,
  ShoppingBag,
  Truck,
  Boxes,
  Users,
  Landmark,
  Sparkles,
};

export function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const { activeExperience, setExperience } = useExperienceStore();

  const current = EXPERIENCE_CONFIGS[activeExperience] || EXPERIENCE_CONFIGS.EXECUTIVE;
  const CurrentIcon = (ICON_MAP as any)[current.icon] || Crown;

  const handleSwitch = (exp: ExperienceType) => {
    setExperience(exp);
    const target = EXPERIENCE_CONFIGS[exp];
    if (target?.defaultRoute) {
      navigate(target.defaultRoute);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60 transition-all text-left shadow-sm focus:outline-hidden">
        <div className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
          <CurrentIcon className="w-3.5 h-3.5" />
        </div>
        <div className="hidden sm:block">
          <span className="text-[11px] font-bold text-slate-200 block leading-tight">
            {current.title}
          </span>
          <span className="text-[9px] text-slate-400 font-mono">{current.badge}</span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72 bg-slate-950 border-slate-800 text-slate-200 p-1.5 shadow-2xl">
        <DropdownMenuLabel className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2 py-1.5 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-sky-400" /> Multi-Experience Switcher (Spec §151–§176)
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-800 my-1" />

        {(Object.keys(EXPERIENCE_CONFIGS) as ExperienceType[]).map((key) => {
          const cfg = EXPERIENCE_CONFIGS[key];
          const Icon = (ICON_MAP as any)[cfg.icon] || Crown;
          const isSelected = activeExperience === key;

          return (
            <DropdownMenuItem
              key={key}
              onClick={() => handleSwitch(key)}
              className={`flex items-start gap-2.5 p-2 rounded-xl cursor-pointer transition-all ${
                isSelected
                  ? 'bg-sky-500/15 border border-sky-500/30 text-white'
                  : 'hover:bg-slate-900 text-slate-300'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  isSelected ? 'bg-sky-500 text-white shadow-sm' : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold truncate">{cfg.title}</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-slate-900 border-slate-700 text-slate-400">
                    {cfg.badge}
                  </Badge>
                </div>
                <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 leading-normal">{cfg.description}</p>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default WorkspaceSwitcher;
