// Live Sepolia smoke test. Gated by LIVE_CHAIN=true so CI stays offline by
// default. Run with:
//
//   LIVE_CHAIN=true \
//   THIRDWEB_CLIENT_ID=... \
//   THIRDWEB_SECRET_KEY=... \
//   THIRDWEB_BACKEND_WALLET_ADDRESS=0x... \
//   CHAIN_ID=84532 \
//   npx playwright test tests/live-chain.spec.ts
//
// Deploys a fresh MisoTicket contract, mints one token to a generated
// In-App Wallet, then reads ownerOf + tokenURI back over the wire. Asserts
// the backend wallet is correctly funded and the Thirdweb client wiring
// works against the real api.thirdweb.com endpoint.

import { expect, test } from "@playwright/test";
import {
  createPublicClient,
  encodeDeployData,
  http,
  type Address,
  type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";

import { MISO_TICKET_ABI, MISO_TICKET_BYTECODE } from "@/lib/thirdweb/contracts/misoTicket";
import {
  deployContract,
  waitForTransaction,
  writeContract,
} from "@/lib/thirdweb/transactions";
import { encodeMintTo } from "@/lib/thirdweb/contracts/misoTicket";
import { ensureUserWallet } from "@/lib/thirdweb/wallet";

const liveEnabled = process.env.LIVE_CHAIN === "true";

test.describe("Live Base Sepolia smoke", () => {
  test.skip(!liveEnabled, "Set LIVE_CHAIN=true with funded backend wallet to run.");
  test.setTimeout(10 * 60 * 1000);

  test("deploys MisoTicket → mints → reads ownerOf + tokenURI", async () => {
    const admin = process.env.THIRDWEB_BACKEND_WALLET_ADDRESS as Address;
    expect(admin, "THIRDWEB_BACKEND_WALLET_ADDRESS required").toBeTruthy();

    const deployData = encodeDeployData({
      abi: MISO_TICKET_ABI,
      bytecode: MISO_TICKET_BYTECODE,
      args: ["MisoLive", "MISO", admin],
    }) as Hex;

    const deployQueued = await deployContract({ bytecode: deployData });
    const deployRecord = await waitForTransaction(deployQueued.transactionId, {
      timeoutMs: 4 * 60 * 1000,
    });
    expect(deployRecord.contractAddress, "contract deployed").toBeTruthy();
    const contractAddress = deployRecord.contractAddress as Address;

    const buyerUserId = `live-${Date.now()}`;
    const buyerEmail = `live+${Date.now()}@miso.test`;
    const { smartAccountAddress } = await ensureUserWallet(buyerUserId, buyerEmail);
    const buyer = smartAccountAddress as Address;
    expect(buyer).toBeTruthy();

    const tokenId = BigInt(Date.now());
    const uri = `ipfs://bafylivesmoke-${tokenId}`;

    const mintQueued = await writeContract({
      contractAddress,
      data: encodeMintTo({ to: buyer, tokenId, uri }),
    });
    const mintRecord = await waitForTransaction(mintQueued.transactionId, {
      timeoutMs: 4 * 60 * 1000,
    });
    expect(mintRecord.transactionHash, "mint mined").toBeTruthy();

    const rpc = createPublicClient({
      chain: baseSepolia,
      transport: http(),
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
