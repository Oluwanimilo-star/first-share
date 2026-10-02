"use client";
/**
 * The live trade executor. Talks to the user's wallet (wagmi) and to our own
 * server routes (which sign Binance Web3 API calls). In demo mode, the exact same
 * sequence runs against mocked API responses and skips the wallet pop-ups.
 */
import {
  getAccount,
  getBalance,
  getConnectorClient,
  readContract,
  sendTransaction,
  switchChain,
  waitForTransactionReceipt,
} from "wagmi/actions";
import { erc20Abi, hexToString, parseEventLogs, type Hex } from "viem";
import type { Config } from "wagmi";
import { api, unwrap } from "./api";
import { BSC_CHAIN_ID, USDT_BSC } from "../constants";
import type { QuoteRoute } from "../types";

export type RouteChoice = { mode: "SWAP" | "RFQ"; vendor: string };

export type TradePlan = {
  token: `0x${string}`;
  tokenSymbol: string;
  tokenDecimals: number;
  amount: string; // USDT smallest unit
  slippage: string;
  route: RouteChoice;
  wallet: `0x${string}`;
  demo: boolean;
};

export type StepKey = "network" | "balance" | "approve" | "quote" | "confirm" | "settle";
export type StepState = { key: StepKey; label: string; status: "todo" | "doing" | "done" | "skipped" | "error"; detail?: string };

export type TradeResult = {
  mode: "SWAP" | "RFQ";
  vendor: string;
  txHash: string | null;
  approveTxHash: string | null;
  orderId: string | null;
  amountIn: string;
  amountOut: string | null;
  demo: boolean;
};

