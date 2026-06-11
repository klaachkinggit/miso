import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-dashed border-hairline bg-ink-raised/40 p-10 text-center",
        className,
      )}
    >
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-hairline bg-ink text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="display text-2xl text-foreground">{title}</h2>
      {description ? (
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}
