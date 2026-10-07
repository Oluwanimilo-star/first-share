import { NextRequest } from "next/server";
import { isDemoRequest, w3w } from "@/lib/server/w3w";
import { mockSimulate, mockSimulateSwap } from "@/lib/server/mock";
import { bad, isEvmAddress, isUintString, reply } from "@/lib/server/http";
import { BINANCE_CHAIN_ID } from "@/lib/constants";
import type { SimulateData } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/simulate  { tx: {from,to,data,value}, hint?: {amountIn, tokenOut, amountOut} }
 * → POST /api/v1/dex/pre-transaction/simulate  { binanceChainId, evmTx }
 * (`hint` is only used to make the stateless demo mock realistic; never forwarded.)
 */
export async function POST(req: NextRequest) {
  const demo = isDemoRequest(req);
  let body: { tx?: { from?: string; to?: string; data?: string; value?: string }; hint?: { amountIn?: string; tokenOut?: string; amountOut?: string } };
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON", demo);
  }
  const tx = body.tx;
  if (!tx || !isEvmAddress(tx.from) || !isEvmAddress(tx.to)) return bad("tx.from / tx.to required", demo);
  if (tx.data && !/^0x[0-9a-fA-F]*$/.test(tx.data)) return bad("tx.data must be hex", demo);
  const value = tx.value && isUintString(tx.value) ? tx.value : "0";
  const evmTx = { from: tx.from, to: tx.to, value, data: tx.data ?? "0x" };

  if (demo) {
    let r = mockSimulate({ evmTx });
    const h = body.hint;
    if (r.data === null && h?.amountIn && h.tokenOut && h.amountOut) {
      r = mockSimulateSwap(tx.from, h.amountIn, h.tokenOut, h.amountOut);
    }
    return reply(r, demo);
  }
  const result = await w3w<SimulateData>("POST", "/api/v1/dex/pre-transaction/simulate", {
    body: { binanceChainId: BINANCE_CHAIN_ID, evmTx },
  });
  return reply(result, demo);
}
