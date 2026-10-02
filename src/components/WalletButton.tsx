"use client";
import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { APPKIT_ENABLED, walletDeepLinks } from "@/lib/client/wallet";
import { BSC_CHAIN_ID } from "@/lib/constants";
import { shortAddr } from "@/lib/format";
import { Button } from "./ui";

function useIsMobile() {
  const [m, setM] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only detection after hydration
  useEffect(() => setM(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)), []);
  return m;
}

function WrongNetwork() {
  const { chainId, isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  if (!isConnected || chainId === BSC_CHAIN_ID) return null;
  return (
    <button
      onClick={() => switchChain({ chainId: BSC_CHAIN_ID })}
      className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-800"
    >
      {isPending ? "Switching…" : "Switch to BNB Chain"}
    </button>
  );
}

function AppKitButton({ compact }: { compact?: boolean }) {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <WrongNetwork />
        <button onClick={() => open({ view: "Account" })} className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow-sm ring-1 ring-black/10">
          🟢 {shortAddr(address)}
        </button>
      </div>
    );
  }
  return compact ? (
    <button onClick={() => open({ view: "Connect" })} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
      Connect wallet
    </button>
  ) : (
    <Button onClick={() => open({ view: "Connect" })} className="w-full" variant="secondary">
      Connect wallet
    </Button>
  );
}

function InjectedButton({ compact }: { compact?: boolean }) {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const isMobile = useIsMobile();
  const [hasInjected, setHasInjected] = useState(true);
  const [copied, setCopied] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only detection after hydration
  useEffect(() => setHasInjected(typeof window !== "undefined" && "ethereum" in window), []);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <WrongNetwork />
        <button onClick={() => disconnect()} title="Disconnect" className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow-sm ring-1 ring-black/10">
          🟢 {shortAddr(address)}
        </button>
      </div>
    );
  }

  // Unique list: EIP-6963 discovered wallets first, generic "Browser wallet" last.
  const list = connectors.filter((c, i, arr) => arr.findIndex((x) => x.name === c.name) === i);
  const url = typeof window !== "undefined" ? window.location.href : "";

  if (compact) {
    return (
      <button
        onClick={() => (list[0] && hasInjected ? connect({ connector: list[0], chainId: BSC_CHAIN_ID }) : document.getElementById("connect")?.scrollIntoView({ behavior: "smooth" }))}
        className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
      >
        Connect wallet
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {hasInjected ? (
        list.map((c) => (
          <Button key={c.uid} variant="secondary" className="w-full" disabled={isPending} onClick={() => connect({ connector: c, chainId: BSC_CHAIN_ID })}>
            {c.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.icon} alt="" className="h-5 w-5" />
            ) : null}
            {c.name === "Injected" ? "Browser wallet" : c.name}
          </Button>
        ))
      ) : (
        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          {isMobile ? (
            <>
              <p className="font-semibold">On a phone? Open this page inside your wallet app:</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {walletDeepLinks(url).map((w) => (
                  <a key={w.name} href={w.href} className="rounded-lg bg-white px-3 py-2 text-center font-semibold ring-1 ring-black/10">
                    {w.name}
                  </a>
                ))}
                <button
                  onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true))}
                  className="col-span-2 rounded-lg bg-white px-3 py-2 font-semibold ring-1 ring-black/10"
                >
                  {copied ? "Link copied — paste it in Binance Wallet's browser" : "Binance Wallet: copy link"}
                </button>
              </div>
            </>
          ) : (
            <p>No browser wallet found. Install MetaMask or the Binance Wallet extension, then refresh this page.</p>
          )}
        </div>
      )}
      {error ? <p className="text-sm text-rose-700">{error.message.split("\n")[0]}</p> : null}
    </div>
  );
}

export function WalletButton({ compact }: { compact?: boolean }) {
  return APPKIT_ENABLED ? <AppKitButton compact={compact} /> : <InjectedButton compact={compact} />;
}
