import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { DrillDownData } from "@/components/ProfitabilityDataTable";
import { format, startOfMonth, endOfMonth } from "date-fns";

export function useProfitabilityDrillDown() {
  const [drillDownRequest, setDrillDownRequest] = useState<{
    type: 'waterfall' | 'margin-trend';
    metric: string;
    period?: string;
    dateKey?: string;
  } | null>(null);

  const { data: drillDownData, isLoading } = useQuery({
    queryKey: ['profitability-drill-down', drillDownRequest],
    queryFn: async (): Promise<DrillDownData | null> => {
      if (!drillDownRequest) return null;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) return null;

      let transactionData: any[] = [];

      if (drillDownRequest.type === 'waterfall') {
        // Fetch data based on metric type
        if (drillDownRequest.metric === 'Revenue') {
          const { data: revenueData } = await supabase
            .from('facts_revenue_daily')
            .select('date, amount_accrual, channel, product_id, region')
            .eq('company_id', profile.company_id)
            .order('date', { ascending: false })
            .limit(50);

          transactionData = (revenueData || []).map(item => ({
            date: format(new Date(item.date), 'MMM dd, yyyy'),
            dateKey: item.date, // ISO date for FX conversion
            description: item.channel || item.region || 'Revenue',
            amount: item.amount_accrual,
            category: item.channel || item.region,
          }));
        } else if (drillDownRequest.metric === 'COGS') {
          // For COGS, we can infer from expenses or create sample data
          const { data: expenseData } = await supabase
            .from('facts_expenses_daily')
            .select('date, amount, category, vendor')
            .eq('company_id', profile.company_id)
            .in('category', ['Cost of Sales', 'Direct Costs', 'Materials'])
            .order('date', { ascending: false })
            .limit(50);

          transactionData = (expenseData || []).map(item => ({
            date: format(new Date(item.date), 'MMM dd, yyyy'),
            dateKey: item.date, // ISO date for FX conversion
            description: item.vendor || 'Cost of Goods',
            amount: item.amount,
            category: item.category,
          }));
        } else if (drillDownRequest.metric === 'Op. Expenses') {
          const { data: expenseData } = await supabase
            .from('facts_expenses_daily')
            .select('date, amount, category, vendor')
            .eq('company_id', profile.company_id)
            .order('date', { ascending: false })
            .limit(50);

          transactionData = (expenseData || []).map(item => ({
            date: format(new Date(item.date), 'MMM dd, yyyy'),
            dateKey: item.date, // ISO date for FX conversion
            description: item.vendor || item.category || 'Operating Expense',
            amount: item.amount,
            category: item.category,
          }));
        }
      } else if (drillDownRequest.type === 'margin-trend' && drillDownRequest.dateKey) {
        // Parse the dateKey (e.g., "2025-01" or "2025-01-15")
        const periodDate = new Date(drillDownRequest.dateKey);
        const startDate = startOfMonth(periodDate);
        const endDate = endOfMonth(periodDate);

        if (drillDownRequest.metric.includes('Margin')) {
          // Fetch revenue and expense data for the selected period
          const { data: revenueData } = await supabase
            .from('facts_revenue_daily')
            .select('date, amount_accrual, channel, product_id')
            .eq('company_id', profile.company_id)
            .gte('date', format(startDate, 'yyyy-MM-dd'))
            .lte('date', format(endDate, 'yyyy-MM-dd'))
            .order('date', { ascending: false });

          const { data: expenseData } = await supabase
            .from('facts_expenses_daily')
            .select('date, amount, category, vendor')
            .eq('company_id', profile.company_id)
            .gte('date', format(startDate, 'yyyy-MM-dd'))
            .lte('date', format(endDate, 'yyyy-MM-dd'))
            .order('date', { ascending: false });

          const revenueTransactions = (revenueData || []).map(item => ({
            date: format(new Date(item.date), 'MMM dd, yyyy'),
            dateKey: item.date, // ISO date for FX conversion
            description: `Revenue - ${item.channel || 'General'}`,
            amount: item.amount_accrual,
            category: 'Revenue',
          }));

          const expenseTransactions = (expenseData || []).map(item => ({
            date: format(new Date(item.date), 'MMM dd, yyyy'),
            dateKey: item.date, // ISO date for FX conversion
            description: item.vendor || item.category || 'Expense',
            amount: -item.amount, // Negative for expenses
            category: item.category,
          }));

          transactionData = [...revenueTransactions, ...expenseTransactions]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 50);
        }
      }

      return {
        type: drillDownRequest.type,
        metric: drillDownRequest.metric,
        period: drillDownRequest.period,
        data: transactionData,
      };
    },
    enabled: !!drillDownRequest,
  });

  const handleWaterfallClick = (metric: string) => {
    setDrillDownRequest({ type: 'waterfall', metric });
  };

  const handleMarginClick = (metric: string, period: string, dateKey: string) => {
    setDrillDownRequest({ type: 'margin-trend', metric, period, dateKey });
  };

  const clearDrillDown = () => {
    setDrillDownRequest(null);
  };

  return {
    drillDownData: drillDownRequest ? drillDownData : null,
    isLoading,
    handleWaterfallClick,
    handleMarginClick,
    clearDrillDown,
  };
}
