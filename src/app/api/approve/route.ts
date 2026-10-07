import { NextRequest } from "next/server";
import { isDemoRequest, w3w } from "@/lib/server/w3w";
import { mockApprove } from "@/lib/server/mock";
import { amountWithinCap, bad, isEvmAddress, reply } from "@/lib/server/http";
import { BINANCE_CHAIN_ID, USDT_BSC } from "@/lib/constants";
import type { ApproveTx } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/approve?amount=…[&token=0x…][&vendor=PcsXRfq]
 * → GET /api/v1/dex/aggregator/approve-transaction
 * Default token is USDT (buy path). Pass the stock token address when selling.
 * vendor is required for RFQ routes; omitted for SWAP.
 */
export async function GET(req: NextRequest) {
  const demo = isDemoRequest(req);
  const amount = req.nextUrl.searchParams.get("amount") ?? "";
  const vendor = req.nextUrl.searchParams.get("vendor") ?? undefined;
  const tokenRaw = req.nextUrl.searchParams.get("token");
  const token = tokenRaw && isEvmAddress(tokenRaw) ? tokenRaw : USDT_BSC;
  const kind = token.toLowerCase() === USDT_BSC.toLowerCase() ? "usdt" : "token";
  if (!amountWithinCap(amount, kind)) return bad("Amount out of range", demo);
  // Accept any reasonable vendor name (live RFQ vendors can vary); reject garbage.
  if (vendor && !/^[A-Za-z0-9_-]{2,40}$/.test(vendor)) return bad("Unknown vendor", demo);

  const result = demo
    ? mockApprove({ approveAmount: amount, vendor, tokenContractAddress: token })
    : await w3w<ApproveTx[]>("GET", "/api/v1/dex/aggregator/approve-transaction", {
        query: { binanceChainId: BINANCE_CHAIN_ID, tokenContractAddress: token, approveAmount: amount, vendor },
      });
  return reply(result, demo);
}
