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
          collection_action: string
          created_at: string
          created_by: string | null
          currency: string
          expires_at: string
          id: string
          line_items: Json
          payment_status: string
          period_label: string
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
          collection_action?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          expires_at: string
          id?: string
          line_items: Json
          payment_status?: string
          period_label: string
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
          collection_action?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          expires_at?: string
          id?: string
          line_items?: Json
          payment_status?: string
          period_label?: string
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
      billing_line_items: {
        Row: {
          amount_cents: number | null
          billing_period_id: string
          created_at: string
          created_by: string
          description: string
          id: string
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
          created_at?: string
          created_by: string
          description: string
          id?: string
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
          created_at?: string
          created_by?: string
          description?: string
          id?: string
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
          pending_verification: Json
          payouts_enabled: boolean
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
          pending_verification?: Json
          payouts_enabled?: boolean
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
          pending_verification?: Json
          payouts_enabled?: boolean
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
          city: string | null
          created_at: string
          created_by: string
          currency: string
          family_billing_mode: string
          id: string
          logo_path: string | null
          name: string
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
          city?: string | null
          created_at?: string
          created_by: string
          currency?: string
          family_billing_mode?: string
          id?: string
          logo_path?: string | null
          name: string
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
          city?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          family_billing_mode?: string
          id?: string
          logo_path?: string | null
          name?: string
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
      approve_billing_request: { Args: { raw_token: string }; Returns: string }
      claim_payment_provider_event: {
        Args: {
          p_provider_event_id: string
          p_stale_after_seconds?: number
        }
        Returns: {
          id: string
          processing_attempts: number
        }[]
      }
      create_single_lesson: {
        Args: {
          p_allow_outside_availability?: boolean
          p_local_start: string
          p_notes?: string | null
          p_override_reason?: string | null
          p_place_id: string
          p_product_id: string
          p_school_id: string
          p_student_id: string
          p_teacher_id: string
        }
        Returns: string
      }
      create_school: {
        Args: { school_name: string; school_timezone?: string }
        Returns: string
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
          line_items: Json
          payment_status: string
          period_label: string
          school_name: string
        }[]
      }
      has_school_role: {
        Args: { allowed_roles: string[]; target_school_id: string }
        Returns: boolean
      }
      is_school_member: { Args: { target_school_id: string }; Returns: boolean }
      shares_school_with: {
        Args: { target_profile_id: string }
        Returns: boolean
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
