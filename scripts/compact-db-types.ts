import fs from "node:fs";
import path from "node:path";

const GENERATED = path.resolve("src/types/db.generated.ts");
const DB = path.resolve("src/types/db.ts");
const sourcePath = fs.existsSync(GENERATED) ? GENERATED : DB;
const source = fs.readFileSync(sourcePath, "utf8");
if (sourcePath === DB && !source.includes("      events: {")) {
  console.log("compact-db-types: src/types/db.ts is already compact");
  process.exit(0);
}

const enumAlias = {
  currency: "Currency",
  event_genre: "EventGenre",
  event_status: "EventStatus",
  event_vibe: "EventVibe",
  listing_status: "ListingStatus",
  marketplace_payment_kind: "MarketplacePaymentKind",
  marketplace_payment_status: "MarketplacePaymentStatus",
  marketplace_transfer_recipient_role: "MarketplaceTransferRecipientRole",
  marketplace_transfer_status: "MarketplaceTransferStatus",
  organization_role: "OrganizationRole",
  organization_status: "OrganizationStatus",
  purchase_status: "PurchaseStatus",
  redemption_result: "RedemptionResult",
  sales_channel: "SalesChannel",
  seller_risk_status: "SellerRiskStatus",
  ticket_category_kind: "TicketCategoryKind",
  ticket_status: "TicketStatus",
  user_role: "UserRole",
} as const;

const tableAlias = {
  events: "EventRow",
  profiles: "Profile",
  tickets: "Ticket",
  ticket_categories: "TicketCategory",
  ticket_redemptions: "TicketRedemption",
  purchases: "Purchase",
  resale_listings: "ResaleListing",
  wallets: "Wallet",
  gate_sessions: "GateSession",
  audit_logs: "AuditLog",
  event_controllers: "EventController",
  chain_ops: "ChainOp",
  organizations: "Organization",
  organization_memberships: "OrganizationMembership",
  organization_customers: "OrganizationCustomer",
  stripe_seller_accounts: "StripeSellerAccount",
  organizer_profiles: "OrganizerProfile",
  marketplace_payments: "MarketplacePayment",
  marketplace_transfers: "MarketplaceTransfer",
  marketplace_payment_items: "MarketplacePaymentItem",
  event_waitlists: "EventWaitlist",
  organization_followers: "OrganizationFollower",
  promo_codes: "PromoCode",
  resale_price_caps: "ResalePriceCap",
  org_embeddings: "OrgEmbedding",
  site_settings: "SiteSettings",
} as const;

function bracedBlockFrom(position: number) {
  const start = source.indexOf("{", position);
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}" && --depth === 0) return source.slice(start + 1, i);
  }
  throw new Error("Unclosed block near " + position);
}

function rowFor(table: string) {
  const tablePosition = source.indexOf("      " + table + ": {");
  if (tablePosition < 0)
    throw new Error("Missing table " + table + " in " + sourcePath);
  const rowPosition = source.indexOf("        Row:", tablePosition);
  return bracedBlockFrom(rowPosition)
    .replace(
      new RegExp('Database\\["public"\\]\\["Enums"\\]\\["([^"]+)"\\]', "g"),
      (_match, name: keyof typeof enumAlias) => enumAlias[name],
    )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

function compactTypeBlock(block: string) {
  return block
    .replace(
      new RegExp('Database\\["public"\\]\\["Enums"\\]\\["([^"]+)"\\]', "g"),
      (_match, name: keyof typeof enumAlias) => enumAlias[name] ?? "never",
    )
    .replace(
      new RegExp(
        'Database\\["public"\\]\\["Tables"\\]\\["([^"]+)"\\]\\["Row"\\]',
        "g",
      ),
      (_match, name: keyof typeof tableAlias) => tableAlias[name] ?? "never",
    )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

function functionsForPublicSchema() {
  const position = source.indexOf("    Functions: {", publicPosition);
  if (position < 0) return "Record<string, { Args: never; Returns: never }>";
  const block = bracedBlockFrom(position);
  if (!block.trim() || block.includes("[key: string]")) {
    return "Record<string, { Args: never; Returns: never }>";
  }
  return "{ " + compactTypeBlock(block) + " }";
}

const publicPosition = source.indexOf("  public: {");
const enumBlock = source.slice(source.indexOf("    Enums: {", publicPosition));
const enumTypes = Object.fromEntries(
  Object.keys(enumAlias).map((name) => {
    const match = enumBlock.match(new RegExp(name + ": ([^;]+);"));
    if (!match) throw new Error("Missing enum " + name + " in " + sourcePath);
    return [name, match[1]];
  }),
) as Record<keyof typeof enumAlias, string>;
const functionTypes = functionsForPublicSchema();

let output =
  "export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\n\n";
for (const [name, alias] of Object.entries(enumAlias)) {
  output +=
    "export type " +
    alias +
    " = " +
    enumTypes[name as keyof typeof enumAlias] +
    ";\n";
}
output += "\n";
for (const [table, alias] of Object.entries(tableAlias)) {
  output += "export type " + alias + " = { " + rowFor(table) + " };\n";
}
output +=
  "\ntype RowMap = { " +
  Object.entries(tableAlias)
    .map(([table, alias]) => table + ": " + alias)
    .join("; ") +
  " };\n";
output +=
  "type EnumMap = { " +
  Object.entries(enumAlias)
    .map(([name, alias]) => name + ": " + alias)
    .join("; ") +
  " };\n";
output += "type FunctionMap = " + functionTypes + ";\n";
output += "export type Tables<T extends keyof RowMap> = RowMap[T];\n";
output +=
  "export type TablesInsert<T extends keyof RowMap> = Partial<RowMap[T]>;\n";
output +=
  "export type TablesUpdate<T extends keyof RowMap> = Partial<RowMap[T]>;\n";
output += "export type Enums<T extends keyof EnumMap> = EnumMap[T];\n";
output += "export type CompositeTypes<_T extends string> = never;\n";
output +=
  "export type Database = { public: { Tables: { [K in keyof RowMap]: { Row: RowMap[K]; Insert: Partial<RowMap[K]>; Update: Partial<RowMap[K]>; Relationships: [] } }; Views: Record<string, never>; Functions: FunctionMap; Enums: EnumMap; CompositeTypes: Record<string, never> } };\n";
output +=
  "export const Constants = { public: { Enums: { " +
  Object.entries(enumTypes)
    .map(([name, value]) => name + ": [" + value.split(" | ").join(", ") + "]")
    .join(", ") +
  " } } } as const;\n";

fs.writeFileSync(DB, output);
if (fs.existsSync(GENERATED)) fs.unlinkSync(GENERATED);
console.log(
  "compact-db-types: wrote " +
    output.split("\n").length +
    " lines to src/types/db.ts",
);
