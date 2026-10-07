"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { StockOption } from "@/lib/stocks";
import type { StockBundle } from "@/lib/types";
import { BSCSCAN } from "@/lib/constants";
import { shortAddr } from "@/lib/format";
import { Badge, Card } from "./ui";

type Platform = "bstock" | "ondo";
const listCache = new Map<Platform, Promise<StockOption[]>>();
function loadList(pl: Platform): Promise<StockOption[]> {
  if (!listCache.has(pl)) {
    listCache.set(
      pl,
      api
        .stocks(pl)
        .then((r) => r.stocks.filter((s) => s.inApi))
        .catch(() => {
          listCache.delete(pl);
          return [];
        }),
    );
  }
  return listCache.get(pl)!;
}

const PROOF_SHORT: Record<string, string> = {
  dailyAttestationReport: "Daily attestation",
  monthlyAttestationReport: "Monthly attestation",
  collateralReport: "Collateral report",
};

function proofFrom(bundle: StockBundle | null): string | null {
  const pr = bundle?.profile.code === 0 ? bundle.profile.data?.protections : null;
  if (!pr) return null;
  const on = Object.entries(pr)
    .filter(([, v]) => v.supported)
    .map(([k]) => PROOF_SHORT[k] ?? k);
  return on.length ? on.join(" + ") : null;
}

/** Contract is "verified" when it's on Binance's official RWA token list for that issuer
 *  (GET /rwa/tokens) and the symbol carries the issuer's suffix. */
export function isVerified(s: Pick<StockOption, "inApi" | "symbol" | "platformId">) {
  const suffixOk = s.platformId === "ondo" ? /on$/.test(s.symbol) : s.platformId === "bstock" ? /B$/.test(s.symbol) : false;
  return s.inApi && suffixOk;
}

export function VerifiedBadge({ stock, demo }: { stock: StockOption; demo?: boolean }) {
  return isVerified(stock) ? (
    <Badge tone="good">✅ Verified token{demo ? " (demo list)" : ""}</Badge>
  ) : (
    <Badge tone="warn">⚠️ Not on the live list right now</Badge>
  );
}

export function IssuerCompare({ stock, bundle, demo }: { stock: StockOption; bundle: StockBundle | null; demo: boolean }) {
  const other: Platform = stock.platformId === "ondo" ? "bstock" : "ondo";
  const [twin, setTwin] = useState<StockOption | null | undefined>(undefined);
  useEffect(() => {
    let stop = false;
    void loadList(other).then((l) => {
      if (!stop) setTwin(l.find((s) => s.ticker.toUpperCase() === stock.ticker.toUpperCase()) ?? null);
    });
    return () => {
      stop = true;
    };
  }, [other, stock.ticker]);

  const by: Record<Platform, StockOption | null | undefined> = {
    bstock: stock.platformId === "bstock" ? stock : twin,
    ondo: stock.platformId === "ondo" ? stock : twin,
  };
  const myProof = proofFrom(bundle);
  const cols = [
    {
      key: "bstock",
      name: "bStocks",
      symbol: by.bstock?.symbol ?? `${stock.ticker}B`,
      min: "From ~$5",
      how: "AMM + RFQ",
      proof: stock.platformId === "bstock" && myProof ? myProof : "Collateral report",
      s: by.bstock,
    },
    {
      key: "ondo",
      name: "Ondo",
      symbol: by.ondo?.symbol ?? `${stock.ticker}on`,
      min: "~$20",
      how: "RFQ only",
      proof: stock.platformId === "ondo" && myProof ? myProof : "Daily + monthly attestation",
      s: by.ondo,
    },
    { key: "xstock", name: "xStocks", symbol: `${stock.ticker}x`, min: "—", how: "AMM", proof: "Not in Binance RWA data", s: null as StockOption | null | undefined },
  ] as const;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">Same stock, different issuers</p>
        <VerifiedBadge stock={stock} demo={demo} />
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Three companies make {stock.name} tokens. They&apos;re <b>not interchangeable</b> — each has its own contract. You&apos;re looking at{" "}
        <b>{stock.symbol}</b>.
      </p>
      <div className="-mx-1 mt-3 overflow-x-auto" data-testid="issuer-compare">
        <table className="w-full min-w-[330px] border-separate border-spacing-x-1 text-left text-xs">
          <thead>
            <tr>
              <th className="w-[22%]" />
              {cols.map((c) => (
                <th key={c.key} className={`rounded-t-xl px-2 pb-1 pt-2 text-sm font-bold ${c.key === stock.platformId ? "bg-amber-100 text-ink" : "text-slate-600"}`}>
                  {c.name}
                  {c.key === stock.platformId ? <span className="block text-[10px] font-semibold text-amber-700">this one</span> : <span className="block text-[10px]">&nbsp;</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="align-top">
            {(
              [
                ["Symbol ends in", (c: (typeof cols)[number]) => <span className="font-mono font-semibold">{c.symbol}</span>],
                ["Minimum", (c: (typeof cols)[number]) => c.min],
                ["How it trades", (c: (typeof cols)[number]) => c.how],
                ["Proof of backing", (c: (typeof cols)[number]) => c.proof],
                [
                  "Contract",
                  (c: (typeof cols)[number]) =>
                    c.key === "xstock" ? (
                      <span className="text-slate-400">Not listed</span>
                    ) : c.s === undefined ? (
                      <span className="text-slate-400">checking…</span>
                    ) : c.s === null ? (
                      <span className="text-slate-400">Not offered</span>
                    ) : (
                      <span className="block">
                        <a className="font-mono font-semibold text-amber-700 underline" href={`${BSCSCAN}/token/${c.s.address}`} target="_blank" rel="noopener noreferrer">
                          {shortAddr(c.s.address)}
                        </a>
                        {isVerified(c.s) ? <span className="mt-0.5 block font-semibold text-emerald-700">✅ verified</span> : null}
                      </span>
                    ),
                ],
              ] as const
            ).map(([label, render], i, arr) => (
              <tr key={label}>
                <th className="py-1.5 pr-1 font-medium text-slate-500">{label}</th>
                {cols.map((c) => (
                  <td key={c.key} className={`px-2 py-1.5 ${c.key === stock.platformId ? `bg-amber-50 ${i === arr.length - 1 ? "rounded-b-xl" : ""}` : ""}`}>
                    {render(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        &ldquo;Verified&rdquo; = this exact contract is on Binance&apos;s official tokenized-stock list for that issuer (Web3 Wallet API <code>/rwa/tokens</code>). xStocks
        can be routed by the Trading API, but Binance&apos;s RWA data doesn&apos;t cover them yet, so we can&apos;t verify one for you.
      </p>
    </Card>
  );
}
