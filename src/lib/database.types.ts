export type Database = {
  public: {
    Tables: {
      boxes: {
        Row: {
          id: string
          name: string
          subtitle: string | null
          active: boolean
        }
        Insert: {
          id?: string
          name: string
          subtitle?: string | null
          active?: boolean
        }
        Update: {
          id?: string
          name?: string
          subtitle?: string | null
          active?: boolean
        }
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          company: string
          contact: string | null
          street: string | null
          zip: string | null
          city: string | null
          email: string | null
          phone: string | null
          vat_id: string | null
          moco_company_id: number | null
          created_at: string
        }
        Insert: {
          id?: string
          company: string
          contact?: string | null
          street?: string | null
          zip?: string | null
          city?: string | null
          email?: string | null
          phone?: string | null
          vat_id?: string | null
          moco_company_id?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          company?: string
          contact?: string | null
          street?: string | null
          zip?: string | null
          city?: string | null
          email?: string | null
          phone?: string | null
          vat_id?: string | null
          moco_company_id?: number | null
          created_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          id: string
          box_id: string
          customer_id: string | null
          title: string
          billing_company: string | null
          billing_address: string | null
          location: string | null
          start_date: string
          end_date: string
          logistics: 'aufbau' | 'abholung'
          with_printer: boolean
          setup_cost: number | null
          media_packages: number
          price_net: number | null
          status: 'option' | 'bestaetigt' | 'storniert'
          moco_invoice_id: number | null
          invoice_status: 'keine' | 'entwurf' | 'bezahlt'
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          box_id: string
          customer_id?: string | null
          title: string
          billing_company?: string | null
          billing_address?: string | null
          location?: string | null
          start_date: string
          end_date: string
          logistics: 'aufbau' | 'abholung'
          with_printer?: boolean
          setup_cost?: number | null
          media_packages?: number
          price_net?: number | null
          status?: 'option' | 'bestaetigt' | 'storniert'
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          box_id?: string
          customer_id?: string | null
          title?: string
          billing_company?: string | null
          billing_address?: string | null
          location?: string | null
          start_date?: string
          end_date?: string
          logistics?: 'aufbau' | 'abholung'
          with_printer?: boolean
          setup_cost?: number | null
          media_packages?: number
          price_net?: number | null
          status?: 'option' | 'bestaetigt' | 'storniert'
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'bookings_box_id_fkey'
            columns: ['box_id']
            referencedRelation: 'boxes'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          name: string | null
          role: 'team' | 'buchhaltung' | 'admin'
        }
        Insert: {
          id: string
          name?: string | null
          role?: 'team' | 'buchhaltung' | 'admin'
        }
        Update: {
          id?: string
          name?: string | null
          role?: 'team' | 'buchhaltung' | 'admin'
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Box = Database['public']['Tables']['boxes']['Row']
export type Customer = Database['public']['Tables']['customers']['Row']
export type Booking = Database['public']['Tables']['bookings']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']

export type BookingWithRefs = Booking & {
  boxes: Box | null
}
