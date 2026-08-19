export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
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
      audit_log: {
        Row: {
          action: string
          actor_profile_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
          school_id: string | null
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json
          school_id?: string | null
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_account_students: {
        Row: {
          billing_account_id: string
          created_at: string
          school_id: string
          student_id: string
        }
        Insert: {
          billing_account_id: string
          created_at?: string
          school_id: string
          student_id: string
        }
        Update: {
          billing_account_id?: string
          created_at?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_account_students_school_id_billing_account_id_fkey"
            columns: ["school_id", "billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_accounts"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "billing_account_students_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["school_id", "person_id"]
          },
        ]
      }
      billing_accounts: {
        Row: {
          billing_contact_person_id: string
          created_at: string
          id: string
          name: string
          school_id: string
          status: string
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          billing_contact_person_id: string
          created_at?: string
          id?: string
          name: string
          school_id: string
          status?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_contact_person_id?: string
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          status?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_accounts_school_id_billing_contact_person_id_fkey"
            columns: ["school_id", "billing_contact_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "billing_accounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_approval_events: {
        Row: {
          approval_request_id: string
          channel: string
          created_at: string
          event_type: string
          evidence: Json
          id: string
          school_id: string
        }
        Insert: {
          approval_request_id: string
          channel?: string
          created_at?: string
          event_type: string
          evidence?: Json
          id?: string
          school_id: string
        }
        Update: {
          approval_request_id?: string
          channel?: string
          created_at?: string
          event_type?: string
          evidence?: Json
          id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_approval_events_school_id_approval_request_id_fkey"
            columns: ["school_id", "approval_request_id"]
            isOneToOne: false
            referencedRelation: "billing_approval_requests"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "billing_approval_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_approval_requests: {
        Row: {
          amount_cents: number
          approval_status: string
          approved_at: string | null
          billing_account_id: string
          billing_period_id: string | null
          cancelled_at: string | null
          collection_action: string
          created_at: string
          created_by: string | null
          currency: string
          expires_at: string
          id: string
          line_items: Json
          payment_status: string
          period_label: string
          rejected_at: string | null
          rejection_note: string | null
          rejection_reason_code: string | null
          request_version: number
          school_id: string
          stripe_payment_intent_id: string | null
          token_hash: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          approval_status?: string
          approved_at?: string | null
          billing_account_id: string
          billing_period_id?: string | null
          cancelled_at?: string | null
          collection_action?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          expires_at: string
          id?: string
          line_items: Json
          payment_status?: string
          period_label: string
          rejected_at?: string | null
          rejection_note?: string | null
          rejection_reason_code?: string | null
          request_version?: number
          school_id: string
          stripe_payment_intent_id?: string | null
          token_hash: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          approval_status?: string
          approved_at?: string | null
          billing_account_id?: string
          billing_period_id?: string | null
          cancelled_at?: string | null
          collection_action?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          expires_at?: string
          id?: string
          line_items?: Json
          payment_status?: string
          period_label?: string
          rejected_at?: string | null
          rejection_note?: string | null
          rejection_reason_code?: string | null
          request_version?: number
          school_id?: string
          stripe_payment_intent_id?: string | null
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_approval_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_approval_requests_period_fkey"
            columns: ["school_id", "billing_account_id", "billing_period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["school_id", "billing_account_id", "id"]
          },
          {
            foreignKeyName: "billing_approval_requests_school_id_billing_account_id_fkey"
            columns: ["school_id", "billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_accounts"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "billing_approval_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_collection_mandate_events: {
        Row: {
          channel: string
          event_type: string
          evidence: Json
          id: number
          mandate_id: string
          occurred_at: string
          school_id: string
        }
        Insert: {
          channel: string
          event_type: string
          evidence?: Json
          id?: never
          mandate_id: string
          occurred_at?: string
          school_id: string
        }
        Update: {
          channel?: string
          event_type?: string
          evidence?: Json
          id?: never
          mandate_id?: string
          occurred_at?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_collection_mandate_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_collection_mandate_events_school_id_mandate_id_fkey"
            columns: ["school_id", "mandate_id"]
            isOneToOne: false
            referencedRelation: "billing_collection_mandates"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      billing_collection_mandates: {
        Row: {
          accepted_at: string
          advance_notice_days: number
          billing_account_id: string
          channel: string
          created_at: string
          evidence: Json
          id: string
          mandate_type: string
          monthly_cap_cents: number | null
          payment_method_id: string
          revoked_at: string | null
          school_id: string
          scope: string
          source_approval_request_id: string
          status: string
          superseded_at: string | null
          terms_sha256: string
          terms_text: string
          terms_version: string
          updated_at: string
        }
        Insert: {
          accepted_at: string
          advance_notice_days: number
          billing_account_id: string
          channel: string
          created_at?: string
          evidence?: Json
          id?: string
          mandate_type?: string
          monthly_cap_cents?: number | null
          payment_method_id: string
          revoked_at?: string | null
          school_id: string
          scope?: string
          source_approval_request_id: string
          status?: string
          superseded_at?: string | null
          terms_sha256: string
          terms_text: string
          terms_version: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string
          advance_notice_days?: number
          billing_account_id?: string
          channel?: string
          created_at?: string
          evidence?: Json
          id?: string
          mandate_type?: string
          monthly_cap_cents?: number | null
          payment_method_id?: string
          revoked_at?: string | null
          school_id?: string
          scope?: string
          source_approval_request_id?: string
          status?: string
          superseded_at?: string | null
          terms_sha256?: string
          terms_text?: string
          terms_version?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_collection_mandates_school_id_billing_account_id_fkey"
            columns: ["school_id", "billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_accounts"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "billing_collection_mandates_school_id_payment_method_id_bi_fkey"
            columns: ["school_id", "payment_method_id", "billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_payment_methods"
            referencedColumns: ["school_id", "id", "billing_account_id"]
          },
          {
            foreignKeyName: "billing_collection_mandates_school_id_source_approval_requ_fkey"
            columns: ["school_id", "source_approval_request_id"]
            isOneToOne: false
            referencedRelation: "billing_approval_requests"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      billing_line_items: {
        Row: {
          amount_cents: number | null
          billing_period_id: string
          billing_terms_id: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          lesson_event_price_snapshot_id: string | null
          metadata: Json
          quantity: number
          school_id: string
          service_date: string | null
          source_id: string | null
          source_type: string
          unit_amount_cents: number
          updated_at: string
        }
        Insert: {
          amount_cents?: number | null
          billing_period_id: string
          billing_terms_id?: string | null
          created_at?: string
          created_by: string
          description: string
          id?: string
          lesson_event_price_snapshot_id?: string | null
          metadata?: Json
          quantity?: number
          school_id: string
          service_date?: string | null
          source_id?: string | null
          source_type: string
          unit_amount_cents: number
          updated_at?: string
        }
        Update: {
          amount_cents?: number | null
          billing_period_id?: string
          billing_terms_id?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          lesson_event_price_snapshot_id?: string | null
          metadata?: Json
          quantity?: number
          school_id?: string
          service_date?: string | null
          source_id?: string | null
          source_type?: string
          unit_amount_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_line_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_line_items_school_id_billing_period_id_fkey"
            columns: ["school_id", "billing_period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "billing_line_items_school_id_billing_terms_id_fkey"
            columns: ["school_id", "billing_terms_id"]
            isOneToOne: false
            referencedRelation: "lesson_series_billing_terms"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "billing_line_items_school_id_lesson_event_price_snapshot_i_fkey"
            columns: ["school_id", "lesson_event_price_snapshot_id"]
            isOneToOne: false
            referencedRelation: "lesson_event_price_snapshots"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      billing_payment_methods: {
        Row: {
          billing_account_id: string
          brand: string | null
          created_at: string
          display_label: string
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean
          last_four: string | null
          method_type: string
          provider_customer_id: string
          provider_payment_method_id: string
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          billing_account_id: string
          brand?: string | null
          created_at?: string
          display_label: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last_four?: string | null
          method_type: string
          provider_customer_id: string
          provider_payment_method_id: string
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          billing_account_id?: string
          brand?: string | null
          created_at?: string
          display_label?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last_four?: string | null
          method_type?: string
          provider_customer_id?: string
          provider_payment_method_id?: string
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_payment_methods_school_id_billing_account_id_fkey"
            columns: ["school_id", "billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_accounts"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "billing_payment_methods_school_id_provider_customer_id_bil_fkey"
            columns: ["school_id", "provider_customer_id", "billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_provider_customers"
            referencedColumns: ["school_id", "id", "billing_account_id"]
          },
        ]
      }
      billing_periods: {
        Row: {
          amount_due_cents: number
          approved_at: string | null
          billing_account_id: string
          created_at: string
          created_by: string
          currency: string
          id: string
          label: string
          locked_at: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          school_id: string
          status: string
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          amount_due_cents?: number
          approved_at?: string | null
          billing_account_id: string
          created_at?: string
          created_by: string
          currency: string
          id?: string
          label: string
          locked_at?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          school_id: string
          status?: string
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          amount_due_cents?: number
          approved_at?: string | null
          billing_account_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          label?: string
          locked_at?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          school_id?: string
          status?: string
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_periods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_periods_school_id_billing_account_id_fkey"
            columns: ["school_id", "billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_accounts"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      billing_provider_customers: {
        Row: {
          billing_account_id: string
          created_at: string
          email: string | null
          id: string
          last_synced_at: string | null
          payment_connection_id: string
          provider_customer_id: string
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          billing_account_id: string
          created_at?: string
          email?: string | null
          id?: string
          last_synced_at?: string | null
          payment_connection_id: string
          provider_customer_id: string
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          billing_account_id?: string
          created_at?: string
          email?: string | null
          id?: string
          last_synced_at?: string | null
          payment_connection_id?: string
          provider_customer_id?: string
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_provider_customers_school_id_billing_account_id_fkey"
            columns: ["school_id", "billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_accounts"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "billing_provider_customers_school_id_payment_connection_id_fkey"
            columns: ["school_id", "payment_connection_id"]
            isOneToOne: false
            referencedRelation: "school_payment_connections"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      cancellation_policy_rules: {
        Row: {
          late_cancel_disposition: string
          max_self_service_reschedules: number | null
          must_keep_assigned_teacher: boolean
          no_show_disposition: string
          policy_version_id: string
          replacement_window_days: number | null
          student_cancel_cutoff_hours: number
          student_reschedule_cutoff_hours: number
          teacher_cancel_disposition: string
          timely_cancel_disposition: string
        }
        Insert: {
          late_cancel_disposition?: string
          max_self_service_reschedules?: number | null
          must_keep_assigned_teacher?: boolean
          no_show_disposition?: string
          policy_version_id: string
          replacement_window_days?: number | null
          student_cancel_cutoff_hours?: number
          student_reschedule_cutoff_hours?: number
          teacher_cancel_disposition?: string
          timely_cancel_disposition?: string
        }
        Update: {
          late_cancel_disposition?: string
          max_self_service_reschedules?: number | null
          must_keep_assigned_teacher?: boolean
          no_show_disposition?: string
          policy_version_id?: string
          replacement_window_days?: number | null
          student_cancel_cutoff_hours?: number
          student_reschedule_cutoff_hours?: number
          teacher_cancel_disposition?: string
          timely_cancel_disposition?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_policy_rules_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: true
            referencedRelation: "school_policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_deliveries: {
        Row: {
          accepted_at: string | null
          approval_request_id: string
          attempt_number: number
          billing_account_id: string
          body_sha256: string
          created_at: string
          created_by: string | null
          delivered_at: string | null
          failed_at: string | null
          from_address: string
          id: string
          idempotency_key: string
          message_kind: string
          provider: string
          provider_email_id: string | null
          provider_error_code: string | null
          provider_error_message: string | null
          recipient_email: string
          school_id: string
          sent_at: string | null
          status: string
          subject: string
          template_version: number
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          approval_request_id: string
          attempt_number?: number
          billing_account_id: string
          body_sha256: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          failed_at?: string | null
          from_address: string
          id?: string
          idempotency_key: string
          message_kind: string
          provider?: string
          provider_email_id?: string | null
          provider_error_code?: string | null
          provider_error_message?: string | null
          recipient_email: string
          school_id: string
          sent_at?: string | null
          status?: string
          subject: string
          template_version?: number
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          approval_request_id?: string
          attempt_number?: number
          billing_account_id?: string
          body_sha256?: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          failed_at?: string | null
          from_address?: string
          id?: string
          idempotency_key?: string
          message_kind?: string
          provider?: string
          provider_email_id?: string | null
          provider_error_code?: string | null
          provider_error_message?: string | null
          recipient_email?: string
          school_id?: string
          sent_at?: string | null
          status?: string
          subject?: string
          template_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_deliveries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_deliveries_school_id_approval_request_id_fkey"
            columns: ["school_id", "approval_request_id"]
            isOneToOne: false
            referencedRelation: "billing_approval_requests"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "email_deliveries_school_id_billing_account_id_fkey"
            columns: ["school_id", "billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_accounts"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      email_delivery_events: {
        Row: {
          delivery_id: string | null
          event_type: string
          id: number
          occurred_at: string
          provider: string
          provider_email_id: string
          provider_event_id: string
          received_at: string
          recipient_email: string | null
        }
        Insert: {
          delivery_id?: string | null
          event_type: string
          id?: never
          occurred_at: string
          provider?: string
          provider_email_id: string
          provider_event_id: string
          received_at?: string
          recipient_email?: string | null
        }
        Update: {
          delivery_id?: string | null
          event_type?: string
          id?: never
          occurred_at?: string
          provider?: string
          provider_email_id?: string
          provider_event_id?: string
          received_at?: string
          recipient_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_delivery_events_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "email_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      email_suppressions: {
        Row: {
          created_at: string
          provider: string
          provider_event_id: string
          reason: string
          recipient_email: string
          suppressed_at: string
        }
        Insert: {
          created_at?: string
          provider?: string
          provider_event_id: string
          reason: string
          recipient_email: string
          suppressed_at: string
        }
        Update: {
          created_at?: string
          provider?: string
          provider_event_id?: string
          reason?: string
          recipient_email?: string
          suppressed_at?: string
        }
        Relationships: []
      }
      lesson_event_changes: {
        Row: {
          actor_profile_id: string | null
          actor_role: string
          change_type: string
          counted_toward_self_service_limit: boolean
          created_at: string
          id: string
          lesson_event_id: string
          new_values: Json
          policy_result: string
          policy_version_id: string | null
          previous_values: Json
          reason: string
          reason_code: string | null
          school_id: string
          source: string
        }
        Insert: {
          actor_profile_id?: string | null
          actor_role: string
          change_type: string
          counted_toward_self_service_limit?: boolean
          created_at?: string
          id?: string
          lesson_event_id: string
          new_values: Json
          policy_result: string
          policy_version_id?: string | null
          previous_values: Json
          reason: string
          reason_code?: string | null
          school_id: string
          source: string
        }
        Update: {
          actor_profile_id?: string | null
          actor_role?: string
          change_type?: string
          counted_toward_self_service_limit?: boolean
          created_at?: string
          id?: string
          lesson_event_id?: string
          new_values?: Json
          policy_result?: string
          policy_version_id?: string | null
          previous_values?: Json
          reason?: string
          reason_code?: string | null
          school_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_event_changes_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_event_changes_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "school_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_event_changes_school_id_lesson_event_id_fkey"
            columns: ["school_id", "lesson_event_id"]
            isOneToOne: false
            referencedRelation: "lesson_events"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      lesson_event_price_snapshots: {
        Row: {
          amount_cents: number
          billing_mode: string
          billing_service_date: string
          billing_timing: string
          captured_at: string
          currency: string
          id: string
          lesson_event_id: string
          offering_name: string
          school_id: string
          series_billing_terms_id: string | null
          source_product_id: string
        }
        Insert: {
          amount_cents: number
          billing_mode: string
          billing_service_date: string
          billing_timing?: string
          captured_at?: string
          currency: string
          id?: string
          lesson_event_id: string
          offering_name: string
          school_id: string
          series_billing_terms_id?: string | null
          source_product_id: string
        }
        Update: {
          amount_cents?: number
          billing_mode?: string
          billing_service_date?: string
          billing_timing?: string
          captured_at?: string
          currency?: string
          id?: string
          lesson_event_id?: string
          offering_name?: string
          school_id?: string
          series_billing_terms_id?: string | null
          source_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_event_price_snapshots_school_id_lesson_event_id_fkey"
            columns: ["school_id", "lesson_event_id"]
            isOneToOne: false
            referencedRelation: "lesson_events"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "lesson_event_price_snapshots_school_id_series_billing_term_fkey"
            columns: ["school_id", "series_billing_terms_id"]
            isOneToOne: false
            referencedRelation: "lesson_series_billing_terms"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "lesson_event_price_snapshots_school_id_source_product_id_fkey"
            columns: ["school_id", "source_product_id"]
            isOneToOne: false
            referencedRelation: "service_products"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      lesson_events: {
        Row: {
          actual_ends_at: string | null
          actual_place_id: string | null
          actual_starts_at: string | null
          cancellation_timing: string | null
          created_at: string
          created_by: string
          ends_at: string
          exception_reason: string | null
          id: string
          is_series_exception: boolean
          lesson_series_id: string | null
          notes: string | null
          outcome: string | null
          place_id: string
          product_id: string
          reschedule_allowed: boolean
          reschedule_blocked_reason: string | null
          reschedule_reason_code: string | null
          reschedule_reason_detail: string | null
          rescheduled_to_event_id: string | null
          school_id: string
          staff_notes: string | null
          starts_at: string
          status: string
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          actual_ends_at?: string | null
          actual_place_id?: string | null
          actual_starts_at?: string | null
          cancellation_timing?: string | null
          created_at?: string
          created_by: string
          ends_at: string
          exception_reason?: string | null
          id?: string
          is_series_exception?: boolean
          lesson_series_id?: string | null
          notes?: string | null
          outcome?: string | null
          place_id: string
          product_id: string
          reschedule_allowed?: boolean
          reschedule_blocked_reason?: string | null
          reschedule_reason_code?: string | null
          reschedule_reason_detail?: string | null
          rescheduled_to_event_id?: string | null
          school_id: string
          staff_notes?: string | null
          starts_at: string
          status?: string
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          actual_ends_at?: string | null
          actual_place_id?: string | null
          actual_starts_at?: string | null
          cancellation_timing?: string | null
          created_at?: string
          created_by?: string
          ends_at?: string
          exception_reason?: string | null
          id?: string
          is_series_exception?: boolean
          lesson_series_id?: string | null
          notes?: string | null
          outcome?: string | null
          place_id?: string
          product_id?: string
          reschedule_allowed?: boolean
          reschedule_blocked_reason?: string | null
          reschedule_reason_code?: string | null
          reschedule_reason_detail?: string | null
          rescheduled_to_event_id?: string | null
          school_id?: string
          staff_notes?: string | null
          starts_at?: string
          status?: string
          student_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_events_rescheduled_to_event_id_fkey"
            columns: ["rescheduled_to_event_id"]
            isOneToOne: false
            referencedRelation: "lesson_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_events_school_id_actual_place_id_fkey"
            columns: ["school_id", "actual_place_id"]
            isOneToOne: false
            referencedRelation: "lesson_places"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "lesson_events_school_id_lesson_series_id_fkey"
            columns: ["school_id", "lesson_series_id"]
            isOneToOne: false
            referencedRelation: "lesson_series"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "lesson_events_school_id_product_id_fkey"
            columns: ["school_id", "product_id"]
            isOneToOne: false
            referencedRelation: "service_products"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "lesson_events_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["school_id", "person_id"]
          },
          {
            foreignKeyName: "lesson_events_school_id_teacher_id_fkey"
            columns: ["school_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["school_id", "person_id"]
          },
          {
            foreignKeyName: "lesson_events_school_place_fkey"
            columns: ["school_id", "place_id"]
            isOneToOne: false
            referencedRelation: "lesson_places"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      lesson_places: {
        Row: {
          created_at: string
          created_by: string
          details: string | null
          id: string
          name: string
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          details?: string | null
          id?: string
          name: string
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          details?: string | null
          id?: string
          name?: string
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_places_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_places_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_series: {
        Row: {
          created_at: string
          created_by: string
          default_place_id: string
          ends_on: string | null
          id: string
          product_id: string
          recurrence_rule: Json
          school_id: string
          starts_on: string
          status: string
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          default_place_id: string
          ends_on?: string | null
          id?: string
          product_id: string
          recurrence_rule: Json
          school_id: string
          starts_on: string
          status?: string
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          default_place_id?: string
          ends_on?: string | null
          id?: string
          product_id?: string
          recurrence_rule?: Json
          school_id?: string
          starts_on?: string
          status?: string
          student_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_series_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_series_school_id_default_place_id_fkey"
            columns: ["school_id", "default_place_id"]
            isOneToOne: false
            referencedRelation: "lesson_places"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "lesson_series_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_series_school_id_product_id_fkey"
            columns: ["school_id", "product_id"]
            isOneToOne: false
            referencedRelation: "service_products"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "lesson_series_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["school_id", "person_id"]
          },
          {
            foreignKeyName: "lesson_series_school_id_teacher_id_fkey"
            columns: ["school_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["school_id", "person_id"]
          },
        ]
      }
      lesson_series_billing_terms: {
        Row: {
          amount_cents: number
          billing_mode: string
          billing_timing: string
          created_at: string
          created_by: string
          currency: string
          effective_from: string
          effective_until: string | null
          id: string
          lesson_series_id: string
          offering_name: string
          school_id: string
          source_product_id: string
        }
        Insert: {
          amount_cents: number
          billing_mode: string
          billing_timing?: string
          created_at?: string
          created_by: string
          currency: string
          effective_from: string
          effective_until?: string | null
          id?: string
          lesson_series_id: string
          offering_name: string
          school_id: string
          source_product_id: string
        }
        Update: {
          amount_cents?: number
          billing_mode?: string
          billing_timing?: string
          created_at?: string
          created_by?: string
          currency?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          lesson_series_id?: string
          offering_name?: string
          school_id?: string
          source_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_series_billing_terms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_series_billing_terms_school_id_lesson_series_id_fkey"
            columns: ["school_id", "lesson_series_id"]
            isOneToOne: false
            referencedRelation: "lesson_series"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "lesson_series_billing_terms_school_id_source_product_id_fkey"
            columns: ["school_id", "source_product_id"]
            isOneToOne: false
            referencedRelation: "service_products"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      owner_notification_email_outbox: {
        Row: {
          accepted_at: string | null
          approval_request_id: string
          created_at: string
          delivered_at: string | null
          failed_at: string | null
          id: string
          idempotency_key: string
          message_text: string
          notification_id: string
          provider_email_id: string | null
          provider_error_code: string | null
          provider_error_message: string | null
          retry_count: number
          retry_not_before: string | null
          recipient_email: string
          school_id: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          approval_request_id: string
          created_at?: string
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key: string
          message_text: string
          notification_id: string
          provider_email_id?: string | null
          provider_error_code?: string | null
          provider_error_message?: string | null
          retry_count?: number
          retry_not_before?: string | null
          recipient_email: string
          school_id: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          approval_request_id?: string
          created_at?: string
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string
          message_text?: string
          notification_id?: string
          provider_email_id?: string | null
          provider_error_code?: string | null
          provider_error_message?: string | null
          retry_count?: number
          retry_not_before?: string | null
          recipient_email?: string
          school_id?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_notification_email_outb_school_id_approval_request_i_fkey"
            columns: ["school_id", "approval_request_id"]
            isOneToOne: false
            referencedRelation: "billing_approval_requests"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "owner_notification_email_outbox_school_id_notification_id_fkey"
            columns: ["school_id", "notification_id"]
            isOneToOne: false
            referencedRelation: "owner_notifications"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      owner_notifications: {
        Row: {
          created_at: string
          dedupe_key: string
          entity_id: string
          entity_type: string
          href: string
          id: string
          kind: string
          message: string
          metadata: Json
          read_at: string | null
          recipient_profile_id: string
          resolved_at: string | null
          school_id: string
          title: string
        }
        Insert: {
          created_at?: string
          dedupe_key: string
          entity_id: string
          entity_type: string
          href: string
          id?: string
          kind: string
          message: string
          metadata?: Json
          read_at?: string | null
          recipient_profile_id: string
          resolved_at?: string | null
          school_id: string
          title: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          entity_id?: string
          entity_type?: string
          href?: string
          id?: string
          kind?: string
          message?: string
          metadata?: Json
          read_at?: string | null
          recipient_profile_id?: string
          resolved_at?: string | null
          school_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_notifications_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_support_incidents: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          diagnostics: Json
          failure_category: string
          id: string
          kind: string
          reported_by: string
          resolved_at: string | null
          school_id: string
          source_id: string
          source_type: string
          status: string
          summary: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          diagnostics?: Json
          failure_category: string
          id?: string
          kind: string
          reported_by: string
          resolved_at?: string | null
          school_id: string
          source_id: string
          source_type: string
          status?: string
          summary: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          diagnostics?: Json
          failure_category?: string
          id?: string
          kind?: string
          reported_by?: string
          resolved_at?: string | null
          school_id?: string
          source_id?: string
          source_type?: string
          status?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_support_incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_support_incidents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          amount_cents: number
          approval_request_id: string | null
          billing_account_id: string
          billing_period_id: string
          created_at: string
          created_by: string
          currency: string
          failed_at: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          payment_connection_id: string
          payment_method_id: string | null
          provider_charge_id: string | null
          provider_customer_id: string
          provider_payment_intent_id: string | null
          receipt_url: string | null
          school_id: string
          status: string
          submitted_at: string | null
          succeeded_at: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          approval_request_id?: string | null
          billing_account_id: string
          billing_period_id: string
          created_at?: string
          created_by: string
          currency: string
          failed_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key: string
          payment_connection_id: string
          payment_method_id?: string | null
          provider_charge_id?: string | null
          provider_customer_id: string
          provider_payment_intent_id?: string | null
          receipt_url?: string | null
          school_id: string
          status?: string
          submitted_at?: string | null
          succeeded_at?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          approval_request_id?: string | null
          billing_account_id?: string
          billing_period_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          failed_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string
          payment_connection_id?: string
          payment_method_id?: string | null
          provider_charge_id?: string | null
          provider_customer_id?: string
          provider_payment_intent_id?: string | null
          receipt_url?: string | null
          school_id?: string
          status?: string
          submitted_at?: string | null
          succeeded_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_school_id_approval_request_id_fkey"
            columns: ["school_id", "approval_request_id"]
            isOneToOne: false
            referencedRelation: "billing_approval_requests"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "payment_attempts_school_id_billing_account_id_billing_peri_fkey"
            columns: ["school_id", "billing_account_id", "billing_period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["school_id", "billing_account_id", "id"]
          },
          {
            foreignKeyName: "payment_attempts_school_id_payment_connection_id_fkey"
            columns: ["school_id", "payment_connection_id"]
            isOneToOne: false
            referencedRelation: "school_payment_connections"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "payment_attempts_school_id_payment_method_id_billing_accou_fkey"
            columns: ["school_id", "payment_method_id", "billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_payment_methods"
            referencedColumns: ["school_id", "id", "billing_account_id"]
          },
          {
            foreignKeyName: "payment_attempts_school_id_provider_customer_id_billing_ac_fkey"
            columns: ["school_id", "provider_customer_id", "billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_provider_customers"
            referencedColumns: ["school_id", "id", "billing_account_id"]
          },
          {
            foreignKeyName: "payment_attempts_school_id_provider_customer_id_payment_co_fkey"
            columns: [
              "school_id",
              "provider_customer_id",
              "payment_connection_id",
            ]
            isOneToOne: false
            referencedRelation: "billing_provider_customers"
            referencedColumns: ["school_id", "id", "payment_connection_id"]
          },
        ]
      }
      payment_disputes: {
        Row: {
          amount_cents: number
          closed_at: string | null
          created_at: string
          currency: string
          evidence_due_at: string | null
          id: string
          payment_attempt_id: string
          provider_dispute_id: string
          reason: string | null
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          closed_at?: string | null
          created_at?: string
          currency: string
          evidence_due_at?: string | null
          id?: string
          payment_attempt_id: string
          provider_dispute_id: string
          reason?: string | null
          school_id: string
          status: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          closed_at?: string | null
          created_at?: string
          currency?: string
          evidence_due_at?: string | null
          id?: string
          payment_attempt_id?: string
          provider_dispute_id?: string
          reason?: string | null
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_disputes_school_id_payment_attempt_id_fkey"
            columns: ["school_id", "payment_attempt_id"]
            isOneToOne: false
            referencedRelation: "payment_attempts"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      payment_method_consents: {
        Row: {
          accepted_at: string
          billing_account_id: string
          channel: string
          created_at: string
          evidence: Json
          id: string
          payment_method_id: string
          provider_setup_intent_id: string | null
          revoked_at: string | null
          school_id: string
          terms_sha256: string
          terms_version: string
          usage_scope: string
        }
        Insert: {
          accepted_at: string
          billing_account_id: string
          channel: string
          created_at?: string
          evidence?: Json
          id?: string
          payment_method_id: string
          provider_setup_intent_id?: string | null
          revoked_at?: string | null
          school_id: string
          terms_sha256: string
          terms_version: string
          usage_scope: string
        }
        Update: {
          accepted_at?: string
          billing_account_id?: string
          channel?: string
          created_at?: string
          evidence?: Json
          id?: string
          payment_method_id?: string
          provider_setup_intent_id?: string | null
          revoked_at?: string | null
          school_id?: string
          terms_sha256?: string
          terms_version?: string
          usage_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_method_consents_school_id_billing_account_id_fkey"
            columns: ["school_id", "billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_accounts"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "payment_method_consents_school_id_payment_method_id_billin_fkey"
            columns: ["school_id", "payment_method_id", "billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_payment_methods"
            referencedColumns: ["school_id", "id", "billing_account_id"]
          },
        ]
      }
      payment_method_setup_requests: {
        Row: {
          billing_account_id: string
          completed_at: string | null
          created_at: string
          expires_at: string
          id: string
          initiated_by: string
          provider_checkout_session_id: string | null
          provider_customer_id: string
          school_id: string
          status: string
          terms_sha256: string
          terms_text: string
          terms_version: string
          updated_at: string
        }
        Insert: {
          billing_account_id: string
          completed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          initiated_by: string
          provider_checkout_session_id?: string | null
          provider_customer_id: string
          school_id: string
          status?: string
          terms_sha256: string
          terms_text: string
          terms_version: string
          updated_at?: string
        }
        Update: {
          billing_account_id?: string
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          initiated_by?: string
          provider_checkout_session_id?: string | null
          provider_customer_id?: string
          school_id?: string
          status?: string
          terms_sha256?: string
          terms_text?: string
          terms_version?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_method_setup_requests_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_method_setup_requests_school_id_billing_account_id_fkey"
            columns: ["school_id", "billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_accounts"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "payment_method_setup_requests_school_id_provider_customer__fkey"
            columns: ["school_id", "provider_customer_id", "billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_provider_customers"
            referencedColumns: ["school_id", "id", "billing_account_id"]
          },
        ]
      }
      payment_policy_rules: {
        Row: {
          approval_requirement: string
          collection_method: string
          due_day_of_month: number | null
          failed_payment_retry_count: number
          grace_period_days: number
          late_fee_cents: number
          policy_version_id: string
        }
        Insert: {
          approval_requirement?: string
          collection_method?: string
          due_day_of_month?: number | null
          failed_payment_retry_count?: number
          grace_period_days?: number
          late_fee_cents?: number
          policy_version_id: string
        }
        Update: {
          approval_requirement?: string
          collection_method?: string
          due_day_of_month?: number | null
          failed_payment_retry_count?: number
          grace_period_days?: number
          late_fee_cents?: number
          policy_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_policy_rules_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: true
            referencedRelation: "school_policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_provider_events: {
        Row: {
          api_version: string | null
          event_type: string
          id: string
          last_error: string | null
          livemode: boolean
          payload: Json
          processed_at: string | null
          processing_attempts: number
          processing_started_at: string | null
          processing_status: string
          provider: string
          provider_account_id: string | null
          provider_created_at: string | null
          provider_event_id: string
          provider_object_id: string | null
          received_at: string
        }
        Insert: {
          api_version?: string | null
          event_type: string
          id?: string
          last_error?: string | null
          livemode: boolean
          payload: Json
          processed_at?: string | null
          processing_attempts?: number
          processing_started_at?: string | null
          processing_status?: string
          provider: string
          provider_account_id?: string | null
          provider_created_at?: string | null
          provider_event_id: string
          provider_object_id?: string | null
          received_at?: string
        }
        Update: {
          api_version?: string | null
          event_type?: string
          id?: string
          last_error?: string | null
          livemode?: boolean
          payload?: Json
          processed_at?: string | null
          processing_attempts?: number
          processing_started_at?: string | null
          processing_status?: string
          provider?: string
          provider_account_id?: string | null
          provider_created_at?: string | null
          provider_event_id?: string
          provider_object_id?: string | null
          received_at?: string
        }
        Relationships: []
      }
      payment_refunds: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          currency: string
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          payment_attempt_id: string
          provider_refund_id: string | null
          reason: string | null
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string | null
          currency: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key: string
          payment_attempt_id: string
          provider_refund_id?: string | null
          reason?: string | null
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string
          payment_attempt_id?: string
          provider_refund_id?: string | null
          reason?: string | null
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_refunds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refunds_school_id_payment_attempt_id_fkey"
            columns: ["school_id", "payment_attempt_id"]
            isOneToOne: false
            referencedRelation: "payment_attempts"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      payment_state_history: {
        Row: {
          actor_profile_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          from_status: string | null
          id: number
          metadata: Json
          provider_event_id: string | null
          school_id: string
          source: string
          to_status: string
        }
        Insert: {
          actor_profile_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          from_status?: string | null
          id?: never
          metadata?: Json
          provider_event_id?: string | null
          school_id: string
          source: string
          to_status: string
        }
        Update: {
          actor_profile_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          from_status?: string | null
          id?: never
          metadata?: Json
          provider_event_id?: string | null
          school_id?: string
          source?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_state_history_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_state_history_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          avatar_path: string | null
          created_at: string
          email: string | null
          external_ref: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          preferred_name: string | null
          profile_id: string | null
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          email?: string | null
          external_ref?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          preferred_name?: string | null
          profile_id?: string | null
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          email?: string | null
          external_ref?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          preferred_name?: string | null
          profile_id?: string | null
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      school_documents: {
        Row: {
          created_at: string
          id: string
          mime_type: string
          name: string
          school_id: string
          size_bytes: number
          status: string
          storage_path: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type: string
          name: string
          school_id: string
          size_bytes: number
          status?: string
          storage_path: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string
          name?: string
          school_id?: string
          size_bytes?: number
          status?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      school_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string | null
          profile_id: string
          role: string
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          profile_id: string
          role: string
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          profile_id?: string
          role?: string
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_payment_connections: {
        Row: {
          charges_enabled: boolean
          created_at: string
          currently_due: Json
          details_submitted: boolean
          disabled_reason: string | null
          eventually_due: Json
          id: string
          last_synced_at: string | null
          livemode: boolean
          past_due: Json
          payouts_enabled: boolean
          pending_verification: Json
          provider: string
          provider_account_id: string | null
          requirement_errors: Json
          requirements_deadline: string | null
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          charges_enabled?: boolean
          created_at?: string
          currently_due?: Json
          details_submitted?: boolean
          disabled_reason?: string | null
          eventually_due?: Json
          id?: string
          last_synced_at?: string | null
          livemode?: boolean
          past_due?: Json
          payouts_enabled?: boolean
          pending_verification?: Json
          provider?: string
          provider_account_id?: string | null
          requirement_errors?: Json
          requirements_deadline?: string | null
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          charges_enabled?: boolean
          created_at?: string
          currently_due?: Json
          details_submitted?: boolean
          disabled_reason?: string | null
          eventually_due?: Json
          id?: string
          last_synced_at?: string | null
          livemode?: boolean
          past_due?: Json
          payouts_enabled?: boolean
          pending_verification?: Json
          provider?: string
          provider_account_id?: string | null
          requirement_errors?: Json
          requirements_deadline?: string | null
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_payment_connections_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_policies: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_default: boolean
          kind: string
          name: string
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_default?: boolean
          kind: string
          name: string
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_default?: boolean
          kind?: string
          name?: string
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_policies_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_policy_versions: {
        Row: {
          created_at: string
          created_by: string
          editor_content: Json
          effective_from: string | null
          id: string
          plain_text: string
          policy_id: string
          published_at: string | null
          school_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by: string
          editor_content?: Json
          effective_from?: string | null
          id?: string
          plain_text?: string
          policy_id: string
          published_at?: string | null
          school_id: string
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string
          editor_content?: Json
          effective_from?: string | null
          id?: string
          plain_text?: string
          policy_id?: string
          published_at?: string | null
          school_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "school_policy_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_policy_versions_school_id_policy_id_fkey"
            columns: ["school_id", "policy_id"]
            isOneToOne: false
            referencedRelation: "school_policies"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      schools: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          billing_day: number
          billing_timing_default: string
          city: string | null
          created_at: string
          created_by: string
          currency: string
          family_billing_mode: string
          id: string
          intended_charge_day: number
          logo_path: string | null
          name: string
          payer_review_days: number
          phone: string | null
          postal_code: string | null
          primary_color: string | null
          region: string | null
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          billing_day?: number
          billing_timing_default?: string
          city?: string | null
          created_at?: string
          created_by: string
          currency?: string
          family_billing_mode?: string
          id?: string
          intended_charge_day?: number
          logo_path?: string | null
          name: string
          payer_review_days?: number
          phone?: string | null
          postal_code?: string | null
          primary_color?: string | null
          region?: string | null
          slug: string
          timezone: string
          updated_at?: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          billing_day?: number
          billing_timing_default?: string
          city?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          family_billing_mode?: string
          id?: string
          intended_charge_day?: number
          logo_path?: string | null
          name?: string
          payer_review_days?: number
          phone?: string | null
          postal_code?: string | null
          primary_color?: string | null
          region?: string | null
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schools_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_product_policy_selections: {
        Row: {
          created_at: string
          policy_id: string | null
          policy_kind: string
          product_id: string
          school_id: string
          updated_at: string
          use_school_default: boolean
        }
        Insert: {
          created_at?: string
          policy_id?: string | null
          policy_kind: string
          product_id: string
          school_id: string
          updated_at?: string
          use_school_default?: boolean
        }
        Update: {
          created_at?: string
          policy_id?: string | null
          policy_kind?: string
          product_id?: string
          school_id?: string
          updated_at?: string
          use_school_default?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "service_product_policy_select_school_id_policy_id_policy_k_fkey"
            columns: ["school_id", "policy_id", "policy_kind"]
            isOneToOne: false
            referencedRelation: "school_policies"
            referencedColumns: ["school_id", "id", "kind"]
          },
          {
            foreignKeyName: "service_product_policy_selections_school_id_product_id_fkey"
            columns: ["school_id", "product_id"]
            isOneToOne: false
            referencedRelation: "service_products"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      service_products: {
        Row: {
          billing_timing_override: string | null
          capacity: number
          created_at: string
          created_by: string
          currency: string
          description: string | null
          duration_minutes: number
          format: string
          id: string
          interval_count: number
          interval_unit: string
          name: string
          price_cents: number
          pricing_model: string
          school_id: string
          sessions_per_interval: number
          status: string
          updated_at: string
        }
        Insert: {
          billing_timing_override?: string | null
          capacity?: number
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          duration_minutes: number
          format: string
          id?: string
          interval_count?: number
          interval_unit?: string
          name: string
          price_cents: number
          pricing_model?: string
          school_id: string
          sessions_per_interval?: number
          status?: string
          updated_at?: string
        }
        Update: {
          billing_timing_override?: string | null
          capacity?: number
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          duration_minutes?: number
          format?: string
          id?: string
          interval_count?: number
          interval_unit?: string
          name?: string
          price_cents?: number
          pricing_model?: string
          school_id?: string
          sessions_per_interval?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_products_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_deliveries: {
        Row: {
          accepted_at: string | null
          approval_request_id: string
          attempt_number: number
          billing_account_id: string
          body_sha256: string
          created_at: string
          created_by: string | null
          delivered_at: string | null
          failed_at: string | null
          id: string
          message_kind: string
          messaging_service_sid: string | null
          provider: string
          provider_error_code: string | null
          provider_error_message: string | null
          provider_message_sid: string | null
          recipient_phone_e164: string
          school_id: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          approval_request_id: string
          attempt_number?: number
          billing_account_id: string
          body_sha256: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          message_kind: string
          messaging_service_sid?: string | null
          provider?: string
          provider_error_code?: string | null
          provider_error_message?: string | null
          provider_message_sid?: string | null
          recipient_phone_e164: string
          school_id: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          approval_request_id?: string
          attempt_number?: number
          billing_account_id?: string
          body_sha256?: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          message_kind?: string
          messaging_service_sid?: string | null
          provider?: string
          provider_error_code?: string | null
          provider_error_message?: string | null
          provider_message_sid?: string | null
          recipient_phone_e164?: string
          school_id?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_deliveries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_deliveries_school_id_approval_request_id_fkey"
            columns: ["school_id", "approval_request_id"]
            isOneToOne: false
            referencedRelation: "billing_approval_requests"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "sms_deliveries_school_id_billing_account_id_fkey"
            columns: ["school_id", "billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_accounts"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      sms_delivery_status_events: {
        Row: {
          delivery_id: string | null
          event_fingerprint: string
          id: number
          provider: string
          provider_error_code: string | null
          provider_message_sid: string
          provider_status: string
          received_at: string
        }
        Insert: {
          delivery_id?: string | null
          event_fingerprint: string
          id?: never
          provider?: string
          provider_error_code?: string | null
          provider_message_sid: string
          provider_status: string
          received_at?: string
        }
        Update: {
          delivery_id?: string | null
          event_fingerprint?: string
          id?: never
          provider?: string
          provider_error_code?: string | null
          provider_message_sid?: string
          provider_status?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_delivery_status_events_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "sms_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_opt_in_events: {
        Row: {
          consent_text: string | null
          consent_version: string | null
          event_fingerprint: string | null
          event_sequence: number
          event_type: string
          full_name: string
          id: string
          messaging_service_sid: string | null
          metadata: Json
          occurred_at: string
          phone_e164: string
          provider_message_sid: string | null
          school_name: string
          source: string
        }
        Insert: {
          consent_text?: string | null
          consent_version?: string | null
          event_fingerprint?: string | null
          event_sequence?: never
          event_type: string
          full_name: string
          id?: string
          messaging_service_sid?: string | null
          metadata?: Json
          occurred_at?: string
          phone_e164: string
          provider_message_sid?: string | null
          school_name: string
          source: string
        }
        Update: {
          consent_text?: string | null
          consent_version?: string | null
          event_fingerprint?: string | null
          event_sequence?: never
          event_type?: string
          full_name?: string
          id?: string
          messaging_service_sid?: string | null
          metadata?: Json
          occurred_at?: string
          phone_e164?: string
          provider_message_sid?: string | null
          school_name?: string
          source?: string
        }
        Relationships: []
      }
      student_contacts: {
        Row: {
          contact_person_id: string
          created_at: string
          is_billing_contact: boolean
          is_primary: boolean
          relationship: string
          school_id: string
          student_id: string
        }
        Insert: {
          contact_person_id: string
          created_at?: string
          is_billing_contact?: boolean
          is_primary?: boolean
          relationship: string
          school_id: string
          student_id: string
        }
        Update: {
          contact_person_id?: string
          created_at?: string
          is_billing_contact?: boolean
          is_primary?: boolean
          relationship?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_contacts_school_id_contact_person_id_fkey"
            columns: ["school_id", "contact_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "student_contacts_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["school_id", "person_id"]
          },
        ]
      }
      students: {
        Row: {
          birth_date: string | null
          created_at: string
          enrollment_status: string
          notes: string | null
          person_id: string
          school_id: string
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          enrollment_status?: string
          notes?: string | null
          person_id: string
          school_id: string
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          enrollment_status?: string
          notes?: string | null
          person_id?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_school_id_person_id_fkey"
            columns: ["school_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      teacher_availability_rules: {
        Row: {
          created_at: string
          created_by: string
          effective_from: string
          effective_until: string | null
          end_time: string
          id: string
          school_id: string
          start_time: string
          teacher_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          created_by: string
          effective_from?: string
          effective_until?: string | null
          end_time: string
          id?: string
          school_id: string
          start_time: string
          teacher_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          created_by?: string
          effective_from?: string
          effective_until?: string | null
          end_time?: string
          id?: string
          school_id?: string
          start_time?: string
          teacher_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "teacher_availability_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_availability_rules_school_id_teacher_id_fkey"
            columns: ["school_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["school_id", "person_id"]
          },
        ]
      }
      teachers: {
        Row: {
          bio: string | null
          created_at: string
          default_lesson_minutes: number
          person_id: string
          school_id: string
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          default_lesson_minutes?: number
          person_id: string
          school_id: string
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          default_lesson_minutes?: number
          person_id?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teachers_school_id_person_id_fkey"
            columns: ["school_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      user_view_preferences: {
        Row: {
          created_at: string
          profile_id: string
          school_id: string
          settings: Json
          updated_at: string
          view_key: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          school_id: string
          settings?: Json
          updated_at?: string
          view_key: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          school_id?: string
          settings?: Json
          updated_at?: string
          view_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_view_preferences_school_id_profile_id_fkey"
            columns: ["school_id", "profile_id"]
            isOneToOne: false
            referencedRelation: "school_members"
            referencedColumns: ["school_id", "profile_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_billing_adjustment: {
        Args: {
          p_amount_cents: number
          p_billing_period_id: string
          p_category: string
          p_description: string
          p_kind: string
          p_school_id: string
        }
        Returns: string
      }
      apply_email_delivery_status: {
        Args: {
          p_delivery_id: string
          p_event_type: string
          p_occurred_at: string
        }
        Returns: undefined
      }
      apply_sms_delivery_status: {
        Args: {
          p_delivery_id: string
          p_provider_error_code?: string
          p_provider_status: string
        }
        Returns: undefined
      }
      approve_billing_request: { Args: { raw_token: string }; Returns: string }
      begin_payment_method_revocation: {
        Args: { p_payment_method_id: string }
        Returns: {
          provider_account_id: string
          provider_payment_method_id: string
        }[]
      }
      claim_payment_provider_event: {
        Args: { p_provider_event_id: string; p_stale_after_seconds?: number }
        Returns: {
          id: string
          processing_attempts: number
        }[]
      }
      complete_email_provider_submission: {
        Args: { p_delivery_id: string; p_provider_email_id: string }
        Returns: undefined
      }
      claim_owner_notification_email_retry: {
        Args: { p_delivery_id: string }
        Returns: string
      }
      complete_payment_method_revocation: {
        Args: { p_payment_method_id: string }
        Returns: undefined
      }
      complete_payment_method_setup: {
        Args: {
          p_accepted_at: string
          p_brand: string
          p_display_label: string
          p_evidence: Json
          p_exp_month: number
          p_exp_year: number
          p_last_four: string
          p_method_type: string
          p_provider_checkout_session_id: string
          p_provider_payment_method_id: string
          p_provider_setup_intent_id: string
          p_setup_request_id: string
        }
        Returns: string
      }
      complete_sms_provider_submission: {
        Args: {
          p_delivery_id: string
          p_provider_error_code?: string
          p_provider_error_message?: string
          p_provider_message_sid: string
          p_provider_status: string
        }
        Returns: undefined
      }
      compute_lesson_event_billing_disposition: {
        Args: {
          p_as_of?: string
          p_lesson_event_id: string
          p_school_id: string
        }
        Returns: Json
      }
      create_billing_approval_email_delivery: {
        Args: {
          p_billing_period_id: string
          p_body_sha256: string
          p_expires_at: string
          p_from_address: string
          p_recipient_email: string
          p_school_id: string
          p_subject: string
          p_token_hash: string
        }
        Returns: {
          approval_request_id: string
          email_delivery_id: string
          idempotency_key: string
        }[]
      }
      create_billing_approval_sms_delivery: {
        Args: {
          p_billing_period_id: string
          p_body_sha256: string
          p_expires_at: string
          p_messaging_service_sid: string
          p_recipient_phone_e164: string
          p_school_id: string
          p_token_hash: string
        }
        Returns: {
          approval_request_id: string
          sms_delivery_id: string
        }[]
      }
      create_school: {
        Args: { school_name: string; school_timezone?: string }
        Returns: string
      }
      create_single_lesson: {
        Args: {
          p_allow_outside_availability?: boolean
          p_local_start: string
          p_notes?: string
          p_override_reason?: string
          p_place_id: string
          p_product_id: string
          p_school_id: string
          p_student_id: string
          p_teacher_id: string
        }
        Returns: string
      }
      enroll_auto_charge_mandate: {
        Args: {
          p_advance_notice_days: number
          p_evidence?: Json
          p_monthly_cap_cents: number
          raw_token: string
        }
        Returns: string
      }
      fail_email_provider_submission: {
        Args: {
          p_delivery_id: string
          p_provider_error_code?: string
          p_provider_error_message?: string
        }
        Returns: undefined
      }
      fail_sms_provider_submission: {
        Args: {
          p_delivery_id: string
          p_provider_error_code?: string
          p_provider_error_message?: string
        }
        Returns: undefined
      }
      get_auto_charge_enrollment: {
        Args: { raw_token: string }
        Returns: {
          active_mandate_id: string
          advance_notice_days: number
          billing_account_name: string
          currency: string
          current_amount_cents: number
          eligible: boolean
          monthly_cap_cents: number
          payment_method_label: string
          payment_method_last_four: string
          reason: string
          school_name: string
        }[]
      }
      get_client_portal_lessons: {
        Args: Record<PropertyKey, never>
        Returns: {
          ends_at: string
          lesson_id: string
          place_name: string
          product_name: string
          reschedule_allowed: boolean
          reschedule_blocked_reason: string | null
          school_id: string
          school_name: string
          school_timezone: string
          starts_at: string
          student_id: string
          student_name: string
          teacher_name: string
        }[]
      }
      get_client_portal_calendar_accounts: {
        Args: Record<PropertyKey, never>
        Returns: {
          billing_account_id: string
          school_id: string
          school_name: string
          school_timezone: string
          subscription_active: boolean
        }[]
      }
      rotate_client_portal_calendar_subscription: {
        Args: { p_school_id: string }
        Returns: string
      }
      revoke_client_portal_calendar_subscription: {
        Args: { p_school_id: string }
        Returns: boolean
      }
      get_payer_calendar_subscription: {
        Args: { raw_token: string }
        Returns: {
          ends_at: string | null
          event_status: string | null
          lesson_id: string | null
          place_name: string | null
          product_name: string | null
          school_id: string
          school_name: string
          school_timezone: string
          starts_at: string | null
          student_name: string | null
          teacher_name: string | null
          updated_at: string | null
        }[]
      }
      client_portal_email_access_state: {
        Args: { p_email: string }
        Returns: string
      }
      current_client_portal_access_state: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_portal_auth_user_id_by_email: {
        Args: { p_email: string }
        Returns: string | null
      }
      get_billing_approval: {
        Args: { raw_token: string }
        Returns: {
          amount_cents: number
          approval_status: string
          approved_at: string
          billing_account_name: string
          collection_action: string
          currency: string
          expires_at: string
          has_newer_request: boolean
          line_items: Json
          payment_status: string
          period_label: string
          school_name: string
        }[]
      }
      get_sms_consent_state: {
        Args: { p_phone_e164: string; p_school_name: string }
        Returns: string
      }
      has_school_role: {
        Args: { allowed_roles: string[]; target_school_id: string }
        Returns: boolean
      }
      is_school_member: { Args: { target_school_id: string }; Returns: boolean }
      lock_family_billing_period: {
        Args: { p_billing_period_id: string; p_school_id: string }
        Returns: string
      }
      prepare_family_billing_draft: {
        Args: {
          p_billing_account_id: string
          p_month: string
          p_school_id: string
        }
        Returns: string
      }
      retry_billing_approval_email_delivery: {
        Args: {
          p_approval_request_id: string
          p_body_sha256: string
          p_expires_at: string
          p_school_id: string
          p_token_hash: string
        }
        Returns: {
          email_delivery_id: string
          from_address: string
          idempotency_key: string
          recipient_email: string
          subject: string
        }[]
      }
      report_owner_notification_email_problem: {
        Args: { p_delivery_id: string }
        Returns: string
      }
      update_billing_contact_email: {
        Args: {
          p_billing_account_id: string
          p_email: string
          p_school_id: string
        }
        Returns: number
      }
      preview_lesson_event_billing_disposition: {
        Args: {
          p_as_of?: string
          p_lesson_event_id: string
          p_school_id: string
        }
        Returns: Json
      }
      queue_payer_response_notifications: {
        Args: {
          p_kind: string
          p_note?: string
          p_request: Database["public"]["Tables"]["billing_approval_requests"]["Row"]
        }
        Returns: undefined
      }
      record_public_sms_opt_in: {
        Args: {
          p_full_name: string
          p_phone_e164: string
          p_school_name: string
        }
        Returns: string
      }
      record_resend_delivery_event: {
        Args: {
          p_event_type: string
          p_occurred_at: string
          p_provider_email_id: string
          p_provider_event_id: string
          p_recipient_email?: string
        }
        Returns: string
      }
      record_twilio_delivery_status: {
        Args: {
          p_event_fingerprint: string
          p_provider_error_code: string
          p_provider_message_sid: string
          p_provider_status: string
        }
        Returns: string
      }
      record_twilio_sms_consent_event: {
        Args: {
          p_event_fingerprint: string
          p_event_type: string
          p_messaging_service_sid: string
          p_phone_e164: string
          p_provider_message_sid: string
        }
        Returns: string
      }
      reject_billing_request: {
        Args: { p_note?: string; p_reason_code: string; raw_token: string }
        Returns: string
      }
      remove_billing_adjustment: {
        Args: {
          p_adjustment_id: string
          p_billing_period_id: string
          p_school_id: string
        }
        Returns: undefined
      }
      reschedule_lesson_as_owner: {
        Args: {
          p_allow_outside_availability?: boolean
          p_lesson_event_id: string
          p_local_start: string
          p_place_id: string
          p_reason: string
          p_school_id: string
          p_source: string
          p_teacher_id: string
        }
        Returns: Json
      }
      revise_submitted_billing_period: {
        Args: { p_billing_period_id: string; p_school_id: string }
        Returns: string
      }
      revoke_auto_charge_mandate: {
        Args: { p_evidence?: Json; raw_token: string }
        Returns: string
      }
      set_lesson_reschedule_permission: {
        Args: {
          p_allowed: boolean
          p_blocked_reason?: string
          p_lesson_event_id: string
          p_school_id: string
        }
        Returns: undefined
      }
      shares_school_with: {
        Args: { target_profile_id: string }
        Returns: boolean
      }
      unlock_unsubmitted_billing_period: {
        Args: { p_billing_period_id: string; p_school_id: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
