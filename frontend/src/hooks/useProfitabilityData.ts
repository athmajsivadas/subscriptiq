import { useQuery } from "@tanstack/react-query";
import { useRevenueSources, useExpenseCategories, useFinancialMetrics } from "./useFinancialData";
import { useAccountingSettings } from "./useAccountingSettings";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

export interface ProfitabilityMetrics {
  totalRevenue: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  operatingProfit: number;
  ebitda: number;
  grossMargin: number;
  netMargin: number;
  operatingMargin: number;
  ebitdaMargin: number;
  revenueGrowth: number;
  profitGrowth: number;
}

export interface ProfitBreakdown {
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  ebitda: number;
}

export interface MarginTrend {
  name: string;
  current: number;
  change: number;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: 'up' | 'down' | 'neutral';
}

export interface MarginTrendTimeSeries {
  period: string;
  dateKey: string;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
}

export function useProfitabilityData(filters?: { dateRange?: { from?: Date; to?: Date }, project?: string, department?: string, product?: string, region?: string, currency?: string }) {
  const { data: settings } = useAccountingSettings();
  const basis = settings?.basis || 'accrual';
  const currency = filters?.currency || 'USD';
  const { data: revenueSources } = useRevenueSources(filters?.dateRange, currency);
  const { data: expenseCategories } = useExpenseCategories(filters?.dateRange, currency);
  const { data: financialMetrics } = useFinancialMetrics(filters?.dateRange);

  return useQuery({
    queryKey: ["profitability-data", basis, revenueSources, expenseCategories, financialMetrics, filters],
    queryFn: (): ProfitabilityMetrics => {
      // Calculate totals strictly from database (no dummy fallbacks)
      const totalRevenue = Array.isArray(revenueSources)
        ? revenueSources.reduce((sum, source) => sum + (Number(source.amount) || 0), 0)
        : 0;

      const totalExpenses = Array.isArray(expenseCategories)
        ? expenseCategories.reduce((sum, category) => sum + (Number(category.amount) || 0), 0)
        : 0;
      
      // Find COGS (Cost of Goods Sold) from expenses only; default to 0
      const cogs = Array.isArray(expenseCategories)
        ? (expenseCategories.find(cat => 
            (cat.category || "").toLowerCase().includes('cogs') || 
            (cat.name || "").toLowerCase().includes('cost of goods')
          )?.amount as number | undefined) || 0
        : 0;
      
      // Calculate operating expenses (excluding COGS)
      const operatingExpenses = Math.max(totalExpenses - cogs, 0);
      
      // Calculate profit metrics (no fabricated adjustments)
      const grossProfit = totalRevenue - cogs;
      const operatingProfit = grossProfit - operatingExpenses;
      const netProfit = operatingProfit; // Simplified; no taxes/interest modeled here
      const ebitda = operatingProfit; // Remove artificial amortization/depreciation add-back
      
      // Calculate margins
      const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
      const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
      const operatingMargin = totalRevenue > 0 ? (operatingProfit / totalRevenue) * 100 : 0;
      const ebitdaMargin = totalRevenue > 0 ? (ebitda / totalRevenue) * 100 : 0;
      
      // Calculate growth rates only when data exists; otherwise 0
      const revenueGrowth = Array.isArray(revenueSources) && revenueSources.length > 0
        ? (revenueSources.reduce((sum, source) => sum + (Number(source.growth_rate) || 0), 0) / revenueSources.length)
        : 0;
      const profitGrowth = totalRevenue > 0 ? revenueGrowth : 0;
      
      return {
        totalRevenue,
        totalExpenses,
        grossProfit,
        netProfit,
        operatingProfit,
        ebitda,
        grossMargin,
        netMargin,
        operatingMargin,
        ebitdaMargin,
        revenueGrowth,
        profitGrowth
      };
    },
    enabled: true, // Always run the calculation
    placeholderData: (previousData) => previousData, // Keep previous data while loading to prevent flickering
  });
}

export function useProfitBreakdown(filters?: { dateRange?: { from?: Date; to?: Date }, project?: string, department?: string, product?: string, region?: string, currency?: string }): ProfitBreakdown {
  const { data: profitabilityData } = useProfitabilityData(filters);
  
  if (!profitabilityData) {
    return {
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
      operatingExpenses: 0,
      netProfit: 0,
      ebitda: 0
    };
  }
  
  const cogs = profitabilityData.totalRevenue - profitabilityData.grossProfit;
  const operatingExpenses = profitabilityData.grossProfit - profitabilityData.operatingProfit;
  
  return {
    revenue: profitabilityData.totalRevenue,
    cogs,
    grossProfit: profitabilityData.grossProfit,
    operatingExpenses,
    netProfit: profitabilityData.netProfit,
    ebitda: profitabilityData.ebitda
  };
}

export function useMarginTrends(filters?: { dateRange?: { from?: Date; to?: Date }, project?: string, department?: string, product?: string, region?: string, currency?: string }): MarginTrend[] {
  const { data: profitabilityData } = useProfitabilityData(filters);
  
  if (!profitabilityData) {
    return [];
  }
  
  return [
    {
      name: 'Gross Margin',
      current: profitabilityData.grossMargin,
      change: 0,
      changeType: 'neutral',
      icon: 'neutral'
    },
    {
      name: 'Operating Margin',
      current: profitabilityData.operatingMargin,
      change: 0,
      changeType: 'neutral',
      icon: 'neutral'
    },
    {
      name: 'Net Margin',
      current: profitabilityData.netMargin,
      change: 0,
      changeType: 'neutral',
      icon: 'neutral'
    }
  ];
}

