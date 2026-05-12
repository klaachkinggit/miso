import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";

const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";
const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";
const sol = Number(process.env.AIRDROP_SOL ?? "2");

if (cluster !== "devnet") {
  throw new Error(`Refusing to airdrop on ${cluster}. Set NEXT_PUBLIC_SOLANA_CLUSTER=devnet.`);
}

const keypair = Keypair.generate();
const address = keypair.publicKey.toBase58();
const secret = bs58.encode(keypair.secretKey);
const connection = new Connection(rpc, "confirmed");

async function main() {
  console.log(`Generated treasury address: ${address}`);
  console.log(`Requesting ${sol} SOL from devnet faucet...`);

  try {
    const signature = await connection.requestAirdrop(keypair.publicKey, sol * LAMPORTS_PER_SOL);
    const latest = await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction(
      {
        signature,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      "confirmed"
    );

    const balance = await connection.getBalance(keypair.publicKey, "confirmed");
    console.log(`Airdrop signature: ${signature}`);
    console.log(`Treasury balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  } catch (error) {
    console.warn("Devnet airdrop failed. The faucet may be rate-limited.");
    console.warn(error instanceof Error ? error.message : error);
  }

  console.log("");
  console.log("Add this to .env.local:");
  console.log(`PLATFORM_TREASURY_SECRET=${secret}`);
  console.log("");
  console.log("Public treasury address:");
  console.log(address);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
