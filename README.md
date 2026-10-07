# First Share 🪙

**Buy your first tokenized stock on BNB Chain — one friendly step at a time.**

First Share is a guided, mobile-friendly web app for people who have never touched crypto. It walks you
through buying about **$5 of a real company's stock as a token** (bStocks or Ondo on BNB Smart Chain),
with a short plain-English explainer at every step.

Built for **BNB Hack: Tokenized Stocks Edition** on the Binance Web3 API.

---

## The 9 steps

| # | Step | What it shows | Powered by |
|---|------|---------------|-----------|
| 1 | **Pick a company** | Curated list (Apple, NVIDIA, Tesla, Microsoft, Amazon, Alphabet, S&P 500 ETF) with on-chain price and market status. Tabs for **bStocks** and **Ondo**. | RWA Data: token list |
| 2 | **What is a tokenized stock?** | Coat-check-ticket explainer, diagram, contract link on BscScan | — |
| 3 | **Is it really backed?** | Token-to-share ratio + attestation / collateral report links + company info | RWA Data: underlying profile |
| 4 | **Can I buy right now?** | `marketStatus` / `reasonCode` / `reasonMsg` / `nextOpenTime` in plain words, in your own time zone | RWA Data: underlying market |
| 5 | **Is the price fair?** | On-chain price vs reference price, gap %, 52-week range | RWA Data: price + underlying market |
| 6 | **Get a quote ($5)** | All routes side by side — **AMM** (liquidity pool) vs **RFQ** (market maker), slippage explained, auto-refresh (quotes last ~30 s) | Trading API: quote |
| 7 | **Dress rehearsal** | Dry-run: simulates the USDT approval and the swap; for RFQ orders shows exactly what your signature authorizes | Trading API: approve + swap, Transaction API: simulate |
| 8 | **Buy it** | Live execution with a progress checklist: network check → balance check → exact-amount approval → fresh quote → sign/send → settle | Trading API (+ RFQ submit/poll), your wallet |
| 9 | **You own a share!** | Receipt with BscScan link, amount, % of one share, "add token to wallet" | Wallet API: tx detail, RFQ order status |

---

## Demo mode vs live mode

- **Demo mode** turns on automatically when the API keys are missing. Every screen works, using realistic
  mock responses shaped exactly like the documented Binance Web3 API responses. Everything is labelled
  **"Demo data"**, no wallet pop-ups appear, and no money moves. Step 4 has a "preview other situations"
  switch (pre-market, closed, paused…) so you can demo every market state.
- **Live mode** turns on when `BINANCE_W3W_API_KEY` and `BINANCE_W3W_API_SECRET` are set. Real prices, real
  quotes, real trades from the user's own wallet on BNB Smart Chain (chain 56).
