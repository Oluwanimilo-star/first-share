"use client";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { WalletButton } from "./WalletButton";
import { Button, Spinner } from "./ui";
import { StepBacked, StepGap, StepMarket, StepPick, StepWhat } from "./steps/StepsLearn";
import { StepConfirm, StepQuote, StepReceipt, StepSimulate, type SimStatus } from "./steps/StepsTrade";
import { Holdings, type HoldingRow } from "./Holdings";
import { SellPanel, SellReceipt } from "./SellPanel";
import { ConnectNavButton, ConnectPanel, DemoToggle, NetworkGuard, PreflightCard, useNetworkState, usePreflight, WalletSheetNotice, GEO_LINE } from "./Guards";
import { api, rememberDemoHints, setClientDemo } from "@/lib/client/api";
import { useQuote } from "@/lib/client/useQuote";
import { recordBuy } from "@/lib/client/ledger";
import type { StockOption } from "@/lib/stocks";
import type { StockBundle } from "@/lib/types";
import type { TradeResult } from "@/lib/client/trade";
import { BUY_AMOUNT_USD, DEFAULT_SLIPPAGE, DEMO_WALLET, isNativeBnb, USDT_BSC } from "@/lib/constants";
import { friendlyError } from "@/lib/explain";
import { shortAddr, unitsToNumber } from "@/lib/format";

const STEP_NAMES = ["Pick", "Learn", "Backed?", "Open?", "Fair price?", "Quote", "Rehearse", "Buy", "Done"];
const DEMO_KEY = "firstshare:demo";

type View = "buy" | "holdings" | "sell" | "sell-done";

