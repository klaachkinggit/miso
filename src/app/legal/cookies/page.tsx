export const metadata = { title: "Cookies — MISO" };

export default function CookiesPage() {
  return (
    <>
      <header className="mb-10 border-b border-hairline pb-8 not-prose">
        <p className="eyebrow-signal">Legal · Cookies</p>
        <h1 className="display mt-4 text-4xl text-foreground md:text-5xl">
          Cookie policy<span className="display-italic">.</span>
        </h1>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Last updated June 21, 2026
        </p>
      </header>
      <p>
        MISO uses strictly necessary cookies to keep you signed in and to
        remember your cart during checkout. We do not use third-party
        advertising cookies.
      </p>
    </>
  );
}
