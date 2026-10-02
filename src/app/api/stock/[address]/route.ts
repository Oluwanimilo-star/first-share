import { NextRequest, NextResponse } from "next/server";
import { isDemoMode, w3w } from "@/lib/server/w3w";
import { mockProfile, mockRwaPrice, mockUnderlyingMarket } from "@/lib/server/mock";
import { isEvmAddress } from "@/lib/server/http";
import { BINANCE_CHAIN_ID } from "@/lib/constants";
import type { RwaPrice, RwaProfile, RwaUnderlyingMarket, StockBundle } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/stock/:address
 * Fans out (in parallel) to:
 *   GET /api/v1/dex/market/rwa/underlying-profile  (backing: tokenToShareRatio + attestation reports)
 *   GET /api/v1/dex/market/rwa/underlying-market   (marketStatus / reasonCode / nextOpenTime)
 *   GET /api/v1/dex/market/rwa/price               (on-chain price vs reference price)
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ address: string }> }) {
  const { address } = await ctx.params;
  const demo = isDemoMode();
  if (!isEvmAddress(address)) {
    return NextResponse.json({ code: 40001, msg: "Invalid token address", demo }, { status: 400 });
  }
  const demoStatus = req.nextUrl.searchParams.get("demoStatus");
  const q = { binanceChainId: BINANCE_CHAIN_ID, tokenContractAddress: address };

  const [profile, market, price] = demo
    ? [mockProfile(address), mockUnderlyingMarket(address, demoStatus), mockRwaPrice([address])]
    : await Promise.all([
        w3w<RwaProfile>("GET", "/api/v1/dex/market/rwa/underlying-profile", { query: q }),
        w3w<RwaUnderlyingMarket>("GET", "/api/v1/dex/market/rwa/underlying-market", { query: q }),
        w3w<RwaPrice[]>("GET", "/api/v1/dex/market/rwa/price", {
          query: { binanceChainId: BINANCE_CHAIN_ID, tokenContractAddresses: address },
        }),
      ]);

  const body: StockBundle = { demo, profile, market, price };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
