import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatPrice } from "@/lib/format";
import type { TicketCategory } from "@/types/db";
import { cancelUnsoldTickets, createCategory, removeCategory } from "../../actions";

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
            const remaining = Math.max(0, category.supply - category.sold_count);
            return (
              <Card key={category.id} className="glass rounded-lg">
                <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{category.name}</h3>
                      <Badge variant="secondary">{formatPrice(category.price, category.currency)}</Badge>
                      <Badge variant={category.sold_count >= category.supply ? "destructive" : "success"}>
                        {category.sold_count}/{category.supply} sold
                      </Badge>
                    </div>
                    {category.description ? (
                      <p className="mt-2 text-sm text-muted-foreground">{category.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {remaining > 0 ? (
                      <form action={cancelUnsoldTickets}>
                        <input type="hidden" name="event_id" value={eventId} />
                        <input type="hidden" name="category_id" value={category.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Cancel {remaining} unsold
                        </Button>
                      </form>
                    ) : null}
                    {category.sold_count === 0 ? (
                      <form action={removeCategory}>
                        <input type="hidden" name="event_id" value={eventId} />
                        <input type="hidden" name="category_id" value={category.id} />
                        <Button type="submit" variant="destructive" size="sm">Remove</Button>
                      </form>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="glass rounded-lg">
            <CardContent className="p-5 text-sm text-muted-foreground">No categories yet.</CardContent>
          </Card>
        )}
      </div>

      <Card className="glass h-fit rounded-lg">
        <CardHeader>
          <CardTitle>Add category</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createCategory} className="grid gap-4">
            <input type="hidden" name="event_id" value={eventId} />
            <div className="grid gap-2">
              <Label htmlFor="category-name">Name</Label>
              <Input id="category-name" name="name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category-description">Description</Label>
              <Textarea id="category-description" name="description" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="price">Price</Label>
                <Input id="price" name="price" type="number" step="0.01" min="0" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  name="currency"
                  defaultValue="EUR"
                  className="h-10 rounded-md border border-input bg-background/40 px-3 text-sm"
                >
                  <option value="EUR">EUR</option>
                  <option value="MAD">MAD</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="supply">Supply</Label>
                <Input id="supply" name="supply" type="number" min="1" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="max_resale_price">Max resale</Label>
                <Input id="max_resale_price" name="max_resale_price" type="number" step="0.01" min="0" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="benefits">Benefits</Label>
              <Textarea id="benefits" name="benefits" rows={3} />
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input name="resale_enabled" type="checkbox" className="h-4 w-4" defaultChecked />
              Resale enabled
            </label>
            <Button type="submit">Create and seed tickets</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
