"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useConfig } from "wagmi";
import { readContract, watchAsset } from "wagmi/actions";
import { erc20Abi, type Hex } from "viem";
import { Badge, Button, Card, DemoChip, ErrorBox, Explainer, ExtLink, SectionTitle, Spinner, Stat, StockLogo } from "../ui";
import { ShareSlice } from "../ShareMath";
import { QuoteTimer } from "../QuoteTimer";
import { ShareCard } from "../ShareCard";
import { VerifiedBadge } from "../IssuerCompare";
import type { QuoteState } from "@/lib/client/useQuote";
import { friendlyClientError } from "@/lib/client/useQuote";
import type { StockOption } from "@/lib/stocks";
import type { QuoteRoute, SimulateData, SwapData, TxDetail } from "@/lib/types";
import { api, ApiError, unwrap } from "@/lib/client/api";
import { executeTrade, INITIAL_STEPS, normalizeTypedData, pickRoute, type RouteChoice, type StepState, type TradeResult } from "@/lib/client/trade";
import { BSC_CHAIN_ID, BSCSCAN, SLIPPAGE_CHOICES, USDT_BSC, usdToUnits } from "@/lib/constants";
import { shortAddr, units, unitsToNumber, usd } from "@/lib/format";
import { classifySimFail, friendlyError, friendlySimFail } from "@/lib/explain";

const errMsg = (e: unknown) => friendlyClientError(e);

function routeLabel(r: { executionMode: string; vendorName: string }) {
  return r.executionMode === "RFQ"
    ? { kind: "RFQ", title: "Market maker (RFQ)", desc: "A professional trader quotes you a firm price and fills it." }
    : { kind: "AMM", title: "Liquidity pool (AMM)", desc: "You trade against a shared pool of tokens; price moves with size." };
}

