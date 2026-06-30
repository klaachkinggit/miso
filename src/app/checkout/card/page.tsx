import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CardCheckoutForm } from "./payment-form";

export default async function CardCheckoutPage({
  searchParams,
}: {
  searchParams?: Promise<{
    category_id?: string;
    listing_id?: string;
    quantity?: string;
    extra_guests?: string;
    return_path?: string;
    promo?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user)
    redirect(`/login?next=${encodeURIComponent(checkoutPath(params))}`);
  if (params?.listing_id) {
    return (
      <div className="container flex min-h-[calc(100vh-4rem)] items-center py-10">
        <CardCheckoutForm
          mode="resale"
          id={params.listing_id}
          returnPath={params.return_path}
        />
      </div>
    );
  }
  if (!params?.category_id) redirect("/events");

  return (
    <div className="container flex min-h-[calc(100vh-4rem)] items-center py-10">
      <CardCheckoutForm
        mode="primary"
        id={params.category_id}
        quantity={params.quantity ? Number(params.quantity) : undefined}
        extraGuests={
          params.extra_guests ? Number(params.extra_guests) : undefined
        }
        returnPath={params.return_path}
        promo={params.promo}
      />
    </div>
  );
}

function checkoutPath(params?: {
  category_id?: string;
  listing_id?: string;
  quantity?: string;
  extra_guests?: string;
  return_path?: string;
  promo?: string;
}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value && key !== "gift_email") search.set(key, value);
  }
  return `/checkout/card${search.size ? `?${search}` : ""}`;
}
