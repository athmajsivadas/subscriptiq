import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "./useFinancialData";

export interface ARAgingBucket {
  bucket: string;
  count: number;
  amount: number;
  percentage: number;
}

export function useARData(dateRange?: { from?: Date; to?: Date }) {
  return useQuery({
    queryKey: ["ar-data", dateRange?.from, dateRange?.to],
    queryFn: async () => {
      let query = supabase
        .from("facts_ar")
        .select("*")
        .order("created_at", { ascending: false });

      // Apply date range filters if provided
      if (dateRange?.from) {
        query = query.gte("created_at", dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte("created_at", dateRange.to.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching AR data:", error);
        throw error;
      }

      // Calculate aging buckets
      const buckets: Record<string, ARAgingBucket> = {
        "current": { bucket: "Current (0-30 days)", count: 0, amount: 0, percentage: 0 },
        "30-60": { bucket: "30-60 days", count: 0, amount: 0, percentage: 0 },
        "60+": { bucket: "60+ days overdue", count: 0, amount: 0, percentage: 0 }
      };

      const total = data.reduce((sum, record) => sum + Number(record.open_amount_base), 0);

      data.forEach((record) => {
        const amount = Number(record.open_amount_base);
        if (record.aging_bucket === "current") {
          buckets.current.count++;
          buckets.current.amount += amount;
        } else if (record.aging_bucket === "30-60") {
          buckets["30-60"].count++;
          buckets["30-60"].amount += amount;
        } else {
          buckets["60+"].count++;
          buckets["60+"].amount += amount;
        }
      });

      // Calculate percentages
      Object.values(buckets).forEach(bucket => {
        bucket.percentage = total > 0 ? (bucket.amount / total) * 100 : 0;
      });

      return {
        total,
        buckets: Object.values(buckets),
        averageCollectionPeriod: data.length > 0 
          ? data.reduce((sum, r) => sum + r.days_overdue, 0) / data.length 
          : 0
      };
    }
  });
}

export function useAPData(dateRange?: { from?: Date; to?: Date }) {
  return useQuery({
    queryKey: ["ap-data", dateRange?.from, dateRange?.to],
    queryFn: async () => {
      let query = supabase
        .from("vendor_bills")
        .select("*")
        .in("status", ["Open", "Pending", "Overdue", "Partial", "Partially Paid"])
        .order("due_date", { ascending: true });

      // Apply date range filters if provided
      if (dateRange?.from) {
        query = query.gte("due_date", dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte("due_date", dateRange.to.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching AP data:", error);
        throw error;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Calculate days until due for each bill
      const billsWithDays = data.map(bill => {
        const dueDate = new Date(bill.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const diffTime = dueDate.getTime() - today.getTime();
        const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { ...bill, daysUntilDue };
      });

      // Group by urgency
      const urgent = billsWithDays.filter(r => r.daysUntilDue <= 7 && r.daysUntilDue >= 0);
      const current = billsWithDays.filter(r => r.daysUntilDue > 7 && r.daysUntilDue <= 30);
      const future = billsWithDays.filter(r => r.daysUntilDue > 30);

      const total = data.reduce((sum, record) => sum + Number(record.open_amount), 0);

      return {
        total,
        groups: [
          {
            name: "Due within 7 days",
            count: urgent.length,
            amount: urgent.reduce((sum, r) => sum + Number(r.open_amount), 0),
            badge: "Urgent"
          },
          {
            name: "Due within 30 days",
            count: current.length,
            amount: current.reduce((sum, r) => sum + Number(r.open_amount), 0),
            badge: "Current"
          },
          {
            name: "Due later",
            count: future.length,
            amount: future.reduce((sum, r) => sum + Number(r.open_amount), 0),
            badge: "Future"
          }
        ]
      };
    }
  });
}

export function useDSO() {
  return useQuery({
    queryKey: ["dso"],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90); // 90 days

      const { data: companyData } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!companyData?.company_id) return null;

      const { data, error } = await supabase
        .rpc("calculate_dso", {
          _company_id: companyData.company_id,
          _start_date: startDate.toISOString().split('T')[0],
          _end_date: endDate.toISOString().split('T')[0]
        });

      if (error) {
        console.error("Error calculating DSO:", error);
        return null;
      }

      return data;
    }
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) return [];

      // Fetch recent invoices with original amounts and currencies
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, issue_date, amount_total, original_amount, original_currency, status, customer_id, customers(name)')
        .eq('company_id', profile.company_id)
        .order('issue_date', { ascending: false })
        .limit(5);

      // Fetch recent payments with original amounts and currencies
      const { data: payments } = await supabase
        .from('payments')
        .select('id, date, amount, original_amount, original_currency, status, invoice_id, invoices(customer_id, customers(name))')
        .eq('company_id', profile.company_id)
        .order('date', { ascending: false })
        .limit(5);

      const activities = [
        ...(invoices || []).map((inv: any) => ({
          id: inv.id,
          type: 'invoice' as const,
          date: inv.issue_date,
          amount: Number(inv.original_amount ?? inv.amount_total ?? 0),
          currency: inv.original_currency || 'USD',
          status: inv.status,
          customerName: inv.customers?.name || 'Unknown Customer',
        })),
        ...(payments || []).map((pmt: any) => ({
          id: pmt.id,
          type: 'payment' as const,
          date: pmt.date,
          amount: Number(pmt.original_amount ?? pmt.amount ?? 0),
          currency: pmt.original_currency || 'USD',
          status: pmt.status,
          customerName: pmt.invoices?.customers?.name || 'Unknown Customer',
        })),
      ];

      return activities.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ).slice(0, 10);
    },
  });
}

