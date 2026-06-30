export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Currency = "EUR";
export type EventGenre =
  | "techno"
  | "afro_house"
  | "rap"
  | "commercial"
  | "live";
export type EventStatus = "draft" | "published" | "canceled" | "completed";
export type EventVibe =
  | "club"
  | "festival"
  | "rooftop"
  | "student_party"
  | "private_event";
export type ListingStatus =
  | "active"
  | "sold"
  | "canceled"
  | "expired"
  | "transferring"
  | "repair_needed";
export type MarketplacePaymentKind = "primary" | "resale";
export type MarketplacePaymentStatus =
  | "requires_payment"
  | "processing"
  | "succeeded"
  | "fulfillment_pending"
  | "transfers_pending"
  | "paid"
  | "failed"
  | "refund_pending"
  | "refunded"
  | "disputed"
  | "repair_needed";
export type MarketplaceTransferRecipientRole = "organizer" | "resale_seller";
export type MarketplaceTransferStatus =
  | "pending"
  | "created"
  | "reversed"
  | "failed";
export type OrganizationRole = "admin" | "controller";
export type OrganizationStatus = "active" | "suspended" | "deleted";
export type PurchaseStatus = "pending" | "paid" | "failed" | "refunded";
export type RedemptionResult =
  | "valid"
  | "already_used"
  | "refunded"
  | "canceled"
  | "wrong_event"
  | "expired"
  | "owner_mismatch"
  | "invalid_signature"
  | "tx_failed"
  | "tx_pending"
  | "no_ticket"
  | "no_session"
  | "wrong_category";
export type SalesChannel =
  | "mini_site"
  | "qr"
  | "marketplace"
  | "widget"
  | "ticket_office"
  | "invitation"
  | "import";
export type SellerRiskStatus =
  | "clear"
  | "restricted"
  | "owes_recovery"
  | "blocked";
export type TicketCategoryKind = "standard" | "club_table";
export type TicketStatus =
  | "available"
  | "reserved"
  | "sold"
  | "listed"
  | "used"
  | "refunded"
  | "canceled"
  | "expired"
  | "refund_pending"
  | "minting"
  | "transferring"
  | "repair_needed";
export type UserRole = "user" | "controller" | "admin" | "organizer";

