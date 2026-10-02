// Shared constants (safe for client + server). No secrets here.

export const BSC_CHAIN_ID = 56;
export const BINANCE_CHAIN_ID = "56"; // Binance Web3 API uses string chain ids

// Binance-Peg USDT on BNB Smart Chain. NOTE: 18 decimals on BSC (not 6 like on Ethereum).
export const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955" as const;
export const USDT_DECIMALS = 18;

// The "first share" ticket size, in USD (USDT).
export const BUY_AMOUNT_USD = 5;
export const MAX_AMOUNT_USD = 50; // server-side hard cap for safety

export const DEFAULT_SLIPPAGE = "1"; // percent
export const SLIPPAGE_CHOICES = ["0.5", "1", "2"] as const;

// Address used for quotes/simulations in demo mode when no wallet is connected.
export const DEMO_WALLET = "0xf125ef125ef125ef125ef125ef125ef125ef125e" as `0x${string}`;

export const BSCSCAN = "https://bscscan.com";
export const PUBLIC_BSC_RPC = "https://bsc-dataseed.bnbchain.org";

export function usdToUnits(usd: number, decimals = USDT_DECIMALS): string {
  // integer string in smallest unit, avoiding float errors for small values
  const cents = Math.round(usd * 100);
  return (BigInt(cents) * 10n ** BigInt(decimals - 2)).toString();
}
