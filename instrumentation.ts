import * as Sentry from "@sentry/nextjs";

// Server + edge Sentry init via the Next 15 instrumentation hook. Every
// init is gated on SENTRY_DSN so local/CI (no DSN) is a clean no-op.
export async function register() {
  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
    });
  }
}

// Next 15 server error hook. Safe to export unconditionally —
// captureRequestError no-ops when no client is initialised (no DSN).
export const onRequestError = Sentry.captureRequestError;
