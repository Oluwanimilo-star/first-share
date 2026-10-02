import { NextRequest } from "next/server";
import { isDemoMode, w3w } from "@/lib/server/w3w";
import { mockQuote } from "@/lib/server/mock";
import { amountWithinCap, bad, isEvmAddress, reply } from "@/lib/server/http";
import { BINANCE_CHAIN_ID, USDT_BSC } from "@/lib/constants";
import type { QuoteRoute } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/quote?token=0x..&amount=<USDT smallest unit>&wallet=0x..
 * → GET /api/v1/dex/aggregator/quote (USDT → stock token on BSC)
 * userWalletAddress is required for RFQ routes (Ondo / bStock).
 */
export async function GET(req: NextRequest) {
  const demo = isDemoMode();
  const sp = req.nextUrl.searchParams;
  const token = sp.get("token");
  const amount = sp.get("amount") ?? "";
  const wallet = sp.get("wallet") ?? undefined;
  if (!isEvmAddress(token)) return bad("Invalid token", demo);
  if (!amountWithinCap(amount)) return bad("Amount out of range", demo);
  if (wallet && !isEvmAddress(wallet)) return bad("Invalid wallet", demo);

  const query = {
    binanceChainId: BINANCE_CHAIN_ID,
    amount,
    fromTokenAddress: USDT_BSC,
    toTokenAddress: token,
    userWalletAddress: wallet,
  };
  const result = demo
    ? mockQuote({ amount, toTokenAddress: token, userWalletAddress: wallet })
    : await w3w<QuoteRoute[]>("GET", "/api/v1/dex/aggregator/quote", { query });
  return reply(result, demo);
}
