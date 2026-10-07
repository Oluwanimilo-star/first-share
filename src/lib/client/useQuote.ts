"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, unwrap } from "./api";
import { pickRoute, type RouteChoice } from "./trade";
import { usdToUnits } from "../constants";
import type { QuoteRoute } from "../types";

/** Market-maker prices are a promise that lasts about 30 seconds. */
export const QUOTE_TTL_S = 30;

export function friendlyClientError(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  const m = (e as Error)?.message ?? "";
  if (/rejected|denied/i.test(m)) return "You cancelled in your wallet. No problem — nothing was spent.";
  if (/fetch|network|timeout|load failed/i.test(m)) return "We couldn't reach the price service. Check your connection and try again.";
  // Our own thrown errors are already written in plain English (see trade.ts) — keep them short.
  if (m && m.length < 220 && !/0x[0-9a-f]{16,}|\{|\bat\b .*\(/i.test(m)) return m.split("\n")[0];
  return "Something went wrong. Nothing was sent — please try again.";
}

/**
 * Quote state for the buy flow, lifted out of the step components so the quote step,
 * the confirm step and the bottom navigation all see the same price + countdown.
 * Auto-refreshes when the countdown hits zero, so a stale quote is never shown as current.
 */
export function useQuote(p: { wallet: `0x${string}` | null; token: string | null; amountUsd: number; enabled: boolean }) {
  const { wallet, token, amountUsd, enabled } = p;
  const [routes, setRoutes] = useState<QuoteRoute[]>([]);
  const [choice, setChoice] = useState<RouteChoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotedAt, setQuotedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const choiceRef = useRef<RouteChoice | null>(null);
  const reqId = useRef(0);
  useEffect(() => {
    choiceRef.current = choice;
  }, [choice]);

  const refresh = useCallback(async () => {
    if (!wallet || !token) return;
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const r = unwrap(await api.quote({ token, amount: usdToUnits(amountUsd), wallet }));
      if (id !== reqId.current) return;
      if (!r.length) throw new ApiError(40441, "no routes");
      setRoutes(r);
      setQuotedAt(Date.now());
      setNow(Date.now());
      const c = choiceRef.current;
      const keep = c && r.find((x) => x.executionMode === c.mode && x.vendorName === c.vendor);
      const best = keep ?? pickRoute(r);
      setChoice(best ? { mode: best.executionMode, vendor: best.vendorName } : null);
    } catch (e) {
      if (id !== reqId.current) return;
      setRoutes([]);
      setQuotedAt(null);
      setError(friendlyClientError(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [wallet, token, amountUsd]);

  const reset = useCallback(() => {
    reqId.current++;
    setRoutes([]);
    setChoice(null);
    setQuotedAt(null);
    setError(null);
    setLoading(false);
  }, []);

  // Fetch whenever the inputs change while the quote is visible.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-change
    if (enabled) void refresh();
  }, [enabled, refresh]);

  // 1 s tick for the countdown.
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [enabled]);

  const secondsLeft = quotedAt ? Math.max(0, QUOTE_TTL_S - Math.floor((now - quotedAt) / 1000)) : null;

  // At zero: fetch a fresh price instead of letting anyone act on a dead one.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- countdown expiry triggers a refetch
    if (enabled && secondsLeft === 0 && !loading) void refresh();
  }, [enabled, secondsLeft, loading, refresh]);

  const expired = secondsLeft === 0;
  return { routes, choice, setChoice, loading, error, quotedAt, secondsLeft, expired, refresh, reset };
}
export type QuoteState = ReturnType<typeof useQuote>;
