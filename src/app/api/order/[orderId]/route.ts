import { NextRequest } from "next/server";
import { isDemoMode, w3w } from "@/lib/server/w3w";
import { mockOrderStatus } from "@/lib/server/mock";
import { bad, reply } from "@/lib/server/http";
import type { OrderStatusData } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/order/:orderId → GET /api/v1/dex/aggregator/order/{orderId} (poll until FILLED/FAILED/EXPIRED/CANCELLED) */
export async function GET(req: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  const demo = isDemoMode();
  const { orderId } = await ctx.params;
  if (!/^[0-9a-zA-Z_-]{4,100}$/.test(orderId)) return bad("Invalid orderId", demo);
  if (demo) {
    const sp = req.nextUrl.searchParams;
    return reply(mockOrderStatus(orderId, Number(sp.get("poll") ?? 0), sp.get("in") ?? undefined, sp.get("out") ?? undefined), demo);
  }
  const result = await w3w<OrderStatusData>("GET", `/api/v1/dex/aggregator/order/${encodeURIComponent(orderId)}`);
  return reply(result, demo);
}
