import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccountingSettings } from "./useAccountingSettings";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

export interface FinancialMetric {
  id: string;
  metric_type: string;
  amount: number;
  period_start: string;
  period_end: string;
  period_type: string;
}

export interface RevenueSource {
  id: string;
  name: string;
  category: string;
  amount: number;
  percentage: number;
  growth_rate: number;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  category: string;
  amount: number;
  percentage: number;
  growth_rate: number;
  budget_amount: number;
}

export interface RegionalRevenue {
  id: string;
  region: string;
  amount: number;
  percentage: number;
  growth_rate: number;
}

export interface Client {
  id: string;
  name: string;
  revenue: number;
  growth_rate: number;
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
  amount: number;
}

export interface KPI {
  id: string;
  kpi_name: string;
  value: number;
  unit: string;
  growth_rate: number;
}

export interface RevenueTrendData {
  period: string;
  dateKey: string;
  accrual: number;
  cash: number;
}

// Hook for financial metrics (overview data)
export function useFinancialMetrics(dateRange?: { from?: Date; to?: Date }) {
  const { data: settings } = useAccountingSettings();
  const basis = settings?.basis || 'accrual';

  return useQuery({
    queryKey: ["financial-metrics", basis, dateRange?.from, dateRange?.to],
    queryFn: async () => {
      // Determine date range
      const today = new Date();
      const startDate = dateRange?.from || startOfMonth(subMonths(today, 12));
      const endDate = dateRange?.to || endOfMonth(today);

      const { data, error } = await supabase
        .from("financial_metrics")
        .select("*")
        .eq("period_type", "month")
        .gte("period_start", startDate.toISOString().split('T')[0])
        .lte("period_end", endDate.toISOString().split('T')[0])
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // If we have data, return it
      if (data && data.length > 0) {
        return data as FinancialMetric[];
      }

      // Fallback: derive metrics from facts_revenue_daily
      const { data: revenueData, error: revenueError } = await supabase
        .from("facts_revenue_daily")
        .select("*")
        .gte("date", startDate.toISOString().split('T')[0])
        .lte("date", endDate.toISOString().split('T')[0]);

      if (revenueError) throw revenueError;

      // Aggregate by month
      const monthlyTotals: Record<string, number> = {};
      let totalCash = 0;
      let totalAccrual = 0;
      
      revenueData.forEach((row: any) => {
        const month = row.date.slice(0, 7); // YYYY-MM
        if (!monthlyTotals[month]) {
          monthlyTotals[month] = 0;
        }
        totalCash += row.amount_cash || 0;
        totalAccrual += row.amount_accrual || 0;
        
        // Use accrual as fallback if cash basis is set but no cash data exists
        const amount = basis === 'cash' && totalCash === 0 
          ? row.amount_accrual 
          : (basis === 'accrual' ? row.amount_accrual : row.amount_cash);
        monthlyTotals[month] += amount;
      });

      // Calculate metrics
      const months = Object.keys(monthlyTotals).sort();
      const totalRevenue = Object.values(monthlyTotals).reduce((sum, val) => sum + val, 0);
      
      // Find most recent non-zero month for MRR
      let mrr = 0;
      let recentMonth = '';
      for (let i = months.length - 1; i >= 0; i--) {
        if (monthlyTotals[months[i]] > 0) {
          mrr = monthlyTotals[months[i]];
          recentMonth = months[i];
          break;
        }
      }

      const arr = mrr * 12;

      // Build derived metrics
      const derivedMetrics: FinancialMetric[] = [
        {
          id: 'derived-revenue',
          metric_type: 'revenue',
          amount: totalRevenue,
          period_start: months.length > 0 ? `${months[0]}-01` : startDate.toISOString().split('T')[0],
          period_end: months.length > 0 ? `${months[months.length - 1]}-28` : endDate.toISOString().split('T')[0],
          period_type: 'derived'
        },
        {
          id: 'derived-mrr',
          metric_type: 'mrr',
          amount: mrr,
          period_start: recentMonth ? `${recentMonth}-01` : startDate.toISOString().split('T')[0],
          period_end: recentMonth ? `${recentMonth}-28` : endDate.toISOString().split('T')[0],
          period_type: 'derived'
        },
        {
          id: 'derived-arr',
          metric_type: 'arr',
          amount: arr,
          period_start: recentMonth ? `${recentMonth}-01` : startDate.toISOString().split('T')[0],
          period_end: recentMonth ? `${recentMonth}-28` : endDate.toISOString().split('T')[0],
          period_type: 'derived'
        }
      ];

      return derivedMetrics;
    },
  });
}

