import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteController } from "../../actions";

export interface ControllerRow {
  user_id: string;
  email: string;
  display_name: string | null;
  role: string;
}

export function ControllersPanel({
  eventId,
  controllers,
}: {
  eventId: string;
  controllers: ControllerRow[];
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        {controllers.length ? (
          controllers.map((controller) => (
            <Card key={controller.user_id} className="rounded-lg">
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div>
                  <h3 className="font-semibold">{controller.display_name ?? controller.email}</h3>
                  <p className="text-sm text-muted-foreground">{controller.email}</p>
                </div>
                <Badge variant="secondary">{controller.role}</Badge>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="rounded-lg">
            <CardContent className="p-5 text-sm text-muted-foreground">No controllers assigned.</CardContent>
          </Card>
        )}
      </div>

      <Card className="h-fit rounded-lg">
        <CardHeader>
          <CardTitle>Invite controller</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={inviteController} className="grid gap-4">
            <input type="hidden" name="event_id" value={eventId} />
            <div className="grid gap-2">
              <Label htmlFor="controller-email">Email</Label>
              <Input id="controller-email" name="email" type="email" required />
            </div>
            <Button type="submit">Invite</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
