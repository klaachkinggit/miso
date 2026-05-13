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
