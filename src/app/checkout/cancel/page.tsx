import Link from "next/link";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CheckoutCancelPage() {
  return (
    <div className="container flex min-h-[calc(100vh-4rem)] items-center py-12">
      <div className="mx-auto w-full max-w-lg rounded-md border border-hairline bg-ink-raised p-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-hairline bg-ink">
          <XCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 className="display mt-6 text-3xl text-foreground md:text-4xl">
          Checkout canceled<span className="display-italic">.</span>
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your reservation expires automatically if payment was not completed.
        </p>
        <Button asChild className="mt-7">
          <Link href="/events">Back to events</Link>
        </Button>
      </div>
    </div>
  );
}
