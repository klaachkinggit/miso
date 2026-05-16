import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      <Card className="glass mx-auto w-full max-w-lg rounded-lg">
        <CardContent className="grid gap-5 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-secondary">
            {sold ? (
              <CheckCircle2 className="h-7 w-7 text-accent" />
            ) : canceled ? (
              <XCircle className="h-7 w-7 text-destructive" />
            ) : (
              <Clock className="h-7 w-7 text-accent" />
            )}
          </div>
          <div>
            <Badge variant={sold ? "success" : canceled ? "destructive" : "warning"}>
              {listing?.status ?? "unknown"}
            </Badge>
            <h1 className="mt-4 text-2xl font-semibold">
              {sold
                ? "Resale ticket is yours"
                : canceled
                  ? "Listing is no longer available"
                  : "Finalising transfer"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {sold
                ? "The NFT ticket has been transferred to your account. Find it in Wallet."
                : canceled
                  ? "This listing was canceled or expired. Browse other tickets on the exchange."
                  : "This page will update once the transfer completes."}
            </p>
          </div>
          <div className="flex justify-center gap-3">
            <Button asChild>
              <Link href="/tickets">Wallet</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/marketplace">Exchange</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
