import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/format";
import type { TicketCategory } from "@/types/db";
import { cancelUnsoldTickets, removeCategory } from "../../actions";
import { CategoryCreateForm } from "./category-create-form";

export function CategoriesPanel({
  eventId,
  categories,
}: {
  eventId: string;
  categories: TicketCategory[];
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        {categories.length ? (
          categories.map((category) => {
            const remaining = Math.max(
              0,
              category.supply - category.sold_count,
            );
            return (
              <Card key={category.id} className="rounded-lg">
                <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-4">
                    {category.image_url ? (
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border/60">
                        <Image
                          src={category.image_url}
                          alt={category.name}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>
                    ) : null}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{category.name}</h3>
                        <Badge variant="secondary">
                          {formatPrice(category.price, category.currency)}
                        </Badge>
                        <Badge
                          variant={
                            category.sold_count >= category.supply
                              ? "destructive"
                              : "success"
                          }
                        >
                          {category.sold_count}/{category.supply} sold
                        </Badge>
                        {category.image_ipfs_uri ? (
                          <Badge variant="success">art pinned</Badge>
                        ) : null}
                      </div>
                      {category.description ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {category.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {remaining > 0 ? (
                      <form action={cancelUnsoldTickets}>
                        <input type="hidden" name="event_id" value={eventId} />
                        <input
                          type="hidden"
                          name="category_id"
                          value={category.id}
                        />
                        <Button type="submit" variant="outline" size="sm">
                          Cancel {remaining} unsold
                        </Button>
                      </form>
                    ) : null}
                    {category.sold_count === 0 ? (
                      <form action={removeCategory}>
                        <input type="hidden" name="event_id" value={eventId} />
                        <input
                          type="hidden"
                          name="category_id"
                          value={category.id}
                        />
                        <Button type="submit" variant="destructive" size="sm">
                          Remove
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="rounded-lg">
            <CardContent className="p-5 text-sm text-muted-foreground">
              No categories yet.
            </CardContent>
          </Card>
        )}
      </div>

      <CategoryCreateForm eventId={eventId} />
    </div>
  );
}
