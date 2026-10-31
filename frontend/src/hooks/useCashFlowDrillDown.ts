import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";

export interface CashFlowDrillDownData {
  period: string;
  dateKey: string;
  data: {
    date: string;
    dateKey: string; // ISO date for FX conversion
    description: string;
    amount: number;
    type: 'inflow' | 'outflow';
    category?: string;
  }[];
}

export function useCashFlowDrillDown() {
  const [drillDownRequest, setDrillDownRequest] = useState<{
    period: string;
    dateKey: string;
  } | null>(null);

  const { data: drillDownData, isLoading } = useQuery({
    queryKey: ['cashflow-drill-down', drillDownRequest],
    queryFn: async (): Promise<CashFlowDrillDownData | null> => {
      if (!drillDownRequest) return null;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) return null;

      // Parse the dateKey to determine the date range
      // If it's in format "yyyy-MM", it's a month
      // If it's in format "yyyy-MM-dd", it's a single day
      const isMonthly = drillDownRequest.dateKey.split('-').length === 2;
      
      let startDate: string;
      let endDate: string;

      if (isMonthly) {
        const periodDate = parseISO(`${drillDownRequest.dateKey}-01`);
        startDate = format(startOfMonth(periodDate), 'yyyy-MM-dd');
        endDate = format(endOfMonth(periodDate), 'yyyy-MM-dd');
      } else {
        startDate = drillDownRequest.dateKey;
        endDate = drillDownRequest.dateKey;
      }

      // Fetch bank transactions for the selected period
      const { data: transactions } = await supabase
        .from('bank_transactions')
        .select('date, amount, type, category, counterparty')
        .eq('company_id', profile.company_id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      const transactionData = (transactions || []).map(item => ({
        date: format(new Date(item.date), 'MMM dd, yyyy'),
        dateKey: item.date, // ISO date for FX conversion
        description: item.counterparty || item.category || 'Transaction',
        amount: Math.abs(item.amount),
        type: item.type === 'inflow' ? 'inflow' as const : 'outflow' as const,
        category: item.category,
      }));

      return {
        period: drillDownRequest.period,
        dateKey: drillDownRequest.dateKey,
        data: transactionData,
      };
    },
    enabled: !!drillDownRequest,
  });

  const handlePeriodClick = (period: string, dateKey: string) => {
    setDrillDownRequest({ period, dateKey });
  };

  const clearDrillDown = () => {
    setDrillDownRequest(null);
  };

  return {
    drillDownData: drillDownRequest ? drillDownData : null,
    isLoading,
    handlePeriodClick,
    clearDrillDown,
  };
}