- **"Try demo" toggle** (header, next to Connect wallet — or open
  [`/?demo=1`](https://first-share-two.vercel.app/?demo=1)) works *even when live keys exist*: a pretend wallet
  (`0xf125…125e`, $25 USDT + 0.012 BNB), **live** market data and prices, but a sample quote, a rehearsed
  signature and a fake receipt. The browser sends `x-first-share-demo: 1`, and the trade routes (quote / swap /
  approve / simulate / order / tx) answer with mocked responses — forcing a mock can only remove the ability
  to trade, never add it. Real wallet stays the default.

### Guard rails (so nobody gets stuck)
- **Price on every card** — tokens without a live price are tucked away; curated tokens missing from
  `/rwa/tokens` get a price from `/rwa/price`.
- **Step 4 never fails** — if `/rwa/underlying-market` doesn't answer, the status is worked out from the NYSE
  timetable (9:30–16:00 New York, weekdays, 2026–27 holidays) and labelled *estimated from market hours*.
- **Network guard** — on any chain other than 56 we don't quote, and the Buy step refuses to sign.
- **Balance preflight** — BNB for gas + USDT on BSC, with a one-sentence fix and a Binance withdraw guide link.
- **Quote countdown** — 30 s timer, auto-refresh at zero; the executor re-quotes if a price is >20 s old and
  won't submit an RFQ order signed after the price expired.
- **One risk check** — "This can go down, and it's not a broker account" before any buy.
- **Never a dead button** — no wallet → "Connect wallet to rehearse" (+ Try demo); failed quote/rehearsal →
  "Try again"; step pills jump to any visited/allowed step.
- **Share card** after a buy (PNG download, copy text, post to X) and **Holdings P/L** from a local buy ledger.

### What a buyer needs in live mode
- A wallet (MetaMask, Binance Wallet, Trust Wallet…) on BNB Smart Chain
- **USDT on BNB Chain (BEP-20)** for the purchase (≥ $5 for bStocks; Ondo has a ~$20 minimum)
- A little **BNB** (≈ $0.20) for network fees

---

## Setup (plain English)

### 1. Run it on your computer
1. Install **Node.js 20+** from nodejs.org.
2. Open a terminal in this folder and run:
   ```bash
   npm install
   npm run dev
   ```
3. Open http://localhost:3000. With no keys it runs in **demo mode** — everything is clickable.

### 2. Get your Binance Web3 API key (turns on live mode)
1. Go to the Binance Web3 Developer Portal: https://web3.binance.com/en/dev-portal/project and sign in with your Binance account.
2. Create a **project**, then create an **API key** inside it.
3. On the permissions screen, tick **Market**, **Trading**, **Transaction** and **Wallet**.
4. Don't turn on an IP allow-list (Vercel's server addresses change).
5. Copy the **API Key** and the **Secret Key**. The secret is shown **once** — save it somewhere safe.
   Never paste it into chat, a screenshot, or anything starting with `NEXT_PUBLIC_`.

### 3. Get a free WalletConnect (Reown) project ID (turns on phone wallets + QR codes)
1. Go to https://dashboard.reown.com and sign up (free).
2. Create a new project → choose **AppKit** → framework **Next.js**.
3. Copy the **Project ID**.
4. In the project's settings, add your website address (e.g. `https://first-share.vercel.app`) and
   `http://localhost:3000` to the **allowed domains** list.

Without this ID the app still works with browser-extension wallets on desktop and inside wallet apps'
built-in browsers on phones; with it, desktop users get a QR code and phone users get one-tap links to
MetaMask, Binance Wallet and Trust Wallet.

### 4. Put the keys in place
- **On your computer:** copy `.env.example` to `.env.local` and fill in the three values.
- **On Vercel:** Project → Settings → Environment Variables → add
  `BINANCE_W3W_API_KEY`, `BINANCE_W3W_API_SECRET`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, then **redeploy**
  (the `NEXT_PUBLIC_` value is baked in at build time).

### 5. Deploy to Vercel (free tier)
1. Push this folder to a GitHub repository.
2. On vercel.com, **Add New → Project**, import the repo, keep the defaults, add the env vars above, deploy.
3. `vercel.json` pins the server functions to **Singapore (`sin1`)**. This matters: the Binance Web3 API
   refuses requests from servers in the US (and UK, Canada, Netherlands, Japan conditionally). Don't
   change it to a US region. `fra1` (Frankfurt) is a fine alternative.

---

## How it's built

- **Next.js 16 (App Router) + TypeScript + Tailwind CSS v4**, mobile-first.
- **All Binance Web3 API calls happen on the server** in route handlers under `src/app/api/*`. They sign
  each request with HMAC-SHA256 (`src/lib/server/w3w.ts`). Keys never reach the browser.
- **Wallets:** wagmi + viem on BNB Smart Chain (56). With a WalletConnect project ID, **Reown AppKit**
  provides the connect modal (injected/EIP-6963 extensions, QR, mobile deep links, wallet in-app browsers;
  MetaMask, Binance Wallet and Trust Wallet are featured). Without it, wagmi's injected connector is used.
- **Execution** (`src/lib/client/trade.ts`):
  - **SWAP route (AMM, e.g. bStock via LiquidMesh):** `/quote` → exact-amount `approve` (only if allowance is
    short) → fresh `/quote` → `/swap` → user's wallet sends `data.tx` → wait for receipt → read the
    received amount from the token's `Transfer` log.
  - **RFQ route (Ondo; bStock via PcsXRfq):** `/quote` → vendor-specific `approve` (`vendor=<vendorName>`) →
    `/swap` → wallet signs `rfq.typedDataToSign` with `eth_signTypedData_v4` → `POST /order/submit`
    (fresh UUID `requestId`) → poll `GET /order/{orderId}` until `FILLED` / `FAILED` / `EXPIRED` / `CANCELLED`.
  - Approvals are always for the **exact** purchase amount, never unlimited.
- **Safety rails on the server:** sell token fixed to USDT, amount capped at $50, slippage capped at 5%,
  all addresses/hashes validated.

### Project layout
```
src/app/api/…            server route handlers (sign + proxy Binance Web3 API, or return demo data)
src/lib/server/w3w.ts    HMAC-SHA256 request signing + fetch
src/lib/server/mock.ts   demo-mode responses (documented shapes)
src/lib/server/marketClock.ts  demo market sessions from the real New York clock
src/lib/client/wallet.ts wagmi / Reown AppKit setup
src/lib/client/trade.ts  the live trade executor (SWAP + RFQ)
src/lib/explain.ts       all the plain-English copy (statuses, reasons, errors)
src/components/…         UI: Flow (stepper), steps, wallet button
scripts/screenshots.py   headless click-through that captures every step
```

---

## Every Binance Web3 API endpoint used

Base URL `https://web3.binance.com/build`, all signed (`X-OC-APIKEY`, `X-OC-TIMESTAMP`, `X-OC-SIGN`).

| Our route | Method & Binance endpoint | Used in step |
|---|---|---|
| `GET /api/stocks` | `GET /api/v1/dex/market/rwa/tokens?binanceChainId=56&platformId=bstock\|ondo` | 1 |
| `GET /api/stock/:address` | `GET /api/v1/dex/market/rwa/underlying-profile?binanceChainId=56&tokenContractAddress=` | 3 |
| 〃 | `GET /api/v1/dex/market/rwa/underlying-market?binanceChainId=56&tokenContractAddress=` | 4, 5 |
| 〃 | `GET /api/v1/dex/market/rwa/price?binanceChainId=56&tokenContractAddresses=` | 5 |
| `GET /api/quote` | `GET /api/v1/dex/aggregator/quote` (USDT → stock token, `userWalletAddress` for RFQ) | 6, 7, 8 |
| `GET /api/approve` | `GET /api/v1/dex/aggregator/approve-transaction` (USDT, exact amount, `vendor` for RFQ) | 7, 8 |
| `GET /api/swap` | `GET /api/v1/dex/aggregator/swap` (`quoteId`, `slippagePercent`) | 7, 8 |
| `POST /api/simulate` | `POST /api/v1/dex/pre-transaction/simulate` (`evmTx`) | 7 |
| `POST /api/order/submit` | `POST /api/v1/dex/aggregator/order/submit` (RFQ) | 8 |
| `GET /api/order/:orderId` | `GET /api/v1/dex/aggregator/order/{orderId}` (RFQ polling) | 8 |
| `GET /api/tx/:hash` | `GET /api/v1/dex/post-transaction/transaction-detail-by-txhash` (Wallet API) | 9 |

Not used (on purpose): `POST /api/v1/dex/pre-transaction/broadcast-transaction` — browser wallets
(MetaMask, Binance Wallet, Trust) sign **and** broadcast in one step and don't hand back a raw signed
transaction, so the wallet broadcasts. See DEVLOG.md.

---

## Screenshots

See `screenshots/` (`mobile-01-pick.png` … `mobile-09-receipt.png`, plus desktop versions).
Re-generate with the dev server running:
```bash
pip install playwright && playwright install chromium
python scripts/screenshots.py http://localhost:3000 --desktop
```

## Disclaimer
Educational project. Not investment advice. Tokenized stocks are not covered by securities insurance, may be
restricted in your country, can be paused for corporate actions, and can lose value.
