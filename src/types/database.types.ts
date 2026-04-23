// Auto-generated types for TMS Logistique Supabase schema.
// Regenerate with: npm run db:types
// DO NOT EDIT manually except to add helper types at the bottom.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type UserRole = 'super_admin' | 'company_admin' | 'dispatcher' | 'driver' | 'client'
export type ShipmentStatus = 'created' | 'assigned' | 'picked_up' | 'in_transit' | 'customs_clearance' | 'delivered' | 'failed' | 'cancelled'
export type BillingMode = 'per_shipment' | 'monthly_grouped'
export type InvoiceStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
export type VehicleType = 'motorcycle' | 'van' | 'truck' | 'pickup'
export type DocumentType = 'pod_photo' | 'pod_signature' | 'customs_doc' | 'other'
export type NotificationChannel = 'email' | 'whatsapp' | 'sms'
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'skipped'
export type PaymentMethod = 'bank_transfer' | 'check' | 'cash'

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          address: string | null
          city: string | null
          country: string
          phone: string | null
          email: string | null
          tax_id: string | null
          vat_number: string | null
          bank_iban: string | null
          bank_swift: string | null
          default_currency: string
          timezone: string
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          address?: string | null
          city?: string | null
          country?: string
          phone?: string | null
          email?: string | null
          tax_id?: string | null
          vat_number?: string | null
          bank_iban?: string | null
          bank_swift?: string | null
          default_currency?: string
          timezone?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          address?: string | null
          city?: string | null
          country?: string
          phone?: string | null
          email?: string | null
          tax_id?: string | null
          vat_number?: string | null
          bank_iban?: string | null
          bank_swift?: string | null
          default_currency?: string
          timezone?: string
          is_active?: boolean
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          company_id: string | null
          role: UserRole
          full_name: string
          email: string
          phone: string | null
          avatar_url: string | null
          preferred_language: 'fr' | 'ar'
          is_active: boolean
          last_login_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          company_id?: string | null
          role: UserRole
          full_name: string
          email: string
          phone?: string | null
          avatar_url?: string | null
          preferred_language?: 'fr' | 'ar'
          is_active?: boolean
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          company_id?: string | null
          role?: UserRole
          full_name?: string
          email?: string
          phone?: string | null
          avatar_url?: string | null
          preferred_language?: 'fr' | 'ar'
          is_active?: boolean
          last_login_at?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          { foreignKeyName: 'users_id_fkey'; columns: ['id']; referencedRelation: 'users'; referencedColumns: ['id'] },
          { foreignKeyName: 'users_company_id_fkey'; columns: ['company_id']; referencedRelation: 'companies'; referencedColumns: ['id'] }
        ]
      }
      clients: {
        Row: {
          id: string
          company_id: string
          user_id: string | null
          business_name: string
          contact_name: string
          contact_email: string
          contact_phone: string
          whatsapp_phone: string | null
          address: string | null
          city: string | null
          country: string
          tax_id: string | null
          billing_mode: BillingMode
          payment_terms_days: number
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          user_id?: string | null
          business_name: string
          contact_name: string
          contact_email: string
          contact_phone: string
          whatsapp_phone?: string | null
          address?: string | null
          city?: string | null
          country?: string
          tax_id?: string | null
          billing_mode?: BillingMode
          payment_terms_days?: number
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          company_id?: string
          user_id?: string | null
          business_name?: string
          contact_name?: string
          contact_email?: string
          contact_phone?: string
          whatsapp_phone?: string | null
          address?: string | null
          city?: string | null
          country?: string
          tax_id?: string | null
          billing_mode?: BillingMode
          payment_terms_days?: number
          notes?: string | null
          is_active?: boolean
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          { foreignKeyName: 'clients_company_id_fkey'; columns: ['company_id']; referencedRelation: 'companies'; referencedColumns: ['id'] },
          { foreignKeyName: 'clients_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id'] }
        ]
      }
      drivers: {
        Row: {
          id: string
          company_id: string
          user_id: string | null
          full_name: string
          phone: string
          whatsapp_phone: string | null
          license_number: string
          license_expiry: string
          cin_number: string
          cin_expiry: string | null
          monthly_salary: number | null
          is_available: boolean
          total_deliveries: number
          on_time_delivery_count: number
          on_time_delivery_rate: number
          average_rating: number
          total_km_driven: number
          avatar_url: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          user_id?: string | null
          full_name: string
          phone: string
          whatsapp_phone?: string | null
          license_number: string
          license_expiry: string
          cin_number: string
          cin_expiry?: string | null
          monthly_salary?: number | null
          is_available?: boolean
          total_deliveries?: number
          on_time_delivery_count?: number
          on_time_delivery_rate?: number
          average_rating?: number
          total_km_driven?: number
          avatar_url?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          company_id?: string
          user_id?: string | null
          full_name?: string
          phone?: string
          whatsapp_phone?: string | null
          license_number?: string
          license_expiry?: string
          cin_number?: string
          cin_expiry?: string | null
          monthly_salary?: number | null
          is_available?: boolean
          total_deliveries?: number
          on_time_delivery_count?: number
          on_time_delivery_rate?: number
          average_rating?: number
          total_km_driven?: number
          avatar_url?: string | null
          notes?: string | null
          is_active?: boolean
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          { foreignKeyName: 'drivers_company_id_fkey'; columns: ['company_id']; referencedRelation: 'companies'; referencedColumns: ['id'] },
          { foreignKeyName: 'drivers_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id'] }
        ]
      }
      vehicles: {
        Row: {
          id: string
          company_id: string
          plate_number: string
          brand: string
          model: string
          year: number | null
          type: VehicleType
          max_weight_kg: number | null
          volume_m3: number | null
          color: string | null
          vin: string | null
          insurance_number: string | null
          insurance_expiry: string | null
          registration_expiry: string | null
          last_maintenance_date: string | null
          next_maintenance_date: string | null
          mileage_km: number
          is_available: boolean
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          plate_number: string
          brand: string
          model: string
          year?: number | null
          type: VehicleType
          max_weight_kg?: number | null
          volume_m3?: number | null
          color?: string | null
          vin?: string | null
          insurance_number?: string | null
          insurance_expiry?: string | null
          registration_expiry?: string | null
          last_maintenance_date?: string | null
          next_maintenance_date?: string | null
          mileage_km?: number
          is_available?: boolean
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          company_id?: string
          plate_number?: string
          brand?: string
          model?: string
          year?: number | null
          type?: VehicleType
          max_weight_kg?: number | null
          volume_m3?: number | null
          color?: string | null
          vin?: string | null
          insurance_number?: string | null
          insurance_expiry?: string | null
          registration_expiry?: string | null
          last_maintenance_date?: string | null
          next_maintenance_date?: string | null
          mileage_km?: number
          is_available?: boolean
          notes?: string | null
          is_active?: boolean
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          { foreignKeyName: 'vehicles_company_id_fkey'; columns: ['company_id']; referencedRelation: 'companies'; referencedColumns: ['id'] }
        ]
      }
      driver_vehicle_assignments: {
        Row: {
          id: string
          company_id: string
          driver_id: string
          vehicle_id: string
          assigned_at: string
          unassigned_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          driver_id: string
          vehicle_id: string
          assigned_at?: string
          unassigned_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          unassigned_at?: string | null
          notes?: string | null
        }
        Relationships: [
          { foreignKeyName: 'dva_company_id_fkey'; columns: ['company_id']; referencedRelation: 'companies'; referencedColumns: ['id'] },
          { foreignKeyName: 'dva_driver_id_fkey'; columns: ['driver_id']; referencedRelation: 'drivers'; referencedColumns: ['id'] },
          { foreignKeyName: 'dva_vehicle_id_fkey'; columns: ['vehicle_id']; referencedRelation: 'vehicles'; referencedColumns: ['id'] }
        ]
      }
      pricing_defaults: {
        Row: {
          id: string
          company_id: string
          base_fee: number
          price_per_km: number
          urgency_surcharge_pct: number
          urgency_threshold_hours: number
          vat_rate: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          base_fee?: number
          price_per_km?: number
          urgency_surcharge_pct?: number
          urgency_threshold_hours?: number
          vat_rate?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          base_fee?: number
          price_per_km?: number
          urgency_surcharge_pct?: number
          urgency_threshold_hours?: number
          vat_rate?: number
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'pd_company_id_fkey'; columns: ['company_id']; referencedRelation: 'companies'; referencedColumns: ['id'] }
        ]
      }
      client_pricing_contracts: {
        Row: {
          id: string
          company_id: string
          client_id: string
          base_fee: number
          price_per_km: number
          urgency_surcharge_pct: number
          valid_from: string
          valid_to: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          client_id: string
          base_fee: number
          price_per_km: number
          urgency_surcharge_pct?: number
          valid_from: string
          valid_to?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          base_fee?: number
          price_per_km?: number
          urgency_surcharge_pct?: number
          valid_from?: string
          valid_to?: string | null
          notes?: string | null
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'cpc_company_id_fkey'; columns: ['company_id']; referencedRelation: 'companies'; referencedColumns: ['id'] },
          { foreignKeyName: 'cpc_client_id_fkey'; columns: ['client_id']; referencedRelation: 'clients'; referencedColumns: ['id'] }
        ]
      }
      shipments: {
        Row: {
          id: string
          company_id: string
          reference: string
          client_id: string
          assigned_driver_id: string | null
          assigned_vehicle_id: string | null
          status: ShipmentStatus
          pickup_street: string
          pickup_city: string
          pickup_postal_code: string | null
          pickup_region: string | null
          pickup_country: string
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_contact_name: string | null
          pickup_contact_phone: string | null
          pickup_notes: string | null
          pickup_scheduled_at: string | null
          pickup_actual_at: string | null
          delivery_street: string
          delivery_city: string
          delivery_postal_code: string | null
          delivery_region: string | null
          delivery_country: string
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_contact_name: string | null
          delivery_contact_phone: string | null
          delivery_notes: string | null
          delivery_scheduled_at: string | null
          delivery_actual_at: string | null
          weight_kg: number | null
          volume_m3: number | null
          description: string | null
          goods_value: number | null
          fragile: boolean
          distance_km: number | null
          is_urgent: boolean
          price_excl_tax: number | null
          tax_amount: number | null
          price_incl_tax: number | null
          pricing_snapshot: Json | null
          manual_price_override: number | null
          is_international: boolean
          customs_declaration_value: number | null
          customs_hs_code: string | null
          customs_notes: string | null
          invoice_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          reference: string
          client_id: string
          assigned_driver_id?: string | null
          assigned_vehicle_id?: string | null
          status?: ShipmentStatus
          pickup_street: string
          pickup_city: string
          pickup_postal_code?: string | null
          pickup_region?: string | null
          pickup_country?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_contact_name?: string | null
          pickup_contact_phone?: string | null
          pickup_notes?: string | null
          pickup_scheduled_at?: string | null
          pickup_actual_at?: string | null
          delivery_street: string
          delivery_city: string
          delivery_postal_code?: string | null
          delivery_region?: string | null
          delivery_country?: string
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_contact_name?: string | null
          delivery_contact_phone?: string | null
          delivery_notes?: string | null
          delivery_scheduled_at?: string | null
          delivery_actual_at?: string | null
          weight_kg?: number | null
          volume_m3?: number | null
          description?: string | null
          goods_value?: number | null
          fragile?: boolean
          distance_km?: number | null
          is_urgent?: boolean
          price_excl_tax?: number | null
          tax_amount?: number | null
          price_incl_tax?: number | null
          pricing_snapshot?: Json | null
          manual_price_override?: number | null
          is_international?: boolean
          customs_declaration_value?: number | null
          customs_hs_code?: string | null
          customs_notes?: string | null
          invoice_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          reference?: string
          client_id?: string
          assigned_driver_id?: string | null
          assigned_vehicle_id?: string | null
          status?: ShipmentStatus
          pickup_street?: string
          pickup_city?: string
          pickup_postal_code?: string | null
          pickup_region?: string | null
          pickup_country?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_contact_name?: string | null
          pickup_contact_phone?: string | null
          pickup_notes?: string | null
          pickup_scheduled_at?: string | null
          pickup_actual_at?: string | null
          delivery_street?: string
          delivery_city?: string
          delivery_postal_code?: string | null
          delivery_region?: string | null
          delivery_country?: string
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_contact_name?: string | null
          delivery_contact_phone?: string | null
          delivery_notes?: string | null
          delivery_scheduled_at?: string | null
          delivery_actual_at?: string | null
          weight_kg?: number | null
          volume_m3?: number | null
          description?: string | null
          goods_value?: number | null
          fragile?: boolean
          distance_km?: number | null
          is_urgent?: boolean
          price_excl_tax?: number | null
          tax_amount?: number | null
          price_incl_tax?: number | null
          pricing_snapshot?: Json | null
          manual_price_override?: number | null
          is_international?: boolean
          customs_declaration_value?: number | null
          customs_hs_code?: string | null
          customs_notes?: string | null
          invoice_id?: string | null
          delivery_actual_at?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          { foreignKeyName: 'shipments_company_id_fkey'; columns: ['company_id']; referencedRelation: 'companies'; referencedColumns: ['id'] },
          { foreignKeyName: 'shipments_client_id_fkey'; columns: ['client_id']; referencedRelation: 'clients'; referencedColumns: ['id'] },
          { foreignKeyName: 'shipments_driver_id_fkey'; columns: ['assigned_driver_id']; referencedRelation: 'drivers'; referencedColumns: ['id'] },
          { foreignKeyName: 'shipments_vehicle_id_fkey'; columns: ['assigned_vehicle_id']; referencedRelation: 'vehicles'; referencedColumns: ['id'] },
          { foreignKeyName: 'fk_shipments_invoice'; columns: ['invoice_id']; referencedRelation: 'invoices'; referencedColumns: ['id'] }
        ]
      }
      shipment_status_history: {
        Row: {
          id: string
          company_id: string
          shipment_id: string
          status: string
          notes: string | null
          location_lat: number | null
          location_lng: number | null
          changed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          shipment_id: string
          status: string
          notes?: string | null
          location_lat?: number | null
          location_lng?: number | null
          changed_by?: string | null
          created_at?: string
        }
        Update: never
        Relationships: [
          { foreignKeyName: 'ssh_company_id_fkey'; columns: ['company_id']; referencedRelation: 'companies'; referencedColumns: ['id'] },
          { foreignKeyName: 'ssh_shipment_id_fkey'; columns: ['shipment_id']; referencedRelation: 'shipments'; referencedColumns: ['id'] }
        ]
      }
      shipment_documents: {
        Row: {
          id: string
          company_id: string
          shipment_id: string
          type: DocumentType
          file_url: string
          file_name: string | null
          file_size_bytes: number | null
          mime_type: string | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          shipment_id: string
          type: DocumentType
          file_url: string
          file_name?: string | null
          file_size_bytes?: number | null
          mime_type?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Update: never
        Relationships: [
          { foreignKeyName: 'sd_shipment_id_fkey'; columns: ['shipment_id']; referencedRelation: 'shipments'; referencedColumns: ['id'] }
        ]
      }
      invoices: {
        Row: {
          id: string
          company_id: string
          client_id: string
          invoice_number: string
          issued_at: string
          due_at: string
          period_start: string | null
          period_end: string | null
          subtotal_excl_tax: number
          tax_rate: number
          tax_amount: number
          total_incl_tax: number
          amount_paid: number
          status: InvoiceStatus
          pdf_url: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          client_id: string
          invoice_number: string
          issued_at?: string
          due_at: string
          period_start?: string | null
          period_end?: string | null
          subtotal_excl_tax: number
          tax_rate: number
          tax_amount: number
          total_incl_tax: number
          amount_paid?: number
          status?: InvoiceStatus
          pdf_url?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: InvoiceStatus
          amount_paid?: number
          pdf_url?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'invoices_company_id_fkey'; columns: ['company_id']; referencedRelation: 'companies'; referencedColumns: ['id'] },
          { foreignKeyName: 'invoices_client_id_fkey'; columns: ['client_id']; referencedRelation: 'clients'; referencedColumns: ['id'] }
        ]
      }
      invoice_shipments: {
        Row: { invoice_id: string; shipment_id: string }
        Insert: { invoice_id: string; shipment_id: string }
        Update: never
        Relationships: [
          { foreignKeyName: 'iship_invoice_id_fkey'; columns: ['invoice_id']; referencedRelation: 'invoices'; referencedColumns: ['id'] },
          { foreignKeyName: 'iship_shipment_id_fkey'; columns: ['shipment_id']; referencedRelation: 'shipments'; referencedColumns: ['id'] }
        ]
      }
      invoice_payments: {
        Row: {
          id: string
          company_id: string
          invoice_id: string
          amount: number
          payment_date: string
          payment_method: PaymentMethod
          reference: string | null
          notes: string | null
          recorded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          invoice_id: string
          amount: number
          payment_date?: string
          payment_method?: PaymentMethod
          reference?: string | null
          notes?: string | null
          recorded_by?: string | null
          created_at?: string
        }
        Update: never
        Relationships: [
          { foreignKeyName: 'ipay_invoice_id_fkey'; columns: ['invoice_id']; referencedRelation: 'invoices'; referencedColumns: ['id'] }
        ]
      }
      driver_ratings: {
        Row: {
          id: string
          company_id: string
          shipment_id: string
          driver_id: string
          client_id: string
          rating: number
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          shipment_id: string
          driver_id: string
          client_id: string
          rating: number
          comment?: string | null
          created_at?: string
        }
        Update: never
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          company_id: string
          type: string
          channel: NotificationChannel
          recipient_email: string | null
          recipient_phone: string | null
          subject: string | null
          body: string
          metadata: Json | null
          status: NotificationStatus
          attempts: number
          last_attempted_at: string | null
          sent_at: string | null
          error_message: string | null
          shipment_id: string | null
          invoice_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          type: string
          channel: NotificationChannel
          recipient_email?: string | null
          recipient_phone?: string | null
          subject?: string | null
          body: string
          metadata?: Json | null
          status?: NotificationStatus
          attempts?: number
          last_attempted_at?: string | null
          sent_at?: string | null
          error_message?: string | null
          shipment_id?: string | null
          invoice_id?: string | null
          created_at?: string
        }
        Update: {
          status?: NotificationStatus
          attempts?: number
          last_attempted_at?: string | null
          sent_at?: string | null
          error_message?: string | null
        }
        Relationships: []
      }
      vehicle_maintenance_records: {
        Row: {
          id: string
          company_id: string
          vehicle_id: string
          type: string
          description: string | null
          cost: number | null
          performed_at: string
          next_due_at: string | null
          mileage_at_service: number | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          vehicle_id: string
          type: string
          description?: string | null
          cost?: number | null
          performed_at: string
          next_due_at?: string | null
          mileage_at_service?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: never
        Relationships: [
          { foreignKeyName: 'vmr_vehicle_id_fkey'; columns: ['vehicle_id']; referencedRelation: 'vehicles'; referencedColumns: ['id'] }
        ]
      }
      company_settings: {
        Row: {
          id: string
          company_id: string
          international_enabled: boolean
          whatsapp_enabled: boolean
          client_portal_enabled: boolean
          driver_ratings_enabled: boolean
          notify_on_assignment: boolean
          notify_on_pickup: boolean
          notify_on_delivery: boolean
          notify_on_invoice: boolean
          notify_overdue_day_7: boolean
          notify_overdue_day_15: boolean
          notify_overdue_day_30: boolean
          invoice_footer_text: string | null
          email_from_name: string | null
          email_reply_to: string | null
          whatsapp_sender_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          international_enabled?: boolean
          whatsapp_enabled?: boolean
          client_portal_enabled?: boolean
          driver_ratings_enabled?: boolean
          notify_on_assignment?: boolean
          notify_on_pickup?: boolean
          notify_on_delivery?: boolean
          notify_on_invoice?: boolean
          notify_overdue_day_7?: boolean
          notify_overdue_day_15?: boolean
          notify_overdue_day_30?: boolean
          invoice_footer_text?: string | null
          email_from_name?: string | null
          email_reply_to?: string | null
          whatsapp_sender_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          international_enabled?: boolean
          whatsapp_enabled?: boolean
          client_portal_enabled?: boolean
          driver_ratings_enabled?: boolean
          notify_on_assignment?: boolean
          notify_on_pickup?: boolean
          notify_on_delivery?: boolean
          notify_on_invoice?: boolean
          notify_overdue_day_7?: boolean
          notify_overdue_day_15?: boolean
          notify_overdue_day_30?: boolean
          invoice_footer_text?: string | null
          email_from_name?: string | null
          email_reply_to?: string | null
          whatsapp_sender_id?: string | null
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'cs_company_id_fkey'; columns: ['company_id']; referencedRelation: 'companies'; referencedColumns: ['id'] }
        ]
      }
      sequence_counters: {
        Row: { company_id: string; type: string; year: number; last_value: number }
        Insert: { company_id: string; type: string; year: number; last_value?: number }
        Update: { last_value?: number }
        Relationships: []
      }
    }
    Views: {
      v_driver_current_vehicle: {
        Row: {
          driver_id: string | null
          company_id: string | null
          driver_name: string | null
          phone: string | null
          is_available: boolean | null
          total_deliveries: number | null
          on_time_delivery_rate: number | null
          average_rating: number | null
          vehicle_id: string | null
          plate_number: string | null
          brand: string | null
          model: string | null
          vehicle_type: string | null
          assigned_at: string | null
        }
      }
      v_shipment_kpis: {
        Row: {
          company_id: string | null
          total_all_time: number | null
          shipments_today: number | null
          shipments_this_week: number | null
          shipments_this_month: number | null
          active_shipments: number | null
          delivered_this_month: number | null
          on_time_rate_pct: number | null
          revenue_this_month: number | null
        }
      }
      v_overdue_invoices: {
        Row: {
          id: string | null
          company_id: string | null
          invoice_number: string | null
          client_id: string | null
          client_name: string | null
          contact_email: string | null
          whatsapp_phone: string | null
          total_incl_tax: number | null
          amount_paid: number | null
          balance_due: number | null
          due_at: string | null
          days_overdue: number | null
        }
      }
    }
    Functions: {
      current_company_id: { Args: Record<string, never>; Returns: string }
      current_user_role: { Args: Record<string, never>; Returns: string }
      has_any_role: { Args: { roles: string[] }; Returns: boolean }
      current_driver_id: { Args: Record<string, never>; Returns: string }
      current_client_id: { Args: Record<string, never>; Returns: string }
      next_sequence_value: { Args: { p_company_id: string; p_type: string }; Returns: number }
      mark_overdue_invoices: { Args: Record<string, never>; Returns: number }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Convenience type helpers
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row']
