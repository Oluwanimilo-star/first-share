import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { CURATED_STOCKS, ONDO_DEMO_STOCKS, findAnyStock } from "../stocks";
import { USDT_BSC, BINANCE_CHAIN_ID } from "../constants";
import { demoStatusInfo } from "./marketClock";
import type {
  ApproveTx,
  OCResult,
  OrderStatusData,
  OrderSubmitData,
  QuoteRoute,
  RwaPrice,
  RwaProfile,
  RwaToken,
  RwaUnderlyingMarket,
  SimulateData,
  SwapData,
  TxDetail,
} from "../types";

/**
 * DEMO MODE data. Every object below is shaped exactly like the documented
 * Binance Web3 API response (OpenAPI 1.0.0, Oct 2026). Numbers are illustrative,
 * NOT live prices. The UI labels all of this as "Demo data".
 */

// Illustrative reference prices (USD per share). Not live.
const DEMO_PRICES: Record<string, number> = {
  AAPL: 254.63,
  NVDA: 187.42,
  TSLA: 436.1,
  MSFT: 517.35,
  AMZN: 221.89,
  GOOGL: 246.54,
  SPY: 668.2,
};

// Small on-chain premium/discount per ticker so the "price gap" step has something to explain.
const DEMO_GAP_BPS: Record<string, number> = { AAPL: 12, NVDA: -18, TSLA: 35, MSFT: 6, AMZN: -9, GOOGL: 14, SPY: 3 };

const DEMO_ROUTER = "0x1de460f363AF910f51726DEf188F9004276Bf4bc"; // illustrative router address
const DEMO_PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3"; // canonical Permit2

function ok<T>(data: T): OCResult<T> {
  return { code: 0, msg: "success", data, timestamp: Date.now(), success: true };
}

export function err(code: number, msg: string): OCResult<never> {
  return { code, msg, data: null, timestamp: Date.now(), success: false };
}

function hexFrom(seed: string, bytes = 32): string {
  let out = "";
  let i = 0;
  while (out.length < bytes * 2) out += createHash("sha256").update(seed + i++).digest("hex");
  return out.slice(0, bytes * 2);
}

function demoPrices(ticker: string) {
  const ref = DEMO_PRICES[ticker] ?? 100;
  // tiny deterministic wobble per minute so the demo feels alive
  const minute = Math.floor(Date.now() / 60000);
  const wobble = (parseInt(hexFrom(ticker + minute, 2), 16) / 65535 - 0.5) * 0.004;
  const reference = ref * (1 + wobble);
  const token = reference * (1 + (DEMO_GAP_BPS[ticker] ?? 0) / 10000);
  return { reference: reference.toFixed(6), token: token.toFixed(6) };
}

function allDemoStocks() {
  return [...CURATED_STOCKS, ...ONDO_DEMO_STOCKS];
}

// GET /api/v1/dex/market/rwa/tokens
export function mockRwaTokens(platformId?: string, statusOverride?: string | null): OCResult<RwaToken[]> {
  const list = allDemoStocks().filter((s) => !platformId || s.platformId === platformId);
  return ok(
    list.map((s) => {
      const p = demoPrices(s.ticker);
      return {
        binanceChainId: BINANCE_CHAIN_ID,
        tokenContractAddress: s.address,
        platformId: s.platformId,
        assetType: s.kind === "ETF" ? 3 : 1,
        tokenName: s.platformId === "ondo" ? `${s.name} (Ondo Tokenized)` : `${s.name} bStock`,
        tokenSymbol: s.symbol,
        tokenLogoUrl: null,
        decimals: "18",
        underlyingTicker: s.ticker,
        underlyingName: s.name,
        underlyingNameZh: null,
        tokenToShareRatio: s.platformId === "ondo" ? "1.003701" : "1",
        tags: s.ticker === "NVDA" ? ["volumeSurge"] : null,
        statusInfo: demoStatusInfo(statusOverride),
        tokenPrice: p.token,
        referencePrice: p.reference,
        volume24H: (1_000_000 + parseInt(hexFrom(s.ticker, 3), 16)).toFixed(2),
        marketCap: null,
        peRatioTTM: s.kind === "ETF" ? null : "31.4",
      } satisfies RwaToken;
    }),
  );
}

// GET /api/v1/dex/market/rwa/price
export function mockRwaPrice(addresses: string[]): OCResult<RwaPrice[]> {
  return ok(
    addresses
      .map((a) => findAnyStock(a))
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => {
        const p = demoPrices(s.ticker);
        return {
          binanceChainId: BINANCE_CHAIN_ID,
          tokenContractAddress: s.address,
          platformId: s.platformId,
          tokenPrice: p.token,
          referencePrice: p.reference,
          tokenPriceUpdatedAt: Date.now() - 12_000,
        };
      }),
  );
}

