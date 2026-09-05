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
      <DropdownMenuTrigger className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-card hover:bg-accent border border-border transition-all text-left shadow-xs focus:outline-hidden cursor-pointer">
        <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <CurrentIcon className="w-3.5 h-3.5" />
        </div>
        <div className="hidden sm:block">
          <span className="text-[11px] font-bold text-foreground block leading-tight">
            {current.title}
          </span>
          <span className="text-[9px] text-muted-foreground font-mono">{current.badge}</span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1 shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72 bg-card border border-border text-foreground p-1.5 shadow-2xl">
        <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider px-2 py-1.5 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-primary" /> Multi-Experience Workspaces
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border my-1" />

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
                  ? 'bg-primary/15 border border-primary/30 text-primary-foreground'
                  : 'hover:bg-accent text-foreground'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  isSelected ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted text-muted-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold truncate text-foreground">{cfg.title}</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-muted border-border text-muted-foreground">
                    {cfg.badge}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5 leading-normal">{cfg.description}</p>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default WorkspaceSwitcher;
