"use client"; // Mark as a client component

import dynamic from "next/dynamic";
import { ReactNode } from "react";

// Dynamically import WalletProvider
const WalletProvider = dynamic(
  () => import("./provider").then((mod) => mod.WalletProvider),
  {
    ssr: false, 
  }
);

export default function ClientWrapper({ children }: { children: ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>;
}