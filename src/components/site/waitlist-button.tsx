"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import {
  joinWaitlistAction,
  leaveWaitlistAction,
} from "@/app/s/[organizationSlug]/events/[eventSlug]/actions";

export function WaitlistButton({
  organizationSlug,
  eventSlug,
  path,
  onWaitlist,
}: {
  organizationSlug: string;
  eventSlug: string;
  path: string;
  onWaitlist: boolean;
}) {
  const [joined, setJoined] = useState(onWaitlist);
  const [pending, startTransition] = useTransition();

  function run(action: typeof joinWaitlistAction, next: boolean, label: string) {
    startTransition(async () => {
      try {
        await action({ organizationSlug, eventSlug, path });
        setJoined(next);
        toast({ title: label });
      } catch (err) {
        toast({
          title: err instanceof Error ? err.message : "Something went wrong",
          variant: "destructive",
        });
      }
    });
  }

  if (joined) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2 text-sm text-foreground sm:justify-end">
          <Check className="h-4 w-4 text-signal" />
          On waitlist
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={pending}
          onClick={() => run(leaveWaitlistAction, false, "Left the waitlist")}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Leave waitlist
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full sm:w-auto"
      disabled={pending}
      onClick={() => run(joinWaitlistAction, true, "You're on the waitlist")}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
      Join waitlist
    </Button>
  );
}
