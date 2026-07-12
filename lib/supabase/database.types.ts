export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          actor_user_id: string | null
          clinic_id: string | null
          created_at: string
          event_name: string
          id: string
          operator_id: string | null
          payload_json: Json
        }
        Insert: {
          actor_user_id?: string | null
          clinic_id?: string | null
          created_at?: string
          event_name: string
          id?: string
          operator_id?: string | null
          payload_json?: Json
        }
        Update: {
          actor_user_id?: string | null
          clinic_id?: string | null
          created_at?: string
          event_name?: string
          id?: string
          operator_id?: string | null
          payload_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "clinic_operators"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_invites: {
        Row: {
          accepted_at: string | null
          clinic_id: string
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invite_status"]
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          clinic_id: string
          created_at?: string
          email: string
          expires_at: string
          full_name: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invite_status"]
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          clinic_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invite_status"]
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_invites_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_locations: {
        Row: {
          address: string | null
          clinic_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_locations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_operators: {
        Row: {
          clinic_id: string
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          pin_hash: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          pin_hash: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          pin_hash?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_operators_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_operators_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_subscriptions: {
        Row: {
          clinic_id: string
          created_at: string
          current_period_end: string | null
          id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_subscriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          branding_json: Json
          created_at: string
          id: string
          name: string
          phone_country_default: string
          plan_id: string
          settings_json: Json
          status: Database["public"]["Enums"]["clinic_status"]
          timezone: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          branding_json?: Json
          created_at?: string
          id?: string
          name: string
          phone_country_default?: string
          plan_id: string
          settings_json?: Json
          status?: Database["public"]["Enums"]["clinic_status"]
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          branding_json?: Json
          created_at?: string
          id?: string
          name?: string
          phone_country_default?: string
          plan_id?: string
          settings_json?: Json
          status?: Database["public"]["Enums"]["clinic_status"]
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinics_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_entitlements: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          id: string
          is_metered: boolean
          plan_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          id?: string
          is_metered?: boolean
          plan_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          id?: string
          is_metered?: boolean
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_entitlements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          limits_json: Json
          name: string
          price_eur_monthly: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          limits_json?: Json
          name: string
          price_eur_monthly: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          limits_json?: Json
          name?: string
          price_eur_monthly?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          clinic_id: string
          created_at: string
          failed_login_count: number
          full_name: string
          id: string
          is_active: boolean
          locked_until: string | null
          pin_failed_count: number
          pin_locked_until: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          failed_login_count?: number
          full_name: string
          id: string
          is_active?: boolean
          locked_until?: string | null
          pin_failed_count?: number
          pin_locked_until?: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          failed_login_count?: number
          full_name?: string
          id?: string
          is_active?: boolean
          locked_until?: string | null
          pin_failed_count?: number
          pin_locked_until?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_clinic_invite: {
        Args: { p_token_hash: string; p_user_id: string }
        Returns: string
      }
      auth_email_exists: {
        Args: { p_email: string }
        Returns: boolean
      }
      check_login_lockout: {
        Args: { p_email: string }
        Returns: undefined
      }
      clear_login_lockout: { Args: never; Returns: undefined }
      create_clinic_for_owner: {
        Args: {
          p_clinic_name: string
          p_full_name: string
          p_trial_ends_at?: string
        }
        Returns: string
      }
      create_clinic_operator: {
        Args: {
          p_profile_id: string
          p_display_name: string
          p_pin: string
        }
        Returns: string
      }
      custom_access_token_hook: {
        Args: { event: Json }
        Returns: Json
      }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      current_clinic_id: { Args: never; Returns: string }
      expire_stale_clinic_invites: {
        Args: { p_clinic_id?: string }
        Returns: number
      }
      is_clinic_owner: { Args: never; Returns: boolean }
      operator_belongs_to_me: {
        Args: { p_operator_id: string }
        Returns: boolean
      }
      owner_mfa_ok: { Args: never; Returns: boolean }
      record_failed_login: {
        Args: { p_email: string }
        Returns: undefined
      }
      peek_clinic_invite: {
        Args: { p_token_hash: string }
        Returns: {
          clinic_id: string
          clinic_name: string
          email: string
          expires_at: string
          full_name: string
          invite_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invite_status"]
        }[]
      }
      set_clinic_operator_active: {
        Args: { p_operator_id: string; p_is_active: boolean }
        Returns: undefined
      }
      shared_desk_needs_pin: { Args: never; Returns: boolean }
      update_clinic_operator_pin: {
        Args: { p_operator_id: string; p_pin: string }
        Returns: undefined
      }
      verify_operator_pin: {
        Args: { p_operator_id: string; p_pin: string }
        Returns: {
          operator_id: string
          display_name: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "owner"
        | "doctor"
        | "assistant"
        | "reception"
        | "accountant"
        | "technician"
      clinic_status: "active" | "readonly" | "pending_delete"
      invite_status: "pending" | "accepted" | "revoked" | "expired"
      subscription_status:
        | "trial"
        | "active"
        | "past_due"
        | "canceled"
        | "readonly"
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

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "owner",
        "doctor",
        "assistant",
        "reception",
        "accountant",
        "technician",
      ],
      clinic_status: ["active", "readonly", "pending_delete"],
      invite_status: ["pending", "accepted", "revoked", "expired"],
      subscription_status: [
        "trial",
        "active",
        "past_due",
        "canceled",
        "readonly",
      ],
    },
  },
} as const
