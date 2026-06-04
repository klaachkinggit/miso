// Live Sepolia smoke test. Gated by LIVE_CHAIN=true so CI stays offline
// by default. Deploys a fresh MisoTicket contract, mints one token to a
// generated In-App Wallet, then reads ownerOf + tokenURI back over RPC.

import { expect, test } from "@playwright/test";
import "./helpers/env";
import {
  createPublicClient,
  http,
  type Abi,
  type Address,
} from "viem";
import { baseSepolia } from "viem/chains";

import { thirdwebFetch } from "@/lib/thirdweb/client";
import {
  MISO_TICKET_ABI,
  MISO_TICKET_BYTECODE,
} from "@/lib/thirdweb/contracts/misoTicket";
import {
  deployContract,
  waitForTransaction,
  writeContract,
} from "@/lib/thirdweb/transactions";

const liveEnabled = process.env.LIVE_CHAIN === "true";

test.describe("Live Base Sepolia smoke", () => {
  test.skip(!liveEnabled, "Set LIVE_CHAIN=true with funded backend wallet to run.");
  test.setTimeout(10 * 60 * 1000);

  test("deploys MisoTicket → mints → reads ownerOf + tokenURI", async () => {
    // Discover the project's smart wallet (ERC-4337) — that's the address
    // whose role checks must pass when Thirdweb routes contract writes.
    const serverList = await thirdwebFetch<{
      result?: {
        wallets?: Array<{ address?: string; smartWalletAddress?: string }>;
      };
    }>("/v1/wallets/server", { method: "GET" });
    const wallet = serverList.result?.wallets?.[0];
    const eoa = wallet?.address as Address | undefined;
    const smart = wallet?.smartWalletAddress as Address | undefined;
    expect(eoa, "Server wallet EOA").toBeTruthy();
    expect(smart, "Server smart wallet").toBeTruthy();
    console.log("[live] EOA:", eoa, "smart:", smart);

    const admin = smart as Address;

    const deployed = await deployContract({
      bytecode: MISO_TICKET_BYTECODE,
      abi: MISO_TICKET_ABI as unknown as Abi,
      constructorParams: {
        name_: "MisoLive",
        symbol_: "MISO",
        admin,
      },
      from: smart,
    });
    expect(deployed.address, "contract deployed").toBeTruthy();
    const contractAddress = deployed.address;
    const deployRecord = await waitForTransaction(deployed.transactionId, {
      timeoutMs: 4 * 60 * 1000,
    });
    expect(deployRecord.transactionHash, "deploy mined").toBeTruthy();
    console.log(
      "[live] deployed:",
      contractAddress,
      "tx:",
      deployRecord.transactionHash,
    );

    const buyerEmail = `live+${Date.now()}@miso.test`;
    const pregen = await thirdwebFetch<{ result?: { address?: string } }>(
      "/v1/wallets/user",
      {
        method: "POST",
        body: { type: "email", email: buyerEmail },
      },
    );
    const buyer = pregen.result?.address as Address;
    expect(buyer, "buyer EOA pregenerated").toBeTruthy();
    console.log("[live] buyer EOA:", buyer);

    const tokenId = BigInt(Date.now());
    const uri = `ipfs://bafylivesmoke-${tokenId}`;

    const mintQueued = await writeContract({
      contractAddress,
      method: "function mintTo(address to, uint256 tokenId, string uri)",
      params: [buyer, tokenId, uri],
      from: smart,
    });
    const mintRecord = await waitForTransaction(mintQueued.transactionId, {
      timeoutMs: 4 * 60 * 1000,
    });
    expect(mintRecord.transactionHash, "mint mined").toBeTruthy();
    console.log("[live] mint tx hash:", mintRecord.transactionHash);

    const rpc = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });
    // Thirdweb reports MINED before the L2 RPC always returns the receipt.
    // Wait on the public RPC so the next read sees consistent state.
    await rpc.waitForTransactionReceipt({
      hash: mintRecord.transactionHash as `0x${string}`,
      timeout: 120_000,
    });
    const onChainOwner = (await rpc.readContract({
      address: contractAddress,
      abi: MISO_TICKET_ABI,
      functionName: "ownerOf",
      args: [tokenId],
    })) as Address;
    expect(onChainOwner.toLowerCase()).toBe(buyer.toLowerCase());

    const onChainUri = await rpc.readContract({
      address: contractAddress,
      abi: MISO_TICKET_ABI,
      functionName: "tokenURI",
      args: [tokenId],
    });
    expect(onChainUri).toBe(uri);
  });
});
