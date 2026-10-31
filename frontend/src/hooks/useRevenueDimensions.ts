import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DimensionData {
  dimension: string;
  amount: number;
  percentage: number;
}

interface RevenueDimensionsResult {
  productData: DimensionData[];
  regionData: DimensionData[];
  channelData: DimensionData[];
}

export function useRevenueDimensions(dateRange?: { from?: Date; to?: Date }) {
  return useQuery({
    queryKey: ["revenue-dimensions", dateRange?.from, dateRange?.to],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) throw new Error("No company found");

      let query = supabase
        .from("facts_revenue_daily")
        .select("*")
        .eq("company_id", profile.company_id);

      if (dateRange?.from) {
        query = query.gte("date", dateRange.from.toISOString().split('T')[0]);
      }
      if (dateRange?.to) {
        query = query.lte("date", dateRange.to.toISOString().split('T')[0]);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (!data || data.length === 0) {
        return {
          productData: [],
          regionData: [],
          channelData: []
        };
      }

      // Calculate total revenue
      const totalRevenue = data.reduce((sum, row) => sum + (row.amount_accrual || 0), 0);

      // Aggregate by product
      const productMap = new Map<string, number>();
      data.forEach(row => {
        const product = row.product_id || "Unspecified";
        productMap.set(product, (productMap.get(product) || 0) + (row.amount_accrual || 0));
      });

      // Aggregate by region
      const regionMap = new Map<string, number>();
      data.forEach(row => {
        const region = row.region || "Unspecified";
        regionMap.set(region, (regionMap.get(region) || 0) + (row.amount_accrual || 0));
      });

      // Aggregate by channel
      const channelMap = new Map<string, number>();
      data.forEach(row => {
        const channel = row.channel || "Unspecified";
        channelMap.set(channel, (channelMap.get(channel) || 0) + (row.amount_accrual || 0));
      });

      // Convert to arrays with percentages
      const productData: DimensionData[] = Array.from(productMap.entries())
        .map(([dimension, amount]) => ({
          dimension,
          amount,
          percentage: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0
        }))
        .sort((a, b) => b.amount - a.amount);

      const regionData: DimensionData[] = Array.from(regionMap.entries())
        .map(([dimension, amount]) => ({
          dimension,
          amount,
          percentage: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0
        }))
        .sort((a, b) => b.amount - a.amount);

      const channelData: DimensionData[] = Array.from(channelMap.entries())
        .map(([dimension, amount]) => ({
          dimension,
          amount,
          percentage: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0
        }))
        .sort((a, b) => b.amount - a.amount);

      return {
        productData,
        regionData,
        channelData
      };
    },
  });
}
