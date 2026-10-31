import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface RevenueProfitData {
  period: string;
  dateKey: string;
  revenue: number;
  profit: number;
}

export function useRevenueProfitData(dateRange?: { from?: Date; to?: Date }) {
  return useQuery({
    queryKey: ["revenue-profit-data", dateRange?.from, dateRange?.to],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) throw new Error("No company found");

      // Build queries for revenue (from invoices) and expenses (from expenses_new)
      let revenueQuery = supabase
        .from("invoices")
        .select("issue_date, amount_total, amount_total_base")
        .eq("company_id", profile.company_id)
        .order("issue_date");

      let expensesQuery = supabase
        .from("expenses_new")
        .select("date, amount, amount_base")
        .eq("company_id", profile.company_id)
        .order("date");

      // Apply date filters if provided
      if (dateRange?.from) {
        const fromDate = format(dateRange.from, 'yyyy-MM-dd');
        revenueQuery = revenueQuery.gte("issue_date", fromDate);
        expensesQuery = expensesQuery.gte("date", fromDate);
      }
      if (dateRange?.to) {
        const toDate = format(dateRange.to, 'yyyy-MM-dd');
        revenueQuery = revenueQuery.lte("issue_date", toDate);
        expensesQuery = expensesQuery.lte("date", toDate);
      }

      const [revenueResult, expensesResult] = await Promise.all([
        revenueQuery,
        expensesQuery
      ]);

      if (revenueResult.error) throw revenueResult.error;
      if (expensesResult.error) throw expensesResult.error;

      const revenueData = revenueResult.data || [];
      const expensesData = expensesResult.data || [];

      if (revenueData.length === 0 && expensesData.length === 0) {
        return [];
      }

      // Determine granularity based on date range
      const dateRangeDays = dateRange?.from && dateRange?.to 
        ? Math.abs((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))
        : revenueData.length > 0 
          ? Math.abs((new Date(revenueData[revenueData.length - 1].issue_date).getTime() - new Date(revenueData[0].issue_date).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
      
      const useDailyGranularity = dateRangeDays <= 30;

      // Aggregate revenue by day or month
      const revenueByPeriod = new Map<string, { dateKey: string; amount: number }>();
      revenueData.forEach((row) => {
        const dateObj = new Date(row.issue_date + 'T00:00:00');
        const displayKey = useDailyGranularity 
          ? format(dateObj, "MMM dd")
          : format(dateObj, "MMM yyyy");
        const dateKey = useDailyGranularity
          ? format(dateObj, "yyyy-MM-dd")
          : format(dateObj, "yyyy-MM");
        if (!revenueByPeriod.has(displayKey)) {
          revenueByPeriod.set(displayKey, { dateKey, amount: 0 });
        }
        const current = revenueByPeriod.get(displayKey)!;
        const amount = (row.amount_total_base ?? row.amount_total ?? 0) as number;
        current.amount += amount;
      });

      // Aggregate expenses by day or month
      const expensesByPeriod = new Map<string, number>();
      expensesData.forEach((row) => {
        const dateObj = new Date(row.date + 'T00:00:00');
        const displayKey = useDailyGranularity 
          ? format(dateObj, "MMM dd")
          : format(dateObj, "MMM yyyy");
        
        if (!expensesByPeriod.has(displayKey)) {
          expensesByPeriod.set(displayKey, 0);
        }
        expensesByPeriod.set(displayKey, expensesByPeriod.get(displayKey)! + (row.amount || 0));
      });

      // Combine revenue and expenses to calculate profit
      const allPeriods = new Set([...revenueByPeriod.keys(), ...expensesByPeriod.keys()]);
      const chartData: RevenueProfitData[] = [];

      allPeriods.forEach(period => {
        const revenueEntry = revenueByPeriod.get(period);
        const revenue = revenueEntry?.amount || 0;
        const expenses = expensesByPeriod.get(period) || 0;
        const profit = revenue - expenses;

        chartData.push({
          period,
          dateKey: revenueEntry?.dateKey || "",
          revenue,
          profit
        });
      });

      // Sort by dateKey
      chartData.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

      return chartData;
    },
  });
}
