"use client"; 

import { getDefaultConfig, RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { mainnet, polygon, optimism, arbitrum, base } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState, useEffect } from "react";
import "@rainbow-me/rainbowkit/styles.css";

// Create a client-side only config
function createWagmiConfig() {
  return getDefaultConfig({
    appName: "VidioCol",
    projectId: "7f2d693fc57948723c36b4a6c94c0a6c",
    chains: [mainnet, polygon, optimism, arbitrum, base],
    ssr: false, // Disable SSR for wallet connections
  });
}

export function WalletProvider({ children }: { children: ReactNode }) {
  // Use state to ensure this only runs on the client
  const [config, setConfig] = useState<ReturnType<typeof createWagmiConfig> | null>(null);
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    // Initialize config on the client side only
    setConfig(createWagmiConfig());
  }, []);

  // Don't render anything until config is ready
  if (!config) {
    return <div className="min-h-screen flex items-center justify-center">Loading wallet providers...</div>;
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({
          accentColor: '#7b3fe4',
          accentColorForeground: 'white',
          borderRadius: 'medium',
        })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}