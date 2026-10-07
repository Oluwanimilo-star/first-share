// Fake balances for the "Try demo" wallet. Clearly labelled demo in the UI; never real.
export const DEMO_BNB_WEI = 12n * 10n ** 15n; // 0.012 BNB (~$9 of gas)
export const DEMO_USDT_WEI = 25n * 10n ** 18n; // 25 USDT
/** Starting demo positions (token → raw 18-dec amount). Priced tickers only. */
export const DEMO_POSITIONS: Record<string, string> = {
  "0x02fca66c1d1afb4e2a7884261eb00f63598a7436": "50000000000000000", // 0.05 NVDAB
  "0x7138b48df7d98d7e3cc221bfe7192d0a178182d8": "10000000000000000", // 0.01 SPYB
};
/** Rough BNB price used only to show "≈ $" next to gas balances. */
export const BNB_USD_ESTIMATE = 780;
/** ~$0.25 of BNB covers an approval + a swap on BSC with room to spare. */
export const MIN_GAS_WEI = 300000000000000n; // 0.0003 BNB
export const GET_FUNDS_URL = "https://www.binance.com/en/support/faq/detail/c47822d9bcc343b9a96601e9cc54b002";
