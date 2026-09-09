export function TrendBars({ data, labels }: { data: number[]; labels: string[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1.5 sm:gap-2 h-32">
      {data.map((v, i) => {
        const pct = Math.max(4, (v / max) * 100);
        const isPeak = v === max && v > 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-2 min-w-0">
            <div className="w-full flex items-end justify-center h-full">
              <div
                className="w-full max-w-[34px] rounded-t-md transition-all duration-500"
                style={{
                  height: `${pct}%`,
                  background: isPeak
                    ? 'linear-gradient(180deg,#818cf8,#4f46e5)'
                    : 'linear-gradient(180deg,rgba(129,140,248,0.55),rgba(79,70,229,0.25))'
                }}
                title={`$${v.toLocaleString()}`}
              />
            </div>
            <span className="text-[9px] font-mono text-slate-500 truncate">{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}
