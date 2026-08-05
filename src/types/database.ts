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
      lesson_events: {
        Row: {
          created_at: string
          created_by: string
          ends_at: string
          id: string
          notes: string | null
          place_id: string
          product_id: string
          school_id: string
          starts_at: string
          status: string
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          ends_at: string
          id?: string
          notes?: string | null
          place_id: string
          product_id: string
          school_id: string
          starts_at: string
          status?: string
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          ends_at?: string
          id?: string
          notes?: string | null
          place_id?: string
          product_id?: string
          school_id?: string
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
      schools: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          family_billing_mode: string
          id: string
          logo_path: string | null
          name: string
          primary_color: string | null
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          family_billing_mode?: string
          id?: string
          logo_path?: string | null
          name: string
          primary_color?: string | null
          slug: string
          timezone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          family_billing_mode?: string
          id?: string
          logo_path?: string | null
          name?: string
          primary_color?: string | null
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
          pricing_model: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_school: {
        Args: { school_name: string; school_timezone?: string }
        Returns: string
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
