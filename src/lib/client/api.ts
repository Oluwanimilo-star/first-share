"use client";
import type {
  ApproveTx,
  OrderStatusData,
  OrderSubmitData,
  QuoteRoute,
  RwaPrice,
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

/* ── "Try demo" toggle (client-side) ──
 * When on, every request carries x-first-share-demo: 1 and the trade routes answer with
 * mocked data (no real quote is reserved, nothing can be signed or sent). Market data
 * (stock list, backing, market hours, prices) stays live. */
let clientDemo = false;
export function setClientDemo(on: boolean) {
  clientDemo = on;
}
export function isClientDemo() {
  return clientDemo;
}

/** Live list prices, so demo quotes match the price the user just saw. */
const demoHints = new Map<string, { hp: string; hs: string; hpf: string }>();
export function rememberDemoHints(stocks: Pick<StockOption, "address" | "tokenPrice" | "symbol" | "platformId">[]) {
  for (const s of stocks) {
    if (Number(s.tokenPrice) > 0) demoHints.set(s.address.toLowerCase(), { hp: String(Number(s.tokenPrice)), hs: s.symbol, hpf: s.platformId });
  }
}
function hintFor(...addrs: (string | undefined)[]): { hp?: string; hs?: string; hpf?: string } {
  if (!clientDemo) return {};
  for (const a of addrs) {
    const h = a ? demoHints.get(a.toLowerCase()) : undefined;
    if (h) return h;
  }
  return {};
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return { ...(clientDemo ? { "x-first-share-demo": "1" } : {}), ...extra };
}

/** Never let a non-JSON body (HTML error page, timeout) reach the UI as a raw error. */
async function readJson<T>(r: Response): Promise<T> {
  try {
    return (await r.json()) as T;
  } catch {
    return { code: r.status || -1, msg: "Unexpected response", data: null, demo: clientDemo } as T;
  }
}

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store", headers: headers() });
  return readJson<T>(r);
}
async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify(body) });
  return readJson<T>(r);
}

/** Throw on non-zero business code, return data. */
export function unwrap<T>(res: Wrapped<T>): T {
  if (res.code !== 0 || res.data === null || res.data === undefined) throw new ApiError(res.code, res.msg);
  return res.data;
}

const qs = (o: Record<string, string | undefined | null>) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString();

export type QuoteParams = {
  amount: string;
  wallet?: string;
  /** Legacy buy: USDT → token */
  token?: string;
  from?: string;
  to?: string;
};

export type SwapParams = {
  amount: string;
  wallet: string;
  quoteId: string;
  slippage: string;
  route?: string;
  token?: string;
  from?: string;
  to?: string;
};

export const api = {
  mode: () => get<{ demo: boolean; walletConnect: boolean; region: string | null }>("/api/mode"),
  stocks: (platform: string, demoStatus?: string) =>
    get<{ code: number; msg: string; demo: boolean; stocks: StockOption[] }>(`/api/stocks?${qs({ platform, demoStatus })}`),
  stock: (address: string, demoStatus?: string) => get<StockBundle>(`/api/stock/${address}?${qs({ demoStatus })}`),
  prices: (addresses: string[]) =>
    get<Wrapped<RwaPrice[]>>(`/api/prices?${qs({ addresses: addresses.join(",") })}`),
  quote: (p: QuoteParams) => get<Wrapped<QuoteRoute[]>>(`/api/quote?${qs({ ...p, ...hintFor(p.token, p.to, p.from) })}`),
  swap: (p: SwapParams) => get<Wrapped<SwapData>>(`/api/swap?${qs({ ...p, ...hintFor(p.token, p.to, p.from) })}`),
  approve: (p: { amount: string; vendor?: string; token?: string }) => get<Wrapped<ApproveTx[]>>(`/api/approve?${qs(p)}`),
  simulate: (tx: { from: string; to: string; data: string; value?: string }, hint?: { amountIn: string; tokenOut: string; amountOut: string }) =>
    post<Wrapped<SimulateData>>("/api/simulate", { tx, hint }),
  orderSubmit: (b: { requestId: string; userSignature: string; vendor: string; quoteId: string; signingScheme?: string }) =>
    post<Wrapped<OrderSubmitData>>("/api/order/submit", b),
  orderStatus: (orderId: string, demoHint?: { poll: number; in?: string; out?: string }) =>
    get<Wrapped<OrderStatusData>>(`/api/order/${encodeURIComponent(orderId)}?${qs({ poll: demoHint ? String(demoHint.poll) : undefined, in: demoHint?.in, out: demoHint?.out })}`),
  tx: (hash: string, demoHint?: { wallet?: string; token?: string; in?: string; out?: string }) =>
    get<Wrapped<TxDetail[]>>(`/api/tx/${hash}?${qs({ ...demoHint, hs: hintFor(demoHint?.token).hs })}`),
};
