// Validate required env vars on server startup. Throws a clear error if missing.
import { z } from "zod";

const ServerEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  WALLET_ENCRYPTION_KEY: z.string().min(32),
  NEXT_PUBLIC_SOLANA_RPC: z.string().url(),
  NEXT_PUBLIC_SOLANA_CLUSTER: z.enum(["devnet", "testnet", "mainnet-beta"]).default("devnet"),
  NEXT_PUBLIC_SOLANA_EXPLORER_BASE: z.string().url().default("https://explorer.solana.com"),
  PLATFORM_TREASURY_SECRET: z.string().optional(),
  PAYMENT_PROVIDER: z.enum(["mock", "payzone"]).default("mock"),
  // PayZone credentials are only required when PAYMENT_PROVIDER=payzone.
  PAYZONE_API_BASE: z.string().url().optional(),
  PAYZONE_MERCHANT_ID: z.string().optional(),
  PAYZONE_API_KEY: z.string().optional(),
  PAYZONE_HMAC_SECRET: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  MISO_DEMO_MODE: z.enum(["true", "false"]).optional(),
});

let cached: z.infer<typeof ServerEnv> | undefined;

export function serverEnv() {
  if (cached) return cached;
  const parsed = ServerEnv.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function publicEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    solanaCluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet",
    solanaRpc: process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com",
    explorerBase: process.env.NEXT_PUBLIC_SOLANA_EXPLORER_BASE ?? "https://explorer.solana.com",
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  };
}