// GET /api/v1/dex/market/rwa/underlying-profile
export function mockProfile(address: string): OCResult<RwaProfile> {
  const s = findAnyStock(address);
  if (!s) return err(40001, "Parameter [tokenContractAddress] error: token not found");
  const month = new Date(Date.now() - 32 * 864e5).toISOString().slice(0, 7);
  const day = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const base = `https://static.onchainos.com/images/web3-data/public/token/${s.platformId}/pdf`;
  const protections: Record<string, { supported: boolean; url: string | null }> =
    s.platformId === "ondo"
      ? {
          dailyAttestationReport: { supported: true, url: `${base}/daily-${day}.pdf` },
          monthlyAttestationReport: { supported: true, url: `${base}/monthly-${month}.pdf` },
        }
      : {
          monthlyAttestationReport: { supported: true, url: `${base}/monthly-${month}.pdf` },
          collateralReport: { supported: true, url: `${base}/collateral-${month}.pdf` },
          dailyAttestationReport: { supported: false, url: null },
        };
  return ok({
    binanceChainId: BINANCE_CHAIN_ID,
    tokenContractAddress: s.address,
    platformId: s.platformId,
    underlyingTicker: s.ticker,
    underlyingFullName: COMPANY[s.ticker]?.full ?? s.name,
    assetType: s.kind === "ETF" ? 3 : 1,
    tokenToShareRatio: s.platformId === "ondo" ? "1.003701" : "1",
    protections,
    companyInfo: {
      ceo: COMPANY[s.ticker]?.ceo ?? null,
      website: COMPANY[s.ticker]?.web ?? null,
      industry: COMPANY[s.ticker]?.industry ?? null,
      conceptsEn: COMPANY[s.ticker]?.concepts ?? [],
      conceptsCn: [],
      descriptionEn: COMPANY[s.ticker]?.desc ?? null,
      descriptionZh: null,
    },
  });
}

const COMPANY: Record<string, { full: string; ceo: string | null; web: string; industry: string; concepts: string[]; desc: string }> = {
  AAPL: { full: "Apple Inc.", ceo: "Tim Cook", web: "https://www.apple.com", industry: "Technology", concepts: ["Magnificent 7", "Consumer Electronics"], desc: "Apple Inc. designs, manufactures and markets smartphones, personal computers, tablets, wearables and accessories, and sells a variety of related services." },
  NVDA: { full: "NVIDIA Corporation", ceo: "Jensen Huang", web: "https://www.nvidia.com", industry: "Semiconductors", concepts: ["AI Chips", "Magnificent 7"], desc: "NVIDIA Corporation designs graphics processors and AI accelerators used in data centers, gaming and autonomous machines." },
  TSLA: { full: "Tesla, Inc.", ceo: "Elon Musk", web: "https://www.tesla.com", industry: "Automotive", concepts: ["Magnificent 7", "EV", "Energy"], desc: "Tesla, Inc. designs, develops, manufactures and sells electric vehicles and energy generation and storage systems." },
  MSFT: { full: "Microsoft Corporation", ceo: "Satya Nadella", web: "https://www.microsoft.com", industry: "Technology", concepts: ["Magnificent 7", "Cloud", "AI"], desc: "Microsoft Corporation develops software, cloud services, devices and solutions, including Windows, Office, Azure and Xbox." },
  AMZN: { full: "Amazon.com, Inc.", ceo: "Andy Jassy", web: "https://www.amazon.com", industry: "Consumer Discretionary", concepts: ["Magnificent 7", "Cloud", "E-commerce"], desc: "Amazon.com, Inc. operates online retail stores and Amazon Web Services (AWS), a leading cloud computing platform." },
  GOOGL: { full: "Alphabet Inc.", ceo: "Sundar Pichai", web: "https://abc.xyz", industry: "Communication Services", concepts: ["Magnificent 7", "AI", "Advertising"], desc: "Alphabet Inc. is the parent company of Google, YouTube, Android and other businesses." },
  SPY: { full: "SPDR S&P 500 ETF Trust", ceo: null, web: "https://www.ssga.com", industry: "ETF", concepts: ["ETF", "Index"], desc: "An exchange-traded fund that tracks the S&P 500 index of 500 large US companies. Managed by State Street Global Advisors." },
};

