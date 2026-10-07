/**
 * Client-safe NYSE timetable, used when the live RWA market-status API doesn't answer.
 * Regular session 09:30–16:00 America/New_York, Mon–Fri, minus NYSE holidays
 * (2026–2027), with 13:00 early closes. Labelled "estimated from market hours" in the UI.
 */
const HOLIDAYS = new Set([
  // 2026
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  // 2027
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);
const EARLY_CLOSE = new Set(["2026-11-27", "2026-12-24", "2027-11-26"]);

const OPEN_MIN = 9 * 60 + 30;
const CLOSE_MIN = 16 * 60;
const EARLY_CLOSE_MIN = 13 * 60;

function nyParts(ms: number) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday as string);
  return { date: `${p.year}-${p.month}-${p.day}`, dow, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

function isOpenAt(ms: number): boolean {
  const { date, dow, minutes } = nyParts(ms);
  if (dow < 1 || dow > 5 || HOLIDAYS.has(date)) return false;
  const close = EARLY_CLOSE.has(date) ? EARLY_CLOSE_MIN : CLOSE_MIN;
  return minutes >= OPEN_MIN && minutes < close;
}

function findNext(from: number, wantOpen: boolean): number | null {
  const step = 5 * 60 * 1000;
  let t = Math.ceil(from / step) * step;
  for (let i = 0; i < 12 * 24 * 10; i++, t += step) if (isOpenAt(t) === wantOpen) return t;
  return null;
}

export type EstimatedMarket = {
  open: boolean;
  reason: "open" | "weekend" | "holiday" | "before-open" | "after-close";
  nextOpenTime: number | null;
  nextCloseTime: number | null;
};

export function estimateNyse(now = Date.now()): EstimatedMarket {
  const open = isOpenAt(now);
  const { date, dow, minutes } = nyParts(now);
  const reason: EstimatedMarket["reason"] = open
    ? "open"
    : dow === 0 || dow === 6
      ? "weekend"
      : HOLIDAYS.has(date)
        ? "holiday"
        : minutes < OPEN_MIN
          ? "before-open"
          : "after-close";
  return {
    open,
    reason,
    nextOpenTime: open ? null : findNext(now, true),
    nextCloseTime: open ? findNext(now, false) : null,
  };
}

export const ESTIMATE_REASON_COPY: Record<EstimatedMarket["reason"], string> = {
  open: "It's a weekday between 9:30am and 4pm in New York, so the main US session should be open.",
  weekend: "It's the weekend in New York, so the main US stock market is shut.",
  holiday: "Today is a US stock-market holiday, so the exchange is shut all day.",
  "before-open": "The main US session hasn't opened yet today (it opens at 9:30am New York time).",
  "after-close": "The main US session has finished for today (it closes at 4pm New York time).",
};
