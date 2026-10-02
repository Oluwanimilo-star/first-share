import { NextRequest, NextResponse } from "next/server";
import { isDemoMode, w3w } from "@/lib/server/w3w";
import { mockRwaTokens } from "@/lib/server/mock";
import { CURATED_STOCKS, ONDO_DEMO_STOCKS, curatedByTicker, type StockOption } from "@/lib/stocks";
import { BINANCE_CHAIN_ID } from "@/lib/constants";
import type { RwaToken } from "@/lib/types";

export const dynamic = "force-dynamic";

const PICK_TICKERS = CURATED_STOCKS.map((s) => s.ticker);

function fromApi(t: RwaToken): StockOption {
  const c = curatedByTicker(t.underlyingTicker);
  return {
    ticker: t.underlyingTicker,
    symbol: t.tokenSymbol,
    name: c?.name ?? t.underlyingName,
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
    marketStatus: t.statusInfo?.marketStatus ?? null,
    openState: t.statusInfo?.openState ?? null,
    inApi: true,
  };
}

/**
 * GET /api/stocks?platform=bstock|ondo
 * Calls GET /api/v1/dex/market/rwa/tokens?binanceChainId=56&platformId=...
 * and narrows it to a beginner-friendly list.
 */
export async function GET(req: NextRequest) {
  const platform = req.nextUrl.searchParams.get("platform") === "ondo" ? "ondo" : "bstock";
  const demoStatus = req.nextUrl.searchParams.get("demoStatus");
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
    // Keep our curated order; prefer API data, fall back to the documented contract list.
    stocks = CURATED_STOCKS.map((c) => {
      const t =
        apiTokens.find((x) => x.tokenContractAddress.toLowerCase() === c.address.toLowerCase()) ??
        apiTokens.find((x) => x.underlyingTicker === c.ticker);
      return t
        ? fromApi(t)
        : { ...c, logoUrl: null, decimals: 18, tokenPrice: null, referencePrice: null, tokenToShareRatio: null, marketStatus: null, openState: null, inApi: false };
    });
  } else {
    const matched = apiTokens.filter((t) => PICK_TICKERS.includes(t.underlyingTicker));
    const list = (matched.length ? matched : apiTokens.filter((t) => t.assetType !== 2).slice(0, 8)).map(fromApi);
    stocks = list.length
      ? list
      : demo
        ? ONDO_DEMO_STOCKS.map((c) => ({ ...c, logoUrl: null, decimals: 18, tokenPrice: null, referencePrice: null, tokenToShareRatio: null, marketStatus: null, openState: null, inApi: false }))
        : [];
  }

  return NextResponse.json(
    { code: result.code, msg: result.msg, demo, platform, stocks },
    { headers: { "Cache-Control": "no-store" } },
  );
}
