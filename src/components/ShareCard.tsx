"use client";
import { useRef, useState } from "react";
import { BSCSCAN } from "@/lib/constants";
import { shortAddr } from "@/lib/format";
import { Button } from "./ui";

const SITE = "https://first-share-two.vercel.app";

export function ShareCard(p: {
  name: string;
  ticker: string;
  symbol: string;
  color: string;
  usdIn: number;
  tokensOut: number;
  txHash: string | null;
  demo: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const money = Number.isInteger(Math.round(p.usdIn * 100) / 100) ? `$${Math.round(p.usdIn)}` : `$${p.usdIn.toFixed(2)}`;
  const price = p.tokensOut > 0 ? p.usdIn / p.tokensOut : NaN;
  const priceStr = isFinite(price) ? price.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }) : "—";
  const tok = p.tokensOut.toLocaleString("en-US", { maximumSignificantDigits: 4 });
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const txUrl = !p.demo && p.txHash ? `${BSCSCAN}/tx/${p.txHash}` : null;
  const headline = `I bought my first ${money} of ${p.name}`;
  const text = p.demo
    ? `[Demo run — no real money] ${headline} 🎓 ${tok} ${p.symbol} at ${priceStr}/token, practised step by step with First Share on BNB Chain.`
    : `${headline} 🎉 ${tok} ${p.symbol} at ${priceStr}/token on BNB Chain.${txUrl ? ` Tx: ${txUrl}` : ""} Learned how with First Share.`;

  const download = async () => {
    if (!ref.current) return;
    setBusy(true);
    setMsg(null);
    try {
      const { toPng } = await import("html-to-image");
      let url: string;
      try {
        url = await toPng(ref.current, { pixelRatio: 2, cacheBust: true, backgroundColor: "#1e2026" });
      } catch {
        url = await toPng(ref.current, { pixelRatio: 2, skipFonts: true, backgroundColor: "#1e2026" });
      }
      const a = document.createElement("a");
      a.href = url;
      a.download = `first-share-${p.ticker.toLowerCase()}${p.demo ? "-demo" : ""}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMsg("Image saved — post it anywhere.");
    } catch {
      setMsg("Couldn't make the image on this browser. Try a screenshot instead!");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${SITE}`);
      setMsg("Copied! Paste it anywhere.");
    } catch {
      setMsg("Couldn't copy automatically — long-press the text above to copy it.");
    }
  };

  const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SITE)}`;

  return (
    <div className="space-y-3" data-testid="share-card">
      <div ref={ref} className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-30" style={{ background: p.color }} aria-hidden />
        <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-bnb opacity-20" aria-hidden />
        {p.demo ? (
          <div className="absolute right-[-44px] top-[18px] rotate-45 bg-amber-400 px-12 py-1 text-xs font-black tracking-widest text-ink" aria-label="Demo">
            DEMO
          </div>
        ) : null}
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-bnb text-base font-black text-ink">1</span>
            <span className="text-sm font-extrabold tracking-tight">First Share</span>
            <span className="ml-auto pr-10 text-xs text-white/60">{date}</span>
          </div>
          <p className="mt-5 text-[26px] font-extrabold leading-tight">{headline} 🎉</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-[11px] uppercase tracking-wider text-white/60">I own</p>
              <p className="text-lg font-bold tabular-nums">
                {tok} <span className="text-sm font-semibold">{p.symbol}</span>
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-[11px] uppercase tracking-wider text-white/60">Price per token</p>
              <p className="text-lg font-bold tabular-nums">{priceStr}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-white/70">
            {p.demo ? (
              "Demo run — no real money moved, no real transaction."
            ) : txUrl ? (
              <>On BNB Chain · bscscan.com/tx/{shortAddr(p.txHash)}</>
            ) : (
              "On BNB Chain"
            )}
          </p>
          <p className="mt-1 text-xs font-semibold text-bnb">first-share-two.vercel.app</p>
        </div>
      </div>
      <p className="rounded-xl bg-white p-3 text-sm text-slate-700 ring-1 ring-black/5" data-testid="share-text">
        {text}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" className="!px-2 !text-sm" onClick={() => void download()} disabled={busy}>
          {busy ? "Saving…" : "⬇ Save PNG"}
        </Button>
        <Button variant="secondary" className="!px-2 !text-sm" onClick={() => void copy()}>
          📋 Copy text
        </Button>
        <a
          href={xUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-black px-2 text-sm font-semibold text-white"
        >
          Share on 𝕏
        </a>
      </div>
      {txUrl ? (
        <p className="text-center text-sm">
          <a href={txUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-amber-700 underline">
            View on BscScan ↗
          </a>
        </p>
      ) : null}
      {msg ? <p className="text-center text-sm text-slate-600">{msg}</p> : null}
    </div>
  );
}
