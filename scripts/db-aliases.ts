// Hand-written type aliases appended to src/types/db.ts after every
// regen. Keep this list in sync with the schema so module imports
// `Profile`, `EventRow`, etc. survive `npm run supabase:types`.
//
// Format: each line gets concatenated verbatim to db.ts.
import fs from "node:fs";
import path from "node:path";

const ALIAS_BLOCK = `

// ---- Convenience aliases (preserved across \`npm run supabase:types\` regens) ----
export type EventRow = Tables<"events">
export type Profile = Tables<"profiles">
export type Ticket = Tables<"tickets">
export type TicketCategory = Tables<"ticket_categories">
export type TicketRedemption = Tables<"ticket_redemptions">
export type Purchase = Tables<"purchases">
export type ResaleListing = Tables<"resale_listings">
export type Wallet = Tables<"wallets">
export type GateSession = Tables<"gate_sessions">
export type AuditLog = Tables<"audit_logs">
export type EventController = Tables<"event_controllers">
export type ChainOp = Tables<"chain_ops">
export type Organization = Tables<"organizations">
export type OrganizationMembership = Tables<"organization_memberships">
export type OrganizationCustomer = Tables<"organization_customers">
export type StripeSellerAccount = Tables<"stripe_seller_accounts">
export type OrganizerProfile = Tables<"organizer_profiles">
export type MarketplacePayment = Tables<"marketplace_payments">
export type MarketplaceTransfer = Tables<"marketplace_transfers">
export type Currency = Enums<"currency">
export type UserRole = Enums<"user_role">
export type OrganizationRole = Enums<"organization_role">
export type OrganizationStatus = Enums<"organization_status">
export type SalesChannel = Enums<"sales_channel">
export type RedemptionResult = Enums<"redemption_result">
export type TicketCategoryKind = Enums<"ticket_category_kind">
export type SellerRiskStatus = Enums<"seller_risk_status">
export type MarketplacePaymentKind = Enums<"marketplace_payment_kind">
export type MarketplacePaymentStatus = Enums<"marketplace_payment_status">
export type MarketplaceTransferRecipientRole = Enums<"marketplace_transfer_recipient_role">
export type MarketplaceTransferStatus = Enums<"marketplace_transfer_status">
`;

const DB_PATH = path.resolve(process.cwd(), "src/types/db.ts");
const current = fs.readFileSync(DB_PATH, "utf8");
const marker = "// ---- Convenience aliases";
if (current.includes(marker)) {
  process.stdout.write("db-aliases: already present, skipping\n");
} else {
  fs.appendFileSync(DB_PATH, ALIAS_BLOCK);
  process.stdout.write("db-aliases: appended to src/types/db.ts\n");
}
