export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata_json: Json | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata_json?: Json | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chain_ops: {
        Row: {
          attempt: number
          contract_address: string
          created_at: string
          error_message: string | null
          from_address: string | null
          id: string
          idempotency_key: string
          listing_id: string | null
          metadata_uri: string | null
          op_type: string
          purchase_id: string | null
          status: string
          ticket_id: string
          to_address: string
          token_id: number
          transaction_id: string | null
          tx_hash: string | null
          updated_at: string
        }
        Insert: {
          attempt?: number
          contract_address: string
          created_at?: string
          error_message?: string | null
          from_address?: string | null
          id?: string
          idempotency_key: string
          listing_id?: string | null
          metadata_uri?: string | null
          op_type: string
          purchase_id?: string | null
          status?: string
          ticket_id: string
          to_address: string
          token_id: number
          transaction_id?: string | null
          tx_hash?: string | null
          updated_at?: string
        }
        Update: {
          attempt?: number
          contract_address?: string
          created_at?: string
          error_message?: string | null
          from_address?: string | null
          id?: string
          idempotency_key?: string
          listing_id?: string | null
          metadata_uri?: string | null
          op_type?: string
          purchase_id?: string | null
          status?: string
          ticket_id?: string
          to_address?: string
          token_id?: number
          transaction_id?: string | null
          tx_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chain_ops_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "resale_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_ops_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_ops_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      event_controllers: {
        Row: {
          event_id: string
          invited_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          invited_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          invited_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_controllers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_controllers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_waitlists: {
        Row: {
          claim_expires_at: string | null
          created_at: string
          event_id: string
          id: string
          notified_at: string | null
          user_id: string
        }
        Insert: {
          claim_expires_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          notified_at?: string | null
          user_id: string
        }
        Update: {
          claim_expires_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          notified_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_waitlists_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_waitlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          artists: string[]
          capacity: number
          city: string
          conditions: string | null
          created_at: string
          date: string
          description: string | null
          floor_plan_url: string | null
          genre: Database["public"]["Enums"]["event_genre"] | null
          hero_url: string | null
          id: string
          image_ipfs_uri: string | null
          image_url: string | null
          is_festival: boolean
          marketplace_url: string | null
          name: string
          nft_contract_address: string | null
          organization_id: string
          organizer_resale_royalty_bps: number
          organizer_user_id: string | null
          public_sales_counter_enabled: boolean
          resale_enabled: boolean
          role_admin_address: string | null
          sales_channel: Database["public"]["Enums"]["sales_channel"]
          sales_enabled: boolean
          search_tsv: unknown
          slug: string | null
          status: Database["public"]["Enums"]["event_status"]
          thumbnail_url: string | null
          ticket_visual_url: string | null
          updated_at: string
          venue_name: string
          vibe: Database["public"]["Enums"]["event_vibe"] | null
        }
        Insert: {
          artists?: string[]
          capacity: number
          city: string
          conditions?: string | null
          created_at?: string
          date: string
          description?: string | null
          floor_plan_url?: string | null
          genre?: Database["public"]["Enums"]["event_genre"] | null
          hero_url?: string | null
          id?: string
          image_ipfs_uri?: string | null
          image_url?: string | null
          is_festival?: boolean
          marketplace_url?: string | null
          name: string
          nft_contract_address?: string | null
          organization_id: string
          organizer_resale_royalty_bps?: number
          organizer_user_id?: string | null
          public_sales_counter_enabled?: boolean
          resale_enabled?: boolean
          role_admin_address?: string | null
          sales_channel?: Database["public"]["Enums"]["sales_channel"]
          sales_enabled?: boolean
          search_tsv?: unknown
          slug?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          thumbnail_url?: string | null
          ticket_visual_url?: string | null
          updated_at?: string
          venue_name: string
          vibe?: Database["public"]["Enums"]["event_vibe"] | null
        }
        Update: {
          artists?: string[]
          capacity?: number
          city?: string
          conditions?: string | null
          created_at?: string
          date?: string
          description?: string | null
          floor_plan_url?: string | null
          genre?: Database["public"]["Enums"]["event_genre"] | null
          hero_url?: string | null
          id?: string
          image_ipfs_uri?: string | null
          image_url?: string | null
          is_festival?: boolean
          marketplace_url?: string | null
          name?: string
          nft_contract_address?: string | null
          organization_id?: string
          organizer_resale_royalty_bps?: number
          organizer_user_id?: string | null
          public_sales_counter_enabled?: boolean
          resale_enabled?: boolean
          role_admin_address?: string | null
          sales_channel?: Database["public"]["Enums"]["sales_channel"]
          sales_enabled?: boolean
          search_tsv?: unknown
          slug?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          thumbnail_url?: string | null
          ticket_visual_url?: string | null
          updated_at?: string
          venue_name?: string
          vibe?: Database["public"]["Enums"]["event_vibe"] | null
        }
        Relationships: [
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organizer_user_id_fkey"
            columns: ["organizer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gate_sessions: {
        Row: {
          allowed_category_ids: string[] | null
          closed_at: string | null
          controller_user_id: string
          created_at: string
          event_id: string
          expires_at: string
          gate_name: string | null
          id: string
          last_redemption_id: string | null
          last_result: string | null
          last_ticket_id: string | null
          opened_at: string
          short_code: string
          status: string
        }
        Insert: {
          allowed_category_ids?: string[] | null
          closed_at?: string | null
          controller_user_id: string
          created_at?: string
          event_id: string
          expires_at: string
          gate_name?: string | null
          id?: string
          last_redemption_id?: string | null
          last_result?: string | null
          last_ticket_id?: string | null
          opened_at?: string
          short_code: string
          status?: string
        }
        Update: {
          allowed_category_ids?: string[] | null
          closed_at?: string | null
          controller_user_id?: string
          created_at?: string
          event_id?: string
          expires_at?: string
          gate_name?: string | null
          id?: string
          last_redemption_id?: string | null
          last_result?: string | null
          last_ticket_id?: string | null
          opened_at?: string
          short_code?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gate_sessions_controller_user_id_fkey"
            columns: ["controller_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_sessions_last_redemption_fk"
            columns: ["last_redemption_id"]
            isOneToOne: false
            referencedRelation: "ticket_redemptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_sessions_last_ticket_id_fkey"
            columns: ["last_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_payment_items: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          marketplace_payment_id: string
          purchase_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          marketplace_payment_id: string
          purchase_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          marketplace_payment_id?: string
          purchase_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_payment_items_marketplace_payment_id_fkey"
            columns: ["marketplace_payment_id"]
            isOneToOne: false
            referencedRelation: "marketplace_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_payment_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: true
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_payments: {
        Row: {
          amount_total_cents: number
          buyer_user_id: string
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          discount_cents: number
          disputed_at: string | null
          failure_reason: string | null
          fulfilled_at: string | null
          id: string
          kind: Database["public"]["Enums"]["marketplace_payment_kind"]
          last_webhook_at: string | null
          marketplace_fee_bps: number
          marketplace_fee_cents: number
          organizer_royalty_bps: number
          organizer_royalty_cents: number
          organizer_user_id: string | null
          primary_seller_cents: number
          primary_seller_user_id: string
          promo_code_id: string | null
          purchase_id: string | null
          refunded_at: string | null
          resale_listing_id: string | null
          status: Database["public"]["Enums"]["marketplace_payment_status"]
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          stripe_transfer_group: string | null
          succeeded_at: string | null
          transferred_at: string | null
          updated_at: string
        }
        Insert: {
          amount_total_cents: number
          buyer_user_id: string
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          discount_cents?: number
          disputed_at?: string | null
          failure_reason?: string | null
          fulfilled_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["marketplace_payment_kind"]
          last_webhook_at?: string | null
          marketplace_fee_bps: number
          marketplace_fee_cents: number
          organizer_royalty_bps?: number
          organizer_royalty_cents?: number
          organizer_user_id?: string | null
          primary_seller_cents: number
          primary_seller_user_id: string
          promo_code_id?: string | null
          purchase_id?: string | null
          refunded_at?: string | null
          resale_listing_id?: string | null
          status?: Database["public"]["Enums"]["marketplace_payment_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_transfer_group?: string | null
          succeeded_at?: string | null
          transferred_at?: string | null
          updated_at?: string
        }
        Update: {
          amount_total_cents?: number
          buyer_user_id?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          discount_cents?: number
          disputed_at?: string | null
          failure_reason?: string | null
          fulfilled_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["marketplace_payment_kind"]
          last_webhook_at?: string | null
          marketplace_fee_bps?: number
          marketplace_fee_cents?: number
          organizer_royalty_bps?: number
          organizer_royalty_cents?: number
          organizer_user_id?: string | null
          primary_seller_cents?: number
          primary_seller_user_id?: string
          promo_code_id?: string | null
          purchase_id?: string | null
          refunded_at?: string | null
          resale_listing_id?: string | null
          status?: Database["public"]["Enums"]["marketplace_payment_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_transfer_group?: string | null
          succeeded_at?: string | null
          transferred_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_payments_buyer_user_id_fkey"
            columns: ["buyer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_payments_organizer_user_id_fkey"
            columns: ["organizer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_payments_primary_seller_user_id_fkey"
            columns: ["primary_seller_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_payments_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_payments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_payments_resale_listing_id_fkey"
            columns: ["resale_listing_id"]
            isOneToOne: false
            referencedRelation: "resale_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_transfers: {
        Row: {
          amount_cents: number
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          failure_reason: string | null
          id: string
          marketplace_payment_id: string
          recipient_role: Database["public"]["Enums"]["marketplace_transfer_recipient_role"]
          recipient_user_id: string
          status: Database["public"]["Enums"]["marketplace_transfer_status"]
          stripe_connected_account_id: string
          stripe_transfer_id: string | null
          stripe_transfer_reversal_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          failure_reason?: string | null
          id?: string
          marketplace_payment_id: string
          recipient_role: Database["public"]["Enums"]["marketplace_transfer_recipient_role"]
          recipient_user_id: string
          status?: Database["public"]["Enums"]["marketplace_transfer_status"]
          stripe_connected_account_id: string
          stripe_transfer_id?: string | null
          stripe_transfer_reversal_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          failure_reason?: string | null
          id?: string
          marketplace_payment_id?: string
          recipient_role?: Database["public"]["Enums"]["marketplace_transfer_recipient_role"]
          recipient_user_id?: string
          status?: Database["public"]["Enums"]["marketplace_transfer_status"]
          stripe_connected_account_id?: string
          stripe_transfer_id?: string | null
          stripe_transfer_reversal_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_transfers_marketplace_payment_id_fkey"
            columns: ["marketplace_payment_id"]
            isOneToOne: false
            referencedRelation: "marketplace_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_transfers_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_customers: {
        Row: {
          first_seen_at: string
          last_seen_at: string
          organization_id: string
          source: Database["public"]["Enums"]["sales_channel"] | null
          user_id: string
        }
        Insert: {
          first_seen_at?: string
          last_seen_at?: string
          organization_id: string
          source?: Database["public"]["Enums"]["sales_channel"] | null
          user_id: string
        }
        Update: {
          first_seen_at?: string
          last_seen_at?: string
          organization_id?: string
          source?: Database["public"]["Enums"]["sales_channel"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_followers: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          unsubscribe_token: string
          unsubscribed_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_followers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_followers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          branding: Json
          country_code: string | null
          created_at: string
          created_by_user_id: string | null
          custom_domain: string | null
          custom_domain_verification_token: string | null
          custom_domain_verified_at: string | null
          default_currency: Database["public"]["Enums"]["currency"]
          id: string
          legal_profile: Json
          name: string
          organizer_onboarding: Json | null
          resale_cap_bps: number
          resale_royalty_bps: number
          resale_royalty_enabled: boolean
          slug: string
          status: Database["public"]["Enums"]["organization_status"]
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_details_submitted: boolean
          stripe_payouts_enabled: boolean
          theme: Json | null
          updated_at: string
        }
        Insert: {
          branding?: Json
          country_code?: string | null
          created_at?: string
          created_by_user_id?: string | null
          custom_domain?: string | null
          custom_domain_verification_token?: string | null
          custom_domain_verified_at?: string | null
          default_currency?: Database["public"]["Enums"]["currency"]
          id?: string
          legal_profile?: Json
          name: string
          organizer_onboarding?: Json | null
          resale_cap_bps?: number
          resale_royalty_bps?: number
          resale_royalty_enabled?: boolean
          slug: string
          status?: Database["public"]["Enums"]["organization_status"]
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_details_submitted?: boolean
          stripe_payouts_enabled?: boolean
          theme?: Json | null
          updated_at?: string
        }
        Update: {
          branding?: Json
          country_code?: string | null
          created_at?: string
          created_by_user_id?: string | null
          custom_domain?: string | null
          custom_domain_verification_token?: string | null
          custom_domain_verified_at?: string | null
          default_currency?: Database["public"]["Enums"]["currency"]
          id?: string
          legal_profile?: Json
          name?: string
          organizer_onboarding?: Json | null
          resale_cap_bps?: number
          resale_royalty_bps?: number
          resale_royalty_enabled?: boolean
          slug?: string
          status?: Database["public"]["Enums"]["organization_status"]
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_details_submitted?: boolean
          stripe_payouts_enabled?: boolean
          theme?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_profiles: {
        Row: {
          activated_at: string | null
          created_at: string
          event_typology: string
          legal_verified_at: string | null
          no_siret: boolean
          page_description: string | null
          page_name: string | null
          page_slug: string | null
          siret: string | null
          status: string
          stripe_verified_at: string | null
          ticketing_footprint: string
          updated_at: string
          user_id: string
          volume_estimation: string
          widget_accent_color: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          event_typology: string
          legal_verified_at?: string | null
          no_siret?: boolean
          page_description?: string | null
          page_name?: string | null
          page_slug?: string | null
          siret?: string | null
          status?: string
          stripe_verified_at?: string | null
          ticketing_footprint: string
          updated_at?: string
          user_id: string
          volume_estimation: string
          widget_accent_color?: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          event_typology?: string
          legal_verified_at?: string | null
          no_siret?: boolean
          page_description?: string | null
          page_name?: string | null
          page_slug?: string | null
          siret?: string | null
          status?: string
          stripe_verified_at?: string | null
          ticketing_footprint?: string
          updated_at?: string
          user_id?: string
          volume_estimation?: string
          widget_accent_color?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizer_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          organizer_onboarding: Json | null
          pro_crypto_mode: boolean
          role: Database["public"]["Enums"]["user_role"]
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_details_submitted: boolean
          stripe_payouts_enabled: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          organizer_onboarding?: Json | null
          pro_crypto_mode?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_details_submitted?: boolean
          stripe_payouts_enabled?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          organizer_onboarding?: Json | null
          pro_crypto_mode?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_details_submitted?: boolean
          stripe_payouts_enabled?: boolean
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          amount_off_cents: number | null
          code: string
          created_at: string
          discount_kind: string
          ends_at: string | null
          id: string
          max_uses: number | null
          organization_id: string
          percent_off: number | null
          starts_at: string | null
          used_count: number
        }
        Insert: {
          active?: boolean
          amount_off_cents?: number | null
          code: string
          created_at?: string
          discount_kind: string
          ends_at?: string | null
          id?: string
          max_uses?: number | null
          organization_id: string
          percent_off?: number | null
          starts_at?: string | null
          used_count?: number
        }
        Update: {
          active?: boolean
          amount_off_cents?: number | null
          code?: string
          created_at?: string
          discount_kind?: string
          ends_at?: string | null
          id?: string
          max_uses?: number | null
          organization_id?: string
          percent_off?: number | null
          starts_at?: string | null
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          amount: number
          buyer_total_amount: number | null
          buyer_user_id: string
          checkout_idempotency_key: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          event_id: string
          extra_guests_count: number
          gift_recipient_user_id: string | null
          id: string
          min_spending_total: number | null
          online_advance_amount: number | null
          organization_id: string | null
          paid_at: string | null
          payment_provider: string | null
          platform_fee_amount: number
          provider_payment_id: string | null
          provider_session_id: string | null
          sales_channel: Database["public"]["Enums"]["sales_channel"]
          status: Database["public"]["Enums"]["purchase_status"]
          stripe_fee_amount: number
          ticket_id: string
          tracking_origin: string | null
        }
        Insert: {
          amount: number
          buyer_total_amount?: number | null
          buyer_user_id: string
          checkout_idempotency_key?: string | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          event_id: string
          extra_guests_count?: number
          gift_recipient_user_id?: string | null
          id?: string
          min_spending_total?: number | null
          online_advance_amount?: number | null
          organization_id?: string | null
          paid_at?: string | null
          payment_provider?: string | null
          platform_fee_amount?: number
          provider_payment_id?: string | null
          provider_session_id?: string | null
          sales_channel?: Database["public"]["Enums"]["sales_channel"]
          status?: Database["public"]["Enums"]["purchase_status"]
          stripe_fee_amount?: number
          ticket_id: string
          tracking_origin?: string | null
        }
        Update: {
          amount?: number
          buyer_total_amount?: number | null
          buyer_user_id?: string
          checkout_idempotency_key?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          event_id?: string
          extra_guests_count?: number
          gift_recipient_user_id?: string | null
          id?: string
          min_spending_total?: number | null
          online_advance_amount?: number | null
          organization_id?: string | null
          paid_at?: string | null
          payment_provider?: string | null
          platform_fee_amount?: number
          provider_payment_id?: string | null
          provider_session_id?: string | null
          sales_channel?: Database["public"]["Enums"]["sales_channel"]
          status?: Database["public"]["Enums"]["purchase_status"]
          stripe_fee_amount?: number
          ticket_id?: string
          tracking_origin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_buyer_user_id_fkey"
            columns: ["buyer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_gift_recipient_user_id_fkey"
            columns: ["gift_recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      resale_listings: {
        Row: {
          buyer_total_amount: number | null
          buyer_user_id: string | null
          checkout_idempotency_key: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          id: string
          organization_id: string | null
          payment_provider: string | null
          platform_fee_amount: number
          price: number
          provider_session_id: string | null
          royalty_amount: number
          sales_channel: Database["public"]["Enums"]["sales_channel"]
          seller_user_id: string
          sold_at: string | null
          status: Database["public"]["Enums"]["listing_status"]
          stripe_fee_amount: number
          ticket_id: string
          tracking_origin: string | null
        }
        Insert: {
          buyer_total_amount?: number | null
          buyer_user_id?: string | null
          checkout_idempotency_key?: string | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          id?: string
          organization_id?: string | null
          payment_provider?: string | null
          platform_fee_amount?: number
          price: number
          provider_session_id?: string | null
          royalty_amount?: number
          sales_channel?: Database["public"]["Enums"]["sales_channel"]
          seller_user_id: string
          sold_at?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          stripe_fee_amount?: number
          ticket_id: string
          tracking_origin?: string | null
        }
        Update: {
          buyer_total_amount?: number | null
          buyer_user_id?: string | null
          checkout_idempotency_key?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          id?: string
          organization_id?: string | null
          payment_provider?: string | null
          platform_fee_amount?: number
          price?: number
          provider_session_id?: string | null
          royalty_amount?: number
          sales_channel?: Database["public"]["Enums"]["sales_channel"]
          seller_user_id?: string
          sold_at?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          stripe_fee_amount?: number
          ticket_id?: string
          tracking_origin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resale_listings_buyer_user_id_fkey"
            columns: ["buyer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resale_listings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resale_listings_seller_user_id_fkey"
            columns: ["seller_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resale_listings_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      resale_price_caps: {
        Row: {
          cap_bps: number
          country_code: string
          label: string | null
          updated_at: string
        }
        Insert: {
          cap_bps: number
          country_code: string
          label?: string | null
          updated_at?: string
        }
        Update: {
          cap_bps?: number
          country_code?: string
          label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      resale_seller_settlements: {
        Row: {
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          id: string
          listing_id: string
          provider_transfer_id: string | null
          seller_user_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          id?: string
          listing_id: string
          provider_transfer_id?: string | null
          seller_user_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          id?: string
          listing_id?: string
          provider_transfer_id?: string | null
          seller_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "resale_seller_settlements_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "resale_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resale_seller_settlements_seller_user_id_fkey"
            columns: ["seller_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          id: string
          landing_audience_url: string | null
          landing_dashboard_url: string | null
          landing_hero_bg_url: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          landing_audience_url?: string | null
          landing_dashboard_url?: string | null
          landing_hero_bg_url?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          landing_audience_url?: string | null
          landing_dashboard_url?: string | null
          landing_hero_bg_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stripe_seller_accounts: {
        Row: {
          charges_enabled: boolean
          created_at: string
          details_submitted: boolean
          disabled_reason: string | null
          id: string
          last_webhook_at: string | null
          payouts_enabled: boolean
          requirements_json: Json | null
          seller_risk_status: Database["public"]["Enums"]["seller_risk_status"]
          stripe_account_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          disabled_reason?: string | null
          id?: string
          last_webhook_at?: string | null
          payouts_enabled?: boolean
          requirements_json?: Json | null
          seller_risk_status?: Database["public"]["Enums"]["seller_risk_status"]
          stripe_account_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          disabled_reason?: string | null
          id?: string
          last_webhook_at?: string | null
          payouts_enabled?: boolean
          requirements_json?: Json | null
          seller_risk_status?: Database["public"]["Enums"]["seller_risk_status"]
          stripe_account_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_seller_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_categories: {
        Row: {
          base_capacity: number | null
          benefits: string | null
          color_hex: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          description: string | null
          event_id: string
          extra_guests_enabled: boolean
          id: string
          image_ipfs_uri: string | null
          image_url: string | null
          kind: Database["public"]["Enums"]["ticket_category_kind"]
          max_extra_guests: number | null
          max_resale_price: number | null
          min_spending: number | null
          name: string
          online_advance: number | null
          price: number
          price_per_extra_guest: number | null
          public_sales_counter_enabled: boolean
          resale_enabled: boolean
          sale_ends_at: string | null
          sale_starts_at: string | null
          sales_enabled: boolean
          sold_count: number
          supply: number
        }
        Insert: {
          base_capacity?: number | null
          benefits?: string | null
          color_hex?: string | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          description?: string | null
          event_id: string
          extra_guests_enabled?: boolean
          id?: string
          image_ipfs_uri?: string | null
          image_url?: string | null
          kind?: Database["public"]["Enums"]["ticket_category_kind"]
          max_extra_guests?: number | null
          max_resale_price?: number | null
          min_spending?: number | null
          name: string
          online_advance?: number | null
          price: number
          price_per_extra_guest?: number | null
          public_sales_counter_enabled?: boolean
          resale_enabled?: boolean
          sale_ends_at?: string | null
          sale_starts_at?: string | null
          sales_enabled?: boolean
          sold_count?: number
          supply: number
        }
        Update: {
          base_capacity?: number | null
          benefits?: string | null
          color_hex?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          description?: string | null
          event_id?: string
          extra_guests_enabled?: boolean
          id?: string
          image_ipfs_uri?: string | null
          image_url?: string | null
          kind?: Database["public"]["Enums"]["ticket_category_kind"]
          max_extra_guests?: number | null
          max_resale_price?: number | null
          min_spending?: number | null
          name?: string
          online_advance?: number | null
          price?: number
          price_per_extra_guest?: number | null
          public_sales_counter_enabled?: boolean
          resale_enabled?: boolean
          sale_ends_at?: string | null
          sale_starts_at?: string | null
          sales_enabled?: boolean
          sold_count?: number
          supply?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_categories_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_redemptions: {
        Row: {
          controller_user_id: string
          event_id: string
          evm_address: string
          gate_name: string | null
          gate_session_id: string | null
          id: string
          organization_id: string | null
          redeem_tx_hash: string | null
          redeemed_at: string
          result: Database["public"]["Enums"]["redemption_result"]
          ticket_id: string
        }
        Insert: {
          controller_user_id: string
          event_id: string
          evm_address: string
          gate_name?: string | null
          gate_session_id?: string | null
          id?: string
          organization_id?: string | null
          redeem_tx_hash?: string | null
          redeemed_at?: string
          result: Database["public"]["Enums"]["redemption_result"]
          ticket_id: string
        }
        Update: {
          controller_user_id?: string
          event_id?: string
          evm_address?: string
          gate_name?: string | null
          gate_session_id?: string | null
          id?: string
          organization_id?: string | null
          redeem_tx_hash?: string | null
          redeemed_at?: string
          result?: Database["public"]["Enums"]["redemption_result"]
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_redemptions_controller_user_id_fkey"
            columns: ["controller_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_redemptions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_redemptions_gate_session_id_fkey"
            columns: ["gate_session_id"]
            isOneToOne: false
            referencedRelation: "gate_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_redemptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_redemptions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          canceled_at: string | null
          category_id: string
          color_hex_snapshot: string | null
          created_at: string
          current_listing_id: string | null
          event_id: string
          extra_guests_count: number
          id: string
          image_url: string | null
          last_transfer_tx_hash: string | null
          metadata_uri: string | null
          min_spending_remaining: number | null
          min_spending_total: number | null
          mint_tx_hash: string | null
          minted_at: string | null
          nft_contract_address: string | null
          nft_token_id: number | null
          original_purchase_id: string | null
          owner_evm_address: string | null
          owner_user_id: string | null
          redeem_tx_hash: string | null
          refunded_at: string | null
          reserved_until: string | null
          serial_number: number
          status: Database["public"]["Enums"]["ticket_status"]
          total_headcount: number | null
          transferred_off_platform_at: string | null
          transferred_to_address: string | null
          updated_at: string
          used_at: string | null
        }
        Insert: {
          canceled_at?: string | null
          category_id: string
          color_hex_snapshot?: string | null
          created_at?: string
          current_listing_id?: string | null
          event_id: string
          extra_guests_count?: number
          id?: string
          image_url?: string | null
          last_transfer_tx_hash?: string | null
          metadata_uri?: string | null
          min_spending_remaining?: number | null
          min_spending_total?: number | null
          mint_tx_hash?: string | null
          minted_at?: string | null
          nft_contract_address?: string | null
          nft_token_id?: number | null
          original_purchase_id?: string | null
          owner_evm_address?: string | null
          owner_user_id?: string | null
          redeem_tx_hash?: string | null
          refunded_at?: string | null
          reserved_until?: string | null
          serial_number: number
          status?: Database["public"]["Enums"]["ticket_status"]
          total_headcount?: number | null
          transferred_off_platform_at?: string | null
          transferred_to_address?: string | null
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          canceled_at?: string | null
          category_id?: string
          color_hex_snapshot?: string | null
          created_at?: string
          current_listing_id?: string | null
          event_id?: string
          extra_guests_count?: number
          id?: string
          image_url?: string | null
          last_transfer_tx_hash?: string | null
          metadata_uri?: string | null
          min_spending_remaining?: number | null
          min_spending_total?: number | null
          mint_tx_hash?: string | null
          minted_at?: string | null
          nft_contract_address?: string | null
          nft_token_id?: number | null
          original_purchase_id?: string | null
          owner_evm_address?: string | null
          owner_user_id?: string | null
          redeem_tx_hash?: string | null
          refunded_at?: string | null
          reserved_until?: string | null
          serial_number?: number
          status?: Database["public"]["Enums"]["ticket_status"]
          total_headcount?: number | null
          transferred_off_platform_at?: string | null
          transferred_to_address?: string | null
          updated_at?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ticket_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_current_listing_fk"
            columns: ["current_listing_id"]
            isOneToOne: false
            referencedRelation: "resale_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          created_at: string
          evm_address: string
          id: string
          is_primary: boolean
          smart_account_address: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          evm_address: string
          id?: string
          is_primary?: boolean
          smart_account_address?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          evm_address?: string
          id?: string
          is_primary?: boolean
          smart_account_address?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      event_popularity: {
        Row: {
          event_id: string | null
          tickets_sold: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_categories_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_stripe_account_snapshot: {
        Args: {
          p_charges_enabled: boolean
          p_details_submitted: boolean
          p_disabled_reason: string
          p_payouts_enabled: boolean
          p_requirements_json: Json
          p_stripe_account_id: string
          p_user_id: string
        }
        Returns: {
          charges_enabled: boolean
          created_at: string
          details_submitted: boolean
          disabled_reason: string | null
          id: string
          last_webhook_at: string | null
          payouts_enabled: boolean
          requirements_json: Json | null
          seller_risk_status: Database["public"]["Enums"]["seller_risk_status"]
          stripe_account_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "stripe_seller_accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      controls_event: { Args: { check_event_id: string }; Returns: boolean }
      current_organization_role: {
        Args: { check_organization_id: string }
        Returns: Database["public"]["Enums"]["organization_role"]
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      decrement_promo_use: {
        Args: { promo_id: string }
        Returns: {
          active: boolean
          amount_off_cents: number | null
          code: string
          created_at: string
          discount_kind: string
          ends_at: string | null
          id: string
          max_uses: number | null
          organization_id: string
          percent_off: number | null
          starts_at: string | null
          used_count: number
        }[]
        SetofOptions: {
          from: "*"
          to: "promo_codes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_role: {
        Args: { roles: Database["public"]["Enums"]["user_role"][] }
        Returns: boolean
      }
      increment_promo_use: {
        Args: { promo_id: string }
        Returns: {
          active: boolean
          amount_off_cents: number | null
          code: string
          created_at: string
          discount_kind: string
          ends_at: string | null
          id: string
          max_uses: number | null
          organization_id: string
          percent_off: number | null
          starts_at: string | null
          used_count: number
        }[]
        SetofOptions: {
          from: "*"
          to: "promo_codes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      is_admin: { Args: never; Returns: boolean }
      is_event_published: { Args: { check_event_id: string }; Returns: boolean }
      is_organization_admin: {
        Args: { check_organization_id: string }
        Returns: boolean
      }
      is_organization_controller: {
        Args: { check_organization_id: string }
        Returns: boolean
      }
      is_organization_member: {
        Args: { check_organization_id: string }
        Returns: boolean
      }
      organizes_event: { Args: { check_event_id: string }; Returns: boolean }
      refresh_organizer_live_status: {
        Args: { p_user_id: string }
        Returns: {
          activated_at: string | null
          created_at: string
          event_typology: string
          legal_verified_at: string | null
          no_siret: boolean
          page_description: string | null
          page_name: string | null
          page_slug: string | null
          siret: string | null
          status: string
          stripe_verified_at: string | null
          ticketing_footprint: string
          updated_at: string
          user_id: string
          volume_estimation: string
          widget_accent_color: string
        }
        SetofOptions: {
          from: "*"
          to: "organizer_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      currency: "EUR"
      event_genre: "techno" | "afro_house" | "rap" | "commercial" | "live"
      event_status: "draft" | "published" | "canceled" | "completed"
      event_vibe:
        | "club"
        | "festival"
        | "rooftop"
        | "student_party"
        | "private_event"
      listing_status:
        | "active"
        | "sold"
        | "canceled"
        | "expired"
        | "transferring"
        | "repair_needed"
      marketplace_payment_kind: "primary" | "resale"
      marketplace_payment_status:
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
        | "repair_needed"
      marketplace_transfer_recipient_role: "organizer" | "resale_seller"
      marketplace_transfer_status: "pending" | "created" | "reversed" | "failed"
      organization_role: "admin" | "controller"
      organization_status: "active" | "suspended" | "deleted"
      purchase_status: "pending" | "paid" | "failed" | "refunded"
      redemption_result:
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
        | "wrong_category"
      sales_channel:
        | "mini_site"
        | "qr"
        | "marketplace"
        | "widget"
        | "ticket_office"
        | "invitation"
        | "import"
      seller_risk_status: "clear" | "restricted" | "owes_recovery" | "blocked"
      ticket_category_kind: "standard" | "club_table"
      ticket_status:
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
        | "repair_needed"
      user_role: "user" | "controller" | "admin" | "organizer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
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
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const



// ---- Convenience aliases (preserved across `npm run supabase:types` regens) ----
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
export type MarketplacePaymentItem = Tables<"marketplace_payment_items">
export type EventWaitlist = Tables<"event_waitlists">
export type OrganizationFollower = Tables<"organization_followers">
export type PromoCode = Tables<"promo_codes">
export type ResalePriceCap = Tables<"resale_price_caps">
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
