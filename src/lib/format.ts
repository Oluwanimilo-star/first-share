import { formatUnits } from "viem";

export function usd(n: number | string | null | undefined, digits = 2): string {
  const v = typeof n === "string" ? Number(n) : n;
  if (v === null || v === undefined || !isFinite(v)) return "—";
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function units(raw: string | bigint | null | undefined, decimals = 18, maxFrac = 6): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  try {
    const s = formatUnits(BigInt(raw), decimals);
    const n = Number(s);
    if (Math.abs(n) >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
    return n.toLocaleString("en-US", { maximumSignificantDigits: maxFrac });
  } catch {
    return String(raw);
  }
}

export function unitsToNumber(raw: string | bigint | null | undefined, decimals = 18): number {
  if (raw === null || raw === undefined || raw === "") return 0;
  try {
    return Number(formatUnits(BigInt(raw), decimals));
  } catch {
    return 0;
  }
}

export function shortAddr(a?: string | null): string {
  if (!a) return "";
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export function pct(n: number, digits = 2): string {
  if (!isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function localTime(ms: number | null | undefined): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}

export function countdown(ms: number | null | undefined, now = Date.now()): string {
  if (!ms) return "";
  let diff = Math.max(0, ms - now);
  const d = Math.floor(diff / 864e5);
  diff -= d * 864e5;
  const h = Math.floor(diff / 36e5);
  diff -= h * 36e5;
  const m = Math.floor(diff / 6e4);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}
