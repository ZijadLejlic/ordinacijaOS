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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointment_waitlist: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          doctor_id: string | null
          id: string
          location_id: string | null
          notes: string | null
          offered_appointment_id: string | null
          patient_id: string
          preferred_from: string | null
          preferred_to: string | null
          priority: number
          service_id: string | null
          status: Database["public"]["Enums"]["waitlist_status"]
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          offered_appointment_id?: string | null
          patient_id: string
          preferred_from?: string | null
          preferred_to?: string | null
          priority?: number
          service_id?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          offered_appointment_id?: string | null
          patient_id?: string
          preferred_from?: string | null
          preferred_to?: string | null
          priority?: number
          service_id?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_waitlist_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_waitlist_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_waitlist_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_waitlist_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "clinic_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_waitlist_offered_appointment_id_fkey"
            columns: ["offered_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_waitlist_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_waitlist_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          doctor_id: string
          ends_at: string
          id: string
          location_id: string | null
          notes: string | null
          patient_id: string
          service_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          doctor_id: string
          ends_at: string
          id?: string
          location_id?: string | null
          notes?: string | null
          patient_id: string
          service_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          doctor_id?: string
          ends_at?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          patient_id?: string
          service_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "clinic_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
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
          closure_reason: string | null
          created_at: string
          grace_ends_at: string | null
          id: string
          name: string
          phone_country_default: string
          plan_id: string
          readonly_started_at: string | null
          settings_json: Json
          status: Database["public"]["Enums"]["clinic_status"]
          timezone: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          branding_json?: Json
          closure_reason?: string | null
          created_at?: string
          grace_ends_at?: string | null
          id?: string
          name: string
          phone_country_default?: string
          plan_id: string
          readonly_started_at?: string | null
          settings_json?: Json
          status?: Database["public"]["Enums"]["clinic_status"]
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          branding_json?: Json
          closure_reason?: string | null
          created_at?: string
          grace_ends_at?: string | null
          id?: string
          name?: string
          phone_country_default?: string
          plan_id?: string
          readonly_started_at?: string | null
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
      crm_notifications: {
        Row: {
          clinic_id: string
          created_at: string
          dismissed_at: string | null
          due_on: string
          id: string
          kind: string
          outbound_message_id: string | null
          patient_id: string
          sent_at: string | null
          sent_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          dismissed_at?: string | null
          due_on: string
          id?: string
          kind: string
          outbound_message_id?: string | null
          patient_id: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          dismissed_at?: string | null
          due_on?: string
          id?: string
          kind?: string
          outbound_message_id?: string | null
          patient_id?: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_notifications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_notifications_outbound_message_id_fkey"
            columns: ["outbound_message_id"]
            isOneToOne: false
            referencedRelation: "outbound_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_notifications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_notifications_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_text: string
          clinic_id: string
          created_at: string
          id: string
          locale: string
          subject: string
          template_key: string
          updated_at: string
        }
        Insert: {
          body_text: string
          clinic_id: string
          created_at?: string
          id?: string
          locale: string
          subject: string
          template_key: string
          updated_at?: string
        }
        Update: {
          body_text?: string
          clinic_id?: string
          created_at?: string
          id?: string
          locale?: string
          subject?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          clinic_id: string
          created_at: string
          currency: string
          description: string
          expense_date: string
          id: string
          notes: string | null
          recorded_by: string
          updated_at: string
          vendor: string | null
          voided_at: string | null
          voided_reason: string | null
        }
        Insert: {
          amount: number
          category?: Database["public"]["Enums"]["expense_category"]
          clinic_id: string
          created_at?: string
          currency?: string
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          recorded_by: string
          updated_at?: string
          vendor?: string | null
          voided_at?: string | null
          voided_reason?: string | null
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          clinic_id?: string
          created_at?: string
          currency?: string
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          recorded_by?: string
          updated_at?: string
          vendor?: string | null
          voided_at?: string | null
          voided_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gdpr_erasure_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          clinic_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          patient_id: string | null
          patient_snapshot: Json
          rejection_reason: string | null
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          clinic_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          patient_id?: string | null
          patient_snapshot?: Json
          rejection_reason?: string | null
          requested_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          clinic_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          patient_id?: string | null
          patient_snapshot?: Json
          rejection_reason?: string | null
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gdpr_erasure_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gdpr_erasure_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gdpr_erasure_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gdpr_erasure_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          clinic_id: string
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total: number
          quantity: number
          service_id: string | null
          sort_order: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          clinic_id: string
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          line_total: number
          quantity?: number
          service_id?: string | null
          sort_order?: number
          unit_price: number
          vat_rate?: number
        }
        Update: {
          clinic_id?: string
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          quantity?: number
          service_id?: string | null
          sort_order?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_number_counters: {
        Row: {
          clinic_id: string
          last_number: number
          series_year: number
        }
        Insert: {
          clinic_id: string
          last_number?: number
          series_year: number
        }
        Update: {
          clinic_id?: string
          last_number?: number
          series_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_number_counters_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          clinic_id: string
          created_at: string
          currency: string
          doctor_id: string | null
          id: string
          issued_at: string
          issued_by: string
          location_id: string | null
          notes: string | null
          patient_id: string
          pdf_storage_path: string | null
          series_number: number
          series_year: number
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal_amount: number
          total_amount: number
          updated_at: string
          vat_amount: number
          voided_at: string | null
          voided_reason: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          currency?: string
          doctor_id?: string | null
          id?: string
          issued_at?: string
          issued_by: string
          location_id?: string | null
          notes?: string | null
          patient_id: string
          pdf_storage_path?: string | null
          series_number: number
          series_year: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_amount: number
          total_amount: number
          updated_at?: string
          vat_amount?: number
          voided_at?: string | null
          voided_reason?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          currency?: string
          doctor_id?: string | null
          id?: string
          issued_at?: string
          issued_by?: string
          location_id?: string | null
          notes?: string | null
          patient_id?: string
          pdf_storage_path?: string | null
          series_number?: number
          series_year?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_amount?: number
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          voided_at?: string | null
          voided_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "clinic_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      odontogram_events: {
        Row: {
          clinic_id: string
          created_at: string
          event_type: string
          fdi_number: number
          id: string
          note: string | null
          patient_id: string
          recorded_by: string | null
          status_after: Database["public"]["Enums"]["tooth_status"] | null
          status_before: Database["public"]["Enums"]["tooth_status"] | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          event_type: string
          fdi_number: number
          id?: string
          note?: string | null
          patient_id: string
          recorded_by?: string | null
          status_after?: Database["public"]["Enums"]["tooth_status"] | null
          status_before?: Database["public"]["Enums"]["tooth_status"] | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          event_type?: string
          fdi_number?: number
          id?: string
          note?: string | null
          patient_id?: string
          recorded_by?: string | null
          status_after?: Database["public"]["Enums"]["tooth_status"] | null
          status_before?: Database["public"]["Enums"]["tooth_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "odontogram_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odontogram_events_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odontogram_events_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      odontogram_teeth: {
        Row: {
          clinic_id: string
          fdi_number: number
          id: string
          notes: string | null
          patient_id: string
          status: Database["public"]["Enums"]["tooth_status"]
          surfaces_json: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          clinic_id: string
          fdi_number: number
          id?: string
          notes?: string | null
          patient_id: string
          status?: Database["public"]["Enums"]["tooth_status"]
          surfaces_json?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          clinic_id?: string
          fdi_number?: number
          id?: string
          notes?: string | null
          patient_id?: string
          status?: Database["public"]["Enums"]["tooth_status"]
          surfaces_json?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "odontogram_teeth_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odontogram_teeth_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odontogram_teeth_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_messages: {
        Row: {
          appointment_id: string | null
          channel: string
          clinic_id: string
          created_at: string
          error_message: string | null
          id: string
          is_test: boolean
          locale: string
          patient_id: string | null
          provider_message_id: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          subject: string
          template_key: string
          to_address: string
        }
        Insert: {
          appointment_id?: string | null
          channel?: string
          clinic_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          is_test?: boolean
          locale: string
          patient_id?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject: string
          template_key: string
          to_address: string
        }
        Update: {
          appointment_id?: string | null
          channel?: string
          clinic_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          is_test?: boolean
          locale?: string
          patient_id?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
          template_key?: string
          to_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_allergies: {
        Row: {
          allergen: string
          clinic_id: string
          created_at: string
          id: string
          notes: string | null
          patient_id: string
          severity: Database["public"]["Enums"]["allergy_severity"]
        }
        Insert: {
          allergen: string
          clinic_id: string
          created_at?: string
          id?: string
          notes?: string | null
          patient_id: string
          severity?: Database["public"]["Enums"]["allergy_severity"]
        }
        Update: {
          allergen?: string
          clinic_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          patient_id?: string
          severity?: Database["public"]["Enums"]["allergy_severity"]
        }
        Relationships: [
          {
            foreignKeyName: "patient_allergies_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_allergies_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_documents: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          mime_type: string
          patient_id: string
          size_bytes: number
          storage_path: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          mime_type?: string
          patient_id: string
          size_bytes?: number
          storage_path: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          mime_type?: string
          patient_id?: string
          size_bytes?: number
          storage_path?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_documents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_images: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          mime_type: string
          patient_id: string
          size_bytes: number
          storage_path: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          mime_type?: string
          patient_id: string
          size_bytes?: number
          storage_path: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          mime_type?: string
          patient_id?: string
          size_bytes?: number
          storage_path?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_images_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_images_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_images_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          clinic_id: string
          created_at: string
          date_of_birth: string | null
          email: string | null
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          medical_history: string | null
          next_control_at: string | null
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          clinic_id: string
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          last_name: string
          medical_history?: string | null
          next_control_at?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          clinic_id?: string
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          medical_history?: string | null
          next_control_at?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plan_installments: {
        Row: {
          amount: number
          clinic_id: string
          created_at: string
          due_date: string
          id: string
          paid_at: string | null
          payment_id: string | null
          payment_plan_id: string
          sequence_number: number
          status: Database["public"]["Enums"]["payment_plan_installment_status"]
        }
        Insert: {
          amount: number
          clinic_id: string
          created_at?: string
          due_date: string
          id?: string
          paid_at?: string | null
          payment_id?: string | null
          payment_plan_id: string
          sequence_number: number
          status?: Database["public"]["Enums"]["payment_plan_installment_status"]
        }
        Update: {
          amount?: number
          clinic_id?: string
          created_at?: string
          due_date?: string
          id?: string
          paid_at?: string | null
          payment_id?: string | null
          payment_plan_id?: string
          sequence_number?: number
          status?: Database["public"]["Enums"]["payment_plan_installment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payment_plan_installments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plan_installments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plan_installments_payment_plan_id_fkey"
            columns: ["payment_plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string
          id: string
          installment_count: number
          invoice_id: string
          notes: string | null
          patient_id: string
          status: Database["public"]["Enums"]["payment_plan_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by: string
          id?: string
          installment_count: number
          invoice_id: string
          notes?: string | null
          patient_id: string
          status?: Database["public"]["Enums"]["payment_plan_status"]
          total_amount: number
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string
          id?: string
          installment_count?: number
          invoice_id?: string
          notes?: string | null
          patient_id?: string
          status?: Database["public"]["Enums"]["payment_plan_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          clinic_id: string
          created_at: string
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          paid_at: string
          recorded_by: string
        }
        Insert: {
          amount: number
          clinic_id: string
          created_at?: string
          id?: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
          recorded_by: string
        }
        Update: {
          amount?: number
          clinic_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      services: {
        Row: {
          clinic_id: string
          code: string | null
          created_at: string
          duration_minutes: number
          id: string
          is_active: boolean
          location_id: string | null
          name: string
          price_eur: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          clinic_id: string
          code?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          location_id?: string | null
          name: string
          price_eur: number
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          clinic_id?: string
          code?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          location_id?: string | null
          name?: string
          price_eur?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "clinic_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plan_items: {
        Row: {
          clinic_id: string
          created_at: string
          estimated_price_eur: number
          fdi_number: number | null
          id: string
          notes: string | null
          service_id: string | null
          service_name: string
          sort_order: number
          status: Database["public"]["Enums"]["treatment_plan_item_status"]
          treatment_plan_id: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          estimated_price_eur?: number
          fdi_number?: number | null
          id?: string
          notes?: string | null
          service_id?: string | null
          service_name: string
          sort_order?: number
          status?: Database["public"]["Enums"]["treatment_plan_item_status"]
          treatment_plan_id: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          estimated_price_eur?: number
          fdi_number?: number | null
          id?: string
          notes?: string | null
          service_id?: string | null
          service_name?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["treatment_plan_item_status"]
          treatment_plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_items_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plans: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          notes: string | null
          patient_id: string
          title: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          patient_id: string
          title: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          patient_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
      allocate_invoice_number: {
        Args: { p_clinic_id: string }
        Returns: {
          series_number: number
          series_year: number
        }[]
      }
      auth_email_exists: { Args: { p_email: string }; Returns: boolean }
      approve_gdpr_patient_erasure: {
        Args: { p_request_id: string }
        Returns: Json
      }
      clinic_is_writable: { Args: never; Returns: boolean }
      hard_delete_clinic: {
        Args: { p_clinic_id: string }
        Returns: Json
      }
      request_clinic_closure: { Args: never; Returns: Json }
      run_clinic_lifecycle_transitions: { Args: never; Returns: Json }
      can_access_appointments: { Args: never; Returns: boolean }
      can_access_crm: { Args: never; Returns: boolean }
      can_access_expenses: { Args: never; Returns: boolean }
      can_access_invoices: { Args: never; Returns: boolean }
      can_access_patients: { Args: never; Returns: boolean }
      can_access_treatment_plan: { Args: never; Returns: boolean }
      can_access_waitlist: { Args: never; Returns: boolean }
      can_import_services: { Args: never; Returns: boolean }
      can_manage_all_appointment_doctors: { Args: never; Returns: boolean }
      can_read_email_templates: { Args: never; Returns: boolean }
      can_send_outbound_messages: { Args: never; Returns: boolean }
      can_write_appointments: { Args: never; Returns: boolean }
      can_write_email_templates: { Args: never; Returns: boolean }
      can_write_expenses: { Args: never; Returns: boolean }
      can_write_invoices: { Args: never; Returns: boolean }
      can_write_odontogram: { Args: never; Returns: boolean }
      can_write_patients: { Args: never; Returns: boolean }
      can_write_services: { Args: never; Returns: boolean }
      can_write_treatment_plan: { Args: never; Returns: boolean }
      can_write_waitlist: { Args: never; Returns: boolean }
      check_login_lockout: { Args: { p_email: string }; Returns: undefined }
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
        Args: { p_display_name: string; p_pin: string; p_profile_id: string }
        Returns: string
      }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      current_clinic_id: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      dashboard_payment_stats: {
        Args: {
          p_month_end: string
          p_month_start: string
          p_today_end: string
          p_today_start: string
          p_trend_start: string
        }
        Returns: Json
      }
      expire_stale_clinic_invites: {
        Args: { p_clinic_id?: string }
        Returns: number
      }
      get_invoice_patient_names: {
        Args: { p_patient_ids: string[] }
        Returns: {
          first_name: string
          id: string
          last_name: string
        }[]
      }
      get_patient_for_invoice: {
        Args: { p_patient_id: string }
        Returns: {
          first_name: string
          id: string
          is_active: boolean
          last_name: string
        }[]
      }
      hash_operator_pin: { Args: { p_pin: string }; Returns: string }
      is_clinic_owner: { Args: never; Returns: boolean }
      is_valid_fdi: { Args: { p_fdi: number }; Returns: boolean }
      list_patients_for_invoices: {
        Args: never
        Returns: {
          first_name: string
          id: string
          last_name: string
        }[]
      }
      operator_belongs_to_me: {
        Args: { p_operator_id: string }
        Returns: boolean
      }
      operator_pin_matches: {
        Args: { p_hash: string; p_pin: string }
        Returns: boolean
      }
      owner_mfa_ok: { Args: never; Returns: boolean }
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
      record_failed_login: { Args: { p_email: string }; Returns: undefined }
      seed_default_email_templates: {
        Args: { p_clinic_id: string }
        Returns: undefined
      }
      set_clinic_operator_active: {
        Args: { p_is_active: boolean; p_operator_id: string }
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
          display_name: string
          operator_id: string
        }[]
      }
    }
    Enums: {
      allergy_severity: "mild" | "moderate" | "severe" | "unknown"
      app_role:
        | "owner"
        | "doctor"
        | "assistant"
        | "reception"
        | "accountant"
        | "technician"
      appointment_status:
        | "pending_confirmation"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      clinic_status: "active" | "readonly" | "pending_delete"
      expense_category:
        | "supplies"
        | "lab"
        | "rent"
        | "utilities"
        | "salaries"
        | "equipment"
        | "marketing"
        | "other"
      invite_status: "pending" | "accepted" | "revoked" | "expired"
      invoice_status: "unpaid" | "partial" | "paid" | "void"
      payment_method: "cash" | "card" | "bank_transfer" | "other"
      payment_plan_installment_status:
        | "pending"
        | "paid"
        | "overdue"
        | "cancelled"
      payment_plan_status: "active" | "completed" | "cancelled"
      subscription_status:
        | "trial"
        | "active"
        | "past_due"
        | "canceled"
        | "readonly"
      tooth_status:
        | "healthy"
        | "caries"
        | "filled"
        | "crown"
        | "missing"
        | "implant"
        | "root_canal"
        | "bridge"
        | "other"
      treatment_plan_item_status:
        | "planned"
        | "in_progress"
        | "done"
        | "cancelled"
      waitlist_status: "waiting" | "offered" | "booked" | "cancelled"
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
  public: {
    Enums: {
      allergy_severity: ["mild", "moderate", "severe", "unknown"],
      app_role: [
        "owner",
        "doctor",
        "assistant",
        "reception",
        "accountant",
        "technician",
      ],
      appointment_status: [
        "pending_confirmation",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      clinic_status: ["active", "readonly", "pending_delete"],
      expense_category: [
        "supplies",
        "lab",
        "rent",
        "utilities",
        "salaries",
        "equipment",
        "marketing",
        "other",
      ],
      invite_status: ["pending", "accepted", "revoked", "expired"],
      invoice_status: ["unpaid", "partial", "paid", "void"],
      payment_method: ["cash", "card", "bank_transfer", "other"],
      payment_plan_installment_status: [
        "pending",
        "paid",
        "overdue",
        "cancelled",
      ],
      payment_plan_status: ["active", "completed", "cancelled"],
      subscription_status: [
        "trial",
        "active",
        "past_due",
        "canceled",
        "readonly",
      ],
      tooth_status: [
        "healthy",
        "caries",
        "filled",
        "crown",
        "missing",
        "implant",
        "root_canal",
        "bridge",
        "other",
      ],
      treatment_plan_item_status: [
        "planned",
        "in_progress",
        "done",
        "cancelled",
      ],
      waitlist_status: ["waiting", "offered", "booked", "cancelled"],
    },
  },
} as const
