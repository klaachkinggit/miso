import { CreateEventForm } from "./create-event-form";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="container max-w-3xl py-12">
      <header className="mb-10 border-b border-hairline pb-8">
        <p className="eyebrow-signal">Workspace · New event</p>
        <h1 className="display mt-3 text-4xl text-foreground md:text-5xl">
          New event<span className="display-italic">.</span>
        </h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Draft the event and deploy its on-chain ticket contract.
        </p>
      </header>
      <CreateEventForm error={params?.error} />
    </div>
  );
}
