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
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
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
      account_balances: {
        Row: {
          available_amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          available_amount?: number
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          id?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          available_amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_balances_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      balance_ledger_entries: {
        Row: {
          account_balance_id: string
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          id: string
          movement_type: Database["public"]["Enums"]["balance_movement_type"]
          profile_id: string
          reference_id: string
          reference_type: string
        }
        Insert: {
          account_balance_id: string
          amount: number
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          id?: string
          movement_type: Database["public"]["Enums"]["balance_movement_type"]
          profile_id: string
          reference_id: string
          reference_type: string
        }
        Update: {
          account_balance_id?: string
          amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          id?: string
          movement_type?: Database["public"]["Enums"]["balance_movement_type"]
          profile_id?: string
          reference_id?: string
          reference_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_ledger_entries_account_balance_id_fkey"
            columns: ["account_balance_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balance_ledger_entries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      events: {
        Row: {
          capacity: number
          city: string
          conditions: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          image_ipfs_uri: string | null
          image_url: string | null
          name: string
          nft_contract_address: string | null
          public_sales_counter_enabled: boolean
          resale_enabled: boolean
          sales_enabled: boolean
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
          venue_name: string
        }
        Insert: {
          capacity: number
          city: string
          conditions?: string | null
          created_at?: string
          date: string
          description?: string | null
          id?: string
          image_ipfs_uri?: string | null
          image_url?: string | null
          name: string
          nft_contract_address?: string | null
          public_sales_counter_enabled?: boolean
          resale_enabled?: boolean
          sales_enabled?: boolean
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          venue_name: string
        }
        Update: {
          capacity?: number
          city?: string
          conditions?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          image_ipfs_uri?: string | null
          image_url?: string | null
          name?: string
          nft_contract_address?: string | null
          public_sales_counter_enabled?: boolean
          resale_enabled?: boolean
          sales_enabled?: boolean
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          venue_name?: string
        }
        Relationships: []
      }
      gate_sessions: {
        Row: {
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
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          pro_crypto_mode: boolean
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          pro_crypto_mode?: boolean
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          pro_crypto_mode?: boolean
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number
          buyer_user_id: string
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          event_id: string
          id: string
          paid_at: string | null
          payment_provider: string | null
          provider_payment_id: string | null
          provider_session_id: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          ticket_id: string
        }
        Insert: {
          amount: number
          buyer_user_id: string
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          event_id: string
          id?: string
          paid_at?: string | null
          payment_provider?: string | null
          provider_payment_id?: string | null
          provider_session_id?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          ticket_id: string
        }
        Update: {
          amount?: number
          buyer_user_id?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          event_id?: string
          id?: string
          paid_at?: string | null
          payment_provider?: string | null
          provider_payment_id?: string | null
          provider_session_id?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          ticket_id?: string
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
          buyer_user_id: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          id: string
          payment_provider: string | null
          price: number
          provider_session_id: string | null
          seller_user_id: string
          sold_at: string | null
          status: Database["public"]["Enums"]["listing_status"]
          ticket_id: string
        }
        Insert: {
          buyer_user_id?: string | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          id?: string
          payment_provider?: string | null
          price: number
          provider_session_id?: string | null
          seller_user_id: string
          sold_at?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          ticket_id: string
        }
        Update: {
          buyer_user_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          id?: string
          payment_provider?: string | null
          price?: number
          provider_session_id?: string | null
          seller_user_id?: string
          sold_at?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          ticket_id?: string
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
      ticket_categories: {
        Row: {
          benefits: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          description: string | null
          event_id: string
          id: string
          max_resale_price: number | null
          name: string
          price: number
          resale_enabled: boolean
          sold_count: number
          supply: number
        }
        Insert: {
          benefits?: string | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          description?: string | null
          event_id: string
          id?: string
          max_resale_price?: number | null
          name: string
          price: number
          resale_enabled?: boolean
          sold_count?: number
          supply: number
        }
        Update: {
          benefits?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          description?: string | null
          event_id?: string
          id?: string
          max_resale_price?: number | null
          name?: string
          price?: number
          resale_enabled?: boolean
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
          created_at: string
          current_listing_id: string | null
          event_id: string
          id: string
          image_url: string | null
          metadata_uri: string | null
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
          updated_at: string
          used_at: string | null
        }
        Insert: {
          canceled_at?: string | null
          category_id: string
          created_at?: string
          current_listing_id?: string | null
          event_id: string
          id?: string
          image_url?: string | null
          metadata_uri?: string | null
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
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          canceled_at?: string | null
          category_id?: string
          created_at?: string
          current_listing_id?: string | null
          event_id?: string
          id?: string
          image_url?: string | null
          metadata_uri?: string | null
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
      [_ in never]: never
    }
    Functions: {
      account_balance_credit: {
        Args: {
          p_profile_id: string
          p_currency: Database["public"]["Enums"]["currency"]
          p_movement_type: Database["public"]["Enums"]["balance_movement_type"]
          p_amount: number
          p_reference_type: string
          p_reference_id: string
        }
        Returns: {
          account_balance_id: string
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          id: string
          movement_type: Database["public"]["Enums"]["balance_movement_type"]
          profile_id: string
          reference_id: string
          reference_type: string
        }
      }
      account_balance_debit: {
        Args: {
          p_profile_id: string
          p_currency: Database["public"]["Enums"]["currency"]
          p_movement_type: Database["public"]["Enums"]["balance_movement_type"]
          p_amount: number
          p_reference_type: string
          p_reference_id: string
        }
        Returns: {
          account_balance_id: string
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          id: string
          movement_type: Database["public"]["Enums"]["balance_movement_type"]
          profile_id: string
          reference_id: string
          reference_type: string
        }
      }
      assert_balance_holder: {
        Args: {
          p_profile_id: string
        }
        Returns: undefined
      }
      current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_role: {
        Args: {
          roles: Database["public"]["Enums"]["user_role"][]
        }
        Returns: boolean
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      balance_movement_type:
        | "seed_credit"
        | "admin_topup_credit"
        | "purchase_debit"
        | "resale_buyer_debit"
        | "resale_seller_credit"
        | "refund_credit"
        | "compensation_credit"
      currency: "MAD"
      event_status: "draft" | "published" | "canceled" | "completed"
      listing_status: "active" | "sold" | "canceled" | "expired"
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
      user_role: "user" | "controller" | "admin"
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
        Args: {
          expected_operations: string[]
        }
        Returns: boolean
      }
      allow_only_operation: {
        Args: {
          expected_operation: string
        }
        Returns: boolean
      }
      can_insert_object: {
        Args: {
          bucketid: string
          name: string
          owner: string
          metadata: Json
        }
        Returns: undefined
      }
      extension: {
        Args: {
          name: string
        }
        Returns: string
      }
      filename: {
        Args: {
          name: string
        }
        Returns: string
      }
      foldername: {
        Args: {
          name: string
        }
        Returns: string[]
      }
      get_common_prefix: {
        Args: {
          p_key: string
          p_prefix: string
          p_delimiter: string
        }
        Returns: string
      }
      get_size_by_bucket: {
        Args: Record<PropertyKey, never>
        Returns: {
          size: number
          bucket_id: string
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          prefix_param: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
        }
        Returns: {
          key: string
          id: string
          created_at: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          prefix_param: string
          delimiter_param: string
          max_keys?: number
          start_after?: string
          next_token?: string
          sort_order?: string
        }
        Returns: {
          name: string
          id: string
          metadata: Json
          updated_at: string
          created_at: string
          last_accessed_at: string
        }[]
      }
      operation: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      search: {
        Args: {
          prefix: string
          bucketname: string
          limits?: number
          levels?: number
          offsets?: number
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          name: string
          id: string
          updated_at: string
          created_at: string
          last_accessed_at: string
          metadata: Json
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_prefix: string
          p_bucket_id: string
          p_limit: number
          p_level: number
          p_start_after: string
          p_sort_order: string
          p_sort_column: string
          p_sort_column_after: string
        }
        Returns: {
          key: string
          name: string
          id: string
          updated_at: string
          created_at: string
          last_accessed_at: string
          metadata: Json
        }[]
      }
      search_v2: {
        Args: {
          prefix: string
          bucket_name: string
          limits?: number
          levels?: number
          start_after?: string
          sort_order?: string
          sort_column?: string
          sort_column_after?: string
        }
        Returns: {
          key: string
          name: string
          id: string
          updated_at: string
          created_at: string
          last_accessed_at: string
          metadata: Json
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

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

// ---- Convenience row aliases for app code ----
// Generated types above are the source of truth. These aliases keep
// imports stable across the codebase and survive regeneration.

export type EventRow = Tables<"events">
export type Profile = Tables<"profiles">
export type Ticket = Tables<"tickets">
export type TicketCategory = Tables<"ticket_categories">
export type TicketRedemption = Tables<"ticket_redemptions">
export type Purchase = Tables<"purchases">
export type ResaleListing = Tables<"resale_listings">
export type Wallet = Tables<"wallets">
export type AccountBalance = Tables<"account_balances">
export type BalanceLedgerEntry = Tables<"balance_ledger_entries">
export type GateSession = Tables<"gate_sessions">
export type AuditLog = Tables<"audit_logs">
export type EventController = Tables<"event_controllers">

export type Currency = Enums<"currency">
export type UserRole = Enums<"user_role">
