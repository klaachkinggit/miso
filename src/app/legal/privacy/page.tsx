export const metadata = { title: "Privacy — MISO" };

export default function PrivacyPage() {
  return (
    <>
      <header className="mb-10 border-b border-hairline pb-8 not-prose">
        <p className="eyebrow-signal">Legal · Privacy</p>
        <h1 className="display mt-4 text-4xl text-foreground md:text-5xl">
          Privacy policy<span className="display-italic">.</span>
        </h1>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Placeholder — final policy to be provided
        </p>
      </header>
      <p>
        MISO collects the minimum personal data required to issue tickets and process payments:
        email, wallet address, and purchase records. Wallet addresses are public on-chain. We do not
        sell your personal data.
      </p>
    </>
  );
}
