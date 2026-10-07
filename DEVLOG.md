# DEVLOG — First Share

Notes kept while building, mainly to help with the DevEx report. Dates in Africa/Lagos time (UTC+1).

## 2026-10-02 — v0.1 (first working version)

### How I got the docs
- `curl` to any docs page, `llms.txt` or `llms-full.txt` returns **HTTP 202 with an empty body** (bot check).
  `WebFetch`-style fetchers get nothing either. Only a real headless Chromium (Playwright) gets the content.
- `llms-full.txt` (≈450 KB) is great for the guides, but the **API Reference part only has one-line summaries**
  per endpoint: no parameters, no response fields, no examples.
- The real goldmine is the OpenAPI file at
  `https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/1.0.0/schema.json` (1.6 MB, OpenAPI 3.0.2).
  It's only linked from the reference page's link list; it isn't mentioned in `llms.txt` or the Agent Native page.
  It should be (and should be fetchable without a browser).

### Doc gaps / errors / ambiguities found
1. **`rfq.orderId` is missing from the `/swap` response schema**, but `POST /order/submit` says its `quoteId` must
   be "`rfq.orderId` from the `/swap` response" (the Integration Flow guide repeats this). The `rfq` object in the
   schema only lists `vendor, txType, typedDataToSign, signingScheme, signatureData`. The app sends `rfq.orderId`
   if present, otherwise falls back to the `/quote` route `quoteId`. **Unconfirmed until tested with live keys.**
2. **`rfq.typedDataToSign` format is ambiguous:** "serialized as a hex string (or JSON-encoded string)".
   `eth_signTypedData_v4` needs the JSON. Is the hex form hex-encoded JSON, or an EIP-712 digest (`0x1901…`)?
   A digest can't be signed by normal wallets. The app accepts JSON or hex-encoded JSON and refuses a raw digest
   with a clear message. There's **no example `/swap` response for RFQ** anywhere.
3. **USDT decimals mistake in the quote/swap examples:** `amount` example says `"1000000" = 1 USDT (decimals=6)`
   while the example `fromTokenAddress` is BSC USDT `0x55d3…7955`, which has **18 decimals** on BSC.
   A beginner following this would quote 0.000000000001 USDT. (Approve-transaction's example uses Ethereum USDT,
   so 6 decimals is right there, which makes it more confusing.)
4. **RWA `decimals` type mismatch:** schema says `string` ("18"), the example response shows a number `18`.
5. **`referencePrice` meaning is unclear:** described as "a per-share converted price derived from the on-chain
   token price, not an official quote from the traditional stock market". If it's derived from the token price,
   is the token-vs-reference "gap" meaningful? I treat it as a per-share benchmark and adjust by
   `tokenToShareRatio`, but a sentence on how it's computed (and when it differs from `tokenPrice`) would help.
6. **Market-hours semantics per platform aren't documented.** `marketStatus` has premarket / regular /
   postmarket / overnight / closed / pause, but nothing says whether bStock or Ondo actually **fill** in
   premarket / postmarket / overnight. Error 40369 just says "outside trading hours". The relation between
   `openState` and `marketStatus` isn't spelled out either (is `overnight` + `openState=true` possible?).
