import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, Laptop, Moon, PlusCircle, Sun } from 'lucide-react';
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
import {
  ADMIN_SECTION_LABELS,
  type AdminNavigationItem,
  type AdminNavigationSection,
} from '@/lib/admin-navigation';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navigation: AdminNavigationItem[];
}

export function CommandPalette({ open, onOpenChange, navigation }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useThemeStore();

  const groupedNavigation = React.useMemo(() => {
    return navigation.reduce<Partial<Record<AdminNavigationSection, AdminNavigationItem[]>>>((groups, item) => {
      (groups[item.section] ??= []).push(item);
      return groups;
    }, {});
  }, [navigation]);

  const runCommand = React.useCallback(
    (command: () => void) => {
      onOpenChange(false);
      command();
    },
    [onOpenChange]
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search modules, workflows, or settings..." />
      <CommandList>
        <CommandEmpty>No accessible modules match your search.</CommandEmpty>

        <CommandGroup heading="Quick actions">
          <CommandItem
            value="new sale checkout cashier pos terminal"
            onSelect={() => runCommand(() => navigate('/sales/new'))}
          >
            <PlusCircle className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Start a new sale</span>
            <CommandShortcut>F1</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="stock adjustment inventory quantity"
            onSelect={() => runCommand(() => navigate('/inventory'))}
          >
            <Boxes className="mr-2 h-4 w-4 text-amber-500" />
            <span>Adjust inventory</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {(Object.keys(groupedNavigation) as AdminNavigationSection[]).map((section) => (
          <CommandGroup key={section} heading={ADMIN_SECTION_LABELS[section]}>
            {groupedNavigation[section]?.map((item) => (
              <CommandItem
                key={item.href}
                value={[item.name, section, ...(item.keywords ?? [])].join(' ')}
                onSelect={() => runCommand(() => navigate(item.href))}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

        <CommandSeparator />

        <CommandGroup heading="Appearance">
          <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
            <Sun className="mr-2 h-4 w-4" />
            <span>Use light theme</span>
            {theme === 'light' && <CommandShortcut>Active</CommandShortcut>}
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
            <Moon className="mr-2 h-4 w-4" />
            <span>Use dark theme</span>
            {theme === 'dark' && <CommandShortcut>Active</CommandShortcut>}
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme('system'))}>
            <Laptop className="mr-2 h-4 w-4" />
            <span>Follow system theme</span>
            {theme === 'system' && <CommandShortcut>Active</CommandShortcut>}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
