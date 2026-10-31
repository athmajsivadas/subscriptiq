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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounting_settings: {
        Row: {
          allow_future_dates: boolean
          base_currency: string
          basis: string
          company_id: string
          created_at: string
          id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          allow_future_dates?: boolean
          base_currency?: string
          basis?: string
          company_id: string
          created_at?: string
          id?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          allow_future_dates?: boolean
          base_currency?: string
          basis?: string
          company_id?: string
          created_at?: string
          id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          balance: number
          company_id: string
          created_at: string
          currency: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          balance?: number
          company_id: string
          created_at?: string
          currency?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          balance?: number
          company_id?: string
          created_at?: string
          currency?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          import_batch_id: string | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          id?: string
          import_batch_id?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          import_batch_id?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          account_id: string
          amount: number
          amount_base: number | null
          category: string | null
          company_id: string
          counterparty: string | null
          created_at: string
          date: string
          id: string
          original_amount: number | null
          original_currency: string | null
          type: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          amount_base?: number | null
          category?: string | null
          company_id: string
          counterparty?: string | null
          created_at?: string
          date: string
          id?: string
          original_amount?: number | null
          original_currency?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          amount_base?: number | null
          category?: string | null
          company_id?: string
          counterparty?: string | null
          created_at?: string
          date?: string
          id?: string
          original_amount?: number | null
          original_currency?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          company_id: string
          created_at: string
          growth_rate: number | null
          id: string
          name: string
          period_end: string
          period_start: string
          revenue: number
        }
        Insert: {
          company_id: string
          created_at?: string
          growth_rate?: number | null
          id?: string
          name: string
          period_end: string
          period_start: string
          revenue: number
        }
        Update: {
          company_id?: string
          created_at?: string
          growth_rate?: number | null
          id?: string
          name?: string
          period_end?: string
          period_start?: string
          revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          address: string | null
          avatar_color: string | null
          company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_color?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_color?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          company_id: string
          country: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      data_rejects: {
        Row: {
          company_id: string
          created_at: string
          id: string
          import_batch_id: string | null
          rejection_reason: string
          row_data: Json
          table_name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          import_batch_id?: string | null
          rejection_reason: string
          row_data: Json
          table_name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          import_batch_id?: string | null
          rejection_reason?: string
          row_data?: Json
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_rejects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_baseline_accounts: {
        Row: {
          balance: number
          company_id: string
          created_at: string
          currency: string
          id: string
          name: string
        }
        Insert: {
          balance?: number
          company_id: string
          created_at?: string
          currency?: string
          id: string
          name: string
        }
        Update: {
          balance?: number
          company_id?: string
          created_at?: string
          currency?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      demo_baseline_bank_transactions: {
        Row: {
          account_id: string
          amount: number
          amount_base: number | null
          category: string | null
          company_id: string
          counterparty: string | null
          created_at: string
          date: string
          id: string
          original_amount: number | null
          original_currency: string | null
          type: string
        }
        Insert: {
          account_id: string
          amount: number
          amount_base?: number | null
          category?: string | null
          company_id: string
          counterparty?: string | null
          created_at?: string
          date: string
          id: string
          original_amount?: number | null
          original_currency?: string | null
          type: string
        }
        Update: {
          account_id?: string
          amount?: number
          amount_base?: number | null
          category?: string | null
          company_id?: string
          counterparty?: string | null
          created_at?: string
          date?: string
          id?: string
          original_amount?: number | null
          original_currency?: string | null
          type?: string
        }
        Relationships: []
      }
      demo_baseline_customers: {
        Row: {
          company_id: string
          country: string | null
          created_at: string
          email: string | null
          id: string
          name: string
        }
        Insert: {
          company_id: string
          country?: string | null
          created_at?: string
          email?: string | null
          id: string
          name: string
        }
        Update: {
          company_id?: string
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      demo_baseline_expense_categories: {
        Row: {
          amount: number
          budget_amount: number | null
          category: string
          company_id: string
          created_at: string
          growth_rate: number | null
          id: string
          name: string
          percentage: number | null
          period_end: string
          period_start: string
        }
        Insert: {
          amount: number
          budget_amount?: number | null
          category: string
          company_id: string
          created_at?: string
          growth_rate?: number | null
          id: string
          name: string
          percentage?: number | null
          period_end: string
          period_start: string
        }
        Update: {
          amount?: number
          budget_amount?: number | null
          category?: string
          company_id?: string
          created_at?: string
          growth_rate?: number | null
          id?: string
          name?: string
          percentage?: number | null
          period_end?: string
          period_start?: string
        }
        Relationships: []
      }
      demo_baseline_expenses: {
        Row: {
          amount: number
          amount_base: number | null
          category: string
          company_id: string
          created_at: string
          date: string
          id: string
          original_amount: number | null
          original_currency: string | null
          project_id: string | null
          vendor: string | null
        }
        Insert: {
          amount: number
          amount_base?: number | null
          category: string
          company_id: string
          created_at?: string
          date: string
          id: string
          original_amount?: number | null
          original_currency?: string | null
          project_id?: string | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          amount_base?: number | null
          category?: string
          company_id?: string
          created_at?: string
          date?: string
          id?: string
          original_amount?: number | null
          original_currency?: string | null
          project_id?: string | null
          vendor?: string | null
        }
        Relationships: []
      }
      demo_baseline_financial_metrics: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          id: string
          metric_type: string
          period_end: string
          period_start: string
          period_type: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          id: string
          metric_type: string
          period_end: string
          period_start: string
          period_type: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          id?: string
          metric_type?: string
          period_end?: string
          period_start?: string
          period_type?: string
        }
        Relationships: []
      }
      demo_baseline_fx_rates: {
        Row: {
          company_id: string
          currency: string
          date: string
          id: string
          is_imputed: boolean
          rate_to_base: number
        }
        Insert: {
          company_id: string
          currency: string
          date: string
          id?: string
          is_imputed?: boolean
          rate_to_base: number
        }
        Update: {
          company_id?: string
          currency?: string
          date?: string
          id?: string
          is_imputed?: boolean
          rate_to_base?: number
        }
        Relationships: []
      }
      demo_baseline_invoices: {
        Row: {
          amount_total: number
          amount_total_base: number | null
          channel: string | null
          company_id: string
          created_at: string
          customer_id: string
          due_date: string
          id: string
          issue_date: string
          open_amount: number
          original_amount: number | null
          original_currency: string | null
          product_id: string | null
          region: string | null
          status: string
        }
        Insert: {
          amount_total: number
          amount_total_base?: number | null
          channel?: string | null
          company_id: string
          created_at?: string
          customer_id: string
          due_date: string
          id: string
          issue_date: string
          open_amount: number
          original_amount?: number | null
          original_currency?: string | null
          product_id?: string | null
          region?: string | null
          status: string
        }
        Update: {
          amount_total?: number
          amount_total_base?: number | null
          channel?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string
          due_date?: string
          id?: string
          issue_date?: string
          open_amount?: number
          original_amount?: number | null
          original_currency?: string | null
          product_id?: string | null
          region?: string | null
          status?: string
        }
        Relationships: []
      }
      demo_baseline_payments: {
        Row: {
          amount: number
          amount_base: number | null
          company_id: string
          created_at: string
          date: string
          id: string
          invoice_id: string
          original_amount: number | null
          original_currency: string | null
          status: string
        }
        Insert: {
          amount: number
          amount_base?: number | null
          company_id: string
          created_at?: string
          date: string
          id: string
          invoice_id: string
          original_amount?: number | null
          original_currency?: string | null
          status: string
        }
        Update: {
          amount?: number
          amount_base?: number | null
          company_id?: string
          created_at?: string
          date?: string
          id?: string
          invoice_id?: string
          original_amount?: number | null
          original_currency?: string | null
          status?: string
        }
        Relationships: []
      }
      demo_baseline_revenue_sources: {
        Row: {
          amount: number
          category: string
          company_id: string
          created_at: string
          growth_rate: number | null
          id: string
          name: string
          percentage: number | null
          period_end: string
          period_start: string
        }
        Insert: {
          amount: number
          category: string
          company_id: string
          created_at?: string
          growth_rate?: number | null
          id: string
          name: string
          percentage?: number | null
          period_end: string
          period_start: string
        }
        Update: {
          amount?: number
          category?: string
          company_id?: string
          created_at?: string
          growth_rate?: number | null
          id?: string
          name?: string
          percentage?: number | null
          period_end?: string
          period_start?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          amount: number
          budget_amount: number | null
          category: string
          company_id: string
          created_at: string
          growth_rate: number | null
          id: string
          name: string
          percentage: number | null
          period_end: string
          period_start: string
        }
        Insert: {
          amount: number
          budget_amount?: number | null
          category: string
          company_id: string
          created_at?: string
          growth_rate?: number | null
          id?: string
          name: string
          percentage?: number | null
          period_end: string
          period_start: string
        }
        Update: {
          amount?: number
          budget_amount?: number | null
          category?: string
          company_id?: string
          created_at?: string
          growth_rate?: number | null
          id?: string
          name?: string
          percentage?: number | null
          period_end?: string
          period_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses_new: {
        Row: {
          amount: number
          amount_base: number | null
          category: string
          company_id: string
          created_at: string
          date: string
          id: string
          original_amount: number | null
          original_currency: string | null
          project_id: string | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount: number
          amount_base?: number | null
          category: string
          company_id: string
          created_at?: string
          date: string
          id?: string
          original_amount?: number | null
          original_currency?: string | null
          project_id?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          amount_base?: number | null
          category?: string
          company_id?: string
          created_at?: string
          date?: string
          id?: string
          original_amount?: number | null
          original_currency?: string | null
          project_id?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: []
      }
      facts_ap: {
        Row: {
          aging_bucket: string
          company_id: string
          created_at: string
          days_overdue: number
          id: string
          open_amount_base: number
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          aging_bucket: string
          company_id: string
          created_at?: string
          days_overdue?: number
          id?: string
          open_amount_base?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          aging_bucket?: string
          company_id?: string
          created_at?: string
          days_overdue?: number
          id?: string
          open_amount_base?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facts_ap_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      facts_ar: {
        Row: {
          aging_bucket: string
          company_id: string
          created_at: string
          days_overdue: number
          id: string
          invoice_id: string
          open_amount_base: number
          updated_at: string
        }
        Insert: {
          aging_bucket: string
          company_id: string
          created_at?: string
          days_overdue?: number
          id?: string
          invoice_id: string
          open_amount_base?: number
          updated_at?: string
        }
        Update: {
          aging_bucket?: string
          company_id?: string
          created_at?: string
          days_overdue?: number
          id?: string
          invoice_id?: string
          open_amount_base?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facts_ar_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facts_ar_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      facts_cashflow_daily: {
        Row: {
          company_id: string
          created_at: string
          date: string
          id: string
          inflow: number
          outflow: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          date: string
          id?: string
          inflow?: number
          outflow?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          date?: string
          id?: string
          inflow?: number
          outflow?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facts_cashflow_daily_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      facts_expenses_daily: {
        Row: {
          amount: number
          category: string
          company_id: string
          created_at: string
          date: string
          id: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount?: number
          category: string
          company_id: string
          created_at?: string
          date: string
          id?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          company_id?: string
          created_at?: string
          date?: string
          id?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facts_expenses_daily_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      facts_revenue_daily: {
        Row: {
          amount_accrual: number
          amount_cash: number
          channel: string | null
          company_id: string
          created_at: string
          date: string
          id: string
          product_id: string | null
          region: string | null
          updated_at: string
        }
        Insert: {
          amount_accrual?: number
          amount_cash?: number
          channel?: string | null
          company_id: string
          created_at?: string
          date: string
          id?: string
          product_id?: string | null
          region?: string | null
          updated_at?: string
        }
        Update: {
          amount_accrual?: number
          amount_cash?: number
          channel?: string | null
          company_id?: string
          created_at?: string
          date?: string
          id?: string
          product_id?: string | null
          region?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facts_revenue_daily_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      filter_segments: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          segment_type: string
          segment_value: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          segment_type: string
          segment_value: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          segment_type?: string
          segment_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      financial_metrics: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          id: string
          metric_type: string
          period_end: string
          period_start: string
          period_type: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          id?: string
          metric_type: string
          period_end: string
          period_start: string
          period_type: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          id?: string
          metric_type?: string
          period_end?: string
          period_start?: string
          period_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_calendar: {
        Row: {
          company_id: string
          created_at: string
          currency: string
          date: string
          id: string
          is_imputed: boolean
          rate_to_base: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          currency: string
          date: string
          id?: string
          is_imputed?: boolean
          rate_to_base: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          currency?: string
          date?: string
          id?: string
          is_imputed?: boolean
          rate_to_base?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fx_calendar_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          company_id: string
          created_at: string
          currency: string
          date: string
          id: string
          is_imputed: boolean
          rate_to_base: number
        }
        Insert: {
          company_id: string
          created_at?: string
          currency: string
          date: string
          id?: string
          is_imputed?: boolean
          rate_to_base: number
        }
        Update: {
          company_id?: string
          created_at?: string
          currency?: string
          date?: string
          id?: string
          is_imputed?: boolean
          rate_to_base?: number
        }
        Relationships: []
      }
      fx_rates_session: {
        Row: {
          company_id: string
          created_at: string
          currency: string
          date: string
          id: string
          is_imputed: boolean
          rate_to_base: number
        }
        Insert: {
          company_id: string
          created_at?: string
          currency: string
          date: string
          id?: string
          is_imputed?: boolean
          rate_to_base: number
        }
        Update: {
          company_id?: string
          created_at?: string
          currency?: string
          date?: string
          id?: string
          is_imputed?: boolean
          rate_to_base?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_total: number
          amount_total_base: number | null
          channel: string | null
          company_id: string
          created_at: string
          customer_id: string
          due_date: string
          id: string
          issue_date: string
          open_amount: number
          original_amount: number | null
          original_currency: string | null
          product_id: string | null
          region: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_total: number
          amount_total_base?: number | null
          channel?: string | null
          company_id: string
          created_at?: string
          customer_id: string
          due_date: string
          id?: string
          issue_date: string
          open_amount: number
          original_amount?: number | null
          original_currency?: string | null
          product_id?: string | null
          region?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          amount_total?: number
          amount_total_base?: number | null
          channel?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string
          due_date?: string
          id?: string
          issue_date?: string
          open_amount?: number
          original_amount?: number | null
          original_currency?: string | null
          product_id?: string | null
          region?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      kpis: {
        Row: {
          company_id: string
          created_at: string
          growth_rate: number | null
          id: string
          kpi_name: string
          period_end: string
          period_start: string
          unit: string | null
          value: number
        }
        Insert: {
          company_id: string
          created_at?: string
          growth_rate?: number | null
          id?: string
          kpi_name: string
          period_end: string
          period_start: string
          unit?: string | null
          value: number
        }
        Update: {
          company_id?: string
          created_at?: string
          growth_rate?: number | null
          id?: string
          kpi_name?: string
          period_end?: string
          period_start?: string
          unit?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpis_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          amount_base: number | null
          company_id: string
          created_at: string
          date: string
          id: string
          invoice_id: string
          original_amount: number | null
          original_currency: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          amount_base?: number | null
          company_id: string
          created_at?: string
          date: string
          id?: string
          invoice_id: string
          original_amount?: number | null
          original_currency?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_base?: number | null
          company_id?: string
          created_at?: string
          date?: string
          id?: string
          invoice_id?: string
          original_amount?: number | null
          original_currency?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      regional_revenue: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          growth_rate: number | null
          id: string
          percentage: number | null
          period_end: string
          period_start: string
          region: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          growth_rate?: number | null
          id?: string
          percentage?: number | null
          period_end: string
          period_start: string
          region: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          growth_rate?: number | null
          id?: string
          percentage?: number | null
          period_end?: string
          period_start?: string
          region?: string
        }
        Relationships: [
          {
            foreignKeyName: "regional_revenue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_sources: {
        Row: {
          amount: number
          category: string
          company_id: string
          created_at: string
          growth_rate: number | null
          id: string
          name: string
          percentage: number | null
          period_end: string
          period_start: string
        }
        Insert: {
          amount: number
          category: string
          company_id: string
          created_at?: string
          growth_rate?: number | null
          id?: string
          name: string
          percentage?: number | null
          period_end: string
          period_start: string
        }
        Update: {
          amount?: number
          category?: string
          company_id?: string
          created_at?: string
          growth_rate?: number | null
          id?: string
          name?: string
          percentage?: number | null
          period_end?: string
          period_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_sources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_reports: {
        Row: {
          company_id: string
          created_at: string
          format: string
          frequency: string
          id: string
          is_active: boolean
          next_run_date: string
          recipients: string[]
          report_name: string
          report_type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          format?: string
          frequency: string
          id?: string
          is_active?: boolean
          next_run_date: string
          recipients?: string[]
          report_name: string
          report_type: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          format?: string
          frequency?: string
          id?: string
          is_active?: boolean
          next_run_date?: string
          recipients?: string[]
          report_name?: string
          report_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_bills: {
        Row: {
          amount_total: number
          amount_total_base: number | null
          category: string | null
          company_id: string
          created_at: string
          description: string | null
          due_date: string
          id: string
          issue_date: string
          open_amount: number
          original_amount: number | null
          original_currency: string | null
          status: string
          updated_at: string
          vendor_name: string
        }
        Insert: {
          amount_total: number
          amount_total_base?: number | null
          category?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          issue_date: string
          open_amount: number
          original_amount?: number | null
          original_currency?: string | null
          status: string
          updated_at?: string
          vendor_name: string
        }
        Update: {
          amount_total?: number
          amount_total_base?: number | null
          category?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          issue_date?: string
          open_amount?: number
          original_amount?: number | null
          original_currency?: string | null
          status?: string
          updated_at?: string
          vendor_name?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          amount: number
          category: string
          company_id: string
          created_at: string
          id: string
          name: string
          period_end: string
          period_start: string
        }
        Insert: {
          amount: number
          category: string
          company_id: string
          created_at?: string
          id?: string
          name: string
          period_end: string
          period_start: string
        }
        Update: {
          amount?: number
          category?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          period_end?: string
          period_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_dso: {
        Args: { _company_id: string; _end_date: string; _start_date: string }
        Returns: number
      }
      get_accounting_basis: { Args: { _company_id: string }; Returns: string }
      get_user_company_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      reset_demo_data: { Args: never; Returns: undefined }
      setup_demo_user_profile: {
        Args: { demo_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "viewer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "viewer"],
    },
  },
} as const
