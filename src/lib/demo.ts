export function isDemoMode() {
  return process.env.MISO_DEMO_MODE === "true";
}

export function demoCollectionAddress(eventId: string) {
  return `demo_collection_${eventId}`;
}

export function demoMetadataUri(kind: "collection" | "ticket", id: string) {
  return `demo://${kind}/${id}`;
}