// Hook for revenue data from facts table with FX conversion
export function useRevenueSources(dateRange?: { from?: Date; to?: Date }, currency: string = 'USD') {
  const { data: settings } = useAccountingSettings();
  const basis = settings?.basis || 'accrual';

  return useQuery({
    queryKey: ["revenue-data", basis, dateRange?.from, dateRange?.to, currency],
    queryFn: async () => {
      const today = new Date();
      const startDate = dateRange?.from || startOfMonth(subMonths(today, 12));
      const endDate = dateRange?.to || endOfMonth(today);

      // Fetch FX rates for the date range
      const { data: fxRates, error: fxError } = await supabase
        .from("fx_rates")
        .select("rate_to_base, currency, date")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (fxError) throw fxError;

      // Build FX lookup map by currency and date
      const fxMap: Record<string, Record<string, number>> = {};
      fxRates?.forEach((rate) => {
        if (!fxMap[rate.currency]) {
          fxMap[rate.currency] = {};
        }
        if (!fxMap[rate.currency][rate.date]) {
          fxMap[rate.currency][rate.date] = rate.rate_to_base;
        }
      });

      // Helper to get FX rate for a specific date
      const getFxRate = (targetCurrency: string, date: string): number => {
        if (targetCurrency === 'USD') return 1;
        if (!fxMap[targetCurrency]) return 1;
        
        // Try exact date match
        if (fxMap[targetCurrency][date]) {
          return fxMap[targetCurrency][date];
        }
        
        // Find closest prior date
        const sortedDates = Object.keys(fxMap[targetCurrency]).sort().reverse();
        const priorDate = sortedDates.find(d => d <= date);
        
        return priorDate ? fxMap[targetCurrency][priorDate] : 1;
      };

      // Helper to convert amount
      const convertAmount = (amount: number, fromCurrency: string, date: string): number => {
        if (fromCurrency === currency) return amount;
        
        const fromRate = fromCurrency === 'USD' ? 1 : getFxRate(fromCurrency, date);
        const toRate = currency === 'USD' ? 1 : getFxRate(currency, date);
        
        const amountInBase = amount * fromRate;
        return amountInBase / toRate;
      };

      const { data, error } = await supabase
        .from("facts_revenue_daily")
        .select("*")
        .gte("date", startDate.toISOString().split('T')[0])
        .lte("date", endDate.toISOString().split('T')[0]);

      if (error) throw error;

      // Check if we have any cash data
      const totalCash = data.reduce((sum: number, row: any) => sum + (row.amount_cash || 0), 0);

      // Aggregate by channel/product, converting each transaction at its date
      const aggregated = data.reduce((acc: any, row: any) => {
        const key = row.channel || row.product_id || 'Other';
        // Use accrual as fallback if cash basis is set but no cash data exists
        const amount = basis === 'cash' && totalCash === 0 
          ? row.amount_accrual 
          : (basis === 'accrual' ? row.amount_accrual : row.amount_cash);
        
        // Convert amount at transaction date
        const convertedAmount = convertAmount(amount, 'USD', row.date);
        
        if (!acc[key]) {
          acc[key] = { name: key, category: 'Revenue', amount: 0 };
        }
        acc[key].amount += convertedAmount;
        return acc;
      }, {});

      const result = Object.values(aggregated).map((item: any, index: number) => ({
        id: `rev-${index}`,
        ...item,
        percentage: 0,
        growth_rate: 0
      }));

      // Calculate percentages
      const total = result.reduce((sum: number, item: any) => sum + item.amount, 0);
      result.forEach((item: any) => {
        item.percentage = total > 0 ? (item.amount / total) * 100 : 0;
      });

      return result as RevenueSource[];
    },
  });
}

