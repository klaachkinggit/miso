"use client";

import { useState, useTransition } from "react";
import { Check, Heart, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import {
  followOrganizationAction,
  unfollowOrganizationAction,
} from "@/app/s/[organizationSlug]/actions";

export function FollowOrganizationButton({
  organizationSlug,
  organizationName,
  following,
  accent,
}: {
  organizationSlug: string;
  organizationName: string;
  following: boolean;
  accent: string;
}) {
  const [isFollowing, setIsFollowing] = useState(following);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !isFollowing;
    // Optimistic: flip immediately, roll back on failure.
    setIsFollowing(next);
    startTransition(async () => {
      try {
        if (next) {
          await followOrganizationAction({ organizationSlug });
          toast({ title: `Following ${organizationName}` });
        } else {
          await unfollowOrganizationAction({ organizationSlug });
          toast({ title: `Unfollowed ${organizationName}` });
        }
      } catch (err) {
        setIsFollowing(!next);
        toast({
          title: err instanceof Error ? err.message : "Something went wrong",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={isFollowing}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] transition-colors disabled:opacity-60",
        isFollowing
          ? "border-hairline bg-transparent text-foreground hover:border-hairline-strong"
          : "border-transparent text-ink",
      )}
      style={isFollowing ? undefined : { backgroundColor: accent }}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isFollowing ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Heart className="h-3.5 w-3.5" />
      )}
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}
