import { NextRequest } from "next/server";
import { isDemoMode, w3w } from "@/lib/server/w3w";
import { mockApprove } from "@/lib/server/mock";
import { amountWithinCap, bad, reply } from "@/lib/server/http";
import { BINANCE_CHAIN_ID, USDT_BSC } from "@/lib/constants";
import type { ApproveTx } from "@/lib/types";

export const dynamic = "force-dynamic";

const VENDORS = ["InchFusion", "CowSwap", "PcsXRfq"];

/**
 * GET /api/approve?amount=<USDT smallest unit>[&vendor=PcsXRfq]
 * → GET /api/v1/dex/aggregator/approve-transaction (USDT only; exact amount, never unlimited)
 * vendor is required for RFQ (equity) routes; omitted for the regular SWAP route.
 */
export async function GET(req: NextRequest) {
  const demo = isDemoMode();
  const amount = req.nextUrl.searchParams.get("amount") ?? "";
  const vendor = req.nextUrl.searchParams.get("vendor") ?? undefined;
  if (!amountWithinCap(amount)) return bad("Amount out of range", demo);
  if (vendor && !VENDORS.includes(vendor)) return bad("Unknown vendor", demo);

  const result = demo
    ? mockApprove({ approveAmount: amount, vendor })
    : await w3w<ApproveTx[]>("GET", "/api/v1/dex/aggregator/approve-transaction", {
        query: { binanceChainId: BINANCE_CHAIN_ID, tokenContractAddress: USDT_BSC, approveAmount: amount, vendor },
      });
  return reply(result, demo);
}
