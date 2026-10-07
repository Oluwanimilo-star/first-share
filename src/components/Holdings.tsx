"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConfig } from "wagmi";
import { getBalance, readContracts } from "wagmi/actions";
import { erc20Abi, formatUnits, type Hex } from "viem";
import { Badge, Button, Card, DemoChip, Explainer, SectionTitle, Spinner, Stat } from "./ui";
import { ConnectPanel } from "./Guards";
import { api } from "@/lib/client/api";
import { BSC_CHAIN_ID, USDT_BSC } from "@/lib/constants";
import { BNB_USD_ESTIMATE, DEMO_BNB_WEI, DEMO_POSITIONS, DEMO_USDT_WEI } from "@/lib/client/demoWallet";
import { costBasis, loadBuys, type BuyRecord } from "@/lib/client/ledger";
import { CURATED_STOCKS, ONDO_DEMO_STOCKS, type CuratedStock, type StockOption } from "@/lib/stocks";
import { shortAddr, units, usd } from "@/lib/format";

export type HoldingRow = {
  stock: CuratedStock | StockOption;
  balance: bigint;
  balanceStr: string;
  tokenPrice: number | null;
  usdValue: number | null;
};

const KNOWN: CuratedStock[] = [...CURATED_STOCKS, ...ONDO_DEMO_STOCKS];

