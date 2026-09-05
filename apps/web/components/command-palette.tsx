import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  PlusCircle,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { useThemeStore } from '@/lib/theme-store';
import { NAVIGATION_ITEMS } from '@/lib/navigation';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useThemeStore();

  const runCommand = React.useCallback(
    (command: () => void) => {
      onOpenChange(false);
      command();
    },
    [onOpenChange]
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search modules..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Quick Actions">
          <CommandItem
            onSelect={() => runCommand(() => navigate('/sales/new'))}
          >
            <PlusCircle className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Open Point of Sale (POS Terminal)</span>
            <CommandShortcut>F1</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate('/products'))}
          >
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>Add New Product to Catalog</span>
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate('/inventory'))}
          >
            <Boxes className="mr-2 h-4 w-4 text-amber-500" />
            <span>Stock Adjustment</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          {NAVIGATION_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.href}
                value={[item.name, item.section, ...(item.keywords ?? [])].join(' ')}
                onSelect={() => runCommand(() => navigate(item.href))}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>{item.name}</span>
                <CommandShortcut>{item.section}</CommandShortcut>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
            <Sun className="mr-2 h-4 w-4" />
            <span>Light Mode</span>
            {theme === 'light' && <span className="ml-auto text-xs text-primary font-bold">Active</span>}
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
            <Moon className="mr-2 h-4 w-4" />
            <span>Dark Mode</span>
            {theme === 'dark' && <span className="ml-auto text-xs text-primary font-bold">Active</span>}
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme('system'))}>
            <Laptop className="mr-2 h-4 w-4" />
            <span>System Preference</span>
            {theme === 'system' && <span className="ml-auto text-xs text-primary font-bold">Active</span>}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
