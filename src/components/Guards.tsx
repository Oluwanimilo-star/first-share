"use client";
/**
 * The "can't get stuck" layer: connect-or-demo panel, wallet-sheet safety notice,
 * network guard (chain 56 only) and the balance preflight (BNB for gas + USDT on BSC).
 */
import { useState } from "react";
import { useAccount, useBalance, useReadContract, useSwitchChain } from "wagmi";
import { useAppKit, useAppKitState } from "@reown/appkit/react";
import { erc20Abi, formatUnits } from "viem";
import { APPKIT_ENABLED } from "@/lib/client/wallet";
import { BSC_CHAIN_ID, USDT_BSC } from "@/lib/constants";
import { BNB_USD_ESTIMATE, DEMO_BNB_WEI, DEMO_USDT_WEI, GET_FUNDS_URL, MIN_GAS_WEI } from "@/lib/client/demoWallet";
import { Button, Card, ExtLink, Spinner } from "./ui";
import { WalletButton } from "./WalletButton";

export const GEO_LINE = "Not available in the US, UK, Canada, Netherlands, Japan and some other regions.";
export const TRUST_LINE = "We never ask for your password or recovery phrase.";

/* ───────── Connect or try the demo ───────── */
export function ConnectPanel({ title, why, onTryDemo }: { title: string; why?: string; onTryDemo?: () => void }) {
  return (
    <Card>
      <div id="connect" className="space-y-3">
        <p className="font-bold">{title}</p>
        {why ? <p className="text-sm text-slate-600">{why}</p> : null}
        <p className="flex items-start gap-1.5 text-xs text-slate-500">
          <span aria-hidden>🌍</span>
          <span>{GEO_LINE}</span>
        </p>
        <WalletButton />
        <p className="flex items-center justify-center gap-1.5 text-center text-xs font-medium text-emerald-800">
          <span aria-hidden>🔒</span> {TRUST_LINE}
        </p>
        {onTryDemo ? (
          <div className="border-t border-slate-100 pt-3 text-center">
            <button onClick={onTryDemo} className="text-sm font-semibold text-amber-700 underline decoration-amber-300 underline-offset-2">
              No wallet handy? Try the demo instead
            </button>
            <p className="mt-0.5 text-xs text-slate-500">Pretend wallet with $25 of play money. Nothing real is signed or sent.</p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/* ───────── Header toggle: Try demo ↔ Exit demo ───────── */
export function DemoToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      title={on ? "Leave demo mode and use a real wallet" : "Try the whole flow with a pretend wallet — no real money"}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition ${
        on ? "bg-amber-100 text-amber-900 ring-amber-400" : "bg-white text-slate-700 ring-black/10"
      }`}
    >
      <span className={`relative inline-block h-4 w-7 rounded-full transition ${on ? "bg-amber-500" : "bg-slate-300"}`} aria-hidden>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${on ? "left-3.5" : "left-0.5"}`} />
      </span>
      {on ? "Demo on" : "Try demo"}
    </button>
  );
}

/* ───────── Safety line pinned on top of the wallet sheet (AppKit modal) ───────── */
function AppKitSheetNotice() {
  const { open } = useAppKitState();
  if (!open) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[1100] flex justify-center p-3" role="status">
      <div className="max-w-md rounded-2xl bg-ink px-4 py-3 text-center text-sm text-white shadow-xl">
        <p className="font-semibold">🔒 {TRUST_LINE}</p>
        <p className="mt-0.5 text-xs text-white/70">Connecting only shares your public address. {GEO_LINE}</p>
      </div>
    </div>
  );
}
export function WalletSheetNotice() {
  return APPKIT_ENABLED ? <AppKitSheetNotice /> : null;
}

/** Opens the wallet sheet (AppKit) or scrolls to the inline connect panel. */
function AppKitOpenButton({ label, className }: { label: string; className?: string }) {
  const { open } = useAppKit();
  return (
    <Button className={className} onClick={() => void open({ view: "Connect" })}>
      {label}
    </Button>
  );
}
export function ConnectNavButton({ label, className }: { label: string; className?: string }) {
  if (APPKIT_ENABLED) return <AppKitOpenButton label={label} className={className} />;
  return (
    <Button className={className} onClick={() => document.getElementById("connect")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
      {label}
    </Button>
  );
}

/* ───────── Network guard ───────── */
const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  97: "BNB testnet",
  137: "Polygon",
  204: "opBNB",
  324: "zkSync",
  8453: "Base",
  42161: "Arbitrum",
  43114: "Avalanche",
  59144: "Linea",
};