// Hook for expense data from facts table with FX conversion
export function useExpenseCategories(dateRange?: { from?: Date; to?: Date }, currency: string = 'USD') {
  return useQuery({
    queryKey: ["expense-data", dateRange?.from, dateRange?.to, currency],
    queryFn: async () => {
      const today = new Date();
      const startDate = dateRange?.from || startOfMonth(subMonths(today, 12));
      const endDate = dateRange?.to || endOfMonth(today);

      // Fetch FX rates for the date range
      const { data: fxRates, error: fxError } = await supabase
        .from("fx_rates")
        .select("rate_to_base, currency, date")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (fxError) throw fxError;

      // Build FX lookup map by currency and date
      const fxMap: Record<string, Record<string, number>> = {};
      fxRates?.forEach((rate) => {
        if (!fxMap[rate.currency]) {
          fxMap[rate.currency] = {};
        }
        if (!fxMap[rate.currency][rate.date]) {
          fxMap[rate.currency][rate.date] = rate.rate_to_base;
        }
      });

      // Helper to get FX rate for a specific date
      const getFxRate = (targetCurrency: string, date: string): number => {
        if (targetCurrency === 'USD') return 1;
        if (!fxMap[targetCurrency]) return 1;
        
        // Try exact date match
        if (fxMap[targetCurrency][date]) {
          return fxMap[targetCurrency][date];
        }
        
        // Find closest prior date
        const sortedDates = Object.keys(fxMap[targetCurrency]).sort().reverse();
        const priorDate = sortedDates.find(d => d <= date);
        
        return priorDate ? fxMap[targetCurrency][priorDate] : 1;
      };

      // Helper to convert amount
      const convertAmount = (amount: number, fromCurrency: string, date: string): number => {
        if (fromCurrency === currency) return amount;
        
        const fromRate = fromCurrency === 'USD' ? 1 : getFxRate(fromCurrency, date);
        const toRate = currency === 'USD' ? 1 : getFxRate(currency, date);
        
        const amountInBase = amount * fromRate;
        return amountInBase / toRate;
      };

      const { data, error } = await supabase
        .from("facts_expenses_daily")
        .select("*")
        .gte("date", startDate.toISOString().split('T')[0])
        .lte("date", endDate.toISOString().split('T')[0]);

      if (error) throw error;

      // Aggregate by category, converting each transaction at its date
      const aggregated = data.reduce((acc: any, row: any) => {
        const key = row.category || 'Other';
        
        // Convert amount at transaction date
        const convertedAmount = convertAmount(Number(row.amount || 0), 'USD', row.date);
        
        if (!acc[key]) {
          acc[key] = { name: key, category: key, amount: 0 };
        }
        acc[key].amount += convertedAmount;
        return acc;
      }, {});

      const result = Object.values(aggregated).map((item: any, index: number) => ({
        id: `exp-${index}`,
        ...item,
        percentage: 0,
        growth_rate: 0,
        budget_amount: 0
      }));

      // Calculate percentages
      const total = result.reduce((sum: number, item: any) => sum + item.amount, 0);
      result.forEach((item: any) => {
        item.percentage = total > 0 ? (item.amount / total) * 100 : 0;
      });

      return result as ExpenseCategory[];
    },
  });
}

