import * as React from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-md border border-hairline bg-ink-soft/60 px-3.5 py-2 text-sm text-foreground",
          "ring-offset-background placeholder:text-muted-foreground",
          "transition-colors focus-visible:border-signal focus-visible:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
