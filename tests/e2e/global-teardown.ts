import { cleanupE2eEvents } from "../../scripts/cleanup-e2e-events";

export default async function globalTeardown(): Promise<void> {
  // Only full-path runs insert real rows; smoke runs have nothing to clean
  // and may lack the service-role key.
  if (process.env.MISO_E2E_FULL !== "1") return;
  const count = await cleanupE2eEvents();
  if (count) console.log(`global-teardown: deleted ${count} E2E event(s).`);
}