export function Flow() {
  const [mode, setMode] = useState<{ demo: boolean; walletConnect: boolean } | null>(null);
  const [userDemo, setUserDemo] = useState(false);
  const [view, setView] = useState<View>("buy");
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
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
  const [simStatus, setSimStatus] = useState<SimStatus>("idle");
  const [simKey, setSimKey] = useState(0);
  const [executing, setExecuting] = useState(false);
  const [demoEmpty, setDemoEmpty] = useState(false);
  const [result, setResult] = useState<TradeResult | null>(null);
  const [sellHolding, setSellHolding] = useState<HoldingRow | null>(null);
  const [sellResult, setSellResult] = useState<TradeResult | null>(null);

  const { address } = useAccount();
  const serverDemo = mode?.demo ?? true;
  // "Try demo" (client toggle) wins over a connected wallet: pretend address, pretend balances,
  // mocked quote/sign/receipt. The server's own demo mode (no API keys) keeps the old behaviour.
  const demo = serverDemo || userDemo;
  const wallet: `0x${string}` | null = userDemo ? DEMO_WALLET : (address ?? (serverDemo ? DEMO_WALLET : null));
  const walletIsDemo = userDemo || (!address && serverDemo);
  // Must be set before children fire requests (child effects run before parent effects).
  setClientDemo(userDemo);

  const net = useNetworkState(walletIsDemo);
  const quote = useQuote({
    wallet,
    token: stock?.address ?? null,
    amountUsd,
    enabled: view === "buy" && !!stock && !!wallet && !net.wrong && (step === 5 || (step === 7 && !executing && !result)),
  });
  const preflight = usePreflight({ wallet, isDemo: walletIsDemo, demoEmpty, amountUsd, enabled: view === "buy" && step >= 5 && step <= 7 });

  useEffect(() => {
    api.mode().then(setMode).catch(() => setMode({ demo: true, walletConnect: false }));
    // ?demo=1 (handy link for judges) or a previous choice in this tab.
    const fromUrl = new URLSearchParams(window.location.search).get("demo");
    const saved = window.sessionStorage.getItem(DEMO_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser-only prefs after hydration
    if (fromUrl === "1" || (fromUrl !== "0" && saved === "1")) setUserDemo(true);
  }, []);

  const resetTrade = useCallback(() => {
    quote.reset();
    setResult(null);
    setSimStatus("idle");
  }, [quote]);

  const toggleDemo = (on: boolean) => {
    setClientDemo(on);
    setUserDemo(on);
    try {
      window.sessionStorage.setItem(DEMO_KEY, on ? "1" : "0");
    } catch {
      /* private mode */
    }
    resetTrade();
    setDemoEmpty(false);
    if (step > 5) setStep(5);
    if (view === "sell" || view === "sell-done") setView("holdings");
  };

  const loadStocks = useCallback(async () => {
    setStocksLoading(true);
    setStocksError(null);
    try {
      const r = await api.stocks(platform, demoStatus);
      if (r.code !== 0 && r.stocks.every((s) => !s.inApi)) setStocksError(`${friendlyError(r.code, r.msg)} Showing the built-in list instead.`);
      rememberDemoHints(r.stocks);
      setStocks(r.stocks);
    } catch {
      setStocksError("We couldn't load the stock list just now. Please check your connection and try again.");
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
      if (b.profile?.code !== 0 && b.market?.code !== 0) setBundleError(friendlyError(b.profile?.code ?? -1, b.profile?.msg ?? ""));
    } catch {
      setBundle(null);
      setBundleError("We couldn't load the details for this token just now.");
    } finally {
      setBundleLoading(false);
    }
  }, [stock, demoStatus]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-change; state is set after await
    void loadBundle();
  }, [loadBundle]);

  const selectStock = (s: StockOption) => {
    if (s.address !== stock?.address) {
      resetTrade();
      setBundle(null);
      setMaxStep(0);
    }
    setStock(s);
    setAmountUsd(s.platformId === "ondo" ? 25 : BUY_AMOUNT_USD);
  };

  const changePlatform = (pl: "bstock" | "ondo") => {
    setPlatform(pl);
    setStock(null);
    setMaxStep(0);
    resetTrade();
  };

  const restart = () => {
    setView("buy");
    setStep(0);
    setMaxStep(0);
    setStock(null);
    resetTrade();
    setSellHolding(null);
    setSellResult(null);
  };

  const go = (n: number) => {
    setStep(n);
    setMaxStep((m) => Math.max(m, n));
    setView("buy");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openHoldings = () => {
    setView("holdings");
    setSellHolding(null);
    setSellResult(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const hasQuote = !!quote.choice && quote.routes.length > 0;
  /** Which step pills can be tapped. Learning steps are free once a stock is picked. */
  const allowed = (i: number) =>
    i === 0 ||
    (i <= 5 && !!stock) ||
    (i === 6 && !!stock && hasQuote) ||
    (i === 7 && !!stock && hasQuote && (maxStep >= 7 || simStatus === "ready")) ||
    (i === 8 && !!result);

  const guardFor = (s: 5 | 6 | 7) =>
    !wallet ? (
      <ConnectPanel
        title={s === 6 ? "Connect your wallet to run the dress rehearsal" : "Connect your wallet to get a real quote"}
        why={
          s === 6
            ? "We only need your public address so the simulator knows whose balances to check. Nothing is signed or sent."
            : "Market makers need to know who they're quoting. Connecting only shares your public address."
        }
        onTryDemo={() => toggleDemo(true)}
      />
    ) : net.wrong ? (
      <NetworkGuard chainName={net.chainName} />
    ) : s === 6 ? null : (
      <PreflightCard pf={preflight} amountUsd={amountUsd} isDemo={walletIsDemo} demoEmpty={demoEmpty} setDemoEmpty={setDemoEmpty} compact={s === 7} />
    );

  const blockedReason = net.wrong
    ? "Switch your wallet to BNB Smart Chain first."
    : preflight.status === "missing"
      ? "Top up first — see the preflight check above."
      : !quote.choice && !quote.loading && quote.error
        ? "No price right now — tap the timer to try again."
        : null;

  /* ── bottom navigation: never a dead button without a reason ── */
  const nextLabels = ["Learn about it", "Is it backed?", "Can I buy now?", "Is the price fair?", "Get a quote", "Rehearse the trade", "Looks good — continue"];
  let nav: React.ReactNode = null;
  if (view === "buy" && step < 7) {
    let primary: React.ReactNode;
    let extra: React.ReactNode = null;
    if (step === 0) {
      primary = (
        <Button className="flex-1" disabled={!stock} onClick={() => go(1)}>
          {stock ? `${nextLabels[0]} →` : "Pick a stock to continue"}
        </Button>
      );
    } else if (step < 5) {
      primary = (
        <Button className="flex-1" onClick={() => go(step + 1)}>
          {nextLabels[step]} →
        </Button>
      );
    } else if (!wallet) {
      primary = <ConnectNavButton className="flex-1" label={step === 5 ? "Connect wallet to rehearse" : "Connect wallet to continue"} />;
      extra = (
        <Button variant="secondary" className="!px-3" onClick={() => toggleDemo(true)}>
          Try demo
        </Button>
      );
    } else if (net.wrong) {
      primary = (
        <Button className="flex-1" onClick={() => document.querySelector("[data-network-guard]")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
          Switch to BNB Chain first ↑
        </Button>
      );
    } else if (step === 5) {
      primary = hasQuote ? (
        <Button className="flex-1" onClick={() => go(6)}>
          {nextLabels[5]} →
        </Button>
      ) : quote.loading ? (
        <Button className="flex-1" disabled>
          <Spinner className="h-4 w-4" /> Getting your price…
        </Button>
      ) : (
        <Button className="flex-1" onClick={() => void quote.refresh()}>
          Try the quote again ↻
        </Button>
      );
    } else {
      primary =
        simStatus === "ready" ? (
          <Button className="flex-1" onClick={() => go(7)}>
            {nextLabels[6]} →
          </Button>
        ) : simStatus === "error" ? (
          <Button className="flex-1" onClick={() => setSimKey((k) => k + 1)}>
            Run the rehearsal again ↻
          </Button>
        ) : (
          <Button className="flex-1" disabled>
            <Spinner className="h-4 w-4" /> Rehearsing…
          </Button>
        );
    }
    nav = (
      <>
        {step > 0 ? (
          <Button variant="ghost" className="!px-3" onClick={() => go(step - 1)}>
            ← Back
          </Button>
        ) : null}
        {primary}
        {extra}
      </>
    );
  } else if (view === "buy" && step === 7) {
    nav = (
      <Button variant="ghost" onClick={() => go(6)} disabled={executing}>
        ← Back
      </Button>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <WalletSheetNotice />
      <header className="sticky top-0 z-20 border-b border-black/5 bg-[#f7f7f5]/90 backdrop-blur">
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <button onClick={restart} className="flex items-center gap-2" aria-label="First Share — start over">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-bnb text-lg font-black text-ink">1</span>
            <span className="hidden text-lg font-extrabold tracking-tight min-[430px]:inline">First Share</span>
          </button>
          <div className="flex items-center gap-2">
            <DemoToggle on={userDemo} onChange={toggleDemo} />
            {userDemo ? null : <WalletButton compact />}
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 pt-2">
          {(["buy", "holdings"] as const).map((v) => {
            const active = v === "buy" ? view === "buy" : view !== "buy";
            return (
              <button
                key={v}
                onClick={() => (v === "buy" ? (setView("buy"), window.scrollTo({ top: 0, behavior: "smooth" })) : openHoldings())}
                className={`rounded-full px-3 py-1 text-sm font-semibold ${active ? "bg-ink text-white" : "bg-white text-slate-700 ring-1 ring-black/10"}`}
              >
                {v === "buy" ? "Buy" : "Holdings"}
              </button>
            );
          })}
          <p className="ml-auto truncate text-xs text-slate-500">
            {view === "buy" ? (
              <>
                {STEP_NAMES[step]}
                {stock ? ` · ${stock.name}` : ""}
              </>
            ) : view === "holdings" ? (
              "Holdings"
            ) : view === "sell" ? (
              "Sell / swap"
            ) : (
              "Sold"
            )}
          </p>
        </div>
        {view === "buy" ? (
          <nav aria-label="Steps" className="flex gap-1 px-4 pb-3 pt-2">
            {STEP_NAMES.map((n, i) => {
              const ok = allowed(i) && !executing;
              const current = i === step;
              return (
                <button
                  key={n}
                  onClick={() => ok && go(i)}
                  disabled={!ok}
                  title={ok ? `Go to step ${i + 1}: ${n}` : `Step ${i + 1}: ${n} (not yet)`}
                  aria-label={`Step ${i + 1}: ${n}`}
                  aria-current={current ? "step" : undefined}
                  className={`flex h-7 flex-1 items-center justify-center rounded-full text-[11px] font-bold transition ${
                    current ? "bg-ink text-white" : i <= maxStep ? "bg-bnb text-ink hover:brightness-95" : ok ? "bg-amber-100 text-amber-900 hover:bg-amber-200" : "bg-black/5 text-slate-400"
                  }`}
                >
                  <span className="sm:hidden">{i + 1}</span>
                  <span className="hidden truncate px-1 sm:inline">{n}</span>
                </button>
              );
            })}
          </nav>
        ) : (
          <div className="pb-3" />
        )}
      </header>

      {userDemo ? (
        <div className="mx-4 mt-3 rounded-xl border border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="demo-banner">
          <div className="flex items-start justify-between gap-2">
            <p>
              <b>Demo mode</b> — pretend wallet <span className="font-mono">{shortAddr(DEMO_WALLET)}</span> with $25 USDT + 0.012 BNB of play money.
              {serverDemo ? " Prices are demo data" : " Prices and market data are live"}; the quote, signature and receipt are simulated. <b>No real transaction.</b>
            </p>
            <button onClick={() => toggleDemo(false)} className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold ring-1 ring-amber-300">
              Exit demo
            </button>
          </div>
        </div>
      ) : mode ? (
        mode.demo ? (
          <div className="mx-4 mt-3 rounded-xl border border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <b>Demo mode</b> — prices, quotes and trades below are realistic <b>demo data</b>. No real money moves. Add API keys to go live.
          </div>
        ) : (
          <div className="mx-4 mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <b>Live</b> on BNB Smart Chain — real prices, real trades.{" "}
            {!address ? (
              <>
                No wallet?{" "}
                <button className="font-semibold underline" onClick={() => toggleDemo(true)}>
                  Try the demo
                </button>
                .
              </>
            ) : null}
            <span className="mt-0.5 block text-xs text-emerald-900/70">{GEO_LINE}</span>
          </div>
        )
      ) : null}

      <main className="flex-1 px-4 py-5 pb-32">
        {view === "holdings" && (
          <Holdings
            demo={demo}
            wallet={wallet}
            walletIsDemo={walletIsDemo}
            extraStocks={stocks}
            onTryDemo={() => toggleDemo(true)}
            onBuy={() => {
              setView("buy");
              setStep(0);
            }}
            onSell={(h) => {
              setSellHolding(h);
              setView("sell");
            }}
          />
        )}
        {view === "sell" && sellHolding && (
          <SellPanel
            demo={demo}
            wallet={wallet}
            walletIsDemo={walletIsDemo}
            holding={sellHolding}
            stocks={stocks}
            onBack={() => setView("holdings")}
            onDone={(r) => {
              setSellResult(r);
              setView("sell-done");
            }}
          />
        )}
        {view === "sell-done" && sellResult && sellHolding && (
          <SellReceipt
            demo={demo}
            result={sellResult}
            symbolIn={sellHolding.stock.symbol}
            symbolOut={sellResult.toToken.toLowerCase() === USDT_BSC.toLowerCase() ? "USDT" : isNativeBnb(sellResult.toToken) ? "BNB" : "token"}
            onBack={() => {
              setView("holdings");
              setSellResult(null);
            }}
          />
        )}

        {view === "buy" && step === 0 && (
          <StepPick
            key={platform}
            demo={serverDemo}
            platform={platform}
            setPlatform={changePlatform}
            stocks={stocks}
            loading={stocksLoading}
            error={stocksError}
            retry={loadStocks}
            selected={stock}
            onSelect={selectStock}
          />
        )}
        {view === "buy" && step === 1 && stock && <StepWhat stock={stock} bundle={bundle} serverDemo={serverDemo} amountUsd={amountUsd} />}
        {view === "buy" && step === 2 && stock && <StepBacked stock={stock} bundle={bundle} loading={bundleLoading && !bundle} error={bundleError} retry={loadBundle} />}
        {view === "buy" && step === 3 && stock && (
          <StepMarket stock={stock} bundle={bundle} loading={bundleLoading && !bundle} error={bundleError} retry={loadBundle} demoStatus={demoStatus} setDemoStatus={setDemoStatus} />
        )}
        {view === "buy" && step === 4 && stock && <StepGap stock={stock} bundle={bundle} />}
        {view === "buy" && step === 5 && stock && (
          <StepQuote
            demo={demo}
            stock={stock}
            wallet={wallet}
            walletIsDemo={walletIsDemo}
            amountUsd={amountUsd}
            setAmountUsd={setAmountUsd}
            slippage={slippage}
            setSlippage={setSlippage}
            q={quote}
            guard={guardFor(5)}
            canQuote={!net.wrong}
          />
        )}
        {view === "buy" && step === 6 && stock && (
          <StepSimulate
            key={simKey}
            demo={demo}
            stock={stock}
            wallet={net.wrong ? null : wallet}
            amountUsd={amountUsd}
            slippage={slippage}
            choice={quote.choice}
            onStatus={setSimStatus}
            guard={guardFor(6)}
          />
        )}
        {view === "buy" && step === 7 && stock && (
          <StepConfirm
            demo={demo}
            stock={stock}
            wallet={wallet}
            walletIsDemo={walletIsDemo}
            amountUsd={amountUsd}
            slippage={slippage}
            q={quote}
            guard={guardFor(7)}
            blockedReason={blockedReason}
            onRunningChange={setExecuting}
            onDone={(r) => {
              setResult(r);
              if (wallet && r.amountOut) {
                recordBuy(wallet, {
                  token: stock.address,
                  symbol: stock.symbol,
                  ticker: stock.ticker,
                  name: stock.name,
                  usdIn: unitsToNumber(r.amountIn, 18),
                  tokensOut: unitsToNumber(r.amountOut, stock.decimals || 18),
                  ts: Date.now(),
                  txHash: r.txHash,
                  demo: r.demo,
                });
              }
              go(8);
            }}
          />
        )}
        {view === "buy" && step === 8 && stock && wallet && result && (
          <StepReceipt demo={result.demo} stock={stock} wallet={wallet} result={result} onRestart={restart} />
        )}
        {view === "buy" && step === 8 && stock && wallet && result ? (
          <div className="mt-4">
            <Button className="w-full" variant="secondary" onClick={openHoldings}>
              View holdings →
            </Button>
          </div>
        ) : null}
        {view === "buy" && step === 8 && !result ? (
          <div className="space-y-3 text-center">
            <p className="text-slate-600">No purchase yet in this session.</p>
            <Button onClick={() => go(stock ? 5 : 0)}>Go to the quote</Button>
          </div>
        ) : null}
      </main>

      {nav ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-white/95 backdrop-blur" data-testid="bottom-nav">
          <div className="mx-auto flex max-w-2xl gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{nav}</div>
        </div>
      ) : null}
    </div>
  );
}
