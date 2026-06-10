import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  variant = "compact",
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  variant?: "compact" | "display";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1
          className={cn(
            variant === "display"
              ? "display text-4xl text-foreground md:text-6xl"
              : "text-2xl font-medium text-foreground md:text-3xl",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              "mt-3 text-muted-foreground",
              variant === "display" ? "max-w-md text-sm" : "text-sm",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
