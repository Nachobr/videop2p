"use client"; 

import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { mainnet, polygon, optimism, arbitrum, base } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import "@rainbow-me/rainbowkit/styles.css";

const config = getDefaultConfig({
    appName: "VidioCol",
    projectId: "7f2d693fc57948723c36b4a6c94c0a6c",
    chains: [mainnet, polygon, optimism, arbitrum, base],
    ssr: true,
});

const queryClient = new QueryClient();

export function WalletProvider({ children }: { children: ReactNode }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider>{children}</RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}