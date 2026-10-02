import "server-only";
import { createHmac } from "node:crypto";
import type { OCResult } from "../types";

/**
 * Binance Web3 API client (server-side only).
 *
 * Auth (https://web3.binance.com/en/dev-docs/authentication):
 *   preHash   = timestamp + METHOD + requestPath + body
 *   requestPath MUST include the "/build" prefix and the raw query string.
 *   X-OC-SIGN = Base64(HMAC-SHA256(preHash, secretKey))
 *   headers: X-OC-APIKEY, X-OC-TIMESTAMP (ISO 8601 ms), X-OC-SIGN
 */

const HOST = "https://web3.binance.com";
const BUILD_PREFIX = "/build";

export function isDemoMode(): boolean {
  if (process.env.FIRST_SHARE_FORCE_DEMO === "1") return true;
  return !process.env.BINANCE_W3W_API_KEY || !process.env.BINANCE_W3W_API_SECRET;
}

type Query = Record<string, string | number | boolean | undefined | null>;

export function buildQueryString(query?: Query): string {
  if (!query) return "";
  return Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

export function signRequest(opts: {
  secret: string;
  timestamp: string;
  method: string;
  requestPath: string; // includes /build and ?query
  body: string;
}): string {
  const preHash = opts.timestamp + opts.method.toUpperCase() + opts.requestPath + opts.body;
  return createHmac("sha256", opts.secret).update(preHash, "utf8").digest("base64");
}

export async function w3w<T>(
  method: "GET" | "POST",
  path: string, // e.g. /api/v1/dex/market/rwa/tokens  (without /build)
  opts: { query?: Query; body?: unknown } = {},
): Promise<OCResult<T>> {
  const apiKey = process.env.BINANCE_W3W_API_KEY;
  const secret = process.env.BINANCE_W3W_API_SECRET;
  if (!apiKey || !secret) {
    return { code: -1, msg: "Server is missing BINANCE_W3W_API_KEY / BINANCE_W3W_API_SECRET", data: null };
  }

  const qs = buildQueryString(opts.query);
  const pathWithQuery = qs ? `${path}?${qs}` : path;
  const requestPath = BUILD_PREFIX + pathWithQuery;
  const body = method === "GET" ? "" : JSON.stringify(opts.body ?? {});
  const timestamp = new Date().toISOString();
  const sign = signRequest({ secret, timestamp, method, requestPath, body });

  const headers: Record<string, string> = {
    "X-OC-APIKEY": apiKey,
    "X-OC-TIMESTAMP": timestamp,
    "X-OC-SIGN": sign,
    "X-OC-RECV-WINDOW": "10000",
    Accept: "application/json",
  };
  if (method !== "GET") headers["Content-Type"] = "application/json";

  try {
    const res = await fetch(HOST + requestPath, {
      method,
      headers,
      body: method === "GET" ? undefined : body,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    try {
      return JSON.parse(text) as OCResult<T>;
    } catch {
      return {
        code: res.status || -1,
        msg: `Non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`,
        data: null,
      };
    }
  } catch (e) {
    return { code: -1, msg: `Network error calling Binance Web3 API: ${(e as Error).message}`, data: null };
  }
}
