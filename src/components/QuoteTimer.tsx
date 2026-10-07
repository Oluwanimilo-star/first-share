"use client";
import { QUOTE_TTL_S } from "@/lib/client/useQuote";

/** Countdown for the ~30 s price promise. At zero the quote is refreshed automatically. */
export function QuoteTimer({ secondsLeft, loading, onRefresh }: { secondsLeft: number | null; loading: boolean; onRefresh: () => void }) {
  const s = secondsLeft ?? 0;
  const frac = secondsLeft === null ? 0 : Math.max(0, Math.min(1, s / QUOTE_TTL_S));
  const tone = loading ? "text-slate-500" : s <= 5 ? "text-rose-700" : s <= 12 ? "text-amber-700" : "text-emerald-700";
  const R = 9;
  const C = 2 * Math.PI * R;
  return (
    <button
      onClick={onRefresh}
      disabled={loading}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-sm font-semibold ring-1 ring-black/10 ${tone}`}
      title="Prices from market makers last about 30 seconds. Tap to get a fresh one now."
      data-testid="quote-timer"
    >
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden className={loading ? "animate-spin" : ""}>
        <circle cx="11" cy="11" r={R} fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <circle
          cx="11"
          cy="11"
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={loading ? C * 0.7 : C * (1 - frac)}
          transform="rotate(-90 11 11)"
        />
      </svg>
      <span className="tabular-nums">{loading ? "Refreshing…" : secondsLeft === null ? "Get price" : `Price held ${s}s`}</span>
    </button>
  );
}
