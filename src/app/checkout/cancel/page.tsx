import Link from "next/link";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function CheckoutCancelPage() {
  return (
    <div className="container flex min-h-[calc(100vh-4rem)] items-center py-12">
      <Card className="mx-auto w-full max-w-lg rounded-lg">
        <CardContent className="grid gap-5 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-secondary">
            <XCircle className="h-7 w-7 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Checkout canceled</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your reservation will expire automatically if payment was not completed.
            </p>
          </div>
          <Button asChild>
            <Link href="/events">Back to events</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
