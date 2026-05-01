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
      accountant_profiles: {
        Row: {
          accountant_name: string
          billing_terms: string | null
          cabinet_name: string | null
          company_id: string
          contract_start_date: string | null
          created_at: string
          email: string | null
          has_portal_access: boolean
          id: string
          notes: string | null
          phone: string | null
          portal_user_id: string | null
          preferred_delivery_method: string
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          accountant_name: string
          billing_terms?: string | null
          cabinet_name?: string | null
          company_id: string
          contract_start_date?: string | null
          created_at?: string
          email?: string | null
          has_portal_access?: boolean
          id?: string
          notes?: string | null
          phone?: string | null
          portal_user_id?: string | null
          preferred_delivery_method?: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          accountant_name?: string
          billing_terms?: string | null
          cabinet_name?: string | null
          company_id?: string
          contract_start_date?: string | null
          created_at?: string
          email?: string | null
          has_portal_access?: boolean
          id?: string
          notes?: string | null
          phone?: string | null
          portal_user_id?: string | null
          preferred_delivery_method?: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accountant_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_profiles_portal_user_id_fkey"
            columns: ["portal_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_audit_log: {
        Row: {
          action: string
          actor_name: string | null
          actor_role: string | null
          actor_user_id: string | null
          after_state: Json | null
          before_state: Json | null
          company_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          notes: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_name?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          company_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          notes?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_name?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          company_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          notes?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_documents: {
        Row: {
          amount_ht: number | null
          amount_ttc: number
          captured_at: string
          captured_by_user_id: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
          document_category: string
          document_date: string | null
          file_mime: string
          file_path: string
          file_size_bytes: number
          file_type: string
          id: string
          linked_driver_id: string | null
          linked_shipment_id: string | null
          linked_vehicle_id: string | null
          monthly_dossier_id: string | null
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          rejection_reason: string | null
          status: string
          subcategory: string | null
          supplier_ice: string | null
          supplier_name: string | null
          updated_at: string
          validated_at: string | null
          validated_by_user_id: string | null
          vat_amount: number | null
          vat_rate: number
        }
        Insert: {
          amount_ht?: number | null
          amount_ttc: number
          captured_at?: string
          captured_by_user_id?: string | null
          company_id: string
          created_at?: string
          deleted_at?: string | null
          document_category: string
          document_date?: string | null
          file_mime: string
          file_path: string
          file_size_bytes: number
          file_type: string
          id?: string
          linked_driver_id?: string | null
          linked_shipment_id?: string | null
          linked_vehicle_id?: string | null
          monthly_dossier_id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          rejection_reason?: string | null
          status?: string
          subcategory?: string | null
          supplier_ice?: string | null
          supplier_name?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by_user_id?: string | null
          vat_amount?: number | null
          vat_rate?: number
        }
        Update: {
          amount_ht?: number | null
          amount_ttc?: number
          captured_at?: string
          captured_by_user_id?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          document_category?: string
          document_date?: string | null
          file_mime?: string
          file_path?: string
          file_size_bytes?: number
          file_type?: string
          id?: string
          linked_driver_id?: string | null
          linked_shipment_id?: string | null
          linked_vehicle_id?: string | null
          monthly_dossier_id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          rejection_reason?: string | null
          status?: string
          subcategory?: string | null
          supplier_ice?: string | null
          supplier_name?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by_user_id?: string | null
          vat_amount?: number | null
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "accounting_documents_captured_by_user_id_fkey"
            columns: ["captured_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_documents_linked_driver_id_fkey"
            columns: ["linked_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_documents_linked_driver_id_fkey"
            columns: ["linked_driver_id"]
            isOneToOne: false
            referencedRelation: "v_driver_current_vehicle"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "accounting_documents_linked_shipment_id_fkey"
            columns: ["linked_shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_documents_linked_shipment_id_fkey"
            columns: ["linked_shipment_id"]
            isOneToOne: false
            referencedRelation: "v_jit_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_documents_linked_shipment_id_fkey"
            columns: ["linked_shipment_id"]
            isOneToOne: false
            referencedRelation: "v_shipment_customs_compliance"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "accounting_documents_linked_vehicle_id_fkey"
            columns: ["linked_vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_driver_current_vehicle"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "accounting_documents_linked_vehicle_id_fkey"
            columns: ["linked_vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_fleet_compliance"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "accounting_documents_linked_vehicle_id_fkey"
            columns: ["linked_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_documents_monthly_dossier_id_fkey"
            columns: ["monthly_dossier_id"]
            isOneToOne: false
            referencedRelation: "monthly_dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_documents_validated_by_user_id_fkey"
            columns: ["validated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bl_template_fields: {
        Row: {
          company_id: string
          created_at: string
          default_value: string | null
          field_key: string
          field_type: string
          help_text: string | null
          id: string
          is_required: boolean
          is_visible: boolean
          label: string
          placeholder: string | null
          select_options: Json
          sort_order: number
          template_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          default_value?: string | null
          field_key: string
          field_type: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          is_visible?: boolean
          label: string
          placeholder?: string | null
          select_options?: Json
          sort_order?: number
          template_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          default_value?: string | null
          field_key?: string
          field_type?: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          is_visible?: boolean
          label?: string
          placeholder?: string | null
          select_options?: Json
          sort_order?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bl_template_fields_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bl_template_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "bl_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      bl_templates: {
        Row: {
          client_id: string
          company_id: string
          created_at: string
          created_by_user_id: string | null
          deleted_at: string | null
          id: string
          is_default: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          company_id: string
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bl_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bl_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bl_templates_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contracts: {
        Row: {
          auto_renewal: boolean
          billing_mode: string
          client_id: string
          company_id: string
          contract_number: string | null
          contract_pdf_path: string | null
          created_at: string
          created_by_user_id: string | null
          deleted_at: string | null
          end_date: string | null
          id: string
          notes: string | null
          payment_terms_days: number
          signed_date: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          auto_renewal?: boolean
          billing_mode?: string
          client_id: string
          company_id: string
          contract_number?: string | null
          contract_pdf_path?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          payment_terms_days?: number
          signed_date?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          auto_renewal?: boolean
          billing_mode?: string
          client_id?: string
          company_id?: string
          contract_number?: string | null
          contract_pdf_path?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          payment_terms_days?: number
          signed_date?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contracts_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_pricing_contracts: {
        Row: {
          base_fee: number
          client_id: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          price_per_km: number
          updated_at: string
          urgency_surcharge_pct: number
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          base_fee: number
          client_id: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          price_per_km: number
          updated_at?: string
          urgency_surcharge_pct?: number
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          base_fee?: number
          client_id?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          price_per_km?: number
          updated_at?: string
          urgency_surcharge_pct?: number
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_pricing_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_pricing_contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          billing_mode: string
          business_name: string
          city: string | null
          company_id: string
          contact_email: string
          contact_name: string
          contact_phone: string
          country: string
          created_at: string
          deleted_at: string | null
          delivery_window_strict: boolean
          id: string
          is_active: boolean
          late_penalty_per_hour_mad: number
          late_tolerance_minutes: number
          notes: string | null
          payment_terms_days: number
          tax_id: string | null
          updated_at: string
          user_id: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          address?: string | null
          billing_mode?: string
          business_name: string
          city?: string | null
          company_id: string
          contact_email: string
          contact_name: string
          contact_phone: string
          country?: string
          created_at?: string
          deleted_at?: string | null
          delivery_window_strict?: boolean
          id?: string
          is_active?: boolean
          late_penalty_per_hour_mad?: number
          late_tolerance_minutes?: number
          notes?: string | null
          payment_terms_days?: number
          tax_id?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          address?: string | null
          billing_mode?: string
          business_name?: string
          city?: string | null
          company_id?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          country?: string
          created_at?: string
          deleted_at?: string | null
          delivery_window_strict?: boolean
          id?: string
          is_active?: boolean
          late_penalty_per_hour_mad?: number
          late_tolerance_minutes?: number
          notes?: string | null
          payment_terms_days?: number
          tax_id?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cmr_documents: {
        Row: {
          attached_documents: string | null
          carrier_address: string | null
          carrier_country: string
          carrier_driver_name: string | null
          carrier_ice: string | null
          carrier_name: string
          carrier_observations: string | null
          carrier_trailer_plate: string | null
          carrier_vehicle_plate: string | null
          cash_on_delivery_mad: number | null
          charges_customs_mad: number | null
          charges_freight_mad: number | null
          charges_other_mad: number | null
          charges_supplementary_mad: number | null
          charges_total_mad: number | null
          cmr_number: string
          company_id: string
          consignee_address: string
          consignee_city: string
          consignee_country: string
          consignee_ice: string | null
          consignee_name: string
          created_at: string
          created_by_user_id: string | null
          deleted_at: string | null
          delivery_country: string
          delivery_place: string
          gross_weight_kg: number | null
          id: string
          internal_notes: string | null
          issued_date: string
          issued_place: string
          marks_and_numbers: string | null
          nature_of_goods: string
          packages_count: number | null
          packing_method: string | null
          payer: string
          pdf_generated_at: string | null
          pdf_storage_path: string | null
          sender_address: string
          sender_city: string
          sender_country: string
          sender_ice: string | null
          sender_instructions: string | null
          sender_name: string
          shipment_id: string
          signature_carrier_date: string | null
          signature_carrier_place: string | null
          signature_consignee_date: string | null
          signature_consignee_place: string | null
          signature_sender_date: string | null
          signature_sender_place: string | null
          special_agreements: string | null
          statistical_number: string | null
          status: string
          successive_carriers: string | null
          taking_over_country: string
          taking_over_date: string | null
          taking_over_place: string
          updated_at: string
          volume_m3: number | null
        }
        Insert: {
          attached_documents?: string | null
          carrier_address?: string | null
          carrier_country?: string
          carrier_driver_name?: string | null
          carrier_ice?: string | null
          carrier_name: string
          carrier_observations?: string | null
          carrier_trailer_plate?: string | null
          carrier_vehicle_plate?: string | null
          cash_on_delivery_mad?: number | null
          charges_customs_mad?: number | null
          charges_freight_mad?: number | null
          charges_other_mad?: number | null
          charges_supplementary_mad?: number | null
          charges_total_mad?: number | null
          cmr_number: string
          company_id: string
          consignee_address: string
          consignee_city: string
          consignee_country: string
          consignee_ice?: string | null
          consignee_name: string
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          delivery_country: string
          delivery_place: string
          gross_weight_kg?: number | null
          id?: string
          internal_notes?: string | null
          issued_date?: string
          issued_place: string
          marks_and_numbers?: string | null
          nature_of_goods: string
          packages_count?: number | null
          packing_method?: string | null
          payer?: string
          pdf_generated_at?: string | null
          pdf_storage_path?: string | null
          sender_address: string
          sender_city: string
          sender_country?: string
          sender_ice?: string | null
          sender_instructions?: string | null
          sender_name: string
          shipment_id: string
          signature_carrier_date?: string | null
          signature_carrier_place?: string | null
          signature_consignee_date?: string | null
          signature_consignee_place?: string | null
          signature_sender_date?: string | null
          signature_sender_place?: string | null
          special_agreements?: string | null
          statistical_number?: string | null
          status?: string
          successive_carriers?: string | null
          taking_over_country?: string
          taking_over_date?: string | null
          taking_over_place: string
          updated_at?: string
          volume_m3?: number | null
        }
        Update: {
          attached_documents?: string | null
          carrier_address?: string | null
          carrier_country?: string
          carrier_driver_name?: string | null
          carrier_ice?: string | null
          carrier_name?: string
          carrier_observations?: string | null
          carrier_trailer_plate?: string | null
          carrier_vehicle_plate?: string | null
          cash_on_delivery_mad?: number | null
          charges_customs_mad?: number | null
          charges_freight_mad?: number | null
          charges_other_mad?: number | null
          charges_supplementary_mad?: number | null
          charges_total_mad?: number | null
          cmr_number?: string
          company_id?: string
          consignee_address?: string
          consignee_city?: string
          consignee_country?: string
          consignee_ice?: string | null
          consignee_name?: string
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          delivery_country?: string
          delivery_place?: string
          gross_weight_kg?: number | null
          id?: string
          internal_notes?: string | null
          issued_date?: string
          issued_place?: string
          marks_and_numbers?: string | null
          nature_of_goods?: string
          packages_count?: number | null
          packing_method?: string | null
          payer?: string
          pdf_generated_at?: string | null
          pdf_storage_path?: string | null
          sender_address?: string
          sender_city?: string
          sender_country?: string
          sender_ice?: string | null
          sender_instructions?: string | null
          sender_name?: string
          shipment_id?: string
          signature_carrier_date?: string | null
          signature_carrier_place?: string | null
          signature_consignee_date?: string | null
          signature_consignee_place?: string | null
          signature_sender_date?: string | null
          signature_sender_place?: string | null
          special_agreements?: string | null
          statistical_number?: string | null
          status?: string
          successive_carriers?: string | null
          taking_over_country?: string
          taking_over_date?: string | null
          taking_over_place?: string
          updated_at?: string
          volume_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cmr_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmr_documents_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmr_documents_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmr_documents_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "v_jit_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmr_documents_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "v_shipment_customs_compliance"
            referencedColumns: ["shipment_id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          bank_iban: string | null
          bank_swift: string | null
          city: string | null
          country: string
          created_at: string
          default_currency: string
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          office_label: string | null
          office_lat: number | null
          office_lng: number | null
          office_maps_url: string | null
          office_radius_m: number
          phone: string | null
          slug: string
          tax_id: string | null
          timezone: string
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          bank_iban?: string | null
          bank_swift?: string | null
          city?: string | null
          country?: string
          created_at?: string
          default_currency?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          office_label?: string | null
          office_lat?: number | null
          office_lng?: number | null
          office_maps_url?: string | null
          office_radius_m?: number
          phone?: string | null
          slug: string
          tax_id?: string | null
          timezone?: string
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          bank_iban?: string | null
          bank_swift?: string | null
          city?: string | null
          country?: string
          created_at?: string
          default_currency?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          office_label?: string | null
          office_lat?: number | null
          office_lng?: number | null
          office_maps_url?: string | null
          office_radius_m?: number
          phone?: string | null
          slug?: string
          tax_id?: string | null
          timezone?: string
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          client_portal_enabled: boolean
          company_id: string
          created_at: string
          driver_ratings_enabled: boolean
          email_from_name: string | null
          email_reply_to: string | null
          id: string
          international_enabled: boolean
          invoice_footer_text: string | null
          notify_on_assignment: boolean
          notify_on_delivery: boolean
          notify_on_invoice: boolean
          notify_on_pickup: boolean
          notify_overdue_day_15: boolean
          notify_overdue_day_30: boolean
          notify_overdue_day_7: boolean
          updated_at: string
          whatsapp_enabled: boolean
          whatsapp_sender_id: string | null
        }
        Insert: {
          client_portal_enabled?: boolean
          company_id: string
          created_at?: string
          driver_ratings_enabled?: boolean
          email_from_name?: string | null
          email_reply_to?: string | null
          id?: string
          international_enabled?: boolean
          invoice_footer_text?: string | null
          notify_on_assignment?: boolean
          notify_on_delivery?: boolean
          notify_on_invoice?: boolean
          notify_on_pickup?: boolean
          notify_overdue_day_15?: boolean
          notify_overdue_day_30?: boolean
          notify_overdue_day_7?: boolean
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_sender_id?: string | null
        }
        Update: {
          client_portal_enabled?: boolean
          company_id?: string
          created_at?: string
          driver_ratings_enabled?: boolean
          email_from_name?: string | null
          email_reply_to?: string | null
          id?: string
          international_enabled?: boolean
          invoice_footer_text?: string | null
          notify_on_assignment?: boolean
          notify_on_delivery?: boolean
          notify_on_invoice?: boolean
          notify_on_pickup?: boolean
          notify_overdue_day_15?: boolean
          notify_overdue_day_30?: boolean
          notify_overdue_day_7?: boolean
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_pricing_grid: {
        Row: {
          base_price_mad: number
          company_id: string
          contract_id: string
          created_at: string
          customs_zone: boolean
          delivery_city: string | null
          id: string
          is_active: boolean
          notes: string | null
          pickup_city: string | null
          route_label: string
          sort_order: number
          surcharge_night_pct: number
          surcharge_urgent_pct: number
          surcharge_waiting_per_hour_mad: number
          surcharge_weekend_pct: number
          updated_at: string
          vehicle_type: string | null
        }
        Insert: {
          base_price_mad: number
          company_id: string
          contract_id: string
          created_at?: string
          customs_zone?: boolean
          delivery_city?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          pickup_city?: string | null
          route_label: string
          sort_order?: number
          surcharge_night_pct?: number
          surcharge_urgent_pct?: number
          surcharge_waiting_per_hour_mad?: number
          surcharge_weekend_pct?: number
          updated_at?: string
          vehicle_type?: string | null
        }
        Update: {
          base_price_mad?: number
          company_id?: string
          contract_id?: string
          created_at?: string
          customs_zone?: boolean
          delivery_city?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          pickup_city?: string | null
          route_label?: string
          sort_order?: number
          surcharge_night_pct?: number
          surcharge_urgent_pct?: number
          surcharge_waiting_per_hour_mad?: number
          surcharge_weekend_pct?: number
          updated_at?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_pricing_grid_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_pricing_grid_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "client_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      customs_document_types: {
        Row: {
          applicable_to: string
          code: string
          company_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          required_by_default: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          applicable_to?: string
          code: string
          company_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          required_by_default?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          applicable_to?: string
          code?: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          required_by_default?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customs_document_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_ratings: {
        Row: {
          client_id: string
          comment: string | null
          company_id: string
          created_at: string
          driver_id: string
          id: string
          rating: number
          shipment_id: string
        }
        Insert: {
          client_id: string
          comment?: string | null
          company_id: string
          created_at?: string
          driver_id: string
          id?: string
          rating: number
          shipment_id: string
        }
        Update: {
          client_id?: string
          comment?: string | null
          company_id?: string
          created_at?: string
          driver_id?: string
          id?: string
          rating?: number
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_ratings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_ratings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "v_driver_current_vehicle"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "driver_ratings_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_ratings_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "v_jit_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_ratings_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "v_shipment_customs_compliance"
            referencedColumns: ["shipment_id"]
          },
        ]
      }
      driver_vehicle_assignments: {
        Row: {
          assigned_at: string
          company_id: string
          created_at: string
          driver_id: string
          id: string
          notes: string | null
          unassigned_at: string | null
          vehicle_id: string
        }
        Insert: {
          assigned_at?: string
          company_id: string
          created_at?: string
          driver_id: string
          id?: string
          notes?: string | null
          unassigned_at?: string | null
          vehicle_id: string
        }
        Update: {
          assigned_at?: string
          company_id?: string
          created_at?: string
          driver_id?: string
          id?: string
          notes?: string | null
          unassigned_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_vehicle_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_vehicle_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_vehicle_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "v_driver_current_vehicle"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "driver_vehicle_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_driver_current_vehicle"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "driver_vehicle_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_fleet_compliance"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "driver_vehicle_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          avatar_url: string | null
          average_rating: number
          cin_expiry: string | null
          cin_number: string
          company_id: string
          created_at: string
          deleted_at: string | null
          full_name: string
          id: string
          is_active: boolean
          is_available: boolean
          license_expiry: string
          license_number: string
          monthly_salary: number | null
          notes: string | null
          on_time_delivery_count: number
          on_time_delivery_rate: number
          phone: string
          total_deliveries: number
          total_km_driven: number
          updated_at: string
          user_id: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          average_rating?: number
          cin_expiry?: string | null
          cin_number: string
          company_id: string
          created_at?: string
          deleted_at?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          is_available?: boolean
          license_expiry: string
          license_number: string
          monthly_salary?: number | null
          notes?: string | null
          on_time_delivery_count?: number
          on_time_delivery_rate?: number
          phone: string
          total_deliveries?: number
          total_km_driven?: number
          updated_at?: string
          user_id?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          average_rating?: number
          cin_expiry?: string | null
          cin_number?: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          is_available?: boolean
          license_expiry?: string
          license_number?: string
          monthly_salary?: number | null
          notes?: string | null
          on_time_delivery_count?: number
          on_time_delivery_rate?: number
          phone?: string
          total_deliveries?: number
          total_km_driven?: number
          updated_at?: string
          user_id?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      free_zone_required_documents: {
        Row: {
          company_id: string
          created_at: string
          document_type_id: string
          free_zone_id: string
          is_required: boolean
          notes: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          document_type_id: string
          free_zone_id: string
          is_required?: boolean
          notes?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          document_type_id?: string
          free_zone_id?: string
          is_required?: boolean
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "free_zone_required_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "free_zone_required_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "customs_document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "free_zone_required_documents_free_zone_id_fkey"
            columns: ["free_zone_id"]
            isOneToOne: false
            referencedRelation: "free_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      free_zones: {
        Row: {
          city: string
          code: string
          company_id: string
          country: string
          created_at: string
          customs_office_code: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          city: string
          code: string
          company_id: string
          country?: string
          created_at?: string
          customs_office_code?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          city?: string
          code?: string
          company_id?: string
          country?: string
          created_at?: string
          customs_office_code?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "free_zones_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_reads: {
        Row: {
          company_id: string
          id: string
          kind: string
          read_at: string
          source_id: string
          user_id: string
        }
        Insert: {
          company_id: string
          id?: string
          kind: string
          read_at?: string
          source_id: string
          user_id: string
        }
        Update: {
          company_id?: string
          id?: string
          kind?: string
          read_at?: string
          source_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_reads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: string
          recorded_by: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_overdue_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_shipments: {
        Row: {
          invoice_id: string
          shipment_id: string
        }
        Insert: {
          invoice_id: string
          shipment_id: string
        }
        Update: {
          invoice_id?: string
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_shipments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_shipments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_overdue_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_shipments_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_shipments_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "v_jit_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_shipments_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "v_shipment_customs_compliance"
            referencedColumns: ["shipment_id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          client_id: string
          company_id: string
          created_at: string
          created_by: string | null
          due_at: string
          id: string
          invoice_number: string
          issued_at: string
          notes: string | null
          pdf_url: string | null
          period_end: string | null
          period_start: string | null
          status: string
          subtotal_excl_tax: number
          tax_amount: number
          tax_rate: number
          total_incl_tax: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          client_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          due_at: string
          id?: string
          invoice_number: string
          issued_at?: string
          notes?: string | null
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          subtotal_excl_tax: number
          tax_amount: number
          tax_rate: number
          total_incl_tax: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          client_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          due_at?: string
          id?: string
          invoice_number?: string
          issued_at?: string
          notes?: string | null
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          subtotal_excl_tax?: number
          tax_amount?: number
          tax_rate?: number
          total_incl_tax?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_dossiers: {
        Row: {
          closed_at: string | null
          company_id: string
          computed_snapshot: Json | null
          created_at: string
          deleted_at: string | null
          excel_export_path: string | null
          generated_at: string | null
          generated_by_user_id: string | null
          id: string
          notes_from_accountant: string | null
          pdf_summary_path: string | null
          period_month: string
          sent_at: string | null
          sent_method: string | null
          sent_to_email: string | null
          status: string
          total_documents_count: number
          total_employer_cost_mad: number
          total_expenses_mad: number
          total_payroll_gross_mad: number
          total_payroll_net_mad: number
          total_revenue_excl_tax_mad: number
          total_revenue_incl_tax_mad: number
          updated_at: string
          vat_collected_mad: number
          vat_deductible_mad: number
          vat_to_pay_mad: number
          zip_archive_path: string | null
        }
        Insert: {
          closed_at?: string | null
          company_id: string
          computed_snapshot?: Json | null
          created_at?: string
          deleted_at?: string | null
          excel_export_path?: string | null
          generated_at?: string | null
          generated_by_user_id?: string | null
          id?: string
          notes_from_accountant?: string | null
          pdf_summary_path?: string | null
          period_month: string
          sent_at?: string | null
          sent_method?: string | null
          sent_to_email?: string | null
          status?: string
          total_documents_count?: number
          total_employer_cost_mad?: number
          total_expenses_mad?: number
          total_payroll_gross_mad?: number
          total_payroll_net_mad?: number
          total_revenue_excl_tax_mad?: number
          total_revenue_incl_tax_mad?: number
          updated_at?: string
          vat_collected_mad?: number
          vat_deductible_mad?: number
          vat_to_pay_mad?: number
          zip_archive_path?: string | null
        }
        Update: {
          closed_at?: string | null
          company_id?: string
          computed_snapshot?: Json | null
          created_at?: string
          deleted_at?: string | null
          excel_export_path?: string | null
          generated_at?: string | null
          generated_by_user_id?: string | null
          id?: string
          notes_from_accountant?: string | null
          pdf_summary_path?: string | null
          period_month?: string
          sent_at?: string | null
          sent_method?: string | null
          sent_to_email?: string | null
          status?: string
          total_documents_count?: number
          total_employer_cost_mad?: number
          total_expenses_mad?: number
          total_payroll_gross_mad?: number
          total_payroll_net_mad?: number
          total_revenue_excl_tax_mad?: number
          total_revenue_incl_tax_mad?: number
          updated_at?: string
          vat_collected_mad?: number
          vat_deductible_mad?: number
          vat_to_pay_mad?: number
          zip_archive_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_dossiers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_dossiers_generated_by_user_id_fkey"
            columns: ["generated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          attempts: number
          body: string
          channel: string
          company_id: string
          created_at: string
          error_message: string | null
          id: string
          invoice_id: string | null
          last_attempted_at: string | null
          metadata: Json | null
          recipient_email: string | null
          recipient_phone: string | null
          sent_at: string | null
          shipment_id: string | null
          status: string
          subject: string | null
          type: string
        }
        Insert: {
          attempts?: number
          body: string
          channel: string
          company_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          last_attempted_at?: string | null
          metadata?: Json | null
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          shipment_id?: string | null
          status?: string
          subject?: string | null
          type: string
        }
        Update: {
          attempts?: number
          body?: string
          channel?: string
          company_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          last_attempted_at?: string | null
          metadata?: Json | null
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          shipment_id?: string | null
          status?: string
          subject?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_overdue_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "v_jit_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "v_shipment_customs_compliance"
            referencedColumns: ["shipment_id"]
          },
        ]
      }
      payroll_data_export: {
        Row: {
          amo_employee_part: number
          amo_employer_part: number
          bonuses_mad: number
          cnss_employee_part: number
          cnss_employer_part: number
          company_id: string
          created_at: string
          deductions_mad: number
          deleted_at: string | null
          driver_id: string
          family_allowance: number
          gross_salary_mad: number
          id: string
          ir_amount: number
          missions_count: number
          net_salary_mad: number
          notes: string | null
          overtime_hours: number
          payment_date: string | null
          period_month: string
          status: string
          total_km_driven: number
          updated_at: string
          validated_at: string | null
          validated_by_user_id: string | null
          vocational_training: number
          working_days: number
        }
        Insert: {
          amo_employee_part?: number
          amo_employer_part?: number
          bonuses_mad?: number
          cnss_employee_part?: number
          cnss_employer_part?: number
          company_id: string
          created_at?: string
          deductions_mad?: number
          deleted_at?: string | null
          driver_id: string
          family_allowance?: number
          gross_salary_mad?: number
          id?: string
          ir_amount?: number
          missions_count?: number
          net_salary_mad?: number
          notes?: string | null
          overtime_hours?: number
          payment_date?: string | null
          period_month: string
          status?: string
          total_km_driven?: number
          updated_at?: string
          validated_at?: string | null
          validated_by_user_id?: string | null
          vocational_training?: number
          working_days?: number
        }
        Update: {
          amo_employee_part?: number
          amo_employer_part?: number
          bonuses_mad?: number
          cnss_employee_part?: number
          cnss_employer_part?: number
          company_id?: string
          created_at?: string
          deductions_mad?: number
          deleted_at?: string | null
          driver_id?: string
          family_allowance?: number
          gross_salary_mad?: number
          id?: string
          ir_amount?: number
          missions_count?: number
          net_salary_mad?: number
          notes?: string | null
          overtime_hours?: number
          payment_date?: string | null
          period_month?: string
          status?: string
          total_km_driven?: number
          updated_at?: string
          validated_at?: string | null
          validated_by_user_id?: string | null
          vocational_training?: number
          working_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_data_export_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_data_export_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_data_export_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "v_driver_current_vehicle"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "payroll_data_export_validated_by_user_id_fkey"
            columns: ["validated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_defaults: {
        Row: {
          base_fee: number
          company_id: string
          created_at: string
          id: string
          price_per_km: number
          updated_at: string
          urgency_surcharge_pct: number
          urgency_threshold_hours: number
          vat_rate: number
        }
        Insert: {
          base_fee?: number
          company_id: string
          created_at?: string
          id?: string
          price_per_km?: number
          updated_at?: string
          urgency_surcharge_pct?: number
          urgency_threshold_hours?: number
          vat_rate?: number
        }
        Update: {
          base_fee?: number
          company_id?: string
          created_at?: string
          id?: string
          price_per_km?: number
          updated_at?: string
          urgency_surcharge_pct?: number
          urgency_threshold_hours?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_defaults_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_schedules: {
        Row: {
          client_id: string
          company_id: string
          created_at: string
          created_by_user_id: string | null
          days_of_week: number[]
          default_driver_id: string | null
          default_vehicle_id: string | null
          default_vehicle_type: string | null
          deleted_at: string | null
          delivery_city: string
          delivery_contact_name: string | null
          delivery_contact_phone: string | null
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_offset_minutes: number | null
          delivery_postal_code: string | null
          delivery_street: string
          id: string
          is_active: boolean
          last_generated_at: string | null
          last_generated_count: number | null
          last_generated_through: string | null
          name: string
          notes: string | null
          pickup_city: string
          pickup_contact_name: string | null
          pickup_contact_phone: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_postal_code: string | null
          pickup_street: string
          pickup_time: string
          updated_at: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          client_id: string
          company_id: string
          created_at?: string
          created_by_user_id?: string | null
          days_of_week: number[]
          default_driver_id?: string | null
          default_vehicle_id?: string | null
          default_vehicle_type?: string | null
          deleted_at?: string | null
          delivery_city: string
          delivery_contact_name?: string | null
          delivery_contact_phone?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_offset_minutes?: number | null
          delivery_postal_code?: string | null
          delivery_street: string
          id?: string
          is_active?: boolean
          last_generated_at?: string | null
          last_generated_count?: number | null
          last_generated_through?: string | null
          name: string
          notes?: string | null
          pickup_city: string
          pickup_contact_name?: string | null
          pickup_contact_phone?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_postal_code?: string | null
          pickup_street: string
          pickup_time?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string
          created_by_user_id?: string | null
          days_of_week?: number[]
          default_driver_id?: string | null
          default_vehicle_id?: string | null
          default_vehicle_type?: string | null
          deleted_at?: string | null
          delivery_city?: string
          delivery_contact_name?: string | null
          delivery_contact_phone?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_offset_minutes?: number | null
          delivery_postal_code?: string | null
          delivery_street?: string
          id?: string
          is_active?: boolean
          last_generated_at?: string | null
          last_generated_count?: number | null
          last_generated_through?: string | null
          name?: string
          notes?: string | null
          pickup_city?: string
          pickup_contact_name?: string | null
          pickup_contact_phone?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_postal_code?: string | null
          pickup_street?: string
          pickup_time?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_schedules_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_schedules_default_driver_id_fkey"
            columns: ["default_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_schedules_default_driver_id_fkey"
            columns: ["default_driver_id"]
            isOneToOne: false
            referencedRelation: "v_driver_current_vehicle"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "recurring_schedules_default_vehicle_id_fkey"
            columns: ["default_vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_driver_current_vehicle"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "recurring_schedules_default_vehicle_id_fkey"
            columns: ["default_vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_fleet_compliance"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "recurring_schedules_default_vehicle_id_fkey"
            columns: ["default_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_counters: {
        Row: {
          company_id: string
          last_value: number
          type: string
          year: number
        }
        Insert: {
          company_id: string
          last_value?: number
          type: string
          year: number
        }
        Update: {
          company_id?: string
          last_value?: number
          type?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "sequence_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_customs_documents: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          document_date: string | null
          document_number: string | null
          document_type_id: string
          file_name: string
          file_size_bytes: number
          id: string
          mime_type: string
          notes: string | null
          shipment_id: string
          storage_path: string
          updated_at: string
          uploaded_by_user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          document_date?: string | null
          document_number?: string | null
          document_type_id: string
          file_name: string
          file_size_bytes: number
          id?: string
          mime_type: string
          notes?: string | null
          shipment_id: string
          storage_path: string
          updated_at?: string
          uploaded_by_user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          document_date?: string | null
          document_number?: string | null
          document_type_id?: string
          file_name?: string
          file_size_bytes?: number
          id?: string
          mime_type?: string
          notes?: string | null
          shipment_id?: string
          storage_path?: string
          updated_at?: string
          uploaded_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_customs_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_customs_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "customs_document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_customs_documents_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_customs_documents_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "v_jit_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_customs_documents_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "v_shipment_customs_compliance"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "shipment_customs_documents_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_documents: {
        Row: {
          company_id: string
          created_at: string
          file_name: string | null
          file_size_bytes: number | null
          file_url: string
          id: string
          mime_type: string | null
          shipment_id: string
          type: string
          uploaded_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          file_name?: string | null
          file_size_bytes?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          shipment_id: string
          type: string
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          file_name?: string | null
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          shipment_id?: string
          type?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_documents_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_documents_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "v_jit_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_documents_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "v_shipment_customs_compliance"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "shipment_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_status_history: {
        Row: {
          changed_by: string | null
          company_id: string
          created_at: string
          id: string
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          shipment_id: string
          status: string
        }
        Insert: {
          changed_by?: string | null
          company_id: string
          created_at?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          shipment_id: string
          status: string
        }
        Update: {
          changed_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          shipment_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_status_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_status_history_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_status_history_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "v_jit_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_status_history_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "v_shipment_customs_compliance"
            referencedColumns: ["shipment_id"]
          },
        ]
      }
      shipments: {
        Row: {
          assigned_driver_id: string | null
          assigned_vehicle_id: string | null
          client_id: string
          cmr_document_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          created_from_schedule_id: string | null
          customs_declaration_value: number | null
          customs_hs_code: string | null
          customs_notes: string | null
          deleted_at: string | null
          delivery_actual_at: string | null
          delivery_city: string
          delivery_contact_name: string | null
          delivery_contact_phone: string | null
          delivery_country: string
          delivery_deadline_at: string | null
          delivery_free_zone_id: string | null
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_notes: string | null
          delivery_postal_code: string | null
          delivery_region: string | null
          delivery_scheduled_at: string | null
          delivery_street: string
          description: string | null
          distance_km: number | null
          fragile: boolean
          goods_value: number | null
          id: string
          invoice_id: string | null
          is_international: boolean
          is_jit: boolean
          is_urgent: boolean
          late_penalty_mad: number | null
          late_penalty_per_hour_mad: number | null
          late_tolerance_minutes: number | null
          lateness_computed_at: string | null
          lateness_minutes: number | null
          manual_price_override: number | null
          pickup_actual_at: string | null
          pickup_city: string
          pickup_contact_name: string | null
          pickup_contact_phone: string | null
          pickup_country: string
          pickup_free_zone_id: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_notes: string | null
          pickup_postal_code: string | null
          pickup_region: string | null
          pickup_scheduled_at: string | null
          pickup_street: string
          price_excl_tax: number | null
          price_incl_tax: number | null
          pricing_snapshot: Json | null
          reference: string
          scheduled_run_date: string | null
          status: string
          subcontracted_mission_id: string | null
          tax_amount: number | null
          updated_at: string
          volume_m3: number | null
          weight_kg: number | null
        }
        Insert: {
          assigned_driver_id?: string | null
          assigned_vehicle_id?: string | null
          client_id: string
          cmr_document_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          created_from_schedule_id?: string | null
          customs_declaration_value?: number | null
          customs_hs_code?: string | null
          customs_notes?: string | null
          deleted_at?: string | null
          delivery_actual_at?: string | null
          delivery_city: string
          delivery_contact_name?: string | null
          delivery_contact_phone?: string | null
          delivery_country?: string
          delivery_deadline_at?: string | null
          delivery_free_zone_id?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_notes?: string | null
          delivery_postal_code?: string | null
          delivery_region?: string | null
          delivery_scheduled_at?: string | null
          delivery_street: string
          description?: string | null
          distance_km?: number | null
          fragile?: boolean
          goods_value?: number | null
          id?: string
          invoice_id?: string | null
          is_international?: boolean
          is_jit?: boolean
          is_urgent?: boolean
          late_penalty_mad?: number | null
          late_penalty_per_hour_mad?: number | null
          late_tolerance_minutes?: number | null
          lateness_computed_at?: string | null
          lateness_minutes?: number | null
          manual_price_override?: number | null
          pickup_actual_at?: string | null
          pickup_city: string
          pickup_contact_name?: string | null
          pickup_contact_phone?: string | null
          pickup_country?: string
          pickup_free_zone_id?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_notes?: string | null
          pickup_postal_code?: string | null
          pickup_region?: string | null
          pickup_scheduled_at?: string | null
          pickup_street: string
          price_excl_tax?: number | null
          price_incl_tax?: number | null
          pricing_snapshot?: Json | null
          reference: string
          scheduled_run_date?: string | null
          status?: string
          subcontracted_mission_id?: string | null
          tax_amount?: number | null
          updated_at?: string
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Update: {
          assigned_driver_id?: string | null
          assigned_vehicle_id?: string | null
          client_id?: string
          cmr_document_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          created_from_schedule_id?: string | null
          customs_declaration_value?: number | null
          customs_hs_code?: string | null
          customs_notes?: string | null
          deleted_at?: string | null
          delivery_actual_at?: string | null
          delivery_city?: string
          delivery_contact_name?: string | null
          delivery_contact_phone?: string | null
          delivery_country?: string
          delivery_deadline_at?: string | null
          delivery_free_zone_id?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_notes?: string | null
          delivery_postal_code?: string | null
          delivery_region?: string | null
          delivery_scheduled_at?: string | null
          delivery_street?: string
          description?: string | null
          distance_km?: number | null
          fragile?: boolean
          goods_value?: number | null
          id?: string
          invoice_id?: string | null
          is_international?: boolean
          is_jit?: boolean
          is_urgent?: boolean
          late_penalty_mad?: number | null
          late_penalty_per_hour_mad?: number | null
          late_tolerance_minutes?: number | null
          lateness_computed_at?: string | null
          lateness_minutes?: number | null
          manual_price_override?: number | null
          pickup_actual_at?: string | null
          pickup_city?: string
          pickup_contact_name?: string | null
          pickup_contact_phone?: string | null
          pickup_country?: string
          pickup_free_zone_id?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_notes?: string | null
          pickup_postal_code?: string | null
          pickup_region?: string | null
          pickup_scheduled_at?: string | null
          pickup_street?: string
          price_excl_tax?: number | null
          price_incl_tax?: number | null
          pricing_snapshot?: Json | null
          reference?: string
          scheduled_run_date?: string | null
          status?: string
          subcontracted_mission_id?: string | null
          tax_amount?: number | null
          updated_at?: string
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_shipments_invoice"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_shipments_invoice"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_overdue_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "v_driver_current_vehicle"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "shipments_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_driver_current_vehicle"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "shipments_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_fleet_compliance"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "shipments_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_cmr_document_id_fkey"
            columns: ["cmr_document_id"]
            isOneToOne: false
            referencedRelation: "cmr_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_created_from_schedule_id_fkey"
            columns: ["created_from_schedule_id"]
            isOneToOne: false
            referencedRelation: "recurring_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_delivery_free_zone_id_fkey"
            columns: ["delivery_free_zone_id"]
            isOneToOne: false
            referencedRelation: "free_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_pickup_free_zone_id_fkey"
            columns: ["pickup_free_zone_id"]
            isOneToOne: false
            referencedRelation: "free_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_subcontracted_mission_id_fkey"
            columns: ["subcontracted_mission_id"]
            isOneToOne: false
            referencedRelation: "subcontracted_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontracted_missions: {
        Row: {
          accepted_at: string | null
          company_id: string
          completed_at: string | null
          cost_excl_tax: number
          created_at: string
          created_by_user_id: string | null
          currency: string
          deleted_at: string | null
          id: string
          internal_notes: string | null
          margin_excl_tax: number | null
          margin_pct: number | null
          mission_order_number: string
          mission_order_pdf_path: string | null
          notes: string | null
          sale_excl_tax: number
          sent_at: string | null
          sent_to: string | null
          sent_via: string | null
          shipment_id: string
          status: string
          subcontractor_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          completed_at?: string | null
          cost_excl_tax: number
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          deleted_at?: string | null
          id?: string
          internal_notes?: string | null
          margin_excl_tax?: number | null
          margin_pct?: number | null
          mission_order_number: string
          mission_order_pdf_path?: string | null
          notes?: string | null
          sale_excl_tax: number
          sent_at?: string | null
          sent_to?: string | null
          sent_via?: string | null
          shipment_id: string
          status?: string
          subcontractor_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          completed_at?: string | null
          cost_excl_tax?: number
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          deleted_at?: string | null
          id?: string
          internal_notes?: string | null
          margin_excl_tax?: number | null
          margin_pct?: number | null
          mission_order_number?: string
          mission_order_pdf_path?: string | null
          notes?: string | null
          sale_excl_tax?: number
          sent_at?: string | null
          sent_to?: string | null
          sent_via?: string | null
          shipment_id?: string
          status?: string
          subcontractor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcontracted_missions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontracted_missions_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontracted_missions_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontracted_missions_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "v_jit_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontracted_missions_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "v_shipment_customs_compliance"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "subcontracted_missions_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "subcontractors"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractors: {
        Row: {
          address: string | null
          bank_iban: string | null
          bank_name: string | null
          bank_swift: string | null
          capacity_kg: number | null
          city: string | null
          cnss_number: string | null
          company_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by_user_id: string | null
          deleted_at: string | null
          ice: string | null
          id: string
          is_active: boolean
          legal_form: string | null
          name: string
          notes: string | null
          payment_terms_days: number
          postal_code: string | null
          rating: number | null
          rating_count: number
          rc_number: string | null
          service_areas: string[]
          tax_id: string | null
          updated_at: string
          vehicle_types: string[]
          whatsapp_phone: string | null
        }
        Insert: {
          address?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          capacity_kg?: number | null
          city?: string | null
          cnss_number?: string | null
          company_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          ice?: string | null
          id?: string
          is_active?: boolean
          legal_form?: string | null
          name: string
          notes?: string | null
          payment_terms_days?: number
          postal_code?: string | null
          rating?: number | null
          rating_count?: number
          rc_number?: string | null
          service_areas?: string[]
          tax_id?: string | null
          updated_at?: string
          vehicle_types?: string[]
          whatsapp_phone?: string | null
        }
        Update: {
          address?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          capacity_kg?: number | null
          city?: string | null
          cnss_number?: string | null
          company_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          ice?: string | null
          id?: string
          is_active?: boolean
          legal_form?: string | null
          name?: string
          notes?: string | null
          payment_terms_days?: number
          postal_code?: string | null
          rating?: number | null
          rating_count?: number
          rc_number?: string | null
          service_areas?: string[]
          tax_id?: string | null
          updated_at?: string
          vehicle_types?: string[]
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcontractors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractors_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoices: {
        Row: {
          accounting_document_id: string | null
          amount_paid: number
          balance_due: number | null
          company_id: string
          created_at: string
          created_by_user_id: string | null
          deleted_at: string | null
          due_date: string | null
          id: string
          invoice_number: string
          issued_at: string
          notes: string | null
          status: string
          supplier_id: string
          total_excl_tax: number
          total_incl_tax: number | null
          updated_at: string
          vat_amount: number
        }
        Insert: {
          accounting_document_id?: string | null
          amount_paid?: number
          balance_due?: number | null
          company_id: string
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          issued_at: string
          notes?: string | null
          status?: string
          supplier_id: string
          total_excl_tax?: number
          total_incl_tax?: number | null
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          accounting_document_id?: string | null
          amount_paid?: number
          balance_due?: number | null
          company_id?: string
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string
          notes?: string | null
          status?: string
          supplier_id?: string
          total_excl_tax?: number
          total_incl_tax?: number | null
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_accounting_document_id_fkey"
            columns: ["accounting_document_id"]
            isOneToOne: false
            referencedRelation: "accounting_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount_mad: number
          company_id: string
          created_at: string
          created_by_user_id: string | null
          id: string
          method: string
          notes: string | null
          paid_at: string
          reference: string | null
          supplier_invoice_id: string
        }
        Insert: {
          amount_mad: number
          company_id: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          method: string
          notes?: string | null
          paid_at?: string
          reference?: string | null
          supplier_invoice_id: string
        }
        Update: {
          amount_mad?: number
          company_id?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          reference?: string | null
          supplier_invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          bank_iban: string | null
          bank_name: string | null
          bank_swift: string | null
          category: string
          city: string | null
          company_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by_user_id: string | null
          deleted_at: string | null
          ice: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          payment_terms_days: number
          postal_code: string | null
          rc_number: string | null
          tax_id: string | null
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          address?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          category: string
          city?: string | null
          company_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          ice?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          payment_terms_days?: number
          postal_code?: string | null
          rc_number?: string | null
          tax_id?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          address?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          category?: string
          city?: string | null
          company_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          ice?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          payment_terms_days?: number
          postal_code?: string | null
          rc_number?: string | null
          tax_id?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_declarations: {
        Row: {
          amount_due: number
          amount_paid: number | null
          company_id: string
          computed_snapshot: Json | null
          created_at: string
          declaration_date: string | null
          declaration_reference: string | null
          declaration_type: string
          declared_by_user_id: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          payment_date: string | null
          period_month: string
          period_quarter: number | null
          status: string
          supporting_documents: Json
          updated_at: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number | null
          company_id: string
          computed_snapshot?: Json | null
          created_at?: string
          declaration_date?: string | null
          declaration_reference?: string | null
          declaration_type: string
          declared_by_user_id?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          period_month: string
          period_quarter?: number | null
          status?: string
          supporting_documents?: Json
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number | null
          company_id?: string
          computed_snapshot?: Json | null
          created_at?: string
          declaration_date?: string | null
          declaration_reference?: string | null
          declaration_type?: string
          declared_by_user_id?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          period_month?: string
          period_quarter?: number | null
          status?: string
          supporting_documents?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_declarations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_declarations_declared_by_user_id_fkey"
            columns: ["declared_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      toll_transactions: {
        Row: {
          accounting_document_id: string | null
          amount_mad: number
          company_id: string
          created_at: string
          created_by_user_id: string | null
          id: string
          kind: string
          notes: string | null
          occurred_at: string
          reference: string | null
          shipment_id: string | null
          station: string | null
          vehicle_id: string
          vehicle_pass_id: string
        }
        Insert: {
          accounting_document_id?: string | null
          amount_mad: number
          company_id: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          kind?: string
          notes?: string | null
          occurred_at?: string
          reference?: string | null
          shipment_id?: string | null
          station?: string | null
          vehicle_id: string
          vehicle_pass_id: string
        }
        Update: {
          accounting_document_id?: string | null
          amount_mad?: number
          company_id?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          kind?: string
          notes?: string | null
          occurred_at?: string
          reference?: string | null
          shipment_id?: string | null
          station?: string | null
          vehicle_id?: string
          vehicle_pass_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "toll_transactions_accounting_document_id_fkey"
            columns: ["accounting_document_id"]
            isOneToOne: false
            referencedRelation: "accounting_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toll_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toll_transactions_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toll_transactions_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toll_transactions_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "v_jit_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toll_transactions_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "v_shipment_customs_compliance"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "toll_transactions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_driver_current_vehicle"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "toll_transactions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_fleet_compliance"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "toll_transactions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toll_transactions_vehicle_pass_id_fkey"
            columns: ["vehicle_pass_id"]
            isOneToOne: false
            referencedRelation: "vehicle_passes"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          phone: string | null
          preferred_language: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          last_login_at?: string | null
          phone?: string | null
          preferred_language?: string
          role: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          phone?: string | null
          preferred_language?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_maintenance_records: {
        Row: {
          company_id: string
          cost: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          mileage_at_service: number | null
          next_due_at: string | null
          notes: string | null
          performed_at: string
          type: string
          vehicle_id: string
        }
        Insert: {
          company_id: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          mileage_at_service?: number | null
          next_due_at?: string | null
          notes?: string | null
          performed_at: string
          type: string
          vehicle_id: string
        }
        Update: {
          company_id?: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          mileage_at_service?: number | null
          next_due_at?: string | null
          notes?: string | null
          performed_at?: string
          type?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenance_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_driver_current_vehicle"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_fleet_compliance"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_passes: {
        Row: {
          company_id: string
          created_at: string
          created_by_user_id: string | null
          current_balance_mad: number
          deleted_at: string | null
          device_serial: string | null
          id: string
          is_active: boolean
          low_balance_threshold_mad: number
          notes: string | null
          provider: string
          tag_number: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by_user_id?: string | null
          current_balance_mad?: number
          deleted_at?: string | null
          device_serial?: string | null
          id?: string
          is_active?: boolean
          low_balance_threshold_mad?: number
          notes?: string | null
          provider: string
          tag_number: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by_user_id?: string | null
          current_balance_mad?: number
          deleted_at?: string | null
          device_serial?: string | null
          id?: string
          is_active?: boolean
          low_balance_threshold_mad?: number
          notes?: string | null
          provider?: string
          tag_number?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_passes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_passes_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_passes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_driver_current_vehicle"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_passes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_fleet_compliance"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_passes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string
          color: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
          id: string
          insurance_expiry: string | null
          insurance_number: string | null
          is_active: boolean
          is_available: boolean
          last_maintenance_date: string | null
          max_weight_kg: number | null
          mileage_km: number
          model: string
          next_maintenance_date: string | null
          notes: string | null
          plate_number: string
          registration_expiry: string | null
          type: string
          updated_at: string
          vin: string | null
          volume_m3: number | null
          year: number | null
        }
        Insert: {
          brand: string
          color?: string | null
          company_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          insurance_expiry?: string | null
          insurance_number?: string | null
          is_active?: boolean
          is_available?: boolean
          last_maintenance_date?: string | null
          max_weight_kg?: number | null
          mileage_km?: number
          model: string
          next_maintenance_date?: string | null
          notes?: string | null
          plate_number: string
          registration_expiry?: string | null
          type: string
          updated_at?: string
          vin?: string | null
          volume_m3?: number | null
          year?: number | null
        }
        Update: {
          brand?: string
          color?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          insurance_expiry?: string | null
          insurance_number?: string | null
          is_active?: boolean
          is_available?: boolean
          last_maintenance_date?: string | null
          max_weight_kg?: number | null
          mileage_km?: number
          model?: string
          next_maintenance_date?: string | null
          notes?: string | null
          plate_number?: string
          registration_expiry?: string | null
          type?: string
          updated_at?: string
          vin?: string | null
          volume_m3?: number | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vignettes: {
        Row: {
          accounting_document_id: string | null
          amount_mad: number | null
          company_id: string
          created_at: string
          created_by_user_id: string | null
          deleted_at: string | null
          expires_at: string
          id: string
          issued_at: string
          kind: string
          notes: string | null
          reference: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          accounting_document_id?: string | null
          amount_mad?: number | null
          company_id: string
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          expires_at: string
          id?: string
          issued_at: string
          kind: string
          notes?: string | null
          reference?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          accounting_document_id?: string | null
          amount_mad?: number | null
          company_id?: string
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          expires_at?: string
          id?: string
          issued_at?: string
          kind?: string
          notes?: string | null
          reference?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vignettes_accounting_document_id_fkey"
            columns: ["accounting_document_id"]
            isOneToOne: false
            referencedRelation: "accounting_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vignettes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vignettes_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vignettes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_driver_current_vehicle"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vignettes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_fleet_compliance"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vignettes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_send_log: {
        Row: {
          audience: string
          body_rendered: string
          client_id: string | null
          company_id: string
          driver_id: string | null
          id: string
          recipient_name: string | null
          recipient_phone: string
          sent_at: string
          sent_by_user_id: string | null
          shipment_id: string | null
          subcontractor_id: string | null
          template_id: string | null
          template_key: string | null
        }
        Insert: {
          audience: string
          body_rendered: string
          client_id?: string | null
          company_id: string
          driver_id?: string | null
          id?: string
          recipient_name?: string | null
          recipient_phone: string
          sent_at?: string
          sent_by_user_id?: string | null
          shipment_id?: string | null
          subcontractor_id?: string | null
          template_id?: string | null
          template_key?: string | null
        }
        Update: {
          audience?: string
          body_rendered?: string
          client_id?: string | null
          company_id?: string
          driver_id?: string | null
          id?: string
          recipient_name?: string | null
          recipient_phone?: string
          sent_at?: string
          sent_by_user_id?: string | null
          shipment_id?: string | null
          subcontractor_id?: string | null
          template_id?: string | null
          template_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_send_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_send_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_send_log_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_send_log_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "v_driver_current_vehicle"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "whatsapp_send_log_sent_by_user_id_fkey"
            columns: ["sent_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_send_log_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_send_log_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "v_jit_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_send_log_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "v_shipment_customs_compliance"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "whatsapp_send_log_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "subcontractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_send_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          audience: string
          body: string
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          audience: string
          body: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      work_sessions: {
        Row: {
          blockers: string | null
          check_in_accuracy: number | null
          check_in_at: string
          check_in_lat: number | null
          check_in_lng: number | null
          check_out_accuracy: number | null
          check_out_at: string | null
          check_out_lat: number | null
          check_out_lng: number | null
          company_id: string
          completed_tasks: Json
          created_at: string
          id: string
          incomplete_tasks: Json
          motiv_rating: number | null
          notes: string | null
          prod_rating: number | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          blockers?: string | null
          check_in_accuracy?: number | null
          check_in_at?: string
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_out_accuracy?: number | null
          check_out_at?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          company_id: string
          completed_tasks?: Json
          created_at?: string
          id?: string
          incomplete_tasks?: Json
          motiv_rating?: number | null
          notes?: string | null
          prod_rating?: number | null
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          blockers?: string | null
          check_in_accuracy?: number | null
          check_in_at?: string
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_out_accuracy?: number | null
          check_out_at?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          company_id?: string
          completed_tasks?: Json
          created_at?: string
          id?: string
          incomplete_tasks?: Json
          motiv_rating?: number | null
          notes?: string | null
          prod_rating?: number | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_driver_current_vehicle: {
        Row: {
          assigned_at: string | null
          average_rating: number | null
          brand: string | null
          company_id: string | null
          driver_id: string | null
          driver_name: string | null
          is_available: boolean | null
          model: string | null
          on_time_delivery_rate: number | null
          phone: string | null
          plate_number: string | null
          total_deliveries: number | null
          vehicle_id: string | null
          vehicle_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      v_fleet_compliance: {
        Row: {
          annual_expires_at: string | null
          company_id: string | null
          earliest_expiring_within_30d: string | null
          insurance_expires_at: string | null
          is_active: boolean | null
          pass_low_balance: boolean | null
          plate_number: string | null
          tax_disc_expires_at: string | null
          vehicle_id: string | null
          visite_expires_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      v_inbox_unified: {
        Row: {
          actor_user_id: string | null
          audience: string | null
          body: string | null
          client_id: string | null
          company_id: string | null
          direction: string | null
          driver_id: string | null
          error_message: string | null
          feed_id: string | null
          invoice_id: string | null
          kind: string | null
          occurred_at: string | null
          recipient: string | null
          recipient_name: string | null
          shipment_id: string | null
          source_id: string | null
          status: string | null
          subcontractor_id: string | null
          subject: string | null
          template_key: string | null
        }
        Relationships: []
      }
      v_jit_at_risk: {
        Row: {
          assigned_driver_id: string | null
          assigned_vehicle_id: string | null
          client_id: string | null
          client_name: string | null
          company_id: string | null
          delivery_city: string | null
          delivery_deadline_at: string | null
          delivery_scheduled_at: string | null
          id: string | null
          late_penalty_per_hour_mad: number | null
          late_tolerance_minutes: number | null
          minutes_late_now: number | null
          pickup_city: string | null
          reference: string | null
          risk_band: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "v_driver_current_vehicle"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "shipments_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_driver_current_vehicle"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "shipments_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_fleet_compliance"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "shipments_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      v_overdue_invoices: {
        Row: {
          amount_paid: number | null
          balance_due: number | null
          client_id: string | null
          client_name: string | null
          company_id: string | null
          contact_email: string | null
          days_overdue: number | null
          due_at: string | null
          id: string | null
          invoice_number: string | null
          total_incl_tax: number | null
          whatsapp_phone: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      v_shipment_customs_compliance: {
        Row: {
          company_id: string | null
          compliance_status: string | null
          required_count: number | null
          shipment_id: string | null
          uploaded_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      v_shipment_kpis: {
        Row: {
          active_shipments: number | null
          company_id: string | null
          delivered_this_month: number | null
          on_time_rate_pct: number | null
          revenue_this_month: number | null
          shipments_this_month: number | null
          shipments_this_week: number | null
          shipments_today: number | null
          total_all_time: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_client_id: { Args: never; Returns: string }
      current_company_id: { Args: never; Returns: string }
      current_driver_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      generate_recurring_shipments: {
        Args: {
          p_company_id: string
          p_window_end: string
          p_window_start: string
        }
        Returns: number
      }
      has_any_role: { Args: { roles: string[] }; Returns: boolean }
      is_team_member: { Args: { _user_id: string }; Returns: boolean }
      mark_overdue_invoices: { Args: never; Returns: number }
      next_sequence_value: {
        Args: { p_company_id: string; p_type: string }
        Returns: number
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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

// ============================================================
// Hand-written union types live in app.types.ts so they survive
// `supabase gen types typescript --linked`. Re-exported here for
// backward compatibility with existing imports.
// ============================================================
export type {
  UserRole,
  ShipmentStatus,
  InvoiceStatus,
  BillingMode,
  VehicleType,
  NotificationChannel,
  NotificationStatus,
  AccountantDeliveryMethod,
  MonthlyDossierStatus,
  AccountingDocumentCategory,
  AccountingDocumentStatus,
  AccountingFileType,
  AccountingPaymentMethod,
  AccountingAuditAction,
  AccountingAuditEntity,
  CmrStatus,
  CmrPayer,
  TaxDeclarationType,
  TaxDeclarationStatus,
  PayrollStatus,
  ClientContractStatus,
  ClientContractBillingMode,
  BlFieldType,
  RecurringScheduleVehicleType,
  SubcontractedMissionStatus,
  WhatsappAudience,
  SupplierCategory,
  SupplierInvoiceStatus,
  PassProvider,
  TollKind,
  VignetteKind,
} from './app.types'
