import { NextRequest, NextResponse } from "next/server";
import { isDemoMode, w3w } from "@/lib/server/w3w";
import { mockProfile, mockRwaPrice, mockUnderlyingMarket } from "@/lib/server/mock";
import { isEvmAddress } from "@/lib/server/http";
import { normalizeStatusInfo } from "@/lib/server/statusNormalize";
import { BINANCE_CHAIN_ID } from "@/lib/constants";
import type { OCResult, RwaPrice, RwaProfile, RwaUnderlyingMarket, StockBundle } from "@/lib/types";

export const dynamic = "force-dynamic";

async function withRetry<T>(fn: () => Promise<OCResult<T>>, attempts = 2): Promise<OCResult<T>> {
  let last: OCResult<T> | null = null;
  for (let i = 0; i < attempts; i++) {
    last = await fn();
    if (last.code !== 42900 && last.code !== 42901) return last;
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return last!;
}

/** Live API returns `description` while our types/docs say `descriptionEn`. */
function normalizeProfile(res: OCResult<RwaProfile>): OCResult<RwaProfile> {
  if (res.code !== 0 || !res.data) return res;
  const ci = res.data.companyInfo as (RwaProfile["companyInfo"] & { description?: string | null }) | null;
  if (ci && !ci.descriptionEn && ci.description) {
    return {
      ...res,
      data: {
        ...res.data,
        companyInfo: { ...ci, descriptionEn: ci.description ?? null },
      },
    };
  }
  return res;
}

function normalizeMarket(res: OCResult<RwaUnderlyingMarket>): OCResult<RwaUnderlyingMarket> {
  if (res.code !== 0 || !res.data) return res;
  const statusInfo = normalizeStatusInfo(res.data.statusInfo);
  if (!statusInfo) return res;
  return { ...res, data: { ...res.data, statusInfo } };
}

/**
 * GET /api/stock/:address
 * Fans out (in parallel) to:
 *   GET /api/v1/dex/market/rwa/underlying-profile  (backing: tokenToShareRatio + attestation reports)
 *   GET /api/v1/dex/market/rwa/underlying-market   (marketStatus / reasonCode / nextOpenTime)
 *   GET /api/v1/dex/market/rwa/price               (on-chain price vs reference price)
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ address: string }> }) {
  const { address } = await ctx.params;
  const demo = isDemoMode();
  if (!isEvmAddress(address)) {
    return NextResponse.json({ code: 40001, msg: "Invalid token address", demo }, { status: 400 });
  }
  const demoStatus = req.nextUrl.searchParams.get("demoStatus");
  const q = { binanceChainId: BINANCE_CHAIN_ID, tokenContractAddress: address };

  let profile: OCResult<RwaProfile>;
  let market: OCResult<RwaUnderlyingMarket>;
  let price: OCResult<RwaPrice[]>;

  if (demo) {
    profile = mockProfile(address);
    market = mockUnderlyingMarket(address, demoStatus);
    price = mockRwaPrice([address]);
  } else {
    // Stagger slightly to reduce burst rate-limits (42900) on the gateway.
    const [p, m, pr] = await Promise.all([
      withRetry(() => w3w<RwaProfile>("GET", "/api/v1/dex/market/rwa/underlying-profile", { query: q })),
      (async () => {
        await new Promise((r) => setTimeout(r, 80));
        return withRetry(() => w3w<RwaUnderlyingMarket>("GET", "/api/v1/dex/market/rwa/underlying-market", { query: q }));
      })(),
      (async () => {
        await new Promise((r) => setTimeout(r, 160));
        return withRetry(() =>
          w3w<RwaPrice[]>("GET", "/api/v1/dex/market/rwa/price", {
            query: { binanceChainId: BINANCE_CHAIN_ID, tokenContractAddresses: address },
          }),
        );
      })(),
    ]);
    profile = normalizeProfile(p);
    market = normalizeMarket(m);
    price = pr;
  }

  const body: StockBundle = { demo, profile, market, price };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
