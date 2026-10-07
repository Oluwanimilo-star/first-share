"use client";
/**
 * Tiny local "buy ledger" so Holdings can show price paid and unrealized P/L on return
 * visits. Stored only in this browser (localStorage), keyed by wallet address.
 * Nothing here ever leaves the device.
 */
export type BuyRecord = {
  token: string; // contract address (lower-case)
  symbol: string;
  ticker: string;
  name: string;
  usdIn: number; // USDT spent (≈ USD)
  tokensOut: number; // tokens received
  ts: number;
  txHash: string | null;
  demo: boolean;
};

const KEY = (wallet: string) => `firstshare:buys:v1:${wallet.toLowerCase()}`;

export function loadBuys(wallet: string | null | undefined): BuyRecord[] {
  if (!wallet || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY(wallet));
    const list = raw ? (JSON.parse(raw) as BuyRecord[]) : [];
    return Array.isArray(list) ? list.filter((b) => b && typeof b.token === "string" && b.tokensOut > 0) : [];
  } catch {
    return [];
  }
}

export function recordBuy(wallet: string, rec: BuyRecord) {
  if (typeof window === "undefined") return;
  try {
    const list = loadBuys(wallet);
    // idempotent per tx / timestamp (React strict-mode double effects)
    if (list.some((b) => (rec.txHash && b.txHash === rec.txHash) || b.ts === rec.ts)) return;
    list.push({ ...rec, token: rec.token.toLowerCase() });
    window.localStorage.setItem(KEY(wallet), JSON.stringify(list.slice(-200)));
  } catch {
    /* storage full / private mode: P/L is a nice-to-have */
  }
}

/** Average cost per token and totals for one token. */
export function costBasis(buys: BuyRecord[], token: string) {
  const mine = buys.filter((b) => b.token === token.toLowerCase());
  const usd = mine.reduce((a, b) => a + b.usdIn, 0);
  const qty = mine.reduce((a, b) => a + b.tokensOut, 0);
  return mine.length && qty > 0 ? { usdIn: usd, tokens: qty, avgPrice: usd / qty, count: mine.length } : null;
}
