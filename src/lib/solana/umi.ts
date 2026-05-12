import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplCore } from "@metaplex-foundation/mpl-core";
import {
  createSignerFromKeypair,
  keypairIdentity,
  publicKey,
  type Umi,
} from "@metaplex-foundation/umi";
import bs58 from "bs58";

const RPC = () => process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";

/** Build a Umi instance with mpl-core registered. Caller sets identity. */
export function buildUmi(): Umi {
  return createUmi(RPC()).use(mplCore());
}

/** Build a Umi instance signed by the platform treasury (from env). */
export function treasuryUmi(): Umi {
  const secret = process.env.PLATFORM_TREASURY_SECRET;
  if (!secret) throw new Error("PLATFORM_TREASURY_SECRET missing — run `pnpm airdrop` first");
  return umiFromBase58(secret);
}

/** Build a Umi instance signed by an arbitrary base58 secret key. */
export function umiFromBase58(base58Secret: string): Umi {
  const u = buildUmi();
  const secret = bs58.decode(base58Secret);
  const kp = u.eddsa.createKeypairFromSecretKey(secret);
  return u.use(keypairIdentity(createSignerFromKeypair(u, kp)));
}

/** Build a Umi instance signed by a raw 64-byte secret. */
export function umiFromSecret(secret: Uint8Array): Umi {
  const u = buildUmi();
  const kp = u.eddsa.createKeypairFromSecretKey(secret);
  return u.use(keypairIdentity(createSignerFromKeypair(u, kp)));
}

export const toPublicKey = (s: string) => publicKey(s);
