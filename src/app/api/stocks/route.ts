import { NextRequest, NextResponse } from "next/server";
import { isDemoMode, w3w } from "@/lib/server/w3w";
import { mockRwaTokens } from "@/lib/server/mock";
import { normalizeStatusInfo } from "@/lib/server/statusNormalize";
import {
  CURATED_STOCKS,
  FAVORITE_TICKERS,
  ONDO_DEMO_STOCKS,
  curatedByTicker,
  type StockOption,
} from "@/lib/stocks";
import { BINANCE_CHAIN_ID } from "@/lib/constants";
import type { RwaPrice, RwaToken } from "@/lib/types";

export const dynamic = "force-dynamic";

function fromApi(t: RwaToken): StockOption {
  const c = curatedByTicker(t.underlyingTicker);
  const status = normalizeStatusInfo(t.statusInfo);
  return {
    ticker: t.underlyingTicker,
    symbol: t.tokenSymbol,
    name: c?.name ?? t.underlyingName ?? t.tokenName ?? t.underlyingTicker,
    address: t.tokenContractAddress,
    platformId: t.platformId,
    logoUrl: t.tokenLogoUrl || null,
    blurb: c?.blurb ?? t.tokenName,
    color: c?.color ?? "#334155",
    kind: t.assetType === 3 ? "ETF" : "Stock",
    decimals: Number(t.decimals ?? 18),
    tokenPrice: t.tokenPrice ?? null,
    referencePrice: t.referencePrice ?? null,
    tokenToShareRatio: t.tokenToShareRatio ?? null,
    marketStatus: status?.marketStatus ?? null,
    openState: status?.openState ?? t.statusInfo?.openState ?? null,
    inApi: true,
  };
}

function fromCurated(c: (typeof CURATED_STOCKS)[number]): StockOption {
  return {
    ...c,
    logoUrl: null,
    decimals: 18,
    tokenPrice: null,
    referencePrice: null,
    tokenToShareRatio: null,
    marketStatus: null,
    openState: null,
    inApi: false,
  };
}

function matchesQuery(s: StockOption, q: string): boolean {
  if (!q) return true;
  const hay = `${s.ticker} ${s.symbol} ${s.name} ${s.blurb}`.toLowerCase();
  return q.split(/\s+/).filter(Boolean).every((part) => hay.includes(part));
}

function sortFavoritesFirst(stocks: StockOption[]): StockOption[] {
  const favIndex = new Map(FAVORITE_TICKERS.map((t, i) => [t, i]));
  const hasPrice = (s: StockOption) => Number(s.tokenPrice) > 0;
  return [...stocks].sort((a, b) => {
    // Tokens with a live price (and on the live trading list) always come first, so the
    // first screen never shows "—".
    if (hasPrice(a) !== hasPrice(b)) return hasPrice(a) ? -1 : 1;
    if (a.inApi !== b.inApi) return a.inApi ? -1 : 1;
    const ai = favIndex.has(a.ticker as (typeof FAVORITE_TICKERS)[number])
      ? favIndex.get(a.ticker as (typeof FAVORITE_TICKERS)[number])!
      : 1000;
    const bi = favIndex.has(b.ticker as (typeof FAVORITE_TICKERS)[number])
      ? favIndex.get(b.ticker as (typeof FAVORITE_TICKERS)[number])!
      : 1000;
    if (ai !== bi) return ai - bi;
    // curated (inApi false still listed) after live favorites of same rank
    if (a.inApi !== b.inApi) return a.inApi ? -1 : 1;
    return (a.name || a.ticker || "").localeCompare(b.name || b.ticker || "");
  });
}

/**
 * GET /api/stocks?platform=bstock|ondo&q=optional
 * Calls GET /api/v1/dex/market/rwa/tokens?binanceChainId=56&platformId=...
 * Returns the full live list (curated favorites pinned to the top). Optional `q`
 * filters by ticker / symbol / name.
 */
export async function GET(req: NextRequest) {
  const platform = req.nextUrl.searchParams.get("platform") === "ondo" ? "ondo" : "bstock";
  const demoStatus = req.nextUrl.searchParams.get("demoStatus");
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const demo = isDemoMode();

  const result = demo
    ? mockRwaTokens(platform, demoStatus)
    : await w3w<RwaToken[]>("GET", "/api/v1/dex/market/rwa/tokens", {
        query: { binanceChainId: BINANCE_CHAIN_ID, platformId: platform },
      });

  const apiTokens = (result.code === 0 && Array.isArray(result.data) ? result.data : []).filter(
    (t) => String(t.binanceChainId) === BINANCE_CHAIN_ID,
  );

  let stocks: StockOption[];

  if (platform === "bstock") {
    const byAddr = new Map(apiTokens.map((t) => [t.tokenContractAddress.toLowerCase(), t]));
    const byTicker = new Map(apiTokens.map((t) => [t.underlyingTicker.toUpperCase(), t]));
    const used = new Set<string>();

    // 1) Curated favorites first (prefer live API row when address/ticker matches).
    const curatedRows: StockOption[] = CURATED_STOCKS.map((c) => {
      const t =
        byAddr.get(c.address.toLowerCase()) ?? byTicker.get(c.ticker.toUpperCase());
      if (t) {
        used.add(t.tokenContractAddress.toLowerCase());
        return fromApi(t);
      }
      return fromCurated(c);
    });

    // 2) Any remaining live tokens not already covered.
    const extras = apiTokens
      .filter((t) => !used.has(t.tokenContractAddress.toLowerCase()))
      .map(fromApi);

    // 3) Curated tokens missing from the live list: try GET /rwa/price for them so they
    //    don't render as "—" (they keep the "Limited data" badge and sort last).
    const missing = curatedRows.filter((r) => !r.tokenPrice);
    if (!demo && missing.length) {
      const pr = await w3w<RwaPrice[]>("GET", "/api/v1/dex/market/rwa/price", {
        query: { binanceChainId: BINANCE_CHAIN_ID, tokenContractAddresses: missing.map((m) => m.address).join(",") },
      });
      if (pr.code === 0 && Array.isArray(pr.data)) {
        const byA = new Map(pr.data.map((x) => [x.tokenContractAddress.toLowerCase(), x]));
        for (const r of missing) {
          const x = byA.get(r.address.toLowerCase());
          if (x && Number(x.tokenPrice) > 0) {
            r.tokenPrice = x.tokenPrice;
            r.referencePrice = x.referencePrice ?? null;
          }
        }
      }
    }

    stocks = sortFavoritesFirst([...curatedRows, ...extras]);
  } else {
    // Ondo: full live list, curated tickers floated to top.
    const list = apiTokens.map(fromApi);
    if (list.length) {
      stocks = sortFavoritesFirst(list);
    } else if (demo) {
      stocks = ONDO_DEMO_STOCKS.map(fromCurated);
    } else {
      stocks = [];
    }
  }

  if (q) stocks = stocks.filter((s) => matchesQuery(s, q));

  return NextResponse.json(
    {
      code: result.code,
      msg: result.msg,
      demo,
      platform,
      total: stocks.length,
      stocks,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
