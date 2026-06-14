import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { CardCheckoutForm } from "./payment-form";

export default async function CardCheckoutPage({
  searchParams,
}: {
  searchParams?: Promise<{
    category_id?: string;
    listing_id?: string;
    quantity?: string;
    extra_guests?: string;
    gift_email?: string;
    return_path?: string;
    promo?: string;
  }>;
}) {
  await requireUser();
  const params = await searchParams;
  if (params?.listing_id) {
    return (
      <div className="container flex min-h-[calc(100vh-4rem)] items-center py-10">
        <CardCheckoutForm mode="resale" id={params.listing_id} />
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
        extraGuests={params.extra_guests ? Number(params.extra_guests) : undefined}
        giftEmail={params.gift_email}
        returnPath={params.return_path}
        promo={params.promo}
      />
    </div>
  );
}
