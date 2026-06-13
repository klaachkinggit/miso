import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { CardCheckoutForm } from "./payment-form";

export default async function CardCheckoutPage({
  searchParams,
}: {
  searchParams?: Promise<{ category_id?: string; listing_id?: string }>;
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
      <CardCheckoutForm mode="primary" id={params.category_id} />
    </div>
  );
}
