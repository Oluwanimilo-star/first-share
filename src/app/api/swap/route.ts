import { NextRequest } from "next/server";
import { isDemoMode, w3w } from "@/lib/server/w3w";
import { mockSwap } from "@/lib/server/mock";
import { amountWithinCap, bad, isEvmAddress, reply } from "@/lib/server/http";
import { BINANCE_CHAIN_ID, USDT_BSC } from "@/lib/constants";
import type { SwapData } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/swap?token&amount&wallet&quoteId&slippage[&route=SWAP|RFQ:<vendor> (demo hint only)]
 * → GET /api/v1/dex/aggregator/swap
 * Returns data.tx (SWAP mode: unsigned tx for the wallet) or data.rfq (RFQ mode: EIP-712 typed data).
 */
export async function GET(req: NextRequest) {
  const demo = isDemoMode();
  const sp = req.nextUrl.searchParams;
  const token = sp.get("token");
  const amount = sp.get("amount") ?? "";
  const wallet = sp.get("wallet");
  const quoteId = sp.get("quoteId") ?? "";
  const slippage = sp.get("slippage") ?? "1";
  if (!isEvmAddress(token)) return bad("Invalid token", demo);
  if (!isEvmAddress(wallet)) return bad("Invalid wallet", demo);
  if (!amountWithinCap(amount)) return bad("Amount out of range", demo);
  if (!/^[0-9a-zA-Z-]{8,80}$/.test(quoteId)) return bad("Invalid quoteId", demo);
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(slippage) || Number(slippage) > 5) return bad("Slippage must be 0–5%", demo);

  const result = demo
    ? mockSwap({ amount, toTokenAddress: token, userWalletAddress: wallet, slippagePercent: slippage, quoteId, routeHint: sp.get("route") ?? undefined })
    : await w3w<SwapData>("GET", "/api/v1/dex/aggregator/swap", {
        query: {
          binanceChainId: BINANCE_CHAIN_ID,
          amount,
          fromTokenAddress: USDT_BSC,
          toTokenAddress: token,
          slippagePercent: slippage,
          userWalletAddress: wallet,
          quoteId,
        },
      });
  return reply(result, demo);
}
