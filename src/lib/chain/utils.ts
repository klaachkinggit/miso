export function shortAddress(addr: string | null | undefined, edge = 4): string {
  if (!addr) return "—";
  return `${addr.slice(0, edge)}…${addr.slice(-edge)}`;
}

export function explorerUrl(kind: "address" | "tx", value: string): string {
  const base = process.env.NEXT_PUBLIC_EXPLORER_BASE ?? "https://sepolia.basescan.org";
  const path = kind === "address" ? "address" : "tx";
  return `${base}/${path}/${value}`;
}
