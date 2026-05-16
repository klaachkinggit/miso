// Validate required env vars on server startup. Throws a clear error if missing.
import { z } from "zod";

const ServerEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  THIRDWEB_CLIENT_ID: z.string().min(8),
  THIRDWEB_SECRET_KEY: z.string().min(8),
  THIRDWEB_API_URL: z.string().url().default("https://api.thirdweb.com"),
  THIRDWEB_BACKEND_WALLET_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  CHAIN_ID: z.string().regex(/^\d+$/),
  NEXT_PUBLIC_CHAIN_ID: z.string().regex(/^\d+$/),
  NEXT_PUBLIC_EXPLORER_BASE: z.string().url().default("https://sepolia.basescan.org"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
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
    chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "84532"),
    explorerBase:
      process.env.NEXT_PUBLIC_EXPLORER_BASE ?? "https://sepolia.basescan.org",
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  };
}
