"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { convertViemChainToRelayChain, createClient } from "@relayprotocol/relay-sdk";
import { useState } from "react";
import { arbitrum, base, optimism } from "viem/chains";

const CHAINS = [base, arbitrum, optimism];

export function Providers({ children }: { children: React.ReactNode }) {
  // Point the Relay SDK at our own /api/relay proxy so the API key stays on
  // the server. The browser never sees it.
  useState(() => {
    if (typeof window === "undefined") return;
    createClient({
      baseApiUrl: `${window.location.origin}/api/relay`,
      source: "relay-trading-app-example",
      chains: CHAINS.map(convertViemChainToRelayChain),
    });
  });

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ["email"],
        defaultChain: base,
        supportedChains: CHAINS,
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
          // One-tap trading: no confirmation modal for each transaction
          showWalletUIs: false,
        },
        appearance: { theme: "dark" },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
