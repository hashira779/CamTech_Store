import { Search } from 'lucide-react';

interface DirectoryControlsProps {
  search: string;
  onSearch: (v: string) => void;
  departments: string[];
  selected: string;
  onSelect: (d: string) => void;
}

export function DirectoryControls({ search, onSearch, departments, selected, onSelect }: DirectoryControlsProps) {
  return (
    <div className="ds-card p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3">
      <div className="relative w-full lg:w-80">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search by name, role, or email…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-ink-950/60 border border-line text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/15 transition"
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 -mx-1 px-1">
        {departments.map((d) => (
          <button
            key={d}
            onClick={() => onSelect(d)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              selected === d
                ? 'bg-brand-600 text-white shadow-glow'
                : 'bg-ink-800/70 text-slate-400 hover:bg-ink-700 hover:text-slate-200'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}