export type EventRow = {
  artists: string[];
  capacity: number;
  city: string;
  conditions: string | null;
  created_at: string;
  date: string;
  description: string | null;
  floor_plan_url: string | null;
  genre: EventGenre | null;
  hero_url: string | null;
  id: string;
  image_ipfs_uri: string | null;
  image_url: string | null;
  is_festival: boolean;
  marketplace_url: string | null;
  name: string;
  nft_contract_address: string | null;
  organization_id: string;
  organizer_resale_royalty_bps: number;
  organizer_user_id: string | null;
  public_sales_counter_enabled: boolean;
  resale_enabled: boolean;
  role_admin_address: string | null;
  sales_channel: SalesChannel;
  sales_enabled: boolean;
  search_tsv: unknown;
  slug: string | null;
  status: EventStatus;
  thumbnail_url: string | null;
  ticket_visual_url: string | null;
  updated_at: string;
  venue_name: string;
  vibe: EventVibe | null;
};
export type Profile = {
  created_at: string;
  display_name: string | null;
  email: string;
  id: string;
  organizer_onboarding: Json | null;
  pro_crypto_mode: boolean;
  role: UserRole;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  stripe_details_submitted: boolean;
  stripe_payouts_enabled: boolean;
};
export type Ticket = {
  canceled_at: string | null;
  category_id: string;
  color_hex_snapshot: string | null;
  created_at: string;
  current_listing_id: string | null;
  event_id: string;
  extra_guests_count: number;
  id: string;
  image_url: string | null;
  last_transfer_tx_hash: string | null;
  metadata_uri: string | null;
  min_spending_remaining: number | null;
  min_spending_total: number | null;
  mint_tx_hash: string | null;
  minted_at: string | null;
  nft_contract_address: string | null;
  nft_token_id: number | null;
  original_purchase_id: string | null;
  owner_evm_address: string | null;
  owner_user_id: string | null;
  redeem_tx_hash: string | null;
  refunded_at: string | null;
  reserved_until: string | null;
  serial_number: number;
  status: TicketStatus;
  total_headcount: number | null;
  transferred_off_platform_at: string | null;
  transferred_to_address: string | null;
  updated_at: string;
  used_at: string | null;
};
export type TicketCategory = {
  base_capacity: number | null;
  benefits: string | null;
  color_hex: string | null;
  created_at: string;
  currency: Currency;
  description: string | null;
  event_id: string;
  extra_guests_enabled: boolean;
  id: string;
  image_ipfs_uri: string | null;
  image_url: string | null;
  kind: TicketCategoryKind;
  max_extra_guests: number | null;
  max_resale_price: number | null;
  min_spending: number | null;
  name: string;
  online_advance: number | null;
  price: number;
  price_per_extra_guest: number | null;
  public_sales_counter_enabled: boolean;
  resale_enabled: boolean;
  sale_ends_at: string | null;
  sale_starts_at: string | null;
  sales_enabled: boolean;
  sold_count: number;
  supply: number;
};
export type TicketRedemption = {
  controller_user_id: string;
  event_id: string;
  evm_address: string;
  gate_name: string | null;
  gate_session_id: string | null;
  id: string;
  organization_id: string | null;
  redeem_tx_hash: string | null;
  redeemed_at: string;
  result: RedemptionResult;
  ticket_id: string;
};
export type Purchase = {
  amount: number;
  buyer_total_amount: number | null;
  buyer_user_id: string;
  checkout_idempotency_key: string | null;
  created_at: string;
  currency: Currency;
  event_id: string;
  extra_guests_count: number;
  gift_recipient_user_id: string | null;
  id: string;
  min_spending_total: number | null;
  online_advance_amount: number | null;
  organization_id: string | null;
  paid_at: string | null;
  payment_provider: string | null;
  platform_fee_amount: number;
  provider_payment_id: string | null;
  provider_session_id: string | null;
  sales_channel: SalesChannel;
  status: PurchaseStatus;
  stripe_fee_amount: number;
  ticket_id: string;
  tracking_origin: string | null;
};
export type ResaleListing = {
  buyer_total_amount: number | null;
  buyer_user_id: string | null;
  checkout_idempotency_key: string | null;
  created_at: string;
  currency: Currency;
  id: string;
  organization_id: string | null;
  payment_provider: string | null;
  platform_fee_amount: number;
  price: number;
  provider_session_id: string | null;
  royalty_amount: number;
  sales_channel: SalesChannel;
  seller_user_id: string;
  sold_at: string | null;
  status: ListingStatus;
  stripe_fee_amount: number;
  ticket_id: string;
  tracking_origin: string | null;
};
export type Wallet = {
  created_at: string;
  evm_address: string;
  id: string;
  is_primary: boolean;
  smart_account_address: string | null;
  user_id: string;
};
export type GateSession = {
  allowed_category_ids: string[] | null;
  closed_at: string | null;
  controller_user_id: string;
  created_at: string;
  event_id: string;
  expires_at: string;
  gate_name: string | null;
  id: string;
  last_redemption_id: string | null;
  last_result: string | null;
  last_ticket_id: string | null;
  opened_at: string;
  short_code: string;
  status: string;
};
export type AuditLog = {
  action: string;
  actor_user_id: string | null;
  created_at: string;
  entity_id: string;
  entity_type: string;
  id: string;
  metadata_json: Json | null;
};
export type EventController = {
  event_id: string;
  invited_at: string;
  user_id: string;
};
export type ChainOp = {
  attempt: number;
  contract_address: string;
  created_at: string;
  error_message: string | null;
  from_address: string | null;
  id: string;
  idempotency_key: string;
  listing_id: string | null;
  metadata_uri: string | null;
  op_type: string;
  purchase_id: string | null;
  status: string;
  ticket_id: string;
  to_address: string;
  token_id: number;
  transaction_id: string | null;
  tx_hash: string | null;
  updated_at: string;
};
export type Organization = {
  branding: Json;
  country_code: string | null;
  created_at: string;
  created_by_user_id: string | null;
  custom_domain: string | null;
  custom_domain_verification_token: string | null;
  custom_domain_verified_at: string | null;
  default_currency: Currency;
  id: string;
  legal_profile: Json;
  name: string;
  organizer_onboarding: Json | null;
  resale_cap_bps: number;
  resale_royalty_bps: number;
  resale_royalty_enabled: boolean;
  slug: string;
  status: OrganizationStatus;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  stripe_details_submitted: boolean;
  stripe_payouts_enabled: boolean;
  theme: Json | null;
  updated_at: string;
};
export type OrganizationMembership = {
  created_at: string;
  id: string;
  organization_id: string;
  role: OrganizationRole;
  updated_at: string;
  user_id: string;
};
export type OrganizationCustomer = {
  first_seen_at: string;
  last_seen_at: string;
  organization_id: string;
  source: SalesChannel | null;
  user_id: string;
};
export type StripeSellerAccount = {
  charges_enabled: boolean;
  created_at: string;
  details_submitted: boolean;
  disabled_reason: string | null;
  id: string;
  last_webhook_at: string | null;
  payouts_enabled: boolean;
  requirements_json: Json | null;
  seller_risk_status: SellerRiskStatus;
  stripe_account_id: string;
  updated_at: string;
  user_id: string;
};
export type OrganizerProfile = {
  activated_at: string | null;
  created_at: string;
  event_typology: string;
  legal_verified_at: string | null;
  no_siret: boolean;
  page_description: string | null;
  page_name: string | null;
  page_slug: string | null;
  siret: string | null;
  status: string;
  stripe_verified_at: string | null;
  ticketing_footprint: string;
  updated_at: string;
  user_id: string;
  volume_estimation: string;
  widget_accent_color: string;
};
export type MarketplacePayment = {
  amount_total_cents: number;
  buyer_user_id: string;
  created_at: string;
  currency: Currency;
  discount_cents: number;
  disputed_at: string | null;
  failure_reason: string | null;
  fulfilled_at: string | null;
  id: string;
  kind: MarketplacePaymentKind;
  last_webhook_at: string | null;
  marketplace_fee_bps: number;
  marketplace_fee_cents: number;
  organizer_royalty_bps: number;
  organizer_royalty_cents: number;
  organizer_user_id: string | null;
  primary_seller_cents: number;
  primary_seller_user_id: string;
  promo_code_id: string | null;
  purchase_id: string | null;
  refunded_at: string | null;
  resale_listing_id: string | null;
  status: MarketplacePaymentStatus;
  stripe_charge_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_transfer_group: string | null;
  succeeded_at: string | null;
  transferred_at: string | null;
  updated_at: string;
};
export type MarketplaceTransfer = {
  amount_cents: number;
  created_at: string;
  currency: Currency;
  failure_reason: string | null;
  id: string;
  marketplace_payment_id: string;
  recipient_role: MarketplaceTransferRecipientRole;
  recipient_user_id: string;
  reversed_amount_cents: number;
  status: MarketplaceTransferStatus;
  stripe_connected_account_id: string;
  stripe_transfer_id: string | null;
  stripe_transfer_reversal_id: string | null;
  stripe_transfer_reversal_ids: string[];
  updated_at: string;
};
export type MarketplacePaymentItem = {
  amount_cents: number;
  created_at: string;
  id: string;
  marketplace_payment_id: string;
  purchase_id: string;
};
export type EventWaitlist = {
  claim_expires_at: string | null;
  created_at: string;
  event_id: string;
  id: string;
  notified_at: string | null;
  user_id: string;
};
export type OrganizationFollower = {
  created_at: string;
  id: string;
  organization_id: string;
  unsubscribe_token: string;
  unsubscribed_at: string | null;
  user_id: string;
};
export type PromoCode = {
  active: boolean;
  amount_off_cents: number | null;
  code: string;
  created_at: string;
  discount_kind: string;
  ends_at: string | null;
  id: string;
  max_uses: number | null;
  organization_id: string;
  percent_off: number | null;
  starts_at: string | null;
  used_count: number;
};
export type ResalePriceCap = {
  cap_bps: number;
  country_code: string;
  label: string | null;
  updated_at: string;
};
export type OrgEmbedding = {
  content: string;
  created_at: string;
  embedding: string;
  id: string;
  metadata: Json;
  organization_id: string;
  source_id: string | null;
  source_type: string;
  updated_at: string;
};
export type SiteSettings = {
  id: string;
  landing_audience_url: string | null;
  landing_dashboard_url: string | null;
  landing_hero_bg_url: string | null;
  updated_at: string;
};

