"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container max-w-xl mx-auto py-24 text-center space-y-6">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground text-sm">
        The page could not be loaded. Please try again.
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
