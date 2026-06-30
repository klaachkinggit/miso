import * as Sentry from "@sentry/nextjs";

// Client Sentry init (Next 15.3+ instrumentation-client hook). Gated on
// the public DSN so the browser bundle is a no-op without it.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}

// Required by the App Router for navigation instrumentation; no-op
// without a client.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
