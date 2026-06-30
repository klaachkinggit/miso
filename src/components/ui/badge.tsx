import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.18em] transition-colors",
  {
    variants: {
      variant: {
        default: "border-hairline bg-ink-soft text-foreground",
        secondary: "border-transparent bg-paper text-ink",
        outline: "border-hairline-strong bg-transparent text-foreground",
        signal: "border-transparent bg-signal text-ink",
        success: "border-transparent bg-signal/15 text-signal",
        warning: "border-hairline bg-ink-soft text-paper",
        destructive: "border-transparent bg-destructive/15 text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge };
