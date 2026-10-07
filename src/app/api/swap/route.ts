import { NextRequest } from "next/server";
import { isDemoRequest, w3w } from "@/lib/server/w3w";
import { mockSwap, readDemoHint } from "@/lib/server/mock";
import { amountWithinCap, bad, isEvmAddress, reply } from "@/lib/server/http";
import { BINANCE_CHAIN_ID, isNativeBnb, NATIVE_BNB, USDT_BSC } from "@/lib/constants";
import type { SwapData } from "@/lib/types";

export const dynamic = "force-dynamic";

function resolveToken(raw: string | null, fallback?: string): string | null {
  if (!raw || raw === "") return fallback ?? null;
  if (raw.toUpperCase() === "BNB" || raw.toUpperCase() === "NATIVE") return NATIVE_BNB;
  if (raw.toUpperCase() === "USDT") return USDT_BSC;
  if (isNativeBnb(raw) || isEvmAddress(raw)) return raw;
  return null;
}

/**
 * GET /api/swap?from&to&amount&wallet&quoteId&slippage[&route=…]
 * Legacy buy: ?token=<stock>&amount&wallet&quoteId&slippage  (from=USDT, to=token)
 */
export async function GET(req: NextRequest) {
  const demo = isDemoRequest(req);
  const sp = req.nextUrl.searchParams;
  const legacyToken = sp.get("token");
  const from = resolveToken(sp.get("from"), legacyToken ? USDT_BSC : undefined);
  const to = resolveToken(sp.get("to"), legacyToken ?? undefined);
  const amount = sp.get("amount") ?? "";
  const wallet = sp.get("wallet");
  const quoteId = sp.get("quoteId") ?? "";
  const slippage = sp.get("slippage") ?? "1";

  if (!from || (!isEvmAddress(from) && !isNativeBnb(from))) return bad("Invalid from token", demo);
  if (!to || (!isEvmAddress(to) && !isNativeBnb(to))) return bad("Invalid to token", demo);
  if (!isEvmAddress(wallet)) return bad("Invalid wallet", demo);
  const fromIsUsdt = from.toLowerCase() === USDT_BSC.toLowerCase();
  if (!amountWithinCap(amount, fromIsUsdt ? "usdt" : "token")) return bad("Amount out of range", demo);
  if (!/^[0-9a-zA-Z-]{8,80}$/.test(quoteId)) return bad("Invalid quoteId", demo);
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(slippage) || Number(slippage) > 5) return bad("Slippage must be 0–5%", demo);

  const result = demo
    ? mockSwap({
        amount,
        fromTokenAddress: from,
        toTokenAddress: to,
        userWalletAddress: wallet,
        slippagePercent: slippage,
        quoteId,
        routeHint: sp.get("route") ?? undefined,
        hint: readDemoHint(sp, fromIsUsdt ? to : from),
      })
    : await w3w<SwapData>("GET", "/api/v1/dex/aggregator/swap", {
        query: {
          binanceChainId: BINANCE_CHAIN_ID,
          amount,
          fromTokenAddress: from,
          toTokenAddress: to,
          slippagePercent: slippage,
          userWalletAddress: wallet,
          quoteId,
        },
      });
  return reply(result, demo);
}