type RowMap = {
  events: EventRow;
  profiles: Profile;
  tickets: Ticket;
  ticket_categories: TicketCategory;
  ticket_redemptions: TicketRedemption;
  purchases: Purchase;
  resale_listings: ResaleListing;
  wallets: Wallet;
  gate_sessions: GateSession;
  audit_logs: AuditLog;
  event_controllers: EventController;
  chain_ops: ChainOp;
  organizations: Organization;
  organization_memberships: OrganizationMembership;
  organization_customers: OrganizationCustomer;
  stripe_seller_accounts: StripeSellerAccount;
  organizer_profiles: OrganizerProfile;
  marketplace_payments: MarketplacePayment;
  marketplace_transfers: MarketplaceTransfer;
  marketplace_payment_items: MarketplacePaymentItem;
  event_waitlists: EventWaitlist;
  organization_followers: OrganizationFollower;
  promo_codes: PromoCode;
  resale_price_caps: ResalePriceCap;
  org_embeddings: OrgEmbedding;
  site_settings: SiteSettings;
};
type EnumMap = {
  currency: Currency;
  event_genre: EventGenre;
  event_status: EventStatus;
  event_vibe: EventVibe;
  listing_status: ListingStatus;
  marketplace_payment_kind: MarketplacePaymentKind;
  marketplace_payment_status: MarketplacePaymentStatus;
  marketplace_transfer_recipient_role: MarketplaceTransferRecipientRole;
  marketplace_transfer_status: MarketplaceTransferStatus;
  organization_role: OrganizationRole;
  organization_status: OrganizationStatus;
  purchase_status: PurchaseStatus;
  redemption_result: RedemptionResult;
  sales_channel: SalesChannel;
  seller_risk_status: SellerRiskStatus;
  ticket_category_kind: TicketCategoryKind;
  ticket_status: TicketStatus;
  user_role: UserRole;
};
type FunctionMap = {
  apply_stripe_account_snapshot: {
    Args: {
      p_user_id: string;
      p_stripe_account_id: string;
      p_charges_enabled: boolean;
      p_payouts_enabled: boolean;
      p_details_submitted: boolean;
      p_disabled_reason: string | null;
      p_requirements_json: Json | null;
    };
    Returns: StripeSellerAccount;
  };
  decrement_promo_use: { Args: { promo_id: string }; Returns: PromoCode[] };
  increment_promo_use: { Args: { promo_id: string }; Returns: PromoCode[] };
  match_org_embeddings: {
    Args: {
      query_embedding: string;
      match_org_id: string;
      match_count?: number;
    };
    Returns: Array<{
      id: string;
      source_type: string;
      source_id: string | null;
      content: string;
      metadata: Json;
      similarity: number;
    }>;
  };
};
export type Tables<T extends keyof RowMap> = RowMap[T];
export type TablesInsert<T extends keyof RowMap> = Partial<RowMap[T]>;
export type TablesUpdate<T extends keyof RowMap> = Partial<RowMap[T]>;
export type Enums<T extends keyof EnumMap> = EnumMap[T];
export type CompositeTypes<_T extends string> = never;
export type Database = {
  public: {
    Tables: {
      [K in keyof RowMap]: {
        Row: RowMap[K];
        Insert: Partial<RowMap[K]>;
        Update: Partial<RowMap[K]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: FunctionMap;
    Enums: EnumMap;
    CompositeTypes: Record<string, never>;
  };
};
export const Constants = {
  public: {
    Enums: {
      currency: ["EUR"],
      event_genre: ["techno", "afro_house", "rap", "commercial", "live"],
      event_status: ["draft", "published", "canceled", "completed"],
      event_vibe: [
        "club",
        "festival",
        "rooftop",
        "student_party",
        "private_event",
      ],
      listing_status: [
        "active",
        "sold",
        "canceled",
        "expired",
        "transferring",
        "repair_needed",
      ],
      marketplace_payment_kind: ["primary", "resale"],
      marketplace_payment_status: [
        "requires_payment",
        "processing",
        "succeeded",
        "fulfillment_pending",
        "transfers_pending",
        "paid",
        "failed",
        "refund_pending",
        "refunded",
        "disputed",
        "repair_needed",
      ],
      marketplace_transfer_recipient_role: ["organizer", "resale_seller"],
      marketplace_transfer_status: ["pending", "created", "reversed", "failed"],
      organization_role: ["admin", "controller"],
      organization_status: ["active", "suspended", "deleted"],
      purchase_status: ["pending", "paid", "failed", "refunded"],
      redemption_result: [
        "valid",
        "already_used",
        "refunded",
        "canceled",
        "wrong_event",
        "expired",
        "owner_mismatch",
        "invalid_signature",
        "tx_failed",
        "tx_pending",
        "no_ticket",
        "no_session",
        "wrong_category",
      ],
      sales_channel: [
        "mini_site",
        "qr",
        "marketplace",
        "widget",
        "ticket_office",
        "invitation",
        "import",
      ],
      seller_risk_status: ["clear", "restricted", "owes_recovery", "blocked"],
      ticket_category_kind: ["standard", "club_table"],
      ticket_status: [
        "available",
        "reserved",
        "sold",
        "listed",
        "used",
        "refunded",
        "canceled",
        "expired",
        "refund_pending",
        "minting",
        "transferring",
        "repair_needed",
      ],
      user_role: ["user", "controller", "admin", "organizer"],
    },
  },
} as const;