export function useNetworkState(isDemo: boolean) {
  const { isConnected, chainId } = useAccount();
  const wrong = !isDemo && isConnected && chainId !== undefined && chainId !== BSC_CHAIN_ID;
  return { wrong, chainId, chainName: chainId ? CHAIN_NAMES[chainId] ?? `network #${chainId}` : "another network" };
}

export function NetworkGuard({ chainName }: { chainName: string }) {
  const { switchChain, isPending, error } = useSwitchChain();
  return (
    <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-4" data-network-guard>
      <p className="font-bold text-rose-900">Your wallet is on {chainName}</p>
      <p className="mt-1 text-sm text-rose-900/90">
        First Share only works on <b>BNB Smart Chain</b>, where these stock tokens live. Switch first — we won&apos;t fetch a price or ask you to sign anything on the wrong
        network.
      </p>
      <Button className="mt-3 w-full" onClick={() => switchChain({ chainId: BSC_CHAIN_ID })} disabled={isPending}>
        {isPending ? (
          <>
            <Spinner /> Check your wallet…
          </>
        ) : (
          "Switch to BNB Smart Chain"
        )}
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-rose-800">
          {/rejected|denied/i.test(error.message)
            ? "No problem — you cancelled. Tap the button again when you're ready."
            : "Your wallet couldn't switch automatically. Open your wallet, choose “BNB Smart Chain” from its network list, then come back."}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-rose-900/70">If your wallet doesn&apos;t have BNB Smart Chain yet, it will offer to add it (chain 56). That&apos;s safe to approve.</p>
    </div>
  );
}

/* ───────── Balance preflight ───────── */
export type Preflight = {
  status: "idle" | "loading" | "ok" | "missing";
  bnb: bigint | null;
  usdt: bigint | null;
  needBnb: boolean;
  needUsdt: boolean;
  refetch: () => void;
};

export function usePreflight(p: { wallet: `0x${string}` | null; isDemo: boolean; demoEmpty: boolean; amountUsd: number; enabled: boolean }): Preflight {
  const live = p.enabled && !p.isDemo && !!p.wallet;
  const bnbQ = useBalance({ address: p.wallet ?? undefined, chainId: BSC_CHAIN_ID, query: { enabled: live } });
  const usdtQ = useReadContract({
    address: USDT_BSC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: p.wallet ? [p.wallet] : undefined,
    chainId: BSC_CHAIN_ID,
    query: { enabled: live },
  });
  const need = BigInt(Math.round(p.amountUsd * 100)) * 10n ** 16n;
  if (!p.wallet || !p.enabled) return { status: "idle", bnb: null, usdt: null, needBnb: false, needUsdt: false, refetch: () => {} };
  if (p.isDemo) {
    const bnb = p.demoEmpty ? 0n : DEMO_BNB_WEI;
    const usdt = p.demoEmpty ? 0n : DEMO_USDT_WEI;
    const needBnb = bnb < MIN_GAS_WEI;
    const needUsdt = usdt < need;
    return { status: needBnb || needUsdt ? "missing" : "ok", bnb, usdt, needBnb, needUsdt, refetch: () => {} };
  }
  const refetch = () => {
    void bnbQ.refetch();
    void usdtQ.refetch();
  };
  if (bnbQ.isLoading || usdtQ.isLoading) return { status: "loading", bnb: null, usdt: null, needBnb: false, needUsdt: false, refetch };
  // If the public RPC hiccups we don't block on unknowns — the Buy step re-checks on-chain.
  const bnb = bnbQ.data?.value ?? null;
  const usdt = (usdtQ.data as bigint | undefined) ?? null;
  const needBnb = bnb !== null && bnb < MIN_GAS_WEI;
  const needUsdt = usdt !== null && usdt < need;
  return { status: needBnb || needUsdt ? "missing" : bnb === null && usdt === null ? "idle" : "ok", bnb, usdt, needBnb, needUsdt, refetch };
}

