"use client";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { WalletButton } from "./WalletButton";
import { Button } from "./ui";
import { StepBacked, StepGap, StepMarket, StepPick, StepWhat } from "./steps/StepsLearn";
import { StepConfirm, StepQuote, StepReceipt, StepSimulate } from "./steps/StepsTrade";
import { api } from "@/lib/client/api";
import type { StockOption } from "@/lib/stocks";
import type { QuoteRoute, StockBundle } from "@/lib/types";
import type { RouteChoice, TradeResult } from "@/lib/client/trade";
import { BUY_AMOUNT_USD, DEFAULT_SLIPPAGE, DEMO_WALLET } from "@/lib/constants";
import { friendlyError } from "@/lib/explain";

const STEP_NAMES = ["Pick", "Learn", "Backed?", "Open?", "Fair price?", "Quote", "Rehearse", "Buy", "Done"];

export function Flow() {
  const [mode, setMode] = useState<{ demo: boolean; walletConnect: boolean } | null>(null);
  const [step, setStep] = useState(0);
  const [platform, setPlatform] = useState<"bstock" | "ondo">("bstock");
  const [stocks, setStocks] = useState<StockOption[]>([]);
  const [stocksLoading, setStocksLoading] = useState(true);
  const [stocksError, setStocksError] = useState<string | null>(null);
  const [stock, setStock] = useState<StockOption | null>(null);
  const [bundle, setBundle] = useState<StockBundle | null>(null);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [demoStatus, setDemoStatus] = useState<string | undefined>(undefined);
  const [amountUsd, setAmountUsd] = useState(BUY_AMOUNT_USD);
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const [routes, setRoutes] = useState<QuoteRoute[]>([]);
  const [choice, setChoice] = useState<RouteChoice | null>(null);
  const [simReady, setSimReady] = useState(false);
  const [result, setResult] = useState<TradeResult | null>(null);

  const { address } = useAccount();
  const demo = mode?.demo ?? true;
  const wallet: `0x${string}` | null = address ?? (demo ? DEMO_WALLET : null);
  const walletIsDemo = !address && demo;

  useEffect(() => {
    api.mode().then(setMode).catch(() => setMode({ demo: true, walletConnect: false }));
  }, []);

  const loadStocks = useCallback(async () => {
    setStocksLoading(true);
    setStocksError(null);
    try {
      const r = await api.stocks(platform, demoStatus);
      if (r.code !== 0 && r.stocks.every((s) => !s.inApi)) setStocksError(`${friendlyError(r.code, r.msg)} Showing the built-in list instead.`);
      setStocks(r.stocks);
    } catch (e) {
      setStocksError((e as Error).message);
    } finally {
      setStocksLoading(false);
    }
  }, [platform, demoStatus]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-change; state is set after await
    void loadStocks();
  }, [loadStocks]);

  const loadBundle = useCallback(async () => {
    if (!stock) return;
    setBundleLoading(true);
    setBundleError(null);
    try {
      const b = await api.stock(stock.address, demoStatus);
      setBundle(b);
      const bad = [b.profile, b.market].find((x) => x.code !== 0);
      if (bad) setBundleError(friendlyError(bad.code, bad.msg));
    } catch (e) {
      setBundleError((e as Error).message);
    } finally {
      setBundleLoading(false);
    }
  }, [stock, demoStatus]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-change; state is set after await
    void loadBundle();
  }, [loadBundle]);

  const selectStock = (s: StockOption) => {
    setStock(s);
    setRoutes([]);
    setChoice(null);
    setResult(null);
    setAmountUsd(s.platformId === "ondo" ? 25 : BUY_AMOUNT_USD);
  };

  const changePlatform = (pl: "bstock" | "ondo") => {
    setPlatform(pl);
    setStock(null);
  };

  const restart = () => {
    setStep(0);
    setStock(null);
    setRoutes([]);
    setChoice(null);
    setResult(null);
    setSimReady(false);
  };

  const go = (n: number) => {
    setStep(n);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const canNext =
    (step === 0 && !!stock) ||
    (step >= 1 && step <= 4) ||
    (step === 5 && !!choice && routes.length > 0) ||
    (step === 6 && simReady);

  const nextLabel = ["Learn about it", "Is it backed?", "Can I buy now?", "Is the price fair?", "Get a quote", "Rehearse the trade", "Looks good — continue"][step];

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-[#f7f7f5]/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={restart} className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-bnb text-lg font-black text-ink">1</span>
            <span className="text-lg font-extrabold tracking-tight">First Share</span>
          </button>
          <WalletButton compact />
        </div>
        <div className="px-4 pb-3">
          <div className="flex gap-1">
            {STEP_NAMES.map((n, i) => (
              <div key={n} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-bnb" : "bg-black/10"}`} title={n} />
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {STEP_NAMES[step]}
            {stock ? ` · ${stock.name}` : ""}
          </p>
        </div>
      </header>

      {mode ? (
        mode.demo ? (
          <div className="mx-4 mt-3 rounded-xl border border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <b>Demo mode</b> — prices, quotes and trades below are realistic <b>demo data</b>. No real money moves. Add API keys to go live.
          </div>
        ) : (
          <div className="mx-4 mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <b>Live</b> on BNB Smart Chain — real prices, real trades.
          </div>
        )
      ) : null}

      <main className="flex-1 px-4 py-5 pb-32">
        {step === 0 && (
          <StepPick demo={demo} platform={platform} setPlatform={changePlatform} stocks={stocks} loading={stocksLoading} error={stocksError} retry={loadStocks} selected={stock} onSelect={selectStock} />
        )}
        {step === 1 && stock && <StepWhat stock={stock} demo={demo} />}
        {step === 2 && stock && <StepBacked stock={stock} bundle={bundle} loading={bundleLoading && !bundle} error={bundleError} retry={loadBundle} />}
        {step === 3 && stock && <StepMarket stock={stock} bundle={bundle} loading={bundleLoading && !bundle} error={bundleError} retry={loadBundle} demoStatus={demoStatus} setDemoStatus={setDemoStatus} />}
        {step === 4 && stock && <StepGap stock={stock} bundle={bundle} />}
        {step === 5 && stock && (
          <StepQuote
            demo={demo}
            stock={stock}
            wallet={wallet}
            walletIsDemo={walletIsDemo}
            amountUsd={amountUsd}
            setAmountUsd={setAmountUsd}
            slippage={slippage}
            setSlippage={setSlippage}
            routes={routes}
            setRoutes={setRoutes}
            choice={choice}
            setChoice={setChoice}
          />
        )}
        {step === 6 && stock && wallet && <StepSimulate demo={demo} stock={stock} wallet={wallet} amountUsd={amountUsd} slippage={slippage} choice={choice} onReady={setSimReady} />}
        {step === 7 && stock && (
          <StepConfirm
            demo={demo}
            stock={stock}
            wallet={wallet}
            walletIsDemo={walletIsDemo}
            amountUsd={amountUsd}
            slippage={slippage}
            choice={choice}
            routes={routes}
            onDone={(r) => {
              setResult(r);
              go(8);
            }}
          />
        )}
        {step === 8 && stock && wallet && result && <StepReceipt demo={demo} stock={stock} wallet={wallet} result={result} onRestart={restart} />}
      </main>

      {step < 7 ? (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-2xl gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => go(step - 1)}>
                ← Back
              </Button>
            ) : null}
            <Button className="flex-1" disabled={!canNext} onClick={() => go(step + 1)}>
              {step === 0 && !stock ? "Pick a stock to continue" : `${nextLabel} →`}
            </Button>
          </div>
        </nav>
      ) : step === 7 ? (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-2xl px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button variant="ghost" onClick={() => go(6)}>
              ← Back
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
