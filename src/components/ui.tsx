"use client";
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-5 ${className}`}>{children}</div>;
}

export function Explainer({ title = "In plain English", children }: { title?: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bnb text-xl shadow-sm" aria-hidden>
        🎓
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">{title}</p>
        <div className="mt-1 space-y-2 text-[15px] leading-relaxed text-slate-800">{children}</div>
      </div>
    </div>
  );
}

export function DemoChip({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-amber-400 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
      Demo data
    </span>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "good" | "ok" | "warn" | "bad" | "neutral" | "info"; children: ReactNode }) {
  const c = {
    good: "bg-emerald-100 text-emerald-800",
    ok: "bg-sky-100 text-sky-800",
    warn: "bg-amber-100 text-amber-800",
    bad: "bg-rose-100 text-rose-800",
    neutral: "bg-slate-100 text-slate-700",
    info: "bg-indigo-100 text-indigo-800",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${c}`}>{children}</span>;
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  type?: "button" | "submit";
}) {
  const v = {
    primary: "bg-bnb text-ink hover:bg-[#f8c933] shadow-sm disabled:bg-slate-200 disabled:text-slate-400",
    secondary: "bg-ink text-white hover:bg-black disabled:bg-slate-300",
    ghost: "bg-transparent text-slate-700 hover:bg-black/5 disabled:text-slate-300",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed ${v} ${className}`}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums text-ink">{value}</p>
      {sub ? <p className="text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-label="Loading" />;
}

export function ErrorBox({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-[15px] text-rose-900">
      <p className="font-semibold">Hmm, that didn&apos;t work</p>
      <div className="mt-1">{children}</div>
      {onRetry ? (
        <button onClick={onRetry} className="mt-3 text-sm font-semibold text-rose-700 underline">
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function StockLogo({ ticker, color, logoUrl, size = 44 }: { ticker: string; color: string; logoUrl?: string | null; size?: number }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={ticker} width={size} height={size} className="shrink-0 rounded-xl bg-white object-contain" />;
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl font-bold text-white"
      style={{ background: color, width: size, height: size, fontSize: size * 0.3 }}
      aria-hidden
    >
      {ticker.slice(0, 4)}
    </div>
  );
}

export function ExtLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`font-semibold text-amber-700 underline decoration-amber-300 underline-offset-2 hover:text-amber-900 ${className}`}>
      {children}
    </a>
  );
}

export function SectionTitle({ step, title, subtitle }: { step: number; title: string; subtitle?: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Step {step} of 9</p>
      <h2 className="mt-1 text-2xl font-extrabold leading-tight text-ink sm:text-3xl">{title}</h2>
      {subtitle ? <p className="mt-1 text-[15px] text-slate-600">{subtitle}</p> : null}
    </div>
  );
}
