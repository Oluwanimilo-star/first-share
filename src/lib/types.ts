// Types mirror the documented Binance Web3 API responses (OpenAPI 1.0.0).
// Every endpoint returns the OCResult<T> envelope.

export type OCResult<T> = {
  code: number;
  msg: string;
  data: T | null;
  timestamp?: number;
  success?: boolean;
};

/** What our own route handlers return to the browser: the OCResult plus a demo flag. */
export type Wrapped<T> = OCResult<T> & { demo: boolean };

export type MarketStatus =
  | "premarket"
  | "regular"
  | "postmarket"
  | "overnight"
  | "closed"
  | "pause";

export type ReasonCode =
  | "TRADING"
  | "MARKET_CLOSED"
  | "MARKET_PAUSED"
  | "MARKET_MAINTENANCE"
  | "ASSET_PAUSED"
  | "ASSET_LIMITED"
  | "UNSUPPORTED";

export type StatusInfo = {
  openState: boolean;
  marketStatus: MarketStatus;
  reasonCode: ReasonCode | null;
  reasonMsg: string | null;
  nextOpenTime: number | null;
  nextCloseTime: number | null;
};

// GET /api/v1/dex/market/rwa/tokens
export type RwaToken = {
  binanceChainId: string;
  tokenContractAddress: string;
  platformId: string;
  assetType: 1 | 2 | 3;
  tokenName: string;
  tokenSymbol: string;
  tokenLogoUrl: string | null;
  decimals: string | number; // schema says string, doc example shows number
  underlyingTicker: string;
  underlyingName: string;
  underlyingNameZh: string | null;
  tokenToShareRatio: string;
  tags: string[] | null;
  statusInfo: StatusInfo;
  tokenPrice: string;
  referencePrice: string;
  volume24H: string | null;
  marketCap: string | null;
  peRatioTTM: string | null;
};

// GET /api/v1/dex/market/rwa/price
export type RwaPrice = {
  binanceChainId: string;
  tokenContractAddress: string;
  platformId: string;
  tokenPrice: string;
  referencePrice: string;
  tokenPriceUpdatedAt: number;
};

// GET /api/v1/dex/market/rwa/underlying-profile
export type Protection = { supported: boolean; url: string | null };
export type RwaProfile = {
  binanceChainId: string;
  tokenContractAddress: string;
  platformId: string;
  underlyingTicker: string;
  underlyingFullName: string;
  assetType: 1 | 2 | 3;
  tokenToShareRatio: string;
  protections: Record<string, Protection> | null;
  companyInfo: {
    ceo: string | null;
    website: string | null;
    industry: string | null;
    conceptsEn: string[] | null;
    conceptsCn: string[] | null;
    descriptionEn: string | null;
    descriptionZh: string | null;
    /** Live API currently returns this instead of descriptionEn. */
    description?: string | null;
  } | null;
};

// GET /api/v1/dex/market/rwa/underlying-market
export type RwaUnderlyingMarket = {
  binanceChainId: string;
  tokenContractAddress: string;
  platformId: string;
  assetType: 1 | 2 | 3;
  statusInfo: StatusInfo;
  marketData: {
    referencePrice: string;
    high52W?: string | null;
    low52W?: string | null;
    volumeShares24H?: string | null;
    avgDailyVolume1Y?: string | null;
    totalShares?: string | null;
    marketCap?: string | null;
    turnoverRate?: string | null;
    amplitude?: string | null;
    peRatioTTM?: string | null;
    pbRatio?: string | null;
    dividendYield?: string | null;
    latestDividend?: string | null;
  };
};

export type QuoteToken = {
  tokenContractAddress: string;
  tokenSymbol: string;
  tokenUnitPrice: string | null;
  decimal: string;
  isHoneyPot: boolean;
  taxRate: string;
};

