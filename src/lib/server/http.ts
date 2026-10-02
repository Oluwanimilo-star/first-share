import "server-only";
import { NextResponse } from "next/server";
import type { OCResult } from "../types";
import { MAX_AMOUNT_USD, USDT_DECIMALS } from "../constants";

export function reply<T>(result: OCResult<T>, demo: boolean) {
  return NextResponse.json({ ...result, demo }, { headers: { "Cache-Control": "no-store" } });
}

export function bad(msg: string, demo: boolean) {
  return NextResponse.json({ code: 40001, msg, data: null, demo }, { status: 400 });
}

export const isEvmAddress = (a: unknown): a is string => typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a);
export const isTxHash = (h: unknown): h is string => typeof h === "string" && /^0x[0-9a-fA-F]{64}$/.test(h);
export const isUintString = (v: unknown): v is string => typeof v === "string" && /^[0-9]{1,40}$/.test(v);

/** Server-side guard: never quote/approve more than MAX_AMOUNT_USD of USDT. */
export function amountWithinCap(amount: string): boolean {
  if (!isUintString(amount)) return false;
  const max = BigInt(MAX_AMOUNT_USD) * 10n ** BigInt(USDT_DECIMALS);
  const v = BigInt(amount);
  return v > 0n && v <= max;
}
