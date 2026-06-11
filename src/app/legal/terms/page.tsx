export const metadata = { title: "Terms — MISO" };

export default function TermsPage() {
  return (
    <>
      <header className="mb-10 border-b border-hairline pb-8 not-prose">
        <p className="eyebrow-signal">Legal · Terms</p>
        <h1 className="display mt-4 text-4xl text-foreground md:text-5xl">
          Terms of service<span className="display-italic">.</span>
        </h1>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Placeholder — final terms to be provided
        </p>
      </header>
      <p>
        By using MISO you agree to purchase, hold, and resell tickets only within the limits set by
        the event organizer and applicable law. Tickets are non-refundable except as required by law
        or explicitly offered through the official resale exchange.
      </p>
    </>
  );
}