function fmt(n: bigint | null, max = 4) {
  if (n === null) return "—";
  return Number(formatUnits(n, 18)).toLocaleString("en-US", { maximumFractionDigits: max });
}

export function PreflightCard({
  pf,
  amountUsd,
  isDemo,
  demoEmpty,
  setDemoEmpty,
  compact,
}: {
  pf: Preflight;
  amountUsd: number;
  isDemo: boolean;
  demoEmpty?: boolean;
  setDemoEmpty?: (v: boolean) => void;
  compact?: boolean;
}) {
  const [showWhy, setShowWhy] = useState(false);
  if (pf.status === "idle") return null;
  const sentence =
    pf.needBnb && pf.needUsdt
      ? `You need about $${amountUsd} of USDT plus a little BNB (≈ $0.25) for network fees, both on BNB Smart Chain.`
      : pf.needUsdt
        ? `You need at least $${amountUsd} of USDT on BNB Smart Chain for this buy.`
        : "You need a little BNB (≈ $0.25) on BNB Smart Chain to pay the network fee.";
  return (
    <div className={`rounded-2xl p-4 ring-1 ${pf.status === "missing" ? "bg-amber-50 ring-amber-300" : "bg-white ring-black/5 shadow-sm"}`} data-testid="preflight">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold">Preflight check {isDemo ? <span className="ml-1 text-xs font-semibold text-amber-700">(demo wallet)</span> : null}</p>
        {pf.status === "loading" ? <Spinner className="h-4 w-4" /> : pf.status === "ok" ? <span className="text-sm font-semibold text-emerald-700">✅ Ready</span> : <span className="text-sm font-semibold text-amber-800">⚠️ Top up first</span>}
      </div>
      {!compact || pf.status === "missing" ? (
        <ul className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <li className="rounded-xl bg-white/70 p-2 ring-1 ring-black/5">
            <p className="text-xs text-slate-500">BNB for gas</p>
            <p className="font-bold tabular-nums">
              {pf.needBnb ? "⚠️" : "✅"} {fmt(pf.bnb, 4)} BNB
            </p>
            {pf.bnb !== null ? <p className="text-xs text-slate-500">≈ ${(Number(formatUnits(pf.bnb, 18)) * BNB_USD_ESTIMATE).toFixed(2)}</p> : null}
          </li>
          <li className="rounded-xl bg-white/70 p-2 ring-1 ring-black/5">
            <p className="text-xs text-slate-500">USDT on BNB Chain</p>
            <p className="font-bold tabular-nums">
              {pf.needUsdt ? "⚠️" : "✅"} {fmt(pf.usdt, 2)} USDT
            </p>
            <p className="text-xs text-slate-500">need ${amountUsd}</p>
          </li>
        </ul>
      ) : null}
      {pf.status === "missing" ? (
        <div className="mt-3 text-sm text-amber-950">
          <p>
            {sentence}{" "}
            <ExtLink href={GET_FUNDS_URL}>How to get funds: withdraw from Binance to BNB Smart Chain (BEP20) ↗</ExtLink>
          </p>
          <button className="mt-1 text-xs font-semibold text-amber-800 underline" onClick={() => setShowWhy(!showWhy)}>
            {showWhy ? "Hide" : "Why both?"}
          </button>
          {showWhy ? (
            <p className="mt-1 text-xs text-amber-900/80">
              USDT is the digital dollar you pay with. BNB is the &ldquo;stamp&rdquo; every BNB Chain transaction needs. When withdrawing on Binance, pick the network called
              <b> BSC – BNB Smart Chain (BEP20)</b>, never ERC20.
            </p>
          ) : null}
          {!isDemo ? (
            <button className="mt-2 block text-xs font-semibold text-slate-700 underline" onClick={pf.refetch}>
              I&apos;ve topped up — check again
            </button>
          ) : null}
        </div>
      ) : null}
      {isDemo && setDemoEmpty ? (
        <button className="mt-2 text-xs font-semibold text-slate-600 underline" onClick={() => setDemoEmpty(!demoEmpty)}>
          {demoEmpty ? "Demo: refill the pretend wallet" : "Demo: see what happens with an empty wallet"}
        </button>
      ) : null}
    </div>
  );
}
