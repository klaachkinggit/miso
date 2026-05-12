import { createServiceClient } from "@/lib/supabase/service";

export async function audit(params: {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  const sb = createServiceClient();
  await sb.from("audit_logs").insert({
    actor_user_id: params.actorUserId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    metadata_json: params.metadata ?? {},
  });
}

// Idempotency check for payment-provider webhooks via audit_logs.
// `provider` namespaces the event id so two providers cannot collide.
export async function isProviderEventProcessed(provider: string, eventId: string): Promise<boolean> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("audit_logs")
    .select("id")
    .eq("action", `${provider}.webhook`)
    .eq("entity_id", eventId)
    .maybeSingle();
  return Boolean(data);
}

export async function markProviderEventProcessed(
  provider: string,
  eventId: string,
  payload: Record<string, unknown>,
) {
  await audit({
    actorUserId: null,
    action: `${provider}.webhook`,
    entityType: `${provider}_event`,
    entityId: eventId,
    metadata: payload,
  });
}
