import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, subQuarters, subYears, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";

export type TimePeriod = 'month' | 'quarter' | 'year';

interface PeriodData {
  revenue: number;
  expenses: number;
  profit: number;
  cashFlow: number;
}

interface PeriodComparison {
  current: PeriodData;
  previous: PeriodData;
  growth: {
    revenue: number;
    expenses: number;
    profit: number;
    cashFlow: number;
  };
}

export function usePeriodComparison(period: TimePeriod) {
  return useQuery({
    queryKey: ["period-comparison", period],
    queryFn: async (): Promise<PeriodComparison> => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) throw new Error("No company found");

      const now = new Date();
      let currentStart: Date, currentEnd: Date, previousStart: Date, previousEnd: Date;

      // Calculate date ranges based on period
      switch (period) {
        case 'month':
          currentStart = startOfMonth(now);
          currentEnd = endOfMonth(now);
          previousStart = startOfMonth(subMonths(now, 1));
          previousEnd = endOfMonth(subMonths(now, 1));
          break;
        case 'quarter':
          currentStart = startOfQuarter(now);
          currentEnd = endOfQuarter(now);
          previousStart = startOfQuarter(subQuarters(now, 1));
          previousEnd = endOfQuarter(subQuarters(now, 1));
          break;
        case 'year':
          currentStart = startOfYear(now);
          currentEnd = endOfYear(now);
          previousStart = startOfYear(subYears(now, 1));
          previousEnd = endOfYear(subYears(now, 1));
          break;
      }

      const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');

      // Fetch current period data
      const [currentRevenue, currentExpenses] = await Promise.all([
        supabase
          .from("facts_revenue_daily")
          .select("amount_accrual")
          .eq("company_id", profile.company_id)
          .gte("date", formatDate(currentStart))
          .lte("date", formatDate(currentEnd)),
        supabase
          .from("facts_expenses_daily")
          .select("amount")
          .eq("company_id", profile.company_id)
          .gte("date", formatDate(currentStart))
          .lte("date", formatDate(currentEnd))
      ]);

      // Fetch previous period data
      const [previousRevenue, previousExpenses] = await Promise.all([
        supabase
          .from("facts_revenue_daily")
          .select("amount_accrual")
          .eq("company_id", profile.company_id)
          .gte("date", formatDate(previousStart))
          .lte("date", formatDate(previousEnd)),
        supabase
          .from("facts_expenses_daily")
          .select("amount")
          .eq("company_id", profile.company_id)
          .gte("date", formatDate(previousStart))
          .lte("date", formatDate(previousEnd))
      ]);

      if (currentRevenue.error) throw currentRevenue.error;
      if (currentExpenses.error) throw currentExpenses.error;
      if (previousRevenue.error) throw previousRevenue.error;
      if (previousExpenses.error) throw previousExpenses.error;

      // Calculate totals
      const currentRevenueTotal = (currentRevenue.data || []).reduce((sum, row) => sum + (row.amount_accrual || 0), 0);
      const currentExpensesTotal = (currentExpenses.data || []).reduce((sum, row) => sum + (row.amount || 0), 0);
      const previousRevenueTotal = (previousRevenue.data || []).reduce((sum, row) => sum + (row.amount_accrual || 0), 0);
      const previousExpensesTotal = (previousExpenses.data || []).reduce((sum, row) => sum + (row.amount || 0), 0);

      const currentProfit = currentRevenueTotal - currentExpensesTotal;
      const previousProfit = previousRevenueTotal - previousExpensesTotal;

      // Calculate growth percentages
      const calculateGrowth = (current: number, previous: number): number => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / Math.abs(previous)) * 100;
      };

      return {
        current: {
          revenue: currentRevenueTotal,
          expenses: currentExpensesTotal,
          profit: currentProfit,
          cashFlow: currentProfit, // Using profit as proxy for cash flow
        },
        previous: {
          revenue: previousRevenueTotal,
          expenses: previousExpensesTotal,
          profit: previousProfit,
          cashFlow: previousProfit,
        },
        growth: {
          revenue: calculateGrowth(currentRevenueTotal, previousRevenueTotal),
          expenses: calculateGrowth(currentExpensesTotal, previousExpensesTotal),
          profit: calculateGrowth(currentProfit, previousProfit),
          cashFlow: calculateGrowth(currentProfit, previousProfit),
        }
      };
    },
  });
}