// GET /api/v1/dex/market/rwa/underlying-market
export function mockUnderlyingMarket(address: string, statusOverride?: string | null): OCResult<RwaUnderlyingMarket> {
  const s = findAnyStock(address);
  if (!s) return err(40001, "Parameter [tokenContractAddress] error: token not found");
  const p = demoPrices(s.ticker);
  const ref = Number(p.reference);
  return ok({
    binanceChainId: BINANCE_CHAIN_ID,
    tokenContractAddress: s.address,
    platformId: s.platformId,
    assetType: s.kind === "ETF" ? 3 : 1,
    statusInfo: demoStatusInfo(statusOverride),
    marketData: {
      referencePrice: p.reference,
      high52W: (ref * 1.12).toFixed(2),
      low52W: (ref * 0.68).toFixed(2),
      volumeShares24H: "48210377",
      avgDailyVolume1Y: "52114980",
      totalShares: s.kind === "ETF" ? "915032116" : "14840390000",
      marketCap: (ref * (s.kind === "ETF" ? 915032116 : 14840390000)).toFixed(0),
      turnoverRate: "0.33",
      amplitude: "1.42",
      peRatioTTM: s.kind === "ETF" ? null : "31.4",
      pbRatio: s.kind === "ETF" ? null : "48.2",
      dividendYield: "0.44",
      latestDividend: "0.26",
    },
  });
}

function routeTokens(toAddress: string) {
  const s = findAnyStock(toAddress);
  const p = demoPrices(s?.ticker ?? "AAPL");
  return {
    s,
    tokenPrice: Number(p.token),
    fromToken: {
      tokenContractAddress: USDT_BSC,
      tokenSymbol: "USDT",
      tokenUnitPrice: "1.0002",
      decimal: "18",
      isHoneyPot: false,
      taxRate: "0",
    },
    toToken: {
      tokenContractAddress: toAddress,
      tokenSymbol: s?.symbol ?? "STOCK",
      tokenUnitPrice: p.token,
      decimal: "18",
      isHoneyPot: false,
      taxRate: "0",
    },
  };
}

function toUnits(amountTokens: number): string {
  // 18 decimals, keep 9 significant decimals to avoid float noise
  return (BigInt(Math.floor(amountTokens * 1e9)) * 10n ** 9n).toString();
}

// GET /api/v1/dex/aggregator/quote
export function mockQuote(q: { amount: string; toTokenAddress: string; userWalletAddress?: string }): OCResult<QuoteRoute[]> {
  const { s, tokenPrice, fromToken, toToken } = routeTokens(q.toTokenAddress);
  if (!s) return err(40421, "Insufficient liquidity for this trading pair");
  const usd = Number(BigInt(q.amount) / 10n ** 14n) / 1e4;
  if (s.platformId === "ondo" && usd < 20) {
    return err(40375, "ONDO_FROM_USD_AMOUNT_TOO_SMALL: Minimum order amount is 20 USD.");
  }
  const rfqOut = (usd / tokenPrice) * 0.9985; // market-maker spread ~0.15%
  const ammOut = (usd / tokenPrice) * (0.9962 - usd / 1_000_000); // pool fee + price impact
  const rfq: QuoteRoute = {
    quoteId: hexFrom("rfq" + Date.now() + randomUUID(), 16),
    vendorName: "PcsXRfq",
    binanceChainId: BINANCE_CHAIN_ID,
    fromTokenAmount: q.amount,
    toTokenAmount: toUnits(rfqOut),
    tradeFee: "0.00",
    estimateGasFee: "0",
    priceImpactPercent: "-0.15",
    router: `${USDT_BSC}--${q.toTokenAddress}`,
    fromToken,
    toToken,
    dexRouterList: [
      {
        dexProtocol: { dexName: "PancakeSwap X (RFQ)", percent: "100.00" },
        fromToken: { tokenContractAddress: USDT_BSC, tokenSymbol: "USDT" },
        fromTokenIndex: "0",
        toToken: { tokenContractAddress: q.toTokenAddress, tokenSymbol: toToken.tokenSymbol },
        toTokenIndex: "1",
      },
    ],
    executionMode: "RFQ",
    approveTarget: DEMO_PERMIT2,
    isBest: true,
    feeAmount: null,
    feeToken: null,
    actualSwapAmount: null,
  };
  if (s.platformId === "ondo") {
    // Ondo is RFQ-only (InchFusion + CowSwap + PcsXRfq).
    const inch: QuoteRoute = { ...rfq, quoteId: hexFrom("inch" + Date.now(), 16), vendorName: "InchFusion", toTokenAmount: toUnits(rfqOut * 0.9991), isBest: false, approveTarget: "0x111111125421cA6dc452d289314280a0f8842A65", dexRouterList: [{ ...rfq.dexRouterList![0], dexProtocol: { dexName: "1inch Fusion (RFQ)", percent: "100.00" } }] };
    return ok([rfq, inch]);
  }
  const amm: QuoteRoute = {
    ...rfq,
    quoteId: hexFrom("amm" + Date.now() + randomUUID(), 16),
    vendorName: "LiquidMesh",
    toTokenAmount: toUnits(ammOut),
    tradeFee: "0.04",
    estimateGasFee: "185000",
    priceImpactPercent: (-0.38 - usd / 10000).toFixed(2),
    executionMode: "SWAP",
    approveTarget: DEMO_ROUTER,
    isBest: false,
    dexRouterList: [
      {
        dexProtocol: { dexName: "PancakeSwap V3", percent: "100.00" },
        fromToken: { tokenContractAddress: USDT_BSC, tokenSymbol: "USDT" },
        fromTokenIndex: "0",
        toToken: { tokenContractAddress: q.toTokenAddress, tokenSymbol: toToken.tokenSymbol },
        toTokenIndex: "1",
      },
    ],
  };
  return ok([rfq, amm]);
}

