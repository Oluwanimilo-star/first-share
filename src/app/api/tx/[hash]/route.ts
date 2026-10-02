import { NextRequest } from "next/server";
import { isDemoMode, w3w } from "@/lib/server/w3w";
import { mockTxDetail } from "@/lib/server/mock";
import { bad, isTxHash, reply } from "@/lib/server/http";
import { BINANCE_CHAIN_ID } from "@/lib/constants";
import type { TxDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/tx/:hash → GET /api/v1/dex/post-transaction/transaction-detail-by-txhash (Wallet API) */
export async function GET(req: NextRequest, ctx: { params: Promise<{ hash: string }> }) {
  const demo = isDemoMode();
  const { hash } = await ctx.params;
  if (!isTxHash(hash)) return bad("Invalid tx hash", demo);
  if (demo) {
    const sp = req.nextUrl.searchParams;
    return reply(mockTxDetail(hash, sp.get("wallet") ?? undefined, sp.get("token") ?? undefined, sp.get("in") ?? undefined, sp.get("out") ?? undefined), demo);
  }
  const result = await w3w<TxDetail[]>("GET", "/api/v1/dex/post-transaction/transaction-detail-by-txhash", {
    query: { binanceChainId: BINANCE_CHAIN_ID, txHash: hash },
  });
  return reply(result, demo);
}