export type DexRouterSegment = {
  dexProtocol: { dexName: string; percent: string };
  fromToken: { tokenContractAddress: string; tokenSymbol: string };
  fromTokenIndex: string;
  toToken: { tokenContractAddress: string; tokenSymbol: string };
  toTokenIndex: string;
};

// GET /api/v1/dex/aggregator/quote  (data is an array of routes)
export type QuoteRoute = {
  quoteId: string;
  vendorName: string;
  binanceChainId: string;
  fromTokenAmount: string;
  toTokenAmount: string;
  tradeFee: string | null;
  estimateGasFee: string | null;
  priceImpactPercent: string | null;
  router: string | null;
  fromToken: QuoteToken;
  toToken: QuoteToken;
  dexRouterList: DexRouterSegment[] | null;
  executionMode: "SWAP" | "RFQ";
  approveTarget: string | null;
  isBest: boolean;
  feeAmount: string | null;
  feeToken: string | null;
  actualSwapAmount: string | null;
};

// GET /api/v1/dex/aggregator/swap
export type SwapData = {
  routerResult: Omit<QuoteRoute, "quoteId" | "executionMode" | "approveTarget" | "isBest">;
  tx: {
    from: string;
    to: string;
    data: string;
    value: string;
    gas: string;
    gasPrice: string;
    maxPriorityFeePerGas: string | null;
    minReceiveAmount: string;
    slippagePercent: string;
    signatureData: string[] | null;
  } | null;
  executionMode: "SWAP" | "RFQ";
  rfq: {
    vendor: "InchFusion" | "CowSwap" | "PcsXRfq";
    txType: "EIP712" | "RAW_TX";
    typedDataToSign: string;
    signingScheme: string;
    signatureData: string[] | null;
    /** Not in the /swap response schema, but /order/submit says quoteId = rfq.orderId. */
    orderId?: string;
  } | null;
};

// GET /api/v1/dex/aggregator/approve-transaction (data is an array)
export type ApproveTx = {
  data: string;
  dexContractAddress: string;
  gasLimit: string;
  gasPrice: string;
};

// POST /api/v1/dex/pre-transaction/simulate
export type SimulateData = {
  status: "SUCCESS" | "FAILED" | string;
  failReason: string | null;
  balanceChanges: {
    contractAddress: string;
    tokenType: string;
    change: string;
    owner: string;
  }[];
  allowanceChanges: {
    tokenAddress: string;
    owner: string;
    spender: string;
    preAmount: string;
    postAmount: string;
  }[];
};

// POST /api/v1/dex/aggregator/order/submit
export type OrderSubmitData = { orderId: string; status: string; createdAt: number };

// GET /api/v1/dex/aggregator/order/{orderId}
export type OrderStatusData = {
  orderId: string;
  status: "PENDING_VENDOR" | "PENDING_ONCHAIN" | "FILLED" | "FAILED" | "EXPIRED" | "CANCELLED" | string;
  txHash: string | null;
  fromAmount: string | null;
  toAmount: string | null;
  filledAt: number | null;
  createdAt: number;
};

// GET /api/v1/dex/post-transaction/transaction-detail-by-txhash (data is an array)
export type TxDetail = {
  chainIndex: string;
  height: string;
  txTime: string;
  txhash: string;
  txStatus: "success" | "fail" | "pending";
  gasLimit: string;
  gasUsed: string;
  gasPrice: string;
  txFee: string;
  nonce: string;
  amount: string;
  symbol: string;
  methodId: string | null;
  tokenTransferDetails: {
    from: string;
    to: string;
    isFromContract: boolean;
    isToContract: boolean;
    tokenContractAddress: string;
    symbol: string;
    amount: string;
  }[];
};

/** Combined payload returned by our /api/stock/[address] route. */
export type StockBundle = {
  demo: boolean;
  profile: OCResult<RwaProfile>;
  market: OCResult<RwaUnderlyingMarket>;
  price: OCResult<RwaPrice[]>;
};
