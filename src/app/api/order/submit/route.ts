import { NextRequest } from "next/server";
import { isDemoMode, w3w } from "@/lib/server/w3w";
import { mockOrderSubmit } from "@/lib/server/mock";
import { bad, reply } from "@/lib/server/http";
import type { OrderSubmitData } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/order/submit { requestId, userSignature, vendor, quoteId, signingScheme? }
 * → POST /api/v1/dex/aggregator/order/submit  (RFQ: Ondo / bStock PcsXRfq routes)
 */
export async function POST(req: NextRequest) {
  const demo = isDemoMode();
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return bad("Invalid JSON", demo);
  }
  const { requestId, userSignature, vendor, quoteId, signingScheme } = b as Record<string, string | undefined>;
  if (!requestId || !/^[0-9a-fA-F-]{32,36}$/.test(requestId)) return bad("requestId must be a UUID", demo);
  if (!userSignature || !/^0x[0-9a-fA-F]{130}$/.test(userSignature)) return bad("userSignature must be a 65-byte hex signature", demo);
  if (!vendor || !["InchFusion", "CowSwap", "PcsXRfq"].includes(vendor)) return bad("Unknown vendor", demo);
  if (!quoteId || !/^[0-9a-zA-Z-]{8,80}$/.test(quoteId)) return bad("Invalid quoteId", demo);

  const body: Record<string, string> = { requestId, userSignature, vendor, quoteId };
  if (signingScheme) body.signingScheme = signingScheme;

  const result = demo ? mockOrderSubmit() : await w3w<OrderSubmitData>("POST", "/api/v1/dex/aggregator/order/submit", { body });
  return reply(result, demo);
}
