import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Search, Smile } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { getCategoryIcon } from '@/components/category-tree-select';
import { EXTENDED_ICONS } from '@/lib/category-icons';

export function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customEmoji, setCustomEmoji] = useState('');

  const filteredIcons = useMemo(() => {
    if (!search.trim()) return EXTENDED_ICONS;
    const q = search.toLowerCase();
    return EXTENDED_ICONS.filter(
      (i) => i.key.includes(q) || i.category.toLowerCase().includes(q) || i.emoji.includes(q)
    );
  }, [search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full justify-start gap-2 text-sm font-normal"
        >
          <span className="text-lg">{getCategoryIcon(value)}</span>
          <span className="text-muted-foreground truncate">{value || 'Choose or paste icon…'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-3 space-y-2.5" align="start">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search icons or categories…"
            className="input w-full text-xs pl-8 h-8"
          />
        </div>

        {/* Custom Input */}
        <div className="flex items-center gap-1.5 pt-1">
          <input
            type="text"
            value={customEmoji}
            onChange={(e) => setCustomEmoji(e.target.value)}
            placeholder="Paste any emoji (e.g. 🍧, 🎸, ☕)…"
            className="input flex-1 text-xs h-8"
            maxLength={10}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-xs shrink-0 px-2.5"
            disabled={!customEmoji.trim()}
            onClick={() => {
              if (customEmoji.trim()) {
                onChange(customEmoji.trim());
                setCustomEmoji('');
                setOpen(false);
              }
            }}
          >
            Apply
          </Button>
        </div>

        {/* Icon Grid */}
        <div className="max-h-[180px] overflow-y-auto pr-1 grid grid-cols-6 gap-1 pt-1 border-t border-border">
          {filteredIcons.map(({ key, emoji }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className={`
                w-9 h-9 flex items-center justify-center rounded-md text-base
                transition-all duration-100 hover:scale-110
                ${value === key || value === emoji
                  ? 'bg-primary/15 ring-2 ring-primary/40'
                  : 'hover:bg-muted/80'
                }
              `}
              title={`${key} (${emoji})`}
            >
              {emoji}
            </button>
          ))}
          {filteredIcons.length === 0 && (
            <div className="col-span-6 py-4 text-center text-xs text-muted-foreground">
              No icon matches &ldquo;{search}&rdquo;
            </div>
          )}
        </div>

        {/* Clear & Footer */}
        <div className="pt-2 border-t border-border flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Smile className="w-3 h-3" />
            {EXTENDED_ICONS.length}+ icons or paste custom
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-muted-foreground hover:text-foreground px-2"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
          >
            Clear icon
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
