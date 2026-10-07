import { NextRequest, NextResponse } from "next/server";
import { isDemoMode, w3w } from "@/lib/server/w3w";
import { mockRwaPrice } from "@/lib/server/mock";
import { isEvmAddress } from "@/lib/server/http";
import { BINANCE_CHAIN_ID } from "@/lib/constants";
import type { RwaPrice } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/prices?addresses=0x…,0x…
 * → GET /api/v1/dex/market/rwa/price
 */
export async function GET(req: NextRequest) {
  const demo = isDemoMode();
  const raw = req.nextUrl.searchParams.get("addresses") ?? "";
  const addresses = raw
    .split(",")
    .map((s) => s.trim())
    .filter(isEvmAddress)
    .slice(0, 40);
  if (!addresses.length) {
    return NextResponse.json({ code: 40001, msg: "addresses required", data: null, demo }, { status: 400 });
  }
  const result = demo
    ? mockRwaPrice(addresses)
    : await w3w<RwaPrice[]>("GET", "/api/v1/dex/market/rwa/price", {
        query: { binanceChainId: BINANCE_CHAIN_ID, tokenContractAddresses: addresses.join(",") },
      });
  return NextResponse.json({ ...result, demo }, { headers: { "Cache-Control": "no-store" } });
}
