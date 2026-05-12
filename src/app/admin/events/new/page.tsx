import { CreateEventForm } from "./create-event-form";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="container max-w-3xl py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">New event</h1>
        <p className="mt-2 text-muted-foreground">Create the draft event and mint its Solana collection.</p>
      </div>
      <CreateEventForm error={params?.error} />
    </div>
  );
}