export function Holdings(p: {
  demo: boolean;
  wallet: `0x${string}` | null;
  walletIsDemo: boolean;
  onSell: (h: HoldingRow) => void;
  onBuy: () => void;
  onTryDemo?: () => void;
  extraStocks?: StockOption[];
}) {
  const config = useConfig();
  const { wallet, walletIsDemo } = p;
  const [buys, setBuys] = useState<BuyRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bnb, setBnb] = useState<bigint | null>(null);
  const [usdt, setUsdt] = useState<bigint | null>(null);
  const [rows, setRows] = useState<HoldingRow[]>([]);
  const [bnbUsd, setBnbUsd] = useState(780);

  const catalog = useMemo(() => {
    const map = new Map<string, CuratedStock | StockOption>();
    for (const s of KNOWN) map.set(s.address.toLowerCase(), s);
    for (const s of p.extraStocks ?? []) map.set(s.address.toLowerCase(), s);
    return [...map.values()];
  }, [p.extraStocks]);

  const load = useCallback(async () => {
    if (!wallet) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const ledger = loadBuys(wallet);
    setBuys(ledger);
    try {
      let bnbBal = 0n;
      let usdtBal = 0n;
      const tokenBals: { address: string; bal: bigint }[] = [];

      if (walletIsDemo) {
        // Pretend wallet: starting positions + whatever was "bought" in demo runs.
        bnbBal = DEMO_BNB_WEI;
        usdtBal = DEMO_USDT_WEI;
        const pos = new Map<string, bigint>(Object.entries(DEMO_POSITIONS).map(([a, raw]) => [a.toLowerCase(), BigInt(raw)]));
        for (const b of ledger) {
          const raw = BigInt(Math.floor(b.tokensOut * 1e9)) * 10n ** 9n;
          pos.set(b.token, (pos.get(b.token) ?? 0n) + raw);
        }
        for (const [address, bal] of pos) tokenBals.push({ address, bal });
      } else {
        const bnbRes = await getBalance(config, { address: wallet, chainId: BSC_CHAIN_ID });
        bnbBal = bnbRes.value;
        const contracts = [
          { address: USDT_BSC, abi: erc20Abi, functionName: "balanceOf" as const, args: [wallet] as const, chainId: BSC_CHAIN_ID },
          ...catalog.map((s) => ({
            address: s.address as Hex,
            abi: erc20Abi,
            functionName: "balanceOf" as const,
            args: [wallet] as const,
            chainId: BSC_CHAIN_ID,
          })),
        ];
        const results = await readContracts(config, { allowFailure: true, contracts });
        usdtBal = (results[0]?.result as bigint | undefined) ?? 0n;
        catalog.forEach((s, i) => {
          const bal = (results[i + 1]?.result as bigint | undefined) ?? 0n;
          if (bal > 0n) tokenBals.push({ address: s.address, bal });
        });
      }

      setBnb(bnbBal);
      setUsdt(usdtBal);

      const addrs = tokenBals.map((t) => t.address);
      const priceMap = new Map<string, number>();
      if (addrs.length) {
        try {
          const pr = await api.prices(addrs);
          if (pr.code === 0 && Array.isArray(pr.data)) {
            for (const row of pr.data) {
              priceMap.set(row.tokenContractAddress.toLowerCase(), Number(row.tokenPrice));
            }
          }
        } catch {
          /* soft-fail prices */
        }
      }

      // Fallback: use list prices from extraStocks / curated tokenPrice if present
      const holdings: HoldingRow[] = tokenBals
        .map(({ address: addr, bal }) => {
          const rec = ledger.find((b) => b.token === addr.toLowerCase());
          const stock: CuratedStock | StockOption | undefined =
            catalog.find((s) => s.address.toLowerCase() === addr.toLowerCase()) ??
            (rec
              ? { ticker: rec.ticker, symbol: rec.symbol, name: rec.name, address: rec.token as `0x${string}`, platformId: /on$/.test(rec.symbol) ? "ondo" : "bstock", blurb: "", color: "#334155", kind: "Stock" }
              : undefined);
          if (!stock) return null;
          const price = priceMap.get(addr.toLowerCase()) ?? ("tokenPrice" in stock && stock.tokenPrice ? Number(stock.tokenPrice) : null);
          const qty = Number(formatUnits(bal, 18));
          return {
            stock,
            balance: bal,
            balanceStr: formatUnits(bal, 18),
            tokenPrice: price,
            usdValue: price != null && isFinite(price) ? qty * price : null,
          } satisfies HoldingRow;
        })
        .filter((x): x is HoldingRow => !!x)
        .sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0));

      setRows(holdings);
      setBnbUsd(BNB_USD_ESTIMATE);
    } catch {
      setError("We couldn't read your balances just now (the public BNB Chain node may be busy). Please try again.");
    } finally {
      setLoading(false);
    }
  }, [wallet, walletIsDemo, config, catalog]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-change
    void load();
  }, [load]);

  const totalUsd =
    (usdt != null ? Number(formatUnits(usdt, 18)) : 0) +
    (bnb != null ? Number(formatUnits(bnb, 18)) * bnbUsd : 0) +
    rows.reduce((a, r) => a + (r.usdValue ?? 0), 0);

  return (
    <div className="space-y-4">
      <SectionTitle title="Your holdings" subtitle="Balances on BNB Smart Chain for this connected wallet." />

      {!wallet ? (
        <ConnectPanel title="Connect your wallet to see holdings" why="We only read public balances — nothing is signed." onTryDemo={p.onTryDemo} />
      ) : (
        <>
          <Card>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-slate-500">Connected wallet</p>
                <p className="font-mono text-sm font-semibold">{shortAddr(wallet)}</p>
                {walletIsDemo ? <p className="mt-1 text-xs text-amber-700">Demo wallet — pretend balances (live prices).</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <DemoChip show={walletIsDemo || p.demo} />
                <button onClick={() => void load()} className="text-sm font-semibold text-amber-700" disabled={loading}>
                  {loading ? <Spinner className="h-4 w-4" /> : "↻ Refresh"}
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="BNB" value={bnb == null ? "—" : units(bnb, 18)} sub={bnb != null ? `≈ ${usd(Number(formatUnits(bnb, 18)) * bnbUsd)}` : undefined} />
              <Stat label="USDT" value={usdt == null ? "—" : units(usdt, 18)} sub="on BNB Chain" />
              <Stat label="Est. total" value={usd(totalUsd)} sub="BNB + USDT + stocks" />
            </div>
          </Card>

          {error ? (
            <Card>
              <p className="text-sm text-rose-700">{error}</p>
              <Button variant="ghost" className="mt-2" onClick={() => void load()}>
                Try again
              </Button>
            </Card>
          ) : null}

          <Card>
            <div className="flex items-center justify-between">
              <p className="font-bold">Tokenized stocks</p>
              <Badge tone="info">{rows.length}</Badge>
            </div>
            {loading && rows.length === 0 ? (
              <div className="mt-3 flex items-center gap-2 text-slate-500">
                <Spinner /> Reading balances…
              </div>
            ) : rows.length === 0 ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-slate-600">No tokenized stocks in this wallet yet (of the ones First Share knows about).</p>
                <Button className="w-full" onClick={p.onBuy}>
                  Buy your first share →
                </Button>
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {rows.map((r) => (
                  <li key={r.stock.address} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
                      style={{ background: r.stock.color }}
                    >
                      {r.stock.ticker.slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">
                        {r.stock.name} · {r.stock.symbol}
                      </p>
                      <p className="text-sm text-slate-600 tabular-nums">
                        {units(r.balance, 18)} {r.stock.symbol}
                        {r.usdValue != null ? ` · ≈ ${usd(r.usdValue)}` : ""}
                        {r.tokenPrice != null ? ` · ${usd(r.tokenPrice)}/token` : ""}
                      </p>
                      <PnL row={r} buys={buys} />
                    </div>
                    <Button variant="secondary" className="shrink-0 !min-h-10 !px-3 !text-sm" onClick={() => p.onSell(r)}>
                      Sell / swap
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {buys.length ? (
            <p className="text-xs text-slate-500">
              &ldquo;Paid&rdquo; and profit/loss come from buys made with First Share in this browser (stored only on this device).{" "}
              {walletIsDemo ? "Demo buys use pretend money but live prices." : ""}
            </p>
          ) : null}

          <Explainer title="Where do these live?">
            <p>
              These tokens sit in <b>your</b> wallet on BNB Chain — not in this app. Selling works the same way as buying, just in reverse (token → USDT or BNB), during
              market hours.
            </p>
          </Explainer>
        </>
      )}
    </div>
  );
}

/** "Paid $5.00 · now $5.04 · +$0.04 (+0.8%)" — only when we know the buy price. */
function PnL({ row, buys }: { row: HoldingRow; buys: BuyRecord[] }) {
  const cb = costBasis(buys, row.stock.address);
  if (!cb) return <p className="mt-0.5 text-xs text-slate-400">Price paid unknown (bought outside First Share)</p>;
  if (row.tokenPrice == null) return <p className="mt-0.5 text-xs text-slate-500">Paid {usd(cb.usdIn)} · avg {usd(cb.avgPrice)}/token</p>;
  // P/L on the tokens bought here (other tokens in the wallet have an unknown cost).
  const qty = Math.min(cb.tokens, Number(formatUnits(row.balance, 18)));
  const cost = qty * cb.avgPrice;
  const now = qty * row.tokenPrice;
  const pl = now - cost;
  const pct = cost > 0 ? (pl / cost) * 100 : 0;
  const up = pl >= 0;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs tabular-nums" data-testid="pnl">
      <span className="text-slate-600">
        Paid {usd(cost)} at {usd(cb.avgPrice)}
      </span>
      <span className="text-slate-400">→</span>
      <span className="text-slate-600">now {usd(now)}</span>
      <span className={`rounded-full px-2 py-0.5 font-bold ${up ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
        {up ? "▲ +" : "▼ −"}
        {usd(Math.abs(pl))} ({up ? "+" : "−"}
        {Math.abs(pct).toFixed(2)}%)
      </span>
      <span className="text-slate-400">unrealized</span>
    </p>
  );
}
