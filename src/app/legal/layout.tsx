import type { ReactNode } from "react";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container max-w-3xl py-16">
      <article className="prose prose-invert prose-sm">{children}</article>
    </div>
  );
}
