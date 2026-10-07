// Plain-English copy, written in a friendly educator's voice.
import type { MarketStatus, ReasonCode } from "./types";

export const STATUS_COPY: Record<MarketStatus, { label: string; tone: "good" | "ok" | "warn" | "bad"; emoji: string; text: string }> = {
  regular: {
    label: "Open — regular hours",
    tone: "good",
    emoji: "🟢",
    text: "The US stock market is open right now. This is the busiest time of day, so prices are the most reliable and the gap between buy and sell prices is usually smallest. Great time for a first buy.",
  },
  premarket: {
    label: "Pre-market (early morning)",
    tone: "ok",
    emoji: "🌅",
    text: "It's early morning in New York, before the main session opens at 9:30am. Some trading happens, but fewer people are around — so prices can jump around more and the spread is wider. Fine for a tiny $5 test, just expect a slightly worse price.",
  },
  postmarket: {
    label: "After-hours (evening)",
    tone: "ok",
    emoji: "🌆",
    text: "The main session ended at 4pm New York time. After-hours trading is quieter, a bit like a shop with only one till open. You may get a slightly worse price than during the day.",
  },
  overnight: {
    label: "Overnight session",
    tone: "ok",
    emoji: "🌙",
    text: "It's night-time in New York. A thin overnight session runs on some venues, but very few traders are active. On-chain prices can drift from the real stock until the morning, so keep orders small.",
  },
  closed: {
    label: "Market closed",
    tone: "bad",
    emoji: "🔒",
    text: "The US stock market is closed (usually nights, weekends or a public holiday). Tokenized-stock market makers mostly stop quoting when the real market is shut, so buying now will likely be refused. Nothing is wrong — just come back when it reopens.",
  },
  pause: {
    label: "Trading paused",
    tone: "bad",
    emoji: "⏸️",
    text: "Trading in this stock is paused. This happens for things like a stock split, a dividend being paid, a merger or a short exchange halt. It protects everyone from trading on a wrong price. It normally resumes on its own.",
  },
};

export const REASON_COPY: Record<ReasonCode, string> = {
  TRADING: "Trading normally.",
  MARKET_CLOSED: "The whole market is closed right now.",
  MARKET_PAUSED: "The whole market is temporarily paused.",
  MARKET_MAINTENANCE: "The system is under scheduled maintenance.",
  ASSET_PAUSED: "Just this one stock is paused — usually for a company event.",
  ASSET_LIMITED: "This stock is restricted (often around an earnings announcement) but not fully paused.",
  UNSUPPORTED: "This token isn't supported for trading here.",
};

export const REASON_MSG_COPY: Record<string, string> = {
  "Weekend or Holiday": "It's the weekend or a US public holiday.",
  Holiday: "Today is a US stock-market holiday, so the exchange is shut all day.",
  cash_dividend: "The company is paying a cash dividend (a share of its profits) to shareholders.",
  stock_dividend: "The company is handing out extra shares as a dividend.",
  stock_split: "The company is splitting its shares (e.g. 1 share becomes 2 cheaper ones). Your value stays the same.",
  merger: "The company is merging with another company.",
  acquisition: "The company is being bought or is buying another company.",
  spinoff: "The company is spinning off part of its business into a new company.",
  maintenance: "Routine maintenance.",
  "corporate action": "A company event is being processed.",
  earnings: "The company is about to report (or just reported) its earnings, so trading is limited.",
};

export const PROTECTION_COPY: Record<string, { title: string; text: string }> = {
  dailyAttestationReport: {
    title: "Daily attestation report",
    text: "An independent check, published every day, confirming the real shares held match the tokens out there.",
  },
  monthlyAttestationReport: {
    title: "Monthly attestation report",
    text: "A monthly report from an independent firm confirming the shares backing the tokens actually exist.",
  },
  collateralReport: {
    title: "Collateral report",
    text: "Shows what assets are held as collateral behind the tokens.",
  },
};

/** Map Binance Web3 API error codes to friendly words. */
export function friendlyError(code: number, msg: string): string {
  const m: Record<number, string> = {
    40101: "The app's API key isn't valid. (Owner: check BINANCE_W3W_API_KEY.)",
    40102: "The app's request signature was rejected. If this happened while buying, make sure you signed with the same wallet you connected.",
    40103: "The server's clock is out of sync. Please try again.",
    40104: "The app's API key doesn't have permission for this.",
    40301: "This service isn't available in the server's region.",
    40302: "A VPN or proxy was detected. Please use a direct connection.",
    40401: "The price quote expired (they only last ~30 seconds). Let's grab a fresh one.",
    40421: "There isn't enough liquidity for this stock right now.",
    40441: "No market maker returned a price right now. Please try again in a moment.",
    40367: "Ondo can't trade this stock right now — the US market is closed or halted.",
    40369: "bStocks can't trade right now — the stock exchange is closed.",
    40374: "No one is offering this tokenized stock right now. Try another one or come back later.",
    40366: "That order is bigger than the market maker allows for this stock.",
    40375: `That's below Ondo's minimum order size. ${msg.match(/Minimum order amount is [^.]+\./)?.[0] ?? ""}`,
    40463: "The price impact is too high for this trade size.",
    42900: "Too many requests — please wait a few seconds.",
    42901: "Your order is already being submitted. Hang tight.",
    50000: "The trading service hit an error. Please try again.",
    50001: "The trading service is temporarily unavailable. Please try again shortly.",
  };
  if (m[code]) return m[code];
  // Never surface raw gateway text to beginners.
  if (code === -1) return "We couldn't reach the market data service. Please try again.";
  // Common gateway / chain phrases that leak through unknown codes
  const lower = (msg || "").toLowerCase();
  if (/outside trading hours|market.?closed|40369|40367/.test(lower)) {
    return "Trading is closed for this stock right now. Come back when the US market is open.";
  }
  if (/insufficient liquidity|40421|40374/.test(lower)) {
    return "There isn't enough liquidity for this trade right now. Try a smaller amount or another stock.";
  }
  if (/quote.*(expir|invalid)|40401/.test(lower)) {
    return "The price quote expired (they only last ~30 seconds). Let's grab a fresh one.";
  }
  return "Something went wrong loading this step. Please try again in a moment.";
}

/** Map on-chain / simulator failReason strings to plain English. Never return raw gateway text. */
export type SimFailKind = "allowance" | "balance" | "closed" | "other";

export function classifySimFail(reason: string | null | undefined): SimFailKind {
  const r = (reason || "").toLowerCase();
  if (/allowance|transfer_from_failed|\bstf\b|exceeds allowance/.test(r)) return "allowance";
  if (/exceeds balance|insufficient (funds|balance)|transfer amount exceeds balance|erc20: transfer amount exceeds balance|bep20: transfer amount exceeds balance/.test(r)) {
    return "balance";
  }
  if (/trading hours|market.?closed|paused/.test(r)) return "closed";
  return "other";
}

export function friendlySimFail(reason: string | null | undefined): string {
  const kind = classifySimFail(reason);
  if (kind === "allowance") {
    return "Would fail right now — only because the spending permission hasn't been given yet. That's expected; we'll ask for it first when you buy.";
  }
  if (kind === "balance") {
    return "Would fail right now because this wallet doesn't have enough tokens for the rehearsal. That's fine — when you trade for real we check your balance first.";
  }
  if (kind === "closed") {
    return "Would fail because trading is closed right now. Come back when the US market is open.";
  }
  return "The dress rehearsal couldn't complete this part. Your money is safe — nothing was sent. You can still continue; we'll re-check everything before a real trade.";
}
