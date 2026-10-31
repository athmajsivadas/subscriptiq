import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface RevenueDrillDownParams {
  startDate: string;
  endDate: string;
  category?: string;
  categoryType?: "product" | "region" | "channel";
}

export function useRevenueDrillDown(params: RevenueDrillDownParams | null) {
  return useQuery({
    queryKey: ["revenue-drill-down", params],
    queryFn: async () => {
      if (!params) return [];

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) throw new Error("No company found");

      // Build the query for invoices
      let query = supabase
        .from("invoices")
        .select(`
          *,
          customers (
            name,
            email,
            country
          )
        `)
        .eq("company_id", profile.company_id)
        .gte("issue_date", params.startDate)
        .lte("issue_date", params.endDate)
        .order("issue_date", { ascending: false });

      // Apply category filter if provided
      if (params.category && params.categoryType) {
        if (params.categoryType === "product") {
          query = query.eq("product_id", params.category);
        } else if (params.categoryType === "region") {
          query = query.eq("region", params.category);
        } else if (params.categoryType === "channel") {
          query = query.eq("channel", params.category);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    },
    enabled: !!params,
  });
}
