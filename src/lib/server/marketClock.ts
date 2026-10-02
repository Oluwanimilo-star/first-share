import type { MarketStatus, StatusInfo } from "../types";

/**
 * Demo-only: derive a realistic US-equity session from the real clock (America/New_York).
 * Sessions (Mon–Fri, ET): premarket 04:00–09:30, regular 09:30–16:00,
 * postmarket 16:00–20:00, overnight 20:00–04:00 (Sun night → Fri morning), otherwise closed.
 * US market holidays are ignored in demo mode.
 */
function etParts(ms: number) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(f.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday as string);
  return { dow, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function sessionAt(ms: number): MarketStatus {
  const { dow, minutes } = etParts(ms);
  const weekday = dow >= 1 && dow <= 5;
  if (weekday && minutes >= 570 && minutes < 960) return "regular";
  if (weekday && minutes >= 240 && minutes < 570) return "premarket";
  if (weekday && minutes >= 960 && minutes < 1200) return "postmarket";
  // overnight: Sun–Thu 20:00 → next day 04:00
  if ((dow >= 0 && dow <= 4 && minutes >= 1200) || (dow >= 1 && dow <= 5 && minutes < 240)) {
    if (dow === 0 && minutes < 1200) return "closed";
    return "overnight";
  }
  return "closed";
}

function findNext(from: number, pred: (s: MarketStatus) => boolean): number | null {
  const step = 5 * 60 * 1000;
  let t = Math.ceil(from / step) * step;
  for (let i = 0; i < 12 * 24 * 5; i++, t += step) if (pred(sessionAt(t))) return t;
  return null;
}

/** Next moment the session *changes into* `target` (ignores the current session if already in it). */
function nextTransitionTo(from: number, target: MarketStatus): number | null {
  const step = 5 * 60 * 1000;
  let t = Math.ceil(from / step) * step;
  let prev = sessionAt(t - step);
  for (let i = 0; i < 12 * 24 * 7; i++, t += step) {
    const cur = sessionAt(t);
    if (cur === target && prev !== target) return t;
    prev = cur;
  }
  return null;
}

export function demoStatusInfo(override?: string | null, now = Date.now()): StatusInfo {
  const forced = override as MarketStatus | undefined;
  const status: MarketStatus =
    forced && ["premarket", "regular", "postmarket", "overnight", "closed", "pause"].includes(forced)
      ? forced
      : sessionAt(now);

  // Next regular-session open / close, from the real clock.
  const isLive = !forced || status === sessionAt(now);
  const nextOpen = isLive ? findNext(now, (s) => s === "regular") : nextTransitionTo(now, "regular");
  const nextClose = status === "regular" ? (isLive ? findNext(now, (s) => s !== "regular") : nextTransitionTo(now, "postmarket")) : null;

  switch (status) {
    case "regular":
      return { openState: true, marketStatus: "regular", reasonCode: null, reasonMsg: null, nextOpenTime: null, nextCloseTime: nextClose };
    case "premarket":
    case "postmarket":
    case "overnight":
      // Extended hours: the docs don't say whether bStock trades here; demo assumes "open but thinner".
      return {
        openState: true,
        marketStatus: status,
        reasonCode: null,
        reasonMsg: null,
        nextOpenTime: nextOpen,
        nextCloseTime: isLive ? findNext(now, (s) => s !== status) : null,
      };
    case "pause":
      return {
        openState: false,
        marketStatus: "pause",
        reasonCode: "ASSET_PAUSED",
        reasonMsg: "stock_split",
        nextOpenTime: nextOpen,
        nextCloseTime: null,
      };
    default:
      return {
        openState: false,
        marketStatus: "closed",
        reasonCode: "MARKET_CLOSED",
        // A forced "closed" preview on a weekday reads as a market holiday.
        reasonMsg: isLive ? "Weekend or Holiday" : "Holiday",
        nextOpenTime: isLive ? findNext(now, (s) => s !== "closed") ?? nextOpen : nextTransitionTo(now, "premarket") ?? nextOpen,
        nextCloseTime: null,
      };
  }
}