// Detailed AR invoice data
export function useARDetailedData(
  dateRange?: { from?: Date; to?: Date },
  sortBy: string = 'due_date_asc',
  page: number = 1,
  pageSize: number = 20
) {
  return useQuery({
    queryKey: ['ar-detailed', dateRange?.from, dateRange?.to, sortBy, page, pageSize],
    queryFn: async () => {
      // First, get the total count
      let countQuery = supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Open', 'Partial', 'Overdue', 'Partially Paid']);

      if (dateRange?.from) {
        countQuery = countQuery.gte('issue_date', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        countQuery = countQuery.lte('issue_date', dateRange.to.toISOString());
      }

      const { count, error: countError } = await countQuery;

      if (countError) {
        console.error('Error fetching AR count:', countError);
        throw countError;
      }

      // Then get the paginated data
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('invoices')
        .select('*, customers(name)')
        .in('status', ['Open', 'Partial', 'Overdue', 'Partially Paid'])
        .range(from, to);

      // Apply sorting based on sortBy parameter
      switch (sortBy) {
        case 'due_date_asc':
          query = query.order('due_date', { ascending: true });
          break;
        case 'due_date_desc':
          query = query.order('due_date', { ascending: false });
          break;
        case 'issue_date_desc':
          query = query.order('issue_date', { ascending: false });
          break;
        case 'issue_date_asc':
          query = query.order('issue_date', { ascending: true });
          break;
        case 'amount_desc':
          query = query.order('open_amount', { ascending: false });
          break;
        case 'amount_asc':
          query = query.order('open_amount', { ascending: true });
          break;
        default:
          query = query.order('due_date', { ascending: true });
      }

      if (dateRange?.from) {
        query = query.gte('issue_date', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('issue_date', dateRange.to.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching detailed AR data:', error);
        throw error;
      }

      // Calculate days outstanding and aging bucket
      const today = new Date();
      const invoices = data.map((inv: any) => {
        const dueDate = new Date(inv.due_date);
        const daysOutstanding = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let agingBucket = 'current';
        if (daysOutstanding > 60) {
          agingBucket = '60+';
        } else if (daysOutstanding > 30) {
          agingBucket = '30-60';
        }

        return {
          id: inv.id,
          invoiceNumber: inv.id.slice(0, 8),
          customer: inv.customers?.name || 'Unknown',
          issueDate: inv.issue_date,
          dueDate: inv.due_date,
          status: inv.status,
          amount: inv.open_amount,
          currency: inv.original_currency || 'USD',
          daysOutstanding,
          agingBucket,
        };
      });

      return {
        data: invoices,
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    },
  });
}

// Detailed AP vendor bill data
export function useAPDetailedData(
  dateRange?: { from?: Date; to?: Date },
  sortBy: string = 'due_date_asc'
) {
  return useQuery({
    queryKey: ['ap-detailed', dateRange?.from, dateRange?.to, sortBy],
    queryFn: async () => {
      let query = supabase
        .from('vendor_bills')
        .select('*')
        .in('status', ['Open', 'Partial', 'Partially Paid']);

      // Apply sorting based on sortBy parameter
      switch (sortBy) {
        case 'due_date_asc':
          query = query.order('due_date', { ascending: true });
          break;
        case 'due_date_desc':
          query = query.order('due_date', { ascending: false });
          break;
        case 'issue_date_desc':
          query = query.order('issue_date', { ascending: false });
          break;
        case 'issue_date_asc':
          query = query.order('issue_date', { ascending: true });
          break;
        case 'amount_desc':
          query = query.order('open_amount', { ascending: false });
          break;
        case 'amount_asc':
          query = query.order('open_amount', { ascending: true });
          break;
        default:
          query = query.order('due_date', { ascending: true });
      }

      if (dateRange?.from) {
        query = query.gte('issue_date', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('issue_date', dateRange.to.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching detailed AP data:', error);
        throw error;
      }

      // Calculate days until due
      const today = new Date();
      return data.map((bill: any) => {
        const dueDate = new Date(bill.due_date);
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          id: bill.id,
          billNumber: bill.id.slice(0, 8),
          vendor: bill.vendor_name,
          issueDate: bill.issue_date,
          dueDate: bill.due_date,
          status: bill.status,
          amount: bill.open_amount,
          currency: bill.original_currency || 'USD',
          daysUntilDue,
          category: bill.category,
        };
      });
    },
  });
}

export { formatCurrency };