7. **Minimum order sizes:** Ondo has a minimum (error 40375's example says "Minimum order amount is 20 USD"),
   only visible in the error-code table. bStock's minimum (if any) isn't documented. A $5 "first share" only
   works on bStock, so the Ondo tab defaults to $25.
8. **bStock counter-token whitelist (40370) isn't listed.** Only the campaign page lists "eligible payment tokens"
   (BNB, USDT, USDC, U, USD1), and that's for the contest, not the API. The app uses USDT.
9. **`protections` example only covers Ondo** (daily + monthly attestation). There's no bStock example, so I don't
   know which keys bStock returns (`collateralReport`?). The demo uses monthly + collateral for bStock; this is
   a guess and is labelled demo data.
10. **RWA Data has no xStocks coverage:** `platformId` enum is only `ondo | bstock`, although the Trading API
    supports xStock (type=2, AMM). So the "Is it backed?" / market-status steps can't work for xStocks.
11. **Wallet API naming inconsistency:** `transaction-detail-by-txhash` returns `chainIndex` and `txhash`
    (lower-case h) while every other endpoint uses `binanceChainId` and `txHash`.
12. **Error responses return `"data": ""`** (empty string) in practice (seen with an invalid key → 40101), while
    the Authentication page says `"data": null`.
13. **Simulation can't dry-run an RFQ order.** `/simulate` takes an `evmTx`; RFQ orders are EIP-712 signatures
    settled by a relayer, so for Ondo / bStock-RFQ you can only simulate the approval. The app shows the decoded
    typed data instead. A "preview RFQ fill" endpoint, or `simulate=true` on `/swap` like the DeFi endpoints,
    would close this gap.
14. **The Integration Flow assumes a backend signer with a private key** (Python `eth-account` example →
    `/broadcast-transaction`). Browser/mobile wallets (MetaMask, Binance Wallet, Trust via WalletConnect)
    don't support `eth_signTransaction`; they sign **and** broadcast. So dApps can't use
    `/broadcast-transaction` or `enableMevProtection`. A short "integrating with browser wallets" section would help.
15. **Approval ordering is confusing:** the SWAP flow says call `/approve-transaction` *before* `/quote`
    (spender unknown yet), RFQ says *after* `/quote` (needs `vendorName`). The app always quotes first (cheap,
    30 s TTL), approves, then re-quotes. It works for both, but one recommended order would be simpler.
16. **`/quote` `vendor` param** only accepts `LiquidMesh | Pancake | Jupiter`, so you can't force an RFQ vendor;
    you have to filter routes client-side by `executionMode` / `vendorName`.
17. **Restricted regions go beyond the US:** the list also has UK, Canada, Netherlands and Japan (conditional),
    and "both client IP and server location are checked". So besides the US regions (`iad1`, `cle1`, `pdx1`, `sfo1`),
    Vercel's London (`lhr1`) and Tokyo (`hnd1`/`kix1`) regions should be avoided too. The app pins `sin1`.
18. **The "Eligible bStock Tokens" page is stale:** "Effective week 2026-08-11 → 2026-09-01, updated weekly", but
    on 2026-10-02 it still showed that week. I used its BSC contract addresses for the curated list (and
    cross-check against `/rwa/tokens` in live mode).
19. **API key permission domains** (Market / Trading / Transaction / Wallet…) are only mentioned in the changelog
    (2026-08-27), not on the Authentication page. A 40104 would confuse a newcomer.

### What I verified
- HMAC signing follows the Authentication page exactly (`timestamp + METHOD + /build + path?query + body`,
  Base64 HMAC-SHA256). With a fake key, the gateway answers `40101 Invalid API Key` for all three RWA calls, so
  the request reaches the gateway and is parsed. (A correct-signature check needs a real key.)
- Demo mode: every route returns documented shapes; full 9-step click-through in headless Chromium with zero
  page errors (screenshots in `screenshots/`).
- Reown AppKit modal opens on desktop and mobile. With a dummy project ID the wallet list is empty (the
  WalletConnect explorer returns 403), which is expected. A real project ID is needed to see the
  MetaMask / Binance / Trust tiles.

### Build notes
- `@reown/appkit-adapter-wagmi@1.8.24` with wagmi 3 conflicts (an optional peer chain pulls an incompatible
  `ox`). Fixed by using **wagmi 2.19** and an npm `overrides` entry pinning the adapter's `@wagmi/connectors` to 6.2.0.
- Turbopack can't resolve `@x402/*` optional imports inside `@coinbase/cdp-sdk` (pulled in by
  `@base-org/account` → wagmi's baseAccount connector). Fixed by aliasing `@coinbase/cdp-sdk` to a tiny stub in
  `next.config.ts` (the app never uses Coinbase server wallets).

### Still to verify with live keys
- `/rwa/tokens?platformId=bstock` actually contains the curated tickers (AAPLB, NVDAB, TSLAB, …) on chain 56.
- Real `/swap` RFQ payload: presence of `rfq.orderId`, the exact `typedDataToSign` encoding.
- Which quote routes bStock returns at $5 (LiquidMesh SWAP and/or PcsXRfq RFQ) and during which sessions.
- Ondo minimum on BSC, and that USDT is an accepted counter-token for bStock.

## 2026-10-07 — v3 (judge-proof demo path)

### What changed
- Client-side **Try demo** toggle that works with live keys: per-request `x-first-share-demo: 1` header →
  mocked trade routes, live market data. Mock quotes take a price hint (`hp`/`hs`/`hpf`) from the live list
  so the demo quote matches the price the user just saw, for any of the ~490 live tokens.
- Quote state lifted into a `useQuote` hook (30 s countdown, auto-refresh, stale-request guard) shared by the
  quote step, confirm step and bottom nav. Executor re-quotes when a price is >20 s old.
- NYSE-timetable fallback for step 4, balance preflight, network guard, issuer compare (bStocks / Ondo /
  xStocks) with a "Verified token" badge, share math pie, share card (html-to-image), local buy ledger → P/L.

### New DevEx findings
20. **`/rwa/price` answers for tokens that `/rwa/tokens` doesn't list.** AAPLB (`0x431a…9b7a`) and AMZNB
    (`0x1a4b…eb00`) are missing from `/rwa/tokens?platformId=bstock` but `/rwa/price` and
    `/rwa/underlying-profile` still return data for them. It isn't documented whether that means "delisted",
    "paused" or "list is paginated / filtered". A `status`/`listed` flag on the token list would remove the guess.
21. **`priceImpactPercent` can come back as `"0.0000000000"`-style strings** with 10 decimals on RFQ-ish
    LiquidMesh routes; documenting precision (or returning a number) would save formatting code.
22. **No xStocks in RWA Data** (see #10) means there's no way to build a "verified contract" check for
    xStocks — the compare table has to say "Not in Binance RWA data".
23. **Reown AppKit with `allowUnsupportedChain: false`** auto-opens an undismissable "Switch network" sheet
    when an injected wallet is on chain 1. Good default; the app still keeps its own in-page guard (no quote,
    no signing off chain 56) for the plain-injected path and for wallets that switch mid-flow.

### Verified
- `scripts/v3_clickthrough.py`: all 9 steps in Try-demo mode, mobile 390×844 + desktop 1280×900, against live
  market data: **0 page errors, 0 raw-error strings** in the page. Also: forced market-status failure → step 4
  shows the estimated status; no wallet → "Connect wallet to rehearse" is enabled; share PNG downloads.
- `scripts/v3_network_guard.py`: mock injected wallet on Ethereum (refuses all sign/send) → our guard blocks the
  quote (0 `/api/quote` calls), switch → quote + live preflight (empty test wallet → "Top up first").
