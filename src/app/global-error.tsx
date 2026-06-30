"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="container mx-auto max-w-xl py-24 text-center">
          <h1 className="text-3xl font-bold">Something went wrong</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            The page could not be loaded. Please try again.
          </p>
        </main>
      </body>
    </html>
  );
}