/* ───────────── Step 6: quote ───────────── */
export function StepQuote(p: {
  demo: boolean;
  stock: StockOption;
  wallet: `0x${string}` | null;
  walletIsDemo: boolean;
  amountUsd: number;
  setAmountUsd: (n: number) => void;
  slippage: string;
  setSlippage: (s: string) => void;
  q: QuoteState;
  /** Connect panel / network guard / preflight, rendered above the options. */
  guard?: ReactNode;
  /** False while the wallet is on the wrong network: no quote is fetched or shown. */
  canQuote: boolean;
}) {
  const { stock, wallet, amountUsd, q } = p;
  const amounts = stock.platformId === "ondo" ? [25, 50] : [5, 10, 25];
  const route = pickRoute(q.routes, q.choice ?? undefined);
  const quotedTokens = route ? unitsToNumber(route.toTokenAmount, Number(route.toToken.decimal || stock.decimals || 18)) : null;
  const estTokens = Number(stock.tokenPrice) > 0 ? amountUsd / Number(stock.tokenPrice) : null;
  const ratio = Number(stock.tokenToShareRatio ?? 1) || 1;

  return (
    <div className="space-y-4">
      <SectionTitle step={6} title={`Get a price for $${amountUsd}`} subtitle="A quote is a price promise that lasts about 30 seconds." />

      {p.guard}

      <ShareSlice usd={amountUsd} tokens={quotedTokens ?? estTokens} estimate={!quotedTokens} symbol={stock.symbol} ticker={stock.ticker} name={stock.name} ratio={ratio} />

      <Card>
        <p className="text-sm font-semibold">How much?</p>
        <div className="mt-2 flex gap-2">
          {amounts.map((a) => (
            <button
              key={a}
              onClick={() => p.setAmountUsd(a)}
              className={`flex-1 rounded-xl py-3 text-lg font-bold ring-1 ${amountUsd === a ? "bg-ink text-white ring-ink" : "bg-white ring-black/10"}`}
            >
              ${a}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">Paid in USDT (a digital dollar) on BNB Chain.{stock.platformId === "ondo" ? " Ondo has a minimum order size of around $20." : ""}</p>

        <p className="mt-4 text-sm font-semibold">Price wiggle room (slippage)</p>
        <div className="mt-2 flex gap-2">
          {SLIPPAGE_CHOICES.map((s) => (
            <button
              key={s}
              onClick={() => p.setSlippage(s)}
              className={`flex-1 rounded-xl py-2 font-semibold ring-1 ${p.slippage === s ? "bg-ink text-white ring-ink" : "bg-white ring-black/10"}`}
            >
              {s}%
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          If the price moves against you by more than this before your order goes through, it&apos;s cancelled instead — so you never pay more than you agreed to.
        </p>
      </Card>

      {wallet && p.canQuote ? (
        <Card>
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold">Your options</p>
            <div className="flex items-center gap-2">
              <DemoChip show={p.demo} />
              <QuoteTimer secondsLeft={q.secondsLeft} loading={q.loading} onRefresh={() => void q.refresh()} />
            </div>
          </div>
          {p.walletIsDemo ? <p className="mt-1 text-xs text-amber-700">Demo wallet {shortAddr(wallet)} · sample quote shaped like the real API, priced from the live token price.</p> : null}
          {q.error ? (
            <div className="mt-3">
              <ErrorBox onRetry={() => void q.refresh()}>{q.error}</ErrorBox>
            </div>
          ) : null}
          <div className="mt-3 space-y-3">
            {q.loading && q.routes.length === 0 ? (
              <div className="flex items-center gap-2 p-4 text-slate-500">
                <Spinner /> Asking market makers and pools…
              </div>
            ) : null}
            {q.routes.map((r) => {
              const l = routeLabel(r);
              const dec = Number(r.toToken.decimal || 18);
              const out = unitsToNumber(r.toTokenAmount, dec);
              const inUsd = unitsToNumber(r.fromTokenAmount, Number(r.fromToken.decimal || 18));
              const effPrice = out > 0 ? inUsd / out : NaN;
              const active = q.choice?.mode === r.executionMode && q.choice?.vendor === r.vendorName;
              return (
                <button
                  key={r.quoteId}
                  onClick={() => q.setChoice({ mode: r.executionMode, vendor: r.vendorName })}
                  className={`w-full rounded-2xl border-2 p-4 text-left transition ${active ? "border-bnb bg-amber-50/50" : "border-slate-100 bg-white hover:border-slate-200"} ${q.loading ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={l.kind === "RFQ" ? "info" : "ok"}>{l.kind}</Badge>
                      <span className="font-bold">{l.title}</span>
                    </div>
                    {r.isBest ? <Badge tone="good">Best price</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{l.desc}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">You get</p>
                      <p className="font-bold tabular-nums">
                        {units(r.toTokenAmount, dec)} {r.toToken.tokenSymbol}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Price / token</p>
                      <p className="font-bold tabular-nums">{usd(effPrice)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Network fee</p>
                      <p className="font-bold tabular-nums">{r.executionMode === "RFQ" ? "Paid by MM" : r.tradeFee ? usd(r.tradeFee) : "a few cents"}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    via {r.vendorName}
                    {r.dexRouterList?.[0] ? ` · ${r.dexRouterList.map((d) => d.dexProtocol.dexName).join(" → ")}` : ""}
                    {r.priceImpactPercent && isFinite(Number(r.priceImpactPercent)) ? ` · price impact ${Number(r.priceImpactPercent).toFixed(2)}%` : ""}
                  </p>
                </button>
              );
            })}
          </div>
          {q.routes.length ? (
            <p className="mt-3 text-xs text-slate-500">⏱ When the timer hits zero we fetch a fresh price automatically — you&apos;ll never sign an expired one.</p>
          ) : null}
        </Card>
      ) : null}

      <Explainer title="AMM vs RFQ, in plain English">
        <p>
          <b>AMM (liquidity pool):</b> like a currency-exchange booth with a pile of both tokens. The more you buy, the more the price shifts — that&apos;s
          &ldquo;price impact&rdquo;. You pay a small network fee yourself.
        </p>
        <p>
          <b>RFQ (request for quote):</b> like phoning a dealer. A professional market maker gives you one firm price, you sign the order, and they deliver the
          tokens. For tokenized stocks this is often the better price, and you just sign — the market maker pays the network fee.
        </p>
        <p>We&apos;ve picked the best one for you. You can tap the other to compare.</p>
      </Explainer>
    </div>
  );
}

/* ───────────── Step 7: simulate (dry-run) ───────────── */
type SimResult = {
  route: QuoteRoute;
  approve?: { spender: string; sim: SimulateData | null; error?: string; skipped?: boolean };
  swap?: { data: SwapData; sim: SimulateData | null; error?: string };
  typed?: { primaryType: string; domainName?: string; fields: [string, string][]; error?: string };
};

function tokenName(addr: string, stock: StockOption) {
  if (!addr) return { sym: "BNB", dec: 18 };
  if (addr.toLowerCase() === USDT_BSC.toLowerCase()) return { sym: "USDT", dec: 18 };
  if (addr.toLowerCase() === stock.address.toLowerCase()) return { sym: stock.symbol, dec: stock.decimals || 18 };
  return { sym: shortAddr(addr), dec: 18 };
}

const KNOWN_SPENDERS: Record<string, string> = {
  "0x000000000022d473030f116ddee9f6b43ac78ba3": "Permit2",
  "0x111111125421ca6dc452d289314280a0f8842a65": "1inch Router",
};

function addrLabel(addr: string, stock: StockOption) {
  const a = addr.toLowerCase();
  if (KNOWN_SPENDERS[a]) return `${KNOWN_SPENDERS[a]} (${shortAddr(addr)})`;
  if (a === USDT_BSC.toLowerCase()) return `USDT (${shortAddr(addr)})`;
  if (a === stock.address.toLowerCase()) return `${stock.symbol} (${shortAddr(addr)})`;
  return shortAddr(addr);
}

function prettyField(k: string, v: string, stock: StockOption) {
  if (/^0x[0-9a-fA-F]{40}$/.test(v)) return addrLabel(v, stock);
  if (/deadline|expir/i.test(k) && /^\d{10}$/.test(v)) return new Date(Number(v) * 1000).toLocaleTimeString();
  if (/amount/i.test(k) && /^\d{10,}$/.test(v)) return units(v, 18);
  return v;
}

function flatten(obj: unknown, prefix = "", out: [string, string][] = []): [string, string][] {
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else out.push([prefix, String(obj)]);
  return out;
}

export type SimStatus = "idle" | "loading" | "ready" | "error";
export function StepSimulate(p: {
  demo: boolean;
  stock: StockOption;
  wallet: `0x${string}` | null;
  amountUsd: number;
  slippage: string;
  choice: RouteChoice | null;
  onStatus: (s: SimStatus) => void;
  guard?: ReactNode;
}) {
  const { stock, wallet, amountUsd, slippage, choice, demo } = p;
  const onStatus = p.onStatus;
  const onReady = useCallback((ok: boolean) => onStatus(ok ? "ready" : "error"), [onStatus]);
  const config = useConfig();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<SimResult | null>(null);
  const [softNotes, setSoftNotes] = useState<string[]>([]);

  const run = useCallback(async () => {
    if (!wallet) {
      setLoading(false);
      setError(null);
      setRes(null);
      onStatus("idle");
      return;
    }
    setLoading(true);
    setError(null);
    setSoftNotes([]);
    onStatus("loading");
    const notes: string[] = [];
    try {
      const amount = usdToUnits(amountUsd);
      let routes: QuoteRoute[] = [];
      try {
        routes = unwrap(await api.quote({ token: stock.address, amount, wallet }));
      } catch (e) {
        const msg = errMsg(e);
        setError(msg);
        notes.push(msg);
        setSoftNotes(notes);
        onReady(false);
        return;
      }
      const route = pickRoute(routes, choice ?? undefined);
      if (!route) {
        const msg = "No price available right now. Try again in a moment, or pick another stock.";
        setError(msg);
        onReady(false);
        return;
      }
      const out: SimResult = { route };

      // 1) Approval dry-run (exact amount). Soft-fail — never block the whole step.
      try {
        const apprList = unwrap(await api.approve({ amount, vendor: route.executionMode === "RFQ" ? route.vendorName : undefined }));
        const appr = apprList[0];
        if (!appr) throw new ApiError(50000, "No approve payload");
        let allowanceOk = false;
        if (!demo) {
          try {
            const a = await readContract(config, { address: USDT_BSC, abi: erc20Abi, functionName: "allowance", args: [wallet, appr.dexContractAddress as Hex], chainId: BSC_CHAIN_ID });
            allowanceOk = a >= BigInt(amount);
          } catch {
            /* ignore, simulate anyway */
          }
        }
        if (allowanceOk) {
          out.approve = { spender: appr.dexContractAddress, sim: null, skipped: true };
        } else {
          const s = await api.simulate({ from: wallet, to: USDT_BSC, data: appr.data, value: "0" });
          if (s.code === 0 && s.data) {
            out.approve = {
              spender: appr.dexContractAddress,
              sim: s.data,
              error: s.data.status === "SUCCESS" ? undefined : friendlySimFail(s.data.failReason),
            };
          } else {
            out.approve = { spender: appr.dexContractAddress, sim: null, error: friendlyError(s.code, s.msg) };
            notes.push("Couldn't dry-run the approval — we'll still ask for it before a real trade.");
          }
        }
      } catch (e) {
        out.approve = { spender: "", sim: null, error: errMsg(e) };
        notes.push("Approval preview unavailable. We'll still request permission safely before you buy.");
      }

      // 2) Build the real trade payload + simulate (SWAP) or show typed data (RFQ).
      try {
        const swap = unwrap(
          await api.swap({
            token: stock.address,
            amount,
            wallet,
            quoteId: route.quoteId,
            slippage,
            route: demo ? (route.executionMode === "RFQ" ? `RFQ:${route.vendorName}` : "SWAP") : undefined,
          }),
        );
        if (swap.executionMode === "SWAP" && swap.tx) {
          const s = await api.simulate(
            { from: wallet, to: swap.tx.to, data: swap.tx.data, value: swap.tx.value },
            { amountIn: amount, tokenOut: stock.address, amountOut: swap.routerResult.toTokenAmount },
          );
          if (s.code === 0 && s.data) {
            const kind = classifySimFail(s.data.failReason);
            // Expected rehearsal failures (no USDT / no allowance) are soft — not blockers.
            const expected = s.data.status !== "SUCCESS" && (kind === "allowance" || kind === "balance");
            out.swap = {
              data: swap,
              sim: s.data,
              error: s.data.status === "SUCCESS" ? undefined : friendlySimFail(s.data.failReason),
            };
            if (expected) {
              notes.push(
                kind === "balance"
                  ? "Rehearsal used a wallet without enough USDT — that's expected until you top up."
                  : "Rehearsal shows the swap needs the permission above first — we'll do that for you.",
              );
            }
          } else {
            out.swap = { data: swap, sim: null, error: friendlyError(s.code, s.msg) };
            notes.push("Swap dry-run unavailable. Your money is safe — nothing was sent.");
          }
        } else if (swap.rfq) {
          out.swap = { data: swap, sim: null };
          try {
            const t = JSON.parse(normalizeTypedData(swap.rfq.typedDataToSign)) as { primaryType: string; domain: { name?: string }; message: unknown };
            out.typed = { primaryType: t.primaryType, domainName: t.domain?.name, fields: flatten(t.message).slice(0, 12) };
          } catch (e) {
            out.typed = { primaryType: "Order", fields: [], error: "Couldn't decode the order preview, but the live step will show it in your wallet." };
            notes.push(errMsg(e));
          }
        } else {
          out.swap = { data: swap, sim: null, error: "No swap transaction or order came back. Try refreshing." };
        }
      } catch (e) {
        notes.push(errMsg(e));
        // Keep route so the UI still explains AMM vs RFQ; allow continue so confirm can re-quote.
        out.swap = undefined;
      }

      setRes(out);
      setSoftNotes(notes);
      // Soft-ready: we have a route. Confirm will re-check balances / quotes before any real spend.
      onReady(true);
    } catch (e) {
      setError(errMsg(e));
      onReady(false);
    } finally {
      setLoading(false);
    }
  }, [stock.address, wallet, amountUsd, slippage, choice, onReady, onStatus, demo, config]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-change; state is set after await
    void run();
  }, [run]);

  const swapFailKind = res?.swap?.sim?.status && res.swap.sim.status !== "SUCCESS" ? classifySimFail(res.swap.sim.failReason) : null;

  return (
    <div className="space-y-4">
      <SectionTitle step={7} title="Dress rehearsal" subtitle="We test the trade first. Nothing is sent and no money moves." />
      <Explainer>
        <p>
          Before you spend a cent, we ask Binance&apos;s simulator to <b>pretend</b> to run your exact transaction on BNB Chain and tell us what would happen to your
          balances. It&apos;s like a flight simulator for your money.
        </p>
      </Explainer>

      {p.guard}

      {loading ? (
        <div className="flex items-center gap-2 p-6 text-slate-500">
          <Spinner /> Running the simulation…
        </div>
      ) : error && !res ? (
        <ErrorBox onRetry={() => void run()}>{error}</ErrorBox>
      ) : res ? (
        <>
          {softNotes.length ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {softNotes.map((n, i) => (
                <p key={i} className={i ? "mt-1" : ""}>
                  {n}
                </p>
              ))}
            </div>
          ) : null}

          {res.approve ? (
            <Card>
              <div className="flex items-center justify-between">
                <p className="font-bold">① Permission to spend USDT</p>
                <DemoChip show={demo} />
              </div>
              {res.approve.skipped ? (
                <p className="mt-1 text-sm text-slate-600">✅ You&apos;ve already given permission — this step will be skipped.</p>
              ) : res.approve.error && !res.approve.sim ? (
                <p className="mt-1 text-sm text-amber-800">{res.approve.error}</p>
              ) : res.approve.sim ? (
                <>
                  <p className="mt-1 text-sm text-slate-600">
                    {res.approve.sim.status === "SUCCESS" ? (
                      <>
                        ✅ Would succeed. It lets {addrLabel(res.approve.spender, stock)} take <b>exactly ${amountUsd} USDT</b> — not a cent more.
                      </>
                    ) : (
                      <>⏳ {friendlySimFail(res.approve.sim.failReason)}</>
                    )}
                  </p>
                  {res.approve.sim.allowanceChanges.map((a, i) => (
                    <div key={i} className="mt-2 rounded-xl bg-slate-50 p-3 text-sm">
                      USDT permission: <b>{units(a.preAmount, 18)}</b> → <b>{units(a.postAmount, 18)}</b>
                    </div>
                  ))}
                </>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <div className="flex items-center justify-between">
              <p className="font-bold">② The {res.route.executionMode === "RFQ" ? "order" : "swap"} itself</p>
              <Badge tone={res.route.executionMode === "RFQ" ? "info" : "ok"}>{res.route.executionMode === "RFQ" ? "RFQ" : "AMM"}</Badge>
            </div>
            {res.swap?.sim ? (
              <>
                <p className="mt-1 text-sm">
                  {res.swap.sim.status === "SUCCESS"
                    ? "✅ Would succeed. Here's what would change in your wallet:"
                    : swapFailKind === "allowance" || swapFailKind === "balance"
                      ? `⏳ ${friendlySimFail(res.swap.sim.failReason)}`
                      : `❌ ${friendlySimFail(res.swap.sim.failReason)}`}
                </p>
                {res.swap.sim.status === "SUCCESS" ? (
                  <ul className="mt-2 space-y-2">
                    {res.swap.sim.balanceChanges
                      .filter((b) => b.owner.toLowerCase() === wallet!.toLowerCase())
                      .map((b, i) => {
                        const t = tokenName(b.contractAddress, stock);
                        const neg = b.change.startsWith("-");
                        return (
                          <li key={i} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                            <span className="text-sm">{t.sym === "BNB" ? "Network fee (BNB)" : t.sym}</span>
                            <span className={`font-bold tabular-nums ${neg ? "text-rose-700" : "text-emerald-700"}`}>
                              {neg ? "−" : "+"}
                              {units(b.change.replace("-", ""), t.dec)} {t.sym}
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                ) : null}
              </>
            ) : res.swap?.error ? (
              <p className="mt-1 text-sm text-amber-800">{res.swap.error}</p>
            ) : res.typed ? (
              <>
                <p className="mt-1 text-sm text-slate-600">
                  RFQ orders aren&apos;t a transaction you send — you <b>sign a message</b> (free) and the market maker settles it on-chain. So instead of a simulation,
                  here&apos;s exactly what your signature would authorize:
                </p>
                <div className="mt-2 rounded-xl bg-slate-50 p-3 text-sm">
                  <p>
                    <b>{res.typed.primaryType}</b>
                    {res.typed.domainName ? ` · ${res.typed.domainName}` : ""}
                  </p>
                  {res.typed.error ? <p className="text-amber-800">{res.typed.error}</p> : null}
                  <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
                    {res.typed.fields.map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-slate-500">{k}</dt>
                        <dd className="truncate">{prettyField(k, v, stock)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Stat label="You pay" value={`${units(res.swap!.data.routerResult.fromTokenAmount, 18)} USDT`} />
                  <Stat label="You receive" value={`${units(res.swap!.data.routerResult.toTokenAmount, stock.decimals)} ${stock.symbol}`} />
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm text-slate-600">
                We locked a {res.route.executionMode} price via {res.route.vendorName}. The dry-run preview wasn&apos;t available, but nothing was sent — you can continue and
                we&apos;ll re-check before any real trade.
              </p>
            )}
          </Card>
          <p className="text-center text-sm text-slate-500">🛟 Nothing has been sent. This was only a rehearsal.</p>
        </>
      ) : null}
    </div>
  );
}

/* ───────────── Step 8: confirm & execute ───────────── */
export function StepConfirm(p: {
  demo: boolean;
  stock: StockOption;
  wallet: `0x${string}` | null;
  walletIsDemo: boolean;
  amountUsd: number;
  slippage: string;
  q: QuoteState;
  /** Network guard / preflight / connect panel. */
  guard?: ReactNode;
  /** Reason the Buy button is blocked (wrong network, missing funds…), shown under it. */
  blockedReason: string | null;
  onRunningChange: (running: boolean) => void;
  onDone: (r: TradeResult) => void;
}) {
  const config = useConfig();
  const [agree, setAgree] = useState(false);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepState[]>(INITIAL_STEPS);
  const [error, setError] = useState<string | null>(null);
  const { q } = p;
  const route = pickRoute(q.routes, q.choice ?? undefined);
  const dec = Number(route?.toToken.decimal || p.stock.decimals || 18);
  const minOut = route ? (BigInt(route.toTokenAmount) * BigInt(Math.round((100 - Number(p.slippage)) * 100))) / 10000n : null;
  const liveNoWallet = !p.demo && (!p.wallet || p.walletIsDemo);

  const go = async () => {
    if (!p.wallet || !q.choice) return;
    setRunning(true);
    p.onRunningChange(true);
    setError(null);
    setSteps(INITIAL_STEPS);
    try {
      const r = await executeTrade(
        config,
        { token: p.stock.address as `0x${string}`, tokenSymbol: p.stock.symbol, tokenDecimals: dec, amount: usdToUnits(p.amountUsd), slippage: p.slippage, route: q.choice, wallet: p.wallet, demo: p.demo },
        (key, patch) => setSteps((s) => s.map((x) => (x.key === key ? { ...x, ...patch } : x))),
      );
      p.onDone(r);
    } catch (e) {
      setError(errMsg(e));
      setSteps((s) => s.map((x) => (x.status === "doing" ? { ...x, status: "error" } : x)));
    } finally {
      setRunning(false);
      p.onRunningChange(false);
    }
  };

  const disabled = !agree || running || liveNoWallet || !q.choice || !!p.blockedReason;

  return (
    <div className="space-y-4">
      <SectionTitle step={8} title="Ready? Let's buy it" subtitle="Last check before anything real happens." />
      {p.guard}
      <Card>
        <div className="flex items-center gap-3">
          <StockLogo ticker={p.stock.ticker} color={p.stock.color} logoUrl={p.stock.logoUrl} />
          <div className="min-w-0">
            <p className="font-bold">
              {p.stock.name} · {p.stock.symbol}
            </p>
            <p className="text-sm text-slate-500">{route ? routeLabel(route).title : ""}</p>
          </div>
          <div className="ml-auto flex flex-col items-end gap-1">
            <DemoChip show={p.demo} />
            <VerifiedBadge stock={p.stock} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Stat label="You pay" value={`$${p.amountUsd} USDT`} />
          <Stat label="You get (about)" value={route ? `${units(route.toTokenAmount, dec)}` : "—"} sub={p.stock.symbol} />
          <Stat label="Guaranteed minimum" value={minOut !== null ? units(minOut, dec) : "—"} sub={`with ${p.slippage}% wiggle room`} />
          <Stat label="Network fee" value={route?.executionMode === "RFQ" ? "~$0.03 approval only" : route?.tradeFee ? `≈ ${usd(route.tradeFee)}` : "a few cents"} sub="paid in BNB" />
        </div>
        {!running ? (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span>Price shown is refreshed automatically. When you tap Buy we lock a brand-new one.</span>
            <QuoteTimer secondsLeft={q.secondsLeft} loading={q.loading} onRefresh={() => void q.refresh()} />
          </div>
        ) : null}
      </Card>

      {!running && !error ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-amber-300 bg-white p-4 shadow-sm" data-testid="risk-check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#f0b90b]" />
          <span className="text-[15px] text-slate-800">
            <b>One quick risk check:</b> I understand <b>this can go down, and it&apos;s not a broker account.</b>
            <span className="mt-1 block text-sm text-slate-500">
              {p.demo
                ? "Demo: no real wallet pop-ups, no real money, and the signature and transaction are pretend."
                : `You're about to spend real money ($${p.amountUsd} USDT) and approve it in your wallet.`}
            </span>
          </span>
        </label>
      ) : null}

      {running || error || steps.some((s) => s.status !== "todo") ? (
        <Card>
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={s.key} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">
                  {s.status === "done" ? "✓" : s.status === "doing" ? <Spinner className="h-4 w-4" /> : s.status === "skipped" ? "–" : s.status === "error" ? "!" : i + 1}
                </span>
                <div className="min-w-0">
                  <p className={`text-[15px] font-semibold ${s.status === "todo" ? "text-slate-400" : s.status === "error" ? "text-rose-700" : ""}`}>{s.label}</p>
                  {s.detail ? <p className="break-words text-sm text-slate-500">{s.detail}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {error ? <ErrorBox>{error}</ErrorBox> : null}

      <Button className="w-full text-lg" disabled={disabled} onClick={() => void go()}>
        {running ? (
          <>
            <Spinner /> Working on it…
          </>
        ) : error ? (
          "Try again"
        ) : (
          `${p.demo ? "Demo buy" : "Buy"} $${p.amountUsd} of ${p.stock.ticker}`
        )}
      </Button>
      {p.blockedReason ? <p className="-mt-2 text-center text-sm font-medium text-rose-700">{p.blockedReason}</p> : !agree && !running && !error ? <p className="-mt-2 text-center text-xs text-slate-500">Tick the risk check above to continue.</p> : null}
      <Explainer>
        <p>
          {q.choice?.mode === "RFQ"
            ? "Your wallet will pop up up to twice: first a one-time permission for exactly this much USDT (a tiny BNB fee), then an order to sign (free). Read each one before tapping Confirm."
            : "Your wallet will pop up up to twice: first a one-time permission for exactly this much USDT, then the swap itself. Each costs a few cents of BNB."}
        </p>
        <p>Never share your recovery phrase with anyone — no real app will ever ask for it.</p>
      </Explainer>
    </div>
  );
}

/* ───────────── Step 9: receipt ───────────── */
export function StepReceipt({ demo, stock, wallet, result, onRestart }: { demo: boolean; stock: StockOption; wallet: `0x${string}`; result: TradeResult; onRestart: () => void }) {
  const config = useConfig();
  const [detail, setDetail] = useState<TxDetail | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const got = unitsToNumber(result.amountOut, stock.decimals || 18);
  const ratio = Number(stock.tokenToShareRatio ?? 1) || 1;
  const shares = got * ratio;
  const paid = unitsToNumber(result.amountIn, 18);
  const pricePaid = got > 0 ? paid / got : NaN;

  useEffect(() => {
    if (!result.txHash) return;
    let stop = false;
    const load = async (tries: number) => {
      const r = await api.tx(result.txHash!, demo ? { wallet, token: stock.address, in: result.amountIn, out: result.amountOut ?? undefined } : undefined);
      if (stop) return;
      if (r.code === 0 && r.data && r.data.length) setDetail(r.data[0]);
      else if (tries < 6) setTimeout(() => void load(tries + 1), 3000); // indexing can lag a few seconds
    };
    void load(0);
    return () => {
      stop = true;
    };
  }, [result, demo, wallet, stock.address]);

  const addToWallet = async () => {
    try {
      await watchAsset(config, { type: "ERC20", options: { address: stock.address as Hex, symbol: stock.symbol.slice(0, 11), decimals: stock.decimals || 18 } });
      setAdded("Added! Look for it in your wallet's token list.");
    } catch (e) {
      setAdded(errMsg(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl bg-ink p-6 text-center text-white">
        <Confetti />
        <p className="text-xs font-bold uppercase tracking-wider text-bnb">Step 9 of 9</p>
        <div className="animate-pop mx-auto mt-3 flex h-20 w-20 items-center justify-center rounded-full bg-bnb text-4xl">🎉</div>
        <h2 className="mt-4 text-3xl font-extrabold">You own a piece of {stock.name}!</h2>
        <p className="mt-2 text-lg">
          <b className="tabular-nums">{units(result.amountOut, stock.decimals || 18)}</b> {stock.symbol}
        </p>
        <p className="mt-1 text-sm text-white/70">
          That&apos;s {(shares * 100).toLocaleString("en-US", { maximumFractionDigits: 3 })}% of one {stock.ticker} share, for {units(result.amountIn, 18)} USDT.
        </p>
        {demo ? <p className="mt-3 inline-block rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-200">Demo — no real transaction happened</p> : null}
      </div>

      <Card>
        <p className="font-bold">Your receipt</p>
        <dl className="mt-2 divide-y divide-slate-100 text-sm">
          <Row k="Route" v={result.mode === "RFQ" ? `Market maker (RFQ) · ${result.vendor}` : `Liquidity pool (AMM) · ${result.vendor}`} />
          <Row k="Price paid" v={`${usd(pricePaid)} per ${stock.symbol}`} />
          {result.orderId ? <Row k="Order ID" v={result.orderId} /> : null}
          {demo && result.signature ? <Row k="Signature" v={<span className="font-mono">{shortAddr(result.signature)} (rehearsed)</span>} /> : null}
          {result.txHash ? (
            <Row
              k={demo ? "Transaction (demo)" : "Transaction"}
              v={demo ? <span className="font-mono">{shortAddr(result.txHash)}</span> : <ExtLink href={`${BSCSCAN}/tx/${result.txHash}`}>{shortAddr(result.txHash)} on BscScan ↗</ExtLink>}
            />
          ) : null}
          {result.approveTxHash ? <Row k="Approval" v={<ExtLink href={`${BSCSCAN}/tx/${result.approveTxHash}`}>{shortAddr(result.approveTxHash)} ↗</ExtLink>} /> : null}
          {detail ? <Row k="Status" v={detail.txStatus === "success" ? "✅ Confirmed" : detail.txStatus} /> : null}
          {detail ? <Row k="Block" v={Number(detail.height).toLocaleString()} /> : null}
          {detail ? <Row k="Network fee" v={`${detail.txFee} BNB`} /> : null}
          {demo ? null : <Row k="Token" v={<ExtLink href={`${BSCSCAN}/token/${stock.address}?a=${wallet}`}>{stock.symbol} in your wallet ↗</ExtLink>} />}
        </dl>
        {demo ? <p className="mt-2 text-xs text-amber-700">Demo receipt: the signature and transaction hash are random and were never sent, so there&apos;s no BscScan link.</p> : null}
        {!demo ? (
          <Button variant="secondary" className="mt-4 w-full" onClick={() => void addToWallet()}>
            Show {stock.symbol} in my wallet
          </Button>
        ) : null}
        {added ? <p className="mt-2 text-sm text-slate-600">{added}</p> : null}
      </Card>

      <ShareSlice usd={paid} tokens={got} symbol={stock.symbol} ticker={stock.ticker} name={stock.name} ratio={ratio} />

      <div>
        <p className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">Share your first buy</p>
        <ShareCard name={stock.name} ticker={stock.ticker} symbol={stock.symbol} color={stock.color} usdIn={paid} tokensOut={got} txHash={result.txHash} demo={demo} />
      </div>

      <Explainer title="What now?">
        <p>
          🧘 <b>Relax.</b> Your token tracks {stock.name}&apos;s share price. It will go up and down — that&apos;s normal.
        </p>
        <p>
          🔐 <b>It&apos;s yours.</b> It lives in your wallet, not in this app. Keep your recovery phrase offline and private.
        </p>
        <p>
          🔁 <b>Selling</b> works the same way in reverse (token → USDT), during market hours.
        </p>
      </Explainer>
      <Button variant="ghost" className="w-full" onClick={onRestart}>
        Start again with another stock
      </Button>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-slate-500">{k}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{v}</dd>
    </div>
  );
}

function Confetti() {
  const colors = ["#f0b90b", "#22c55e", "#3b82f6", "#ef4444", "#a855f7"];
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {Array.from({ length: 28 }).map((_, i) => (
        <span key={i} className="confetti-piece" style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 7) * 0.12}s` }} />
      ))}
    </div>
  );
}
