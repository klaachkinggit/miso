import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEmbedCategory } from "@/lib/embed/public";
import { formatDateShort, formatPrice } from "@/lib/format";
import { ResizePoster } from "./resize-poster";

export const metadata: Metadata = {
  robots: { index: false },
};

export default async function EmbedCategoryPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  const data = await getEmbedCategory(categoryId);
  if (!data) notFound();

  const { category, event } = data;
  const isClub = category.kind === "club_table";
  const now = Date.now();
  const soldOut = category.remaining <= 0;
  const comingSoon =
    category.sale_starts_at != null &&
    now < new Date(category.sale_starts_at).getTime();
  const salesEnded =
    category.sale_ends_at != null &&
    now > new Date(category.sale_ends_at).getTime();
  const disabled =
    !category.sales_enabled || soldOut || comingSoon || salesEnded;
  const reason = comingSoon
    ? `Coming soon · ${formatDateShort(category.sale_starts_at!)}`
    : salesEnded
      ? "Sales ended"
      : !category.sales_enabled
        ? "Sales closed"
        : soldOut
          ? "Sold out"
          : null;

  const displayPrice =
    isClub && category.online_advance != null
      ? category.online_advance
      : category.price;

  return (
    <div
      className="miso-embed-card dark mx-auto max-w-sm rounded-lg border border-hairline bg-ink-raised p-5 font-sans text-foreground"
      style={{ colorScheme: "dark" }}
    >
      <ResizePoster />
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {event.name}
      </p>
      <h1 className="mt-1 text-lg font-semibold">{category.name}</h1>
      {category.description ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {category.description}
        </p>
      ) : null}

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">
            {formatPrice(displayPrice, category.currency)}
          </div>
          {isClub ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Online advance
            </p>
          ) : null}
        </div>
        {disabled ? (
          <span className="rounded-md border border-hairline px-4 py-2 text-sm text-muted-foreground">
            {reason}
          </span>
        ) : (
          <a
            target="_top"
            href={`/checkout/card?category_id=${encodeURIComponent(category.id)}`}
            className="inline-flex items-center rounded-md bg-signal px-5 py-2 text-sm font-medium text-ink"
          >
            {isClub ? "Book table" : "Buy"}
          </a>
        )}
      </div>
    </div>
  );
}
