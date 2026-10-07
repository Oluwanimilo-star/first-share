"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConfig } from "wagmi";
import { Badge, Button, Card, DemoChip, ErrorBox, Explainer, SectionTitle, Spinner, Stat } from "./ui";
import { WalletButton } from "./WalletButton";
import type { HoldingRow } from "./Holdings";
import { friendlyClientError } from "@/lib/client/useQuote";
import { api, unwrap } from "@/lib/client/api";
import { executeTrade, initialSteps, pickRoute, type RouteChoice, type StepState, type TradeResult } from "@/lib/client/trade";
import { DEFAULT_SLIPPAGE, NATIVE_BNB, SLIPPAGE_CHOICES, USDT_BSC } from "@/lib/constants";
import { shortAddr, units, usd } from "@/lib/format";
import { REASON_COPY, STATUS_COPY } from "@/lib/explain";
import type { QuoteRoute } from "@/lib/types";
import type { StockOption as StockOpt } from "@/lib/stocks";

type PayOut = "USDT" | "BNB" | "STOCK";

const errMsg = (e: unknown) => friendlyClientError(e);

function pctAmount(bal: bigint, pct: number): string {
  return ((bal * BigInt(Math.round(pct * 100))) / 10000n).toString();
}

export function SellPanel(p: {
  demo: boolean;
  wallet: `0x${string}` | null;
  walletIsDemo: boolean;
  holding: HoldingRow;
  stocks: StockOpt[];
  onBack: () => void;
  onDone: (r: TradeResult) => void;
}) {
  const { holding, demo, wallet } = p;
  const stock = holding.stock;
  const config = useConfig();

  const [out, setOut] = useState<PayOut>("USDT");
  const [toStock, setToStock] = useState<StockOpt | null>(null);
  const [pct, setPct] = useState(100);
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const [routes, setRoutes] = useState<QuoteRoute[]>([]);
  const [choice, setChoice] = useState<RouteChoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marketNote, setMarketNote] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepState[]>(initialSteps("sell"));
  const [execError, setExecError] = useState<string | null>(null);

  const amount = useMemo(() => pctAmount(holding.balance, pct), [holding.balance, pct]);
  const toAddress = out === "USDT" ? USDT_BSC : out === "BNB" ? NATIVE_BNB : toStock?.address ?? null;

  // Market hours soft-check
  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const b = await api.stock(stock.address);
        if (stop) return;
        const si = b.market.data?.statusInfo;
        if (!si) {
          setMarketNote(null);
          return;
        }
        const status = si.marketStatus;
        const copy = STATUS_COPY[status];
        const reason = si.reasonCode ? REASON_COPY[si.reasonCode] : null;
        if (!si.openState || status === "closed" || status === "pause") {
          setMarketNote(`${copy?.emoji ?? "🔒"} ${copy?.label ?? "Closed"}. ${reason ?? copy?.text ?? "Selling may be refused until the market reopens."}`);
        } else if (status === "premarket" || status === "postmarket" || status === "overnight") {
          setMarketNote(`${copy.emoji} ${copy.label}. ${copy.text}`);
        } else {
          setMarketNote(null);
        }
      } catch {
        setMarketNote(null);
      }
    })();
    return () => {
      stop = true;
    };
  }, [stock.address]);

  const fetchQuote = useCallback(async () => {
    if (!wallet || !toAddress || BigInt(amount) <= 0n) return;
    setLoading(true);
    setError(null);
    try {
      const routes = unwrap(await api.quote({ from: stock.address, to: toAddress, amount, wallet }));
      setRoutes(routes);
      const best = pickRoute(routes);
      setChoice(best ? { mode: best.executionMode, vendor: best.vendorName } : null);
    } catch (e) {
      setRoutes([]);
      setChoice(null);
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [wallet, toAddress, amount, stock.address]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-change; state is set after await
    void fetchQuote();
  }, [fetchQuote]);

  const route = pickRoute(routes, choice ?? undefined);
  const outDec = out === "USDT" || out === "BNB" ? 18 : toStock?.decimals || 18;
  const outSym = out === "USDT" ? "USDT" : out === "BNB" ? "BNB" : toStock?.symbol ?? "token";

  const go = async () => {
    if (!wallet || !choice || !toAddress) return;
    setRunning(true);
    setExecError(null);
    setSteps(initialSteps(out === "STOCK" ? "swap" : "sell"));
    try {
      const r = await executeTrade(
        config,
        {
          token: stock.address as `0x${string}`,
          tokenSymbol: stock.symbol,
          tokenDecimals: ("decimals" in stock ? stock.decimals : 18) || 18,
          amount,
          slippage,
          route: choice,
          wallet,
          demo,
          fromToken: stock.address as `0x${string}`,
          toToken: toAddress as `0x${string}`,
          fromSymbol: stock.symbol,
          toSymbol: outSym,
          intent: out === "STOCK" ? "swap" : "sell",
        },
        (key, patch) => setSteps((s) => s.map((x) => (x.key === key ? { ...x, ...patch } : x))),
      );
      p.onDone(r);
    } catch (e) {
      const m = errMsg(e);
      setExecError(/rejected|denied|User rejected/i.test(m) ? "You cancelled in your wallet. No problem — nothing was spent." : m);
      setSteps((s) => s.map((x) => (x.status === "doing" ? { ...x, status: "error" } : x)));
    } finally {
      setRunning(false);
    }
  };

  const swapTargets = p.stocks.filter((s) => s.address.toLowerCase() !== stock.address.toLowerCase()).slice(0, 24);

  return (
    <div className="space-y-4">
      <SectionTitle title={`Sell ${stock.symbol}`} subtitle="Same path as buying — just flipped. USDT, BNB, or another stock." />

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold">
              {stock.name} · {stock.symbol}
            </p>
            <p className="text-sm text-slate-600 tabular-nums">
              You hold {units(holding.balance, 18)}
              {holding.usdValue != null ? ` · ≈ ${usd(holding.usdValue)}` : ""}
            </p>
          </div>
          <DemoChip show={demo} />
        </div>

        <p className="mt-4 text-sm font-semibold">How much to sell?</p>
        <div className="mt-2 flex gap-2">
          {[25, 50, 100].map((n) => (
            <button
              key={n}
              onClick={() => setPct(n)}
              className={`flex-1 rounded-xl py-3 font-bold ring-1 ${pct === n ? "bg-ink text-white ring-ink" : "bg-white ring-black/10"}`}
            >
              {n}%
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500 tabular-nums">
          Selling {units(amount, 18)} {stock.symbol}
        </p>

        <p className="mt-4 text-sm font-semibold">Receive</p>
        <div className="mt-2 flex gap-2">
          {(
            [
              ["USDT", "USDT"],
              ["BNB", "BNB"],
              ["STOCK", "Other stock"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setOut(k)}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold ring-1 ${out === k ? "bg-ink text-white ring-ink" : "bg-white ring-black/10"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {out === "STOCK" ? (
          <div className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-xl bg-slate-50 p-2">
            {swapTargets.map((s) => (
              <button
                key={s.address}
                onClick={() => setToStock(s)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${toStock?.address === s.address ? "bg-bnb font-bold" : "hover:bg-white"}`}
              >
                <span>
                  {s.ticker} · {s.symbol}
                </span>
                <span className="text-xs text-slate-500">{s.name}</span>
              </button>
            ))}
          </div>
        ) : null}

        <p className="mt-4 text-sm font-semibold">Price wiggle room</p>
        <div className="mt-2 flex gap-2">
          {SLIPPAGE_CHOICES.map((s) => (
            <button
              key={s}
              onClick={() => setSlippage(s)}
              className={`flex-1 rounded-xl py-2 font-semibold ring-1 ${slippage === s ? "bg-ink text-white ring-ink" : "bg-white ring-black/10"}`}
            >
              {s}%
            </button>
          ))}
        </div>
      </Card>

      {marketNote ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{marketNote}</div>
      ) : null}

      {!wallet ? (
        <Card>
          <div id="connect" className="space-y-3">
            <p className="font-bold">Connect your wallet to sell</p>
            <WalletButton />
          </div>
        </Card>
      ) : (
        <Card>
          <div className="flex items-center justify-between">
            <p className="font-bold">Quote</p>
            <button onClick={() => void fetchQuote()} className="text-sm font-semibold text-amber-700" disabled={loading}>
              {loading ? <Spinner className="h-4 w-4" /> : "↻ Refresh"}
            </button>
          </div>
          {p.walletIsDemo ? <p className="mt-1 text-xs text-amber-700">Demo wallet ({shortAddr(wallet)}).</p> : null}
          {error ? (
            <div className="mt-3">
              <ErrorBox onRetry={() => void fetchQuote()}>{error}</ErrorBox>
            </div>
          ) : null}
          {loading && !routes.length ? (
            <div className="mt-3 flex items-center gap-2 text-slate-500">
              <Spinner /> Asking for a sell price…
            </div>
          ) : null}
          {route ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Stat label="You sell" value={`${units(route.fromTokenAmount, 18)} ${stock.symbol}`} />
              <Stat label="You get (about)" value={`${units(route.toTokenAmount, outDec)} ${outSym}`} />
              <Stat label="Route" value={route.executionMode === "RFQ" ? "Market maker" : "Liquidity pool"} sub={route.vendorName} />
              <Stat
                label="Network fee"
                value={route.executionMode === "RFQ" ? "Paid by MM" : route.tradeFee ? usd(route.tradeFee) : "a few cents"}
              />
            </div>
          ) : null}
          {routes.length > 1 ? (
            <div className="mt-3 space-y-2">
              {routes.map((r) => {
                const active = choice?.mode === r.executionMode && choice?.vendor === r.vendorName;
                return (
                  <button
                    key={r.quoteId}
                    onClick={() => setChoice({ mode: r.executionMode, vendor: r.vendorName })}
                    className={`flex w-full items-center justify-between rounded-xl border-2 p-3 text-left ${active ? "border-bnb bg-amber-50/50" : "border-slate-100"}`}
                  >
                    <span className="flex items-center gap-2">
                      <Badge tone={r.executionMode === "RFQ" ? "info" : "ok"}>{r.executionMode}</Badge>
                      <span className="text-sm font-semibold">{r.vendorName}</span>
                    </span>
                    <span className="text-sm font-bold tabular-nums">
                      {units(r.toTokenAmount, outDec)} {outSym}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </Card>
      )}

      {!running && !execError ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-5 w-5 accent-[#f0b90b]" />
          <span className="text-[15px] text-slate-700">
            {demo
              ? "I understand this is a demo sell: no real wallet pop-ups and no real money moves."
              : "I understand this sells real tokens from my wallet, and I'll approve in my wallet."}
          </span>
        </label>
      ) : null}

      {running || execError || steps.some((s) => s.status !== "todo") ? (
        <Card>
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={s.key} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">
                  {s.status === "done" ? "✓" : s.status === "doing" ? <Spinner className="h-4 w-4" /> : s.status === "skipped" ? "–" : s.status === "error" ? "!" : i + 1}
                </span>
                <div>
                  <p className={`text-[15px] font-semibold ${s.status === "todo" ? "text-slate-400" : s.status === "error" ? "text-rose-700" : ""}`}>{s.label}</p>
                  {s.detail ? <p className="text-sm text-slate-500">{s.detail}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {execError ? <ErrorBox>{execError}</ErrorBox> : null}

      <div className="flex gap-2">
        <Button variant="ghost" onClick={p.onBack}>
          ← Back
        </Button>
        <Button className="flex-1" disabled={!agree || running || !wallet || !choice || (out === "STOCK" && !toStock)} onClick={() => void go()}>
          {running ? (
            <>
              <Spinner /> Working…
            </>
          ) : execError ? (
            "Try again"
          ) : (
            `Sell ${units(amount, 18)} ${stock.symbol}`
          )}
        </Button>
      </div>

      <Explainer>
        <p>
          Selling uses the same Trading API as buying: quote → approve the <b>stock token</b> → swap (or sign an RFQ). Market makers may refuse when the US exchange is
          closed — we&apos;ll show a clear reason instead of a cryptic error.
        </p>
      </Explainer>
    </div>
  );
}

/** Tiny receipt after a demo/live sell (stop before real sign in live smoke tests). */
export function SellReceipt(p: { demo: boolean; result: TradeResult; symbolIn: string; symbolOut: string; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-ink p-6 text-center text-white">
        <p className="text-xs font-bold uppercase tracking-wider text-bnb">Sold</p>
        <h2 className="mt-3 text-2xl font-extrabold">Trade submitted</h2>
        <p className="mt-2 text-sm text-white/70">
          {units(p.result.amountIn, 18)} {p.symbolIn} → {p.result.amountOut ? units(p.result.amountOut, 18) : "—"} {p.symbolOut}
        </p>
        {p.demo ? <p className="mt-3 inline-block rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-200">Demo — no real transaction</p> : null}
      </div>
      <Button className="w-full" onClick={p.onBack}>
        Back to holdings
      </Button>
    </div>
  );
}
