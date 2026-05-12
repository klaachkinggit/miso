"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function StatusPoller({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => router.refresh(), 2000);
    return () => window.clearInterval(id);
  }, [enabled, router]);

  return null;
}
