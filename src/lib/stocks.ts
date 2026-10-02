// Curated beginner-friendly list. Contract addresses are the bStock (BSC) tokens
// published in the Binance Web3 docs "Eligible bStock Tokens" page.
// In live mode these are cross-checked against GET /api/v1/dex/market/rwa/tokens.

export type CuratedStock = {
  ticker: string;
  symbol: string; // on-chain token symbol
  name: string;
  address: `0x${string}`;
  platformId: "bstock" | "ondo";
  blurb: string; // one-line plain-English hook
  color: string; // tile colour for the logo fallback
  kind: "Stock" | "ETF";
};

export const CURATED_STOCKS: CuratedStock[] = [
  {
    ticker: "AAPL",
    symbol: "AAPLB",
    name: "Apple",
    address: "0x431a3bee82e2ca41e49895cbece5bb0f76a89b7a",
    platformId: "bstock",
    blurb: "The iPhone company. A classic first stock.",
    color: "#111827",
    kind: "Stock",
  },
  {
    ticker: "NVDA",
    symbol: "NVDAB",
    name: "NVIDIA",
    address: "0x02fca66c1d1afb4e2a7884261eb00f63598a7436",
    platformId: "bstock",
    blurb: "Makes the chips that power AI.",
    color: "#4d7c0f",
    kind: "Stock",
  },
  {
    ticker: "TSLA",
    symbol: "TSLAB",
    name: "Tesla",
    address: "0x5b1910eaad6450e50f816082aa078c41f10c292f",
    platformId: "bstock",
    blurb: "Electric cars, batteries and robots.",
    color: "#b91c1c",
    kind: "Stock",
  },
  {
    ticker: "MSFT",
    symbol: "MSFTB",
    name: "Microsoft",
    address: "0x80106cb3ead06659a5ad19df39d9b4733863b9b0",
    platformId: "bstock",
    blurb: "Windows, Office, Xbox and cloud.",
    color: "#0369a1",
    kind: "Stock",
  },
  {
    ticker: "AMZN",
    symbol: "AMZNB",
    name: "Amazon",
    address: "0x1a4b499833a79a09ad7cf1d42d7dacf71e92eb00",
    platformId: "bstock",
    blurb: "Online shopping and cloud computing.",
    color: "#c2410c",
    kind: "Stock",
  },
  {
    ticker: "GOOGL",
    symbol: "GOOGLB",
    name: "Alphabet (Google)",
    address: "0x3f53de71c126bdabae20f9cd64848d317f6c3238",
    platformId: "bstock",
    blurb: "Google Search, YouTube and Android.",
    color: "#1d4ed8",
    kind: "Stock",
  },
  {
    ticker: "SPY",
    symbol: "SPYB",
    name: "S&P 500 ETF",
    address: "0x7138b48df7d98d7e3cc221bfe7192d0a178182d8",
    platformId: "bstock",
    blurb: "One token, 500 big US companies.",
    color: "#7c3aed",
    kind: "ETF",
  },
];

export function findCurated(address: string): CuratedStock | undefined {
  const a = address.toLowerCase();
  return CURATED_STOCKS.find((s) => s.address.toLowerCase() === a);
}

export const PLATFORM_LABEL: Record<string, string> = {
  bstock: "bStocks",
  ondo: "Ondo Global Markets",
  xstock: "xStocks",
};

// Ondo tokens used in DEMO mode only. The address below is the NVDAon example
// from the Binance Web3 API docs (Search RWA Token example). In live mode the Ondo
// list comes from GET /api/v1/dex/market/rwa/tokens?platformId=ondo.
export const ONDO_DEMO_STOCKS: CuratedStock[] = [
  {
    ticker: "NVDA",
    symbol: "NVDAon",
    name: "NVIDIA",
    address: "0xa9ee28c80f960b889dfbd1902055218cba016f75",
    platformId: "ondo",
    blurb: "Makes the chips that power AI. (Ondo version)",
    color: "#4d7c0f",
    kind: "Stock",
  },
];

export function findAnyStock(address: string): CuratedStock | undefined {
  const a = address.toLowerCase();
  return [...CURATED_STOCKS, ...ONDO_DEMO_STOCKS].find((s) => s.address.toLowerCase() === a);
}

export function curatedByTicker(ticker: string): CuratedStock | undefined {
  return CURATED_STOCKS.find((s) => s.ticker === ticker.toUpperCase());
}

/** Shape the client works with for a pickable stock (from API in live mode, or curated/demo). */
export type StockOption = {
  ticker: string;
  symbol: string;
  name: string;
  address: string;
  platformId: string;
  logoUrl: string | null;
  blurb: string;
  color: string;
  kind: "Stock" | "ETF";
  decimals: number;
  tokenPrice: string | null;
  referencePrice: string | null;
  tokenToShareRatio: string | null;
  marketStatus: string | null;
  openState: boolean | null;
  inApi: boolean; // true when the token was found in the RWA token list response
};
