import "server-only";
import type { MarketStatus, ReasonCode, StatusInfo } from "../types";
import { sessionAt } from "./marketClock";

/**
 * Live Binance RWA responses often return marketStatus: null while still
 * populating openState + reasonCode. The UI needs a concrete MarketStatus
 * for STATUS_COPY, so we infer one from openState/reasonCode + the NY clock.
 * Also fill nextOpen/nextClose when the API leaves them null.
 */
function findNext(from: number, pred: (s: MarketStatus) => boolean): number | null {
  const step = 5 * 60 * 1000;
  let t = Math.ceil(from / step) * step;
  for (let i = 0; i < 12 * 24 * 5; i++, t += step) if (pred(sessionAt(t))) return t;
  return null;
}

function inferMarketStatus(si: StatusInfo, now: number): MarketStatus {
  if (si.marketStatus) return si.marketStatus;
  const reason = si.reasonCode as ReasonCode | null;
  if (reason === "MARKET_PAUSED" || reason === "ASSET_PAUSED" || reason === "MARKET_MAINTENANCE") {
    return "pause";
  }
  if (reason === "MARKET_CLOSED" || reason === "UNSUPPORTED") {
    return "closed";
  }
  if (si.openState) {
    // Tradable — label with the current US equity session from the clock.
    return sessionAt(now);
  }
  // Not tradable; prefer clock session if it's closed/overnight, else pause.
  const clock = sessionAt(now);
  if (clock === "closed" || clock === "overnight") return clock;
  return "pause";
}

export function normalizeStatusInfo(si: StatusInfo | null | undefined, now = Date.now()): StatusInfo | null {
  if (!si) return null;
  const marketStatus = inferMarketStatus(si, now);
  let nextOpenTime = si.nextOpenTime;
  let nextCloseTime = si.nextCloseTime;

  if (nextOpenTime == null && (marketStatus === "closed" || marketStatus === "pause" || marketStatus === "overnight" || marketStatus === "premarket" || marketStatus === "postmarket")) {
    nextOpenTime = findNext(now, (s) => s === "regular");
  }
  if (nextCloseTime == null && marketStatus === "regular") {
    nextCloseTime = findNext(now, (s) => s !== "regular");
  }

  return {
    openState: si.openState,
    marketStatus,
    reasonCode: si.reasonCode,
    reasonMsg: si.reasonMsg,
    nextOpenTime,
    nextCloseTime,
  };
}
