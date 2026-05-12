import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

/** Request a devnet airdrop. Returns signature. Best-effort — devnet faucet is rate-limited. */
export async function devnetAirdrop(address: string, sol: number = 1): Promise<string | null> {
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";
  if (cluster !== "devnet") return null;
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";
  const conn = new Connection(rpc, "confirmed");
  try {
    const sig = await conn.requestAirdrop(new PublicKey(address), sol * LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sig, "confirmed");
    return sig;
  } catch {
    return null;
  }
}
