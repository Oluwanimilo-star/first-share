"use client";
/**
 * Wallet setup.
 *  - With NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: Reown AppKit (WalletConnect) + wagmi.
 *      Desktop: injected wallets (MetaMask / Binance Wallet extensions, EIP-6963) + QR code for phone wallets.
 *      Mobile: deep links into MetaMask / Binance Wallet / Trust Wallet, or injected inside a wallet's in-app browser.
 *  - Without it: plain wagmi injected connector (desktop extensions + wallet in-app browsers only).
 * BNB Smart Chain mainnet (56) only.
 */
import { createConfig, http, cookieStorage, createStorage, type Config } from "wagmi";
import { bsc as bscChain } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { bsc } from "@reown/appkit/networks";
import { PUBLIC_BSC_RPC } from "../constants";

export const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";
export const APPKIT_ENABLED = WC_PROJECT_ID.length > 0;

// WalletConnect Explorer wallet ids (shown first in the AppKit modal).
export const WALLET_IDS = {
  metamask: "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96",
  binance: "8a0ee50d1f22f6651afcae7eb4253e52a3310b90af5daef78a8c4929a9bb99d4",
  trust: "4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0",
};

const transports = { [bscChain.id]: http(PUBLIC_BSC_RPC) };

let config: Config;

if (APPKIT_ENABLED) {
  const adapter = new WagmiAdapter({
    networks: [bsc],
    projectId: WC_PROJECT_ID,
    ssr: true,
    storage: createStorage({ storage: cookieStorage }),
    transports,
  });
  config = adapter.wagmiConfig;

  const siteUrl =
    typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL ?? "https://first-share.vercel.app";

  createAppKit({
    adapters: [adapter],
    networks: [bsc],
    defaultNetwork: bsc,
    projectId: WC_PROJECT_ID,
    metadata: {
      name: "First Share",
      description: "Buy your first tokenized stock on BNB Chain, one friendly step at a time.",
      url: siteUrl,
      icons: [`${siteUrl}/icon.png`],
    },
    featuredWalletIds: [WALLET_IDS.metamask, WALLET_IDS.binance, WALLET_IDS.trust],
    allWallets: "SHOW",
    enableInjected: true,
    enableWalletConnect: true,
    enableCoinbase: false,
    enableNetworkSwitch: true,
    allowUnsupportedChain: false,
    features: { analytics: false, email: false, socials: false, swaps: false, onramp: false, send: false, history: false },
    themeMode: "light",
    themeVariables: { "--w3m-accent": "#F0B90B", "--w3m-border-radius-master": "4px", "--w3m-font-family": "inherit" },
  });
} else {
  config = createConfig({
    chains: [bscChain],
    connectors: [injected({ shimDisconnect: true })],
    multiInjectedProviderDiscovery: true, // EIP-6963: MetaMask, Binance Wallet, Trust extension listed separately
    ssr: true,
    storage: createStorage({ storage: cookieStorage }),
    transports,
  });
}

export const wagmiConfig = config;

/**
 * Deep links that open this page inside a wallet's in-app browser (works without WalletConnect).
 * Binance Wallet has no documented public dapp deep link, so the UI offers "copy link" for it instead.
 */
export function walletDeepLinks(url: string) {
  const noProto = url.replace(/^https?:\/\//, "");
  return [
    { name: "MetaMask", href: `https://metamask.app.link/dapp/${noProto}` },
    { name: "Trust Wallet", href: `https://link.trustwallet.com/open_url?coin_id=20000714&url=${encodeURIComponent(url)}` },
  ];
}