// GET /api/v1/dex/aggregator/swap
export function mockSwap(q: {
  amount: string;
  toTokenAddress: string;
  userWalletAddress: string;
  slippagePercent: string;
  quoteId: string;
  routeHint?: string; // our own hint (demo only): "SWAP" | "RFQ:<vendor>"
}): OCResult<SwapData> {
  const quote = mockQuote({ amount: q.amount, toTokenAddress: q.toTokenAddress });
  if (!quote.data) return quote as OCResult<never>;
  const wantRfq = (q.routeHint ?? "RFQ").startsWith("RFQ");
  const vendor = q.routeHint?.split(":")[1] ?? "PcsXRfq";
  const r = quote.data.find((x) => (wantRfq ? x.executionMode === "RFQ" && x.vendorName === vendor : x.executionMode === "SWAP")) ?? quote.data[0];
  const slip = Number(q.slippagePercent || "1");
  const minReceive = ((BigInt(r.toTokenAmount) * BigInt(Math.round((100 - slip) * 1000))) / 100000n).toString();
  const { quoteId: _q, executionMode, approveTarget: _a, isBest: _b, ...routerResult } = r;
  void _q; void _a; void _b;
  if (executionMode === "SWAP") {
    return ok({
      routerResult,
      tx: {
        from: q.userWalletAddress,
        to: DEMO_ROUTER,
        data: "0x5f575529" + hexFrom("calldata" + q.quoteId, 196),
        value: "0",
        gas: "214000",
        gasPrice: "100000000",
        maxPriorityFeePerGas: null,
        minReceiveAmount: minReceive,
        slippagePercent: q.slippagePercent,
        signatureData: [],
      },
      executionMode: "SWAP",
      rfq: null,
    });
  }
  const deadline = Math.floor(Date.now() / 1000) + 120;
  const typedData = {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      PermitWitnessTransferFrom: [
        { name: "permitted", type: "TokenPermissions" },
        { name: "spender", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "witness", type: "Order" },
      ],
      TokenPermissions: [
        { name: "token", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      Order: [
        { name: "maker", type: "address" },
        { name: "taker", type: "address" },
        { name: "inputToken", type: "address" },
        { name: "outputToken", type: "address" },
        { name: "inputAmount", type: "uint256" },
        { name: "outputAmount", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "PermitWitnessTransferFrom",
    domain: { name: "Permit2", chainId: 56, verifyingContract: DEMO_PERMIT2 },
    message: {
      permitted: { token: USDT_BSC, amount: q.amount },
      spender: DEMO_ROUTER,
      nonce: String(parseInt(hexFrom(q.quoteId, 6), 16)),
      deadline: String(deadline),
      witness: {
        maker: "0x7a9f00000000000000000000000000000000a001",
        taker: q.userWalletAddress,
        inputToken: USDT_BSC,
        outputToken: q.toTokenAddress,
        inputAmount: q.amount,
        outputAmount: r.toTokenAmount,
        deadline: String(deadline),
      },
    },
  };
  return ok({
    routerResult,
    tx: null,
    executionMode: "RFQ",
    rfq: {
      vendor: r.vendorName as "PcsXRfq",
      txType: "EIP712",
      typedDataToSign: JSON.stringify(typedData),
      signingScheme: "EIP712",
      signatureData: [],
      orderId: hexFrom("order" + q.quoteId, 16),
    },
  });
}

// GET /api/v1/dex/aggregator/approve-transaction
export function mockApprove(q: { approveAmount: string; vendor?: string }): OCResult<ApproveTx[]> {
  const spender = q.vendor === "PcsXRfq" ? DEMO_PERMIT2 : q.vendor === "InchFusion" ? "0x111111125421cA6dc452d289314280a0f8842A65" : DEMO_ROUTER;
  const data =
    "0x095ea7b3" +
    spender.slice(2).toLowerCase().padStart(64, "0") +
    BigInt(q.approveAmount).toString(16).padStart(64, "0");
  return ok([{ data, dexContractAddress: spender, gasLimit: "50000", gasPrice: "100000000" }]);
}

// POST /api/v1/dex/pre-transaction/simulate
export function mockSimulate(body: { evmTx?: { from: string; to: string; data?: string; value?: string } }): OCResult<SimulateData> {
  const tx = body.evmTx;
  if (!tx) return err(40001, "Parameter [evmTx] error: required for EVM chains");
  const data = (tx.data ?? "").toLowerCase();
  if (data.startsWith("0x095ea7b3")) {
    const spender = "0x" + data.slice(34, 74);
    const amount = BigInt("0x" + data.slice(74, 138)).toString();
    return ok({
      status: "SUCCESS",
      failReason: null,
      balanceChanges: [{ contractAddress: "", tokenType: "NATIVE", change: "-4600000000000", owner: tx.from }],
      allowanceChanges: [{ tokenAddress: tx.to, owner: tx.from, spender, preAmount: "0", postAmount: amount }],
    });
  }
  return { code: 0, msg: "success", data: null, timestamp: Date.now(), success: true };
}

/** Swap simulation needs the expected amounts, which the stateless mock gets from the caller. */
export function mockSimulateSwap(from: string, amountIn: string, tokenOut: string, amountOut: string): OCResult<SimulateData> {
  return ok({
    status: "SUCCESS",
    failReason: null,
    balanceChanges: [
      { contractAddress: USDT_BSC, tokenType: "ERC20", change: "-" + amountIn, owner: from },
      { contractAddress: tokenOut, tokenType: "ERC20", change: amountOut, owner: from },
      { contractAddress: "", tokenType: "NATIVE", change: "-21400000000000", owner: from },
    ],
    allowanceChanges: [],
  });
}

// POST /api/v1/dex/aggregator/order/submit
export function mockOrderSubmit(): OCResult<OrderSubmitData> {
  return ok({ orderId: "oc-o-" + hexFrom(randomUUID(), 6), status: "PENDING_VENDOR", createdAt: Date.now() });
}

// GET /api/v1/dex/aggregator/order/{orderId}
export function mockOrderStatus(orderId: string, polls: number, amountIn?: string, amountOut?: string): OCResult<OrderStatusData> {
  const createdAt = Date.now() - 4000;
  if (polls < 1) return ok({ orderId, status: "PENDING_VENDOR", txHash: null, fromAmount: null, toAmount: null, filledAt: null, createdAt });
  if (polls < 2) return ok({ orderId, status: "PENDING_ONCHAIN", txHash: null, fromAmount: null, toAmount: null, filledAt: null, createdAt });
  return ok({
    orderId,
    status: "FILLED",
    txHash: "0x" + hexFrom("tx" + orderId),
    fromAmount: amountIn ?? null,
    toAmount: amountOut ?? null,
    filledAt: Date.now(),
    createdAt,
  });
}

// GET /api/v1/dex/post-transaction/transaction-detail-by-txhash
export function mockTxDetail(txHash: string, wallet?: string, token?: string, amountIn?: string, amountOut?: string): OCResult<TxDetail[]> {
  const s = token ? findAnyStock(token) : undefined;
  return ok([
    {
      chainIndex: BINANCE_CHAIN_ID,
      height: String(62_000_000 + (parseInt(txHash.slice(2, 8), 16) % 100000)),
      txTime: String(Date.now() - 3000),
      txhash: txHash,
      txStatus: "success",
      gasLimit: "214000",
      gasUsed: "171302",
      gasPrice: "100000000",
      txFee: "0.0000171302",
      nonce: "7",
      amount: "0",
      symbol: "BNB",
      methodId: "0x5f575529",
      tokenTransferDetails: [
        { from: wallet ?? "", to: DEMO_ROUTER, isFromContract: false, isToContract: true, tokenContractAddress: USDT_BSC, symbol: "USDT", amount: amountIn ?? "0" },
        { from: DEMO_ROUTER, to: wallet ?? "", isFromContract: true, isToContract: false, tokenContractAddress: token ?? "", symbol: s?.symbol ?? "", amount: amountOut ?? "0" },
      ],
    },
  ]);
}