// Helper function to format currency for profitability display
export function formatProfitCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(2)}K`;
  }
  return `$${amount.toFixed(2)}`;
}

// Helper function to format percentage with proper styling
export function formatMarginPercentage(percentage: number): string {
  return `${percentage.toFixed(1)}%`;
}

// Helper function to format change with sign
export function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

// Hook for margin trends time series with dynamic granularity
export function useMarginTrendsTimeSeries(filters?: { dateRange?: { from?: Date; to?: Date }, product?: string, region?: string, currency?: string }) {
  const { data: settings } = useAccountingSettings();
  const basis = settings?.basis || 'accrual';
  const dateRange = filters?.dateRange;
  const currency = filters?.currency || 'USD';

  return useQuery({
    queryKey: ["margin-trends-timeseries", basis, filters],
    queryFn: async () => {
      // Determine date range
      const today = new Date();
      const startDate = dateRange?.from || startOfMonth(subMonths(today, 6));
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

      const tableName = basis === 'cash' ? 'demo_baseline_invoices' : 'facts_revenue_daily';
      const dateColumn = basis === 'cash' ? 'issue_date' : 'date';

      let revenueQuery = supabase
        .from(tableName)
        .select("*")
        .gte(dateColumn, startDate.toISOString().split('T')[0])
        .lte(dateColumn, endDate.toISOString().split('T')[0]);

      // Apply segment filters
      if (filters?.product) {
        revenueQuery = revenueQuery.eq("product_id", filters.product);
      }
      if (filters?.region) {
        revenueQuery = revenueQuery.eq("region", filters.region);
      }

      const { data: revenueData, error: revenueError } = await revenueQuery;

      let expenseQuery = supabase
        .from("facts_expenses_daily")
        .select("date, category, vendor, amount")
        .gte("date", startDate.toISOString().split('T')[0])
        .lte("date", endDate.toISOString().split('T')[0]);

      const { data: expenseData, error: expenseError } = await expenseQuery;

      if (revenueError) throw revenueError;
      if (expenseError) throw expenseError;

      if (!revenueData || revenueData.length === 0) {
        return [];
      }

      // Determine granularity based on date range
      const dateRangeDays = dateRange?.from && dateRange?.to 
        ? Math.abs((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))
        : revenueData.length > 0 
          ? Math.abs((new Date((revenueData[revenueData.length - 1] as any)[dateColumn]).getTime() - new Date((revenueData[0] as any)[dateColumn]).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
      
      const useDailyGranularity = dateRangeDays <= 30;

      // Aggregate revenue by period, converting at transaction date
      const revenueByPeriod = revenueData.reduce((acc: any, row: any) => {
        const dateObj = new Date(row[dateColumn] + 'T00:00:00');
        const key = useDailyGranularity 
          ? format(dateObj, "MMM dd")
          : format(dateObj, "MMM yyyy");
        const dateKey = useDailyGranularity
          ? format(dateObj, "yyyy-MM-dd")
          : format(dateObj, "yyyy-MM");
        
        if (!acc[key]) {
          acc[key] = { period: key, dateKey, revenue: 0 };
        }
        // Handle both cash and accrual basis and convert at transaction date
        const revenueAmount = basis === 'cash' ? (row.amount_total || 0) : (row.amount_accrual || 0);
        const convertedRevenue = convertAmount(revenueAmount, 'USD', row[dateColumn]);
        acc[key].revenue += convertedRevenue;
        return acc;
      }, {});

      // Aggregate expenses by period, converting at transaction date
      const expensesByPeriod = (expenseData || []).reduce((acc: any, row) => {
        const dateObj = new Date(row.date + 'T00:00:00');
        const key = useDailyGranularity 
          ? format(dateObj, "MMM dd")
          : format(dateObj, "MMM yyyy");
        const dateKey = useDailyGranularity
          ? format(dateObj, "yyyy-MM-dd")
          : format(dateObj, "yyyy-MM");
        
        if (!acc[key]) {
          acc[key] = { period: key, dateKey, cogs: 0, opex: 0 };
        }
        
        const category = (row.category || '').toLowerCase();
        const convertedExpense = convertAmount(row.amount || 0, 'USD', row.date);
        if (category.includes('cogs') || category.includes('cost of goods')) {
          acc[key].cogs += convertedExpense;
        } else {
          acc[key].opex += convertedExpense;
        }
        return acc;
      }, {});

      // Combine and calculate margins
      const marginData: any[] = [];
      Object.keys(revenueByPeriod).forEach(key => {
        const revenue = revenueByPeriod[key].revenue;
        const expenses = expensesByPeriod[key] || { cogs: 0, opex: 0 };
        const cogs = expenses.cogs;
        const opex = expenses.opex;
        
        const grossProfit = revenue - cogs;
        const operatingProfit = grossProfit - opex;
        const netProfit = operatingProfit;
        
        marginData.push({
          period: key,
          dateKey: revenueByPeriod[key].dateKey,
          grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
          operatingMargin: revenue > 0 ? (operatingProfit / revenue) * 100 : 0,
          netMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
        });
      });

      // Sort by date and keep dateKey for drill-down functionality
      const chartData = marginData
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

      return chartData as MarginTrendTimeSeries[];
    },
  });
}