export function useExpenseTrends(dateRange?: { from?: Date; to?: Date }) {
  return useQuery({
    queryKey: ["expense-trends", dateRange?.from, dateRange?.to],
    queryFn: async () => {
      const today = new Date();
      const startDate = dateRange?.from || startOfMonth(subMonths(today, 6));
      const endDate = dateRange?.to || endOfMonth(today);

      const { data, error } = await supabase
        .from("facts_expenses_daily")
        .select("*")
        .gte("date", startDate.toISOString().split('T')[0])
        .lte("date", endDate.toISOString().split('T')[0])
        .order("date");

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Determine granularity based on date range
      const dateRangeDays = Math.abs((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const useDailyGranularity = dateRangeDays <= 30;

      // Aggregate by day or month
      const aggregated = data.reduce((acc: any, row: any) => {
        const date = new Date(row.date);
        const key = useDailyGranularity 
          ? format(date, "MMM dd")
          : format(date, "MMM yyyy");
        const dateKey = useDailyGranularity
          ? format(date, "yyyy-MM-dd")
          : format(date, "yyyy-MM");
        
        if (!acc[key]) {
          acc[key] = { period: key, dateKey, expenses: 0, cogs: 0, opex: 0 };
        }
        
        const amount = Number(row.amount || 0);
        acc[key].expenses += amount;
        
        if (row.category === 'cogs') {
          acc[key].cogs += amount;
        } else {
          acc[key].opex += amount;
        }
        
        return acc;
      }, {});

      // Sort by date and remove dateKey
      return Object.values(aggregated)
        .sort((a: any, b: any) => a.dateKey.localeCompare(b.dateKey));
    },
  });
}

// Hook for regional revenue
export function useRegionalRevenue() {
  return useQuery({
    queryKey: ["regional-revenue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("regional_revenue")
        .select("*")
        .order("amount", { ascending: false });

      if (error) throw error;
      return data as RegionalRevenue[];
    },
  });
}

// Hook for top clients
export function useTopClients() {
  return useQuery({
    queryKey: ["top-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("revenue", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as Client[];
    },
  });
}

// Hook for vendors
export function useVendors(dateRange?: { from?: Date; to?: Date }) {
  return useQuery({
    queryKey: ["vendors", dateRange?.from, dateRange?.to],
    queryFn: async () => {
      let query = supabase
        .from("vendors")
        .select("*")
        .order("amount", { ascending: false });

      // Apply date range filters if provided
      if (dateRange?.from) {
        query = query.gte("period_start", dateRange.from.toISOString().split('T')[0]);
      }
      if (dateRange?.to) {
        query = query.lte("period_end", dateRange.to.toISOString().split('T')[0]);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Vendor[];
    },
  });
}

// Hook for KPIs
export function useKPIs() {
  return useQuery({
    queryKey: ["kpis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpis")
        .select("*")
        .order("kpi_name", { ascending: true });

      if (error) throw error;
      return data as KPI[];
    },
  });
}

// Hook for revenue trends with dynamic granularity
export function useRevenueTrends(dateRange?: { from?: Date; to?: Date }) {
  return useQuery({
    queryKey: ["revenue-trends", dateRange?.from, dateRange?.to],
    queryFn: async () => {
      let query = supabase.from("facts_revenue_daily").select("*").order("date");

      // Apply date filters if provided
      if (dateRange?.from) {
        const fromDate = format(dateRange.from, 'yyyy-MM-dd');
        query = query.gte("date", fromDate);
      }
      if (dateRange?.to) {
        const toDate = format(dateRange.to, 'yyyy-MM-dd');
        query = query.lte("date", toDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        return [];
      }

      // Determine granularity based on date range
      const dateRangeDays = dateRange?.from && dateRange?.to 
        ? Math.abs((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))
        : data.length > 0 
          ? Math.abs((new Date(data[data.length - 1].date).getTime() - new Date(data[0].date).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
      
      const useDailyGranularity = dateRangeDays <= 30;

      // Aggregate by day or month based on range
      const aggregatedData = data.reduce((acc: any, row) => {
        const dateObj = new Date(row.date + 'T00:00:00');
        const key = useDailyGranularity 
          ? format(dateObj, "MMM dd")
          : format(dateObj, "MMM yyyy");
        const dateKey = useDailyGranularity
          ? format(dateObj, "yyyy-MM-dd")
          : format(dateObj, "yyyy-MM");
        
        if (!acc[key]) {
          acc[key] = { period: key, dateKey, accrual: 0, cash: 0 };
        }
        acc[key].accrual += row.amount_accrual || 0;
        acc[key].cash += row.amount_cash || 0;
        return acc;
      }, {});

      // Sort by date and keep dateKey for drill-down functionality
      const chartData = Object.values(aggregatedData)
        .sort((a: any, b: any) => a.dateKey.localeCompare(b.dateKey));

      return chartData as RevenueTrendData[];
    },
  });
}

// Helper function to format currency
export function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(2)}K`;
  }
  return `$${amount.toFixed(2)}`;
}

// Helper function to format percentage
export function formatPercentage(percentage: number): string {
  const sign = percentage >= 0 ? '+' : '';
  return `${sign}${percentage.toFixed(1)}%`;
}