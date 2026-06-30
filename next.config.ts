import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const config: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["viem", "isows", "ws"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
    ],
  },
  webpack: (webpackConfig, { isServer }) => {
    if (!isServer) {
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        ws: false,
      };
    }
    return webpackConfig;
  },
};

// Source-map upload only runs when SENTRY_AUTH_TOKEN is set; otherwise
// withSentryConfig passes through and the build stays green with no DSN.
export default withSentryConfig(config, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
