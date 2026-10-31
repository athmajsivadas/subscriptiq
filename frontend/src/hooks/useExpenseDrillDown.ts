import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface ExpenseDrillDownData {
  filterType: "category" | "period";
  category?: string;
  periodLabel?: string;
  data: {
    date: string;
    dateKey: string; // ISO date for FX conversion
    description: string;
    amount: number;
    category?: string;
  }[];
}

type DrillDownRequest =
  | { type: "category"; category: string }
  | { type: "period"; dateKey: string; label: string; granularity: "day" | "month" };

export function useExpenseDrillDown(dateRange?: { from?: Date; to?: Date }) {
  const [drillDownRequest, setDrillDownRequest] = useState<DrillDownRequest | null>(null);

  const { data: drillDownData, isLoading } = useQuery<ExpenseDrillDownData | null>({
    queryKey: ["expense-drill-down", drillDownRequest, dateRange?.from, dateRange?.to],
    queryFn: async () => {
      if (!drillDownRequest) return null;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.company_id) return null;

      let query = supabase
        .from("facts_expenses_daily")
        .select("date, amount, category, vendor")
        .eq("company_id", profile.company_id);

      if (drillDownRequest.type === "category") {
        query = query.eq("category", drillDownRequest.category);

        if (dateRange?.from) {
          query = query.gte("date", format(dateRange.from, "yyyy-MM-dd"));
        }
        if (dateRange?.to) {
          query = query.lte("date", format(dateRange.to, "yyyy-MM-dd"));
        }
      } else {
        let startDateStr: string;
        let endDateStr: string;

        if (drillDownRequest.granularity === "day") {
          startDateStr = drillDownRequest.dateKey;
          endDateStr = drillDownRequest.dateKey;
        } else {
          const baseDate = new Date(
            drillDownRequest.dateKey.length === 7
              ? `${drillDownRequest.dateKey}-01`
              : drillDownRequest.dateKey
          );
          const start = startOfMonth(baseDate);
          const end = endOfMonth(baseDate);
          startDateStr = format(start, "yyyy-MM-dd");
          endDateStr = format(end, "yyyy-MM-dd");
        }

        query = query.gte("date", startDateStr).lte("date", endDateStr);
      }

      const { data, error } = await query.order("date", { ascending: false }).limit(200);
      if (error) throw error;

      const transactions = (data || []).map((row: any) => ({
        date: format(new Date(row.date), "MMM dd, yyyy"),
        dateKey: row.date, // ISO date string for FX conversion
        description: row.vendor || row.category || "Expense",
        amount: Number(row.amount || 0),
        category: row.category || undefined,
      }));

      if (drillDownRequest.type === "category") {
        return {
          filterType: "category",
          category: drillDownRequest.category,
          data: transactions,
        };
      }

      return {
        filterType: "period",
        periodLabel: drillDownRequest.label,
        data: transactions,
      };
    },
    enabled: !!drillDownRequest,
  });

  const openCategoryDrillDown = (category: string) => {
    setDrillDownRequest({ type: "category", category });
  };

  const openPeriodDrillDown = (dateKey: string, label: string, granularity: "day" | "month") => {
    setDrillDownRequest({ type: "period", dateKey, label, granularity });
  };

  const clearDrillDown = () => {
    setDrillDownRequest(null);
  };

  return {
    drillDownData: drillDownRequest ? drillDownData : null,
    isLoading,
    openCategoryDrillDown,
    openPeriodDrillDown,
    clearDrillDown,
  };
}
