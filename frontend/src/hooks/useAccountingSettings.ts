import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AccountingSettings {
  id: string;
  company_id: string;
  basis: 'accrual' | 'cash';
  base_currency: string;
  timezone: string;
  allow_future_dates: boolean;
}

export function useAccountingSettings() {
  return useQuery({
    queryKey: ["accounting-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_settings")
        .select("*")
        .single();

      if (error) throw error;
      return data as AccountingSettings;
    },
  });
}

export function useUpdateAccountingBasis() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (basis: 'accrual' | 'cash') => {
      // First get the user's company_id from their profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) throw new Error('Company not found');

      const { data, error } = await supabase
        .from("accounting_settings")
        .update({ basis })
        .eq('company_id', profile.company_id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting-settings"] });
      queryClient.invalidateQueries({ queryKey: ["revenue-data"] });
      queryClient.invalidateQueries({ queryKey: ["expense-data"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-data"] });
      queryClient.invalidateQueries({ queryKey: ["profitability-data"] });
      toast({
        title: "Accounting basis updated",
        description: "Your financial data has been recalculated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update accounting basis",
        variant: "destructive",
      });
    },
  });
}
