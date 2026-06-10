import * as React from "react";
import { cn } from "@/lib/utils";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[88px] w-full rounded-md border border-hairline bg-ink-soft/60 px-3.5 py-2.5 text-sm text-foreground",
        "ring-offset-background placeholder:text-muted-foreground",
        "transition-colors focus-visible:border-signal focus-visible:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export { Textarea };
