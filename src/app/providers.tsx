"use client";
import { useState, type ReactNode } from "react";
import { WagmiProvider, cookieToInitialState } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/client/wallet";

export function Providers({ children, cookies }: { children: ReactNode; cookies: string | null }) {
  const [queryClient] = useState(() => new QueryClient());
  const initialState = cookieToInitialState(wagmiConfig, cookies);
  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
