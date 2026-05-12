"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container max-w-xl mx-auto py-24 text-center space-y-6">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground text-sm font-mono break-all">{error.message}</p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
