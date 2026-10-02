import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/server/w3w";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    demo: isDemoMode(),
    walletConnect: Boolean(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID),
    region: process.env.VERCEL_REGION ?? null,
  });
}
