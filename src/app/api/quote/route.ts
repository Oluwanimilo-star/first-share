import { NextRequest } from "next/server";
import { isDemoRequest, w3w } from "@/lib/server/w3w";
import { mockQuote, readDemoHint } from "@/lib/server/mock";
import { amountWithinCap, bad, isEvmAddress, reply } from "@/lib/server/http";
import { BINANCE_CHAIN_ID, isNativeBnb, NATIVE_BNB, USDT_BSC } from "@/lib/constants";
import type { QuoteRoute } from "@/lib/types";

export const dynamic = "force-dynamic";

function resolveToken(raw: string | null, fallback?: string): string | null {
  if (!raw || raw === "") return fallback ?? null;
  if (raw.toUpperCase() === "BNB" || raw.toUpperCase() === "NATIVE") return NATIVE_BNB;
  if (raw.toUpperCase() === "USDT") return USDT_BSC;
  if (isNativeBnb(raw) || isEvmAddress(raw)) return raw;
  return null;
}

/**
 * GET /api/quote
 * Buy (default):  ?token=<stock>&amount=<USDT units>&wallet=
 * Explicit:       ?from=<addr|USDT|BNB>&to=<addr|USDT|BNB>&amount=&wallet=
 * → GET /api/v1/dex/aggregator/quote
 */
export async function GET(req: NextRequest) {
  const demo = isDemoRequest(req);
  const sp = req.nextUrl.searchParams;
  const legacyToken = sp.get("token");
  const from = resolveToken(sp.get("from"), legacyToken ? USDT_BSC : undefined);
  const to = resolveToken(sp.get("to"), legacyToken ?? undefined);
  const amount = sp.get("amount") ?? "";
  const wallet = sp.get("wallet") ?? undefined;

  if (!from || (!isEvmAddress(from) && !isNativeBnb(from))) return bad("Invalid from token", demo);
  if (!to || (!isEvmAddress(to) && !isNativeBnb(to))) return bad("Invalid to token", demo);
  if (from.toLowerCase() === to.toLowerCase()) return bad("from and to must differ", demo);

  const fromIsUsdt = from.toLowerCase() === USDT_BSC.toLowerCase();
  if (!amountWithinCap(amount, fromIsUsdt ? "usdt" : "token")) return bad("Amount out of range", demo);
  if (wallet && !isEvmAddress(wallet)) return bad("Invalid wallet", demo);

  const query = {
    binanceChainId: BINANCE_CHAIN_ID,
    amount,
    fromTokenAddress: from,
    toTokenAddress: to,
    userWalletAddress: wallet,
  };
  const result = demo
    ? mockQuote({ amount, fromTokenAddress: from, toTokenAddress: to, userWalletAddress: wallet, hint: readDemoHint(sp, fromIsUsdt ? to : from) })
    : await w3w<QuoteRoute[]>("GET", "/api/v1/dex/aggregator/quote", { query });
  return reply(result, demo);
}
