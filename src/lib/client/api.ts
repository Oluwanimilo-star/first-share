"use client";
import type {
  ApproveTx,
  OrderStatusData,
  OrderSubmitData,
  QuoteRoute,
  SimulateData,
  StockBundle,
  SwapData,
  TxDetail,
  Wrapped,
} from "../types";
import type { StockOption } from "../stocks";
import { friendlyError } from "../explain";

export class ApiError extends Error {
  constructor(public code: number, public apiMsg: string) {
    super(friendlyError(code, apiMsg));
  }
}

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  return (await r.json()) as T;
}
async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await r.json()) as T;
}

/** Throw on non-zero business code, return data. */
export function unwrap<T>(res: Wrapped<T>): T {
  if (res.code !== 0 || res.data === null || res.data === undefined) throw new ApiError(res.code, res.msg);
  return res.data;
}

const qs = (o: Record<string, string | undefined | null>) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString();

export const api = {
  mode: () => get<{ demo: boolean; walletConnect: boolean; region: string | null }>("/api/mode"),
  stocks: (platform: string, demoStatus?: string) =>
    get<{ code: number; msg: string; demo: boolean; stocks: StockOption[] }>(`/api/stocks?${qs({ platform, demoStatus })}`),
  stock: (address: string, demoStatus?: string) => get<StockBundle>(`/api/stock/${address}?${qs({ demoStatus })}`),
  quote: (p: { token: string; amount: string; wallet?: string }) => get<Wrapped<QuoteRoute[]>>(`/api/quote?${qs(p)}`),
  swap: (p: { token: string; amount: string; wallet: string; quoteId: string; slippage: string; route?: string }) =>
    get<Wrapped<SwapData>>(`/api/swap?${qs(p)}`),
  approve: (p: { amount: string; vendor?: string }) => get<Wrapped<ApproveTx[]>>(`/api/approve?${qs(p)}`),
  simulate: (tx: { from: string; to: string; data: string; value?: string }, hint?: { amountIn: string; tokenOut: string; amountOut: string }) =>
    post<Wrapped<SimulateData>>("/api/simulate", { tx, hint }),
  orderSubmit: (b: { requestId: string; userSignature: string; vendor: string; quoteId: string; signingScheme?: string }) =>
    post<Wrapped<OrderSubmitData>>("/api/order/submit", b),
  orderStatus: (orderId: string, demoHint?: { poll: number; in?: string; out?: string }) =>
    get<Wrapped<OrderStatusData>>(`/api/order/${encodeURIComponent(orderId)}?${qs({ poll: demoHint ? String(demoHint.poll) : undefined, in: demoHint?.in, out: demoHint?.out })}`),
  tx: (hash: string, demoHint?: { wallet?: string; token?: string; in?: string; out?: string }) =>
    get<Wrapped<TxDetail[]>>(`/api/tx/${hash}?${qs({ ...demoHint })}`),
};
