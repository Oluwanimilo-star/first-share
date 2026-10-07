"use client";

/** "$5 buys ~0.013 TSLAB — a thin slice of one share", with a tiny pie. */
export function ShareSlice(p: { usd: number; tokens: number | null; symbol: string; ticker: string; name: string; ratio?: number | null; estimate?: boolean }) {
  if (!p.tokens || !isFinite(p.tokens) || p.tokens <= 0) return null;
  const ratio = p.ratio && isFinite(p.ratio) && p.ratio > 0 ? p.ratio : 1;
  const frac = p.tokens * ratio; // fraction of ONE real share
  const pctOfShare = frac * 100;
  const slices = frac > 0 ? Math.round(1 / frac) : 0;
  const tok = p.tokens.toLocaleString("en-US", { maximumSignificantDigits: 2 });
  const money = Number.isInteger(p.usd) ? `$${p.usd}` : `$${p.usd.toFixed(2)}`;
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5" data-testid="share-math">
      <Pie frac={Math.min(frac, 1)} />
      <div className="min-w-0">
        <p className="text-[15px] font-bold leading-snug text-ink">
          {money} buys {p.estimate ? "about " : "~"}
          {tok} {p.symbol} — {frac >= 1 ? `more than one whole ${p.ticker} share` : `a thin slice of one ${p.name} share`}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {frac >= 1
            ? `That's ${frac.toLocaleString("en-US", { maximumFractionDigits: 2 })} shares.`
            : `That's ${pctOfShare.toLocaleString("en-US", { maximumSignificantDigits: 2 })}% of one share — about ${slices.toLocaleString("en-US")} slices like this make a whole one.`}
        </p>
        {p.estimate ? <p className="mt-0.5 text-xs text-slate-400">Estimate from today&apos;s token price. Your quote will be exact.</p> : null}
      </div>
    </div>
  );
}

function Pie({ frac, size = 64 }: { frac: number; size?: number }) {
  const r = size / 2 - 3;
  const c = size / 2;
  // Keep tiny slices visible: at least ~4°.
  const angle = Math.max(frac * 360, 4) * (Math.PI / 180);
  const x = c + r * Math.sin(angle);
  const y = c - r * Math.cos(angle);
  const large = angle > Math.PI ? 1 : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label={`${(frac * 100).toFixed(1)}% of one share`}>
      <circle cx={c} cy={c} r={r} fill="#e2e8f0" stroke="#fff" strokeWidth={2} />
      {frac >= 1 ? (
        <circle cx={c} cy={c} r={r} fill="#f0b90b" />
      ) : (
        <path d={`M ${c} ${c} L ${c} ${c - r} A ${r} ${r} 0 ${large} 1 ${x} ${y} Z`} fill="#f0b90b" stroke="#1e2026" strokeWidth={1} strokeLinejoin="round" />
      )}
      <circle cx={c} cy={c} r={r} fill="none" stroke="#1e2026" strokeOpacity={0.15} strokeWidth={1} />
    </svg>
  );
}
