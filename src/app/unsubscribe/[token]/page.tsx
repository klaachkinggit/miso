import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { confirmUnsubscribeAction } from "./actions";

// No auth: the unguessable token is the capability. The mutation rides on an
// explicit POST (confirmUnsubscribeAction) — never on this GET — so email-client
// link scanners / prefetchers that crawl the link cannot silently unsubscribe a
// follower (RFC 9110: GET must have no side effects).
export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const done = (await searchParams)?.done === "1";

  if (done) {
    return (
      <div className="container flex min-h-[60vh] items-center justify-center py-16">
        <div className="w-full max-w-md rounded-md border border-hairline bg-ink-raised/40 p-10 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-hairline bg-ink text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-foreground" />
          </div>
          <h1 className="display text-2xl text-foreground">
            You&apos;re unsubscribed
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
            You will no longer receive announcements from this organizer. You
            can follow them again any time from their storefront.
          </p>
          <Link
            href="/events"
            className="mt-6 inline-block rounded-md border border-hairline px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-foreground transition-colors hover:border-hairline-strong"
          >
            Browse events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-16">
      <div className="w-full max-w-md rounded-md border border-hairline bg-ink-raised/40 p-10 text-center">
        <h1 className="display text-2xl text-foreground">Unsubscribe?</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
          Confirm below to stop receiving announcements from this organizer.
        </p>
        <form action={confirmUnsubscribeAction} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="inline-block rounded-md border border-hairline px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-foreground transition-colors hover:border-hairline-strong"
          >
            Confirm unsubscribe
          </button>
        </form>
      </div>
    </div>
  );
}