export const INITIAL_STEPS: StepState[] = [
  { key: "network", label: "Check you're on BNB Chain", status: "todo" },
  { key: "balance", label: "Check you have enough USDT", status: "todo" },
  { key: "approve", label: "Give one-time permission to spend your USDT", status: "todo" },
  { key: "quote", label: "Lock in a fresh price", status: "todo" },
  { key: "confirm", label: "Confirm in your wallet", status: "todo" },
  { key: "settle", label: "Wait for BNB Chain to confirm", status: "todo" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function pickRoute(routes: QuoteRoute[], choice?: RouteChoice): QuoteRoute | undefined {
  if (!routes.length) return undefined;
  if (choice) {
    const exact = routes.find((r) => r.executionMode === choice.mode && r.vendorName === choice.vendor);
    if (exact) return exact;
    const sameMode = routes.find((r) => r.executionMode === choice.mode);
    if (sameMode) return sameMode;
  }
  return routes.find((r) => r.isBest) ?? routes[0];
}

/** Accepts JSON, or hex-encoded JSON (docs say "hex string (or JSON-encoded string)"). */
export function normalizeTypedData(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("0x")) {
    if (s.toLowerCase().startsWith("0x1901")) {
      throw new Error("The order came back as a pre-hashed EIP-712 digest, which wallets can't display or sign safely. (See DEVLOG: typedDataToSign format.)");
    }
    s = hexToString(s as Hex);
  }
  const obj = JSON.parse(s) as { types: Record<string, { name: string; type: string }[]>; domain: Record<string, unknown> };
  if (!obj.types.EIP712Domain && obj.domain) {
    const order: [string, string][] = [["name", "string"], ["version", "string"], ["chainId", "uint256"], ["verifyingContract", "address"], ["salt", "bytes32"]];
    obj.types.EIP712Domain = order.filter(([k]) => k in obj.domain).map(([name, type]) => ({ name, type }));
  }
  return JSON.stringify(obj);
}

export async function executeTrade(
  config: Config,
  plan: TradePlan,
  onStep: (key: StepKey, patch: Partial<StepState>) => void,
): Promise<TradeResult> {
  const { demo, wallet, amount, token } = plan;
  const fake = (ms: number) => (demo ? sleep(ms) : Promise.resolve());
  let approveTxHash: string | null = null;

  // 1) Network
  onStep("network", { status: "doing" });
  if (!demo) {
    const acct = getAccount(config);
    if (!acct.address) throw new Error("Please connect your wallet first.");
    if (acct.address.toLowerCase() !== wallet.toLowerCase()) throw new Error("Your wallet account changed. Please go back one step and re-check.");
    if (acct.chainId !== BSC_CHAIN_ID) {
      onStep("network", { detail: "Asking your wallet to switch to BNB Smart Chain…" });
      await switchChain(config, { chainId: BSC_CHAIN_ID });
    }
  }
  await fake(600);
  onStep("network", { status: "done", detail: "BNB Smart Chain (chain 56)" });

  // 2) Balances
  onStep("balance", { status: "doing" });
  if (!demo) {
    const [usdtBal, bnbBal] = await Promise.all([
      readContract(config, { address: USDT_BSC, abi: erc20Abi, functionName: "balanceOf", args: [wallet], chainId: BSC_CHAIN_ID }),
      getBalance(config, { address: wallet, chainId: BSC_CHAIN_ID }),
    ]);
    if (usdtBal < BigInt(amount)) throw new Error("You don't have enough USDT on BNB Chain for this buy. Top up your wallet with USDT (BEP-20) and try again.");
    if (bnbBal.value < 300000000000000n) throw new Error("You need a little BNB (about $0.20 worth) to pay network fees. Add some BNB to your wallet and try again.");
  }
  await fake(700);
  onStep("balance", { status: "done", detail: demo ? "Demo wallet: 25.00 USDT, 0.01 BNB" : "Enough USDT and BNB for fees" });

  // 3) Approval (exact amount, never unlimited)
  onStep("approve", { status: "doing" });
  let q = unwrap(await api.quote({ token, amount, wallet }));
  let route = pickRoute(q, plan.route);
  if (!route) throw new Error("No price available right now.");
  const appr = unwrap(await api.approve({ amount, vendor: route.executionMode === "RFQ" ? route.vendorName : undefined }))[0];
  if (!appr) throw new Error("Couldn't prepare the approval.");
  const spender = appr.dexContractAddress as `0x${string}`;
  let needApprove = true;
  if (!demo) {
    const allowance = await readContract(config, { address: USDT_BSC, abi: erc20Abi, functionName: "allowance", args: [wallet, spender], chainId: BSC_CHAIN_ID });
    needApprove = allowance < BigInt(amount);
  }
  if (needApprove) {
    onStep("approve", { detail: demo ? "Demo: approval auto-confirmed" : "Approve in your wallet — this lets the exchange take exactly this much USDT, nothing more." });
    if (!demo) {
      const h = await sendTransaction(config, { to: USDT_BSC, data: appr.data as Hex, chainId: BSC_CHAIN_ID });
      approveTxHash = h;
      onStep("approve", { detail: "Waiting for the approval to confirm…" });
      const rc = await waitForTransactionReceipt(config, { hash: h, chainId: BSC_CHAIN_ID });
      if (rc.status !== "success") throw new Error("The approval transaction failed on-chain.");
    }
    await fake(1200);
    onStep("approve", { status: "done", detail: "Permission granted for exactly this amount" });
  } else {
    onStep("approve", { status: "skipped", detail: "Already approved — nothing to do" });
  }

  // 4) Fresh quote (quotes live ~30s) + build
  onStep("quote", { status: "doing" });
  if (needApprove && !demo) {
    q = unwrap(await api.quote({ token, amount, wallet }));
    route = pickRoute(q, plan.route)!;
  }
  const routeHint = route.executionMode === "RFQ" ? `RFQ:${route.vendorName}` : "SWAP";
  const swap = unwrap(
    await api.swap({ token, amount, wallet, quoteId: route.quoteId, slippage: plan.slippage, route: demo ? routeHint : undefined }),
  );
  await fake(600);
  onStep("quote", { status: "done", detail: `${swap.executionMode === "RFQ" ? "RFQ order from " + (swap.rfq?.vendor ?? route.vendorName) : "AMM swap via " + route.vendorName}` });

  // 5 + 6) Execute
  if (swap.executionMode === "SWAP") {
    if (!swap.tx) throw new Error("The swap transaction wasn't returned.");
    onStep("confirm", { status: "doing", detail: demo ? "Demo: no wallet pop-up" : "Check the details in your wallet and tap Confirm." });
    let hash: string;
    if (demo) {
      await sleep(1200);
      hash = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
    } else {
      // Gas is estimated by the wallet (eth_estimateGas also catches reverts before you pay).
      hash = await sendTransaction(config, {
        to: swap.tx.to as `0x${string}`,
        data: swap.tx.data as Hex,
        value: BigInt(swap.tx.value || "0"),
        chainId: BSC_CHAIN_ID,
      });
    }
    onStep("confirm", { status: "done", detail: "Sent!" });
    onStep("settle", { status: "doing", detail: "Usually takes 1–3 seconds on BNB Chain…" });
    let amountOut: string | null = swap.routerResult.toTokenAmount;
    if (!demo) {
      const rc = await waitForTransactionReceipt(config, { hash: hash as Hex, chainId: BSC_CHAIN_ID });
      if (rc.status !== "success") throw new Error("The swap transaction failed on-chain. Your USDT was not spent (only a small network fee).");
      const logs = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: rc.logs });
      const got = logs.filter((l) => l.address.toLowerCase() === token.toLowerCase() && l.args.to.toLowerCase() === wallet.toLowerCase());
      amountOut = got.length ? got.reduce((a, l) => a + l.args.value, 0n).toString() : amountOut;
    } else {
      await sleep(1500);
    }
    onStep("settle", { status: "done", detail: "Confirmed on BNB Chain" });
    return { mode: "SWAP", vendor: route.vendorName, txHash: hash, approveTxHash, orderId: null, amountIn: amount, amountOut, demo };
  }

  // RFQ (Ondo / bStock PcsXRfq): sign EIP-712 order → submit → poll
  if (!swap.rfq) throw new Error("The RFQ order wasn't returned.");
  onStep("confirm", { status: "doing", detail: demo ? "Demo: no wallet pop-up" : "Your wallet will show an order to sign. Signing is free — it's not a transaction." });
  let signature: string;
  if (demo) {
    await sleep(1200);
    signature = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(65)), (b) => b.toString(16).padStart(2, "0")).join("");
  } else {
    const typed = normalizeTypedData(swap.rfq.typedDataToSign);
    const client = await getConnectorClient(config, { chainId: BSC_CHAIN_ID });
    signature = (await client.request({
      method: "eth_signTypedData_v4",
      params: [wallet, typed],
    } as never)) as string;
  }
  // Docs: /order/submit quoteId = rfq.orderId (not in the /swap schema) — fall back to the route quoteId.
  const submitQuoteId = swap.rfq.orderId ?? route.quoteId;
  const requestId = crypto.randomUUID();
  const sub = unwrap(
    await api.orderSubmit({ requestId, userSignature: signature, vendor: swap.rfq.vendor, quoteId: submitQuoteId, signingScheme: swap.rfq.signingScheme }),
  );
  onStep("confirm", { status: "done", detail: `Order sent (${sub.orderId})` });

  onStep("settle", { status: "doing", detail: "The market maker is filling your order…" });
  const started = Date.now();
  for (let poll = 0; ; poll++) {
    await sleep(demo ? 1200 : 2500);
    const st = unwrap(
      await api.orderStatus(sub.orderId, demo ? { poll, in: amount, out: swap.routerResult.toTokenAmount } : undefined),
    );
    if (st.status === "PENDING_ONCHAIN") onStep("settle", { detail: "Filled! Waiting for BNB Chain to confirm…" });
    if (st.status === "FILLED") {
      onStep("settle", { status: "done", detail: "Settled on BNB Chain" });
      return {
        mode: "RFQ",
        vendor: swap.rfq.vendor,
        txHash: st.txHash,
        approveTxHash,
        orderId: sub.orderId,
        amountIn: st.fromAmount ?? amount,
        amountOut: st.toAmount ?? swap.routerResult.toTokenAmount,
        demo,
      };
    }
    if (["FAILED", "EXPIRED", "CANCELLED"].includes(st.status)) {
      throw new Error(`The market maker couldn't fill this order (${st.status.toLowerCase()}). Your USDT stays in your wallet. You can try again.`);
    }
    if (Date.now() - started > 180_000) {
      throw new Error(`Still waiting after 3 minutes. Your order id is ${sub.orderId} — check again shortly.`);
    }
  }
}
