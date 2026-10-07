"use client";

// The only file besides app/providers.tsx that knows about Privy. To use a different
// wallet provider, reimplement this hook with the same return shape and swap the
// provider in app/providers.tsx. The rest of the app only talks to this hook.

import { usePrivy, useSendTransaction, useWallets } from "@privy-io/react-auth";
import { adaptViemWallet, type AdaptedWallet } from "@relayprotocol/relay-sdk";
import { createWalletClient, custom } from "viem";
import { VIEM_CHAINS } from "@/lib/chains";

export function useTradingWallet() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();

  // Prefer the embedded wallet Privy creates on email sign-up; otherwise use the
  // wallet the user connected (MetaMask, Rainbow, and so on).
  const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
  const address = wallet?.address as `0x${string}` | undefined;
  const embedded = wallet?.walletClientType === "privy";
  const label = user?.email?.address ?? "Your wallet";

  // A wallet the Relay SDK can execute a quote with, on the given origin chain.
  // With sponsorGas, embedded-wallet transactions go through Privy with
  // sponsor: true, so the user needs no ETH. Connected wallets pay their own gas.
  const getRelayWallet = async (chainId: number, sponsorGas: boolean): Promise<AdaptedWallet> => {
    if (!wallet || !address) throw new Error("No wallet connected");
    // switchChain can resolve while the provider still reports the old chain,
    // and the Relay SDK refuses a wallet on the wrong chain. Wait until the
    // provider actually switched before handing it over.
    await wallet.switchChain(chainId);
    const provider = await wallet.getEthereumProvider();
    for (let i = 0; i < 10; i++) {
      const current = parseInt((await provider.request({ method: "eth_chainId" })) as string, 16);
      if (current === chainId) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    const walletClient = createWalletClient({
      account: address,
      chain: VIEM_CHAINS[chainId],
      transport: custom(provider),
    });
    const adapted = adaptViemWallet(walletClient);
    // Connected wallets (MetaMask and friends) prompt the user and switch
    // chains properly on their own.
    if (!embedded) return adapted;

    // The embedded provider doesn't reliably land on the requested chain even
    // after switchChain, which fails trades with a chain mismatch. Privy's
    // sendTransaction takes the chain per transaction and routes it correctly
    // regardless of provider state, so embedded transactions always go through
    // it. Signatures already carry their chain in the EIP-712 domain.
    return {
      ...adapted,
      getChainId: async () => chainId,
      supportsAtomicBatch: async () => false,
      handleSendTransactionStep: async (stepChainId, item) => {
        const { hash } = await sendTransaction(
          { to: item.data.to, data: item.data.data, value: item.data.value ?? "0x0", chainId: stepChainId },
          { sponsor: sponsorGas, address },
        );
        return hash;
      },
    };
  };

  return { ready, authenticated, login, logout, address, embedded, label, getRelayWallet };
}
