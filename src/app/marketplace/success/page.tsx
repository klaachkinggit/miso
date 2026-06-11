import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { ResaleListing } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function MarketplaceSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ listing_id?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const listingId = params?.listing_id;
  const sb = createServiceClient();

  const { data: listing } = listingId
    ? await sb
        .from("resale_listings")
        .select("*")
        .eq("id", listingId)
        .maybeSingle<ResaleListing>()
    : { data: null };

  const sold = listing?.status === "sold" && listing.buyer_user_id === user.id;
  const canceled = listing?.status === "canceled" || listing?.status === "expired";

  return (
    <div className="container flex min-h-[calc(100vh-4rem)] items-center py-12">
      <div className="mx-auto w-full max-w-lg rounded-md border border-hairline bg-ink-raised p-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-hairline bg-ink">
          {sold ? (
            <CheckCircle2 className="h-6 w-6 text-signal" />
          ) : canceled ? (
            <XCircle className="h-6 w-6 text-destructive" />
          ) : (
            <Clock className="h-6 w-6 text-signal" />
          )}
        </div>
        <Badge variant={sold ? "signal" : canceled ? "destructive" : "warning"} className="mt-6">
          {listing?.status ?? "unknown"}
        </Badge>
        <h1 className="display mt-5 text-3xl text-foreground md:text-4xl">
          {sold
            ? "Resale ticket is yours."
            : canceled
              ? "Listing no longer available."
              : "Finalising transfer."}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {sold
            ? "The digital ticket transferred to your account."
            : canceled
              ? "This listing was canceled or expired. Browse the exchange for other tickets."
              : "This page refreshes once the transfer completes."}
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Button asChild>
            <Link href="/tickets">My tickets</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/marketplace">Exchange</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
