import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ScheduledReport {
  id: string;
  company_id: string;
  report_type: string;
  report_name: string;
  frequency: string;
  next_run_date: string;
  recipients: string[];
  format: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScheduledReportInput {
  report_type: string;
  report_name: string;
  frequency: string;
  next_run_date: string;
  recipients: string[];
  format: string;
  is_active?: boolean;
}

export const useScheduledReports = () => {
  const queryClient = useQueryClient();

  const { data: scheduledReports, isLoading } = useQuery({
    queryKey: ["scheduled-reports"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("scheduled_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ScheduledReport[];
    },
  });

  const createScheduledReport = useMutation({
    mutationFn: async (input: ScheduledReportInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { data, error } = await supabase
        .from("scheduled_reports")
        .insert({
          ...input,
          company_id: profile.company_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
    },
  });

  const updateScheduledReport = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ScheduledReportInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("scheduled_reports")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
    },
  });

  const deleteScheduledReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("scheduled_reports")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
    },
  });

  return {
    scheduledReports,
    isLoading,
    createScheduledReport,
    updateScheduledReport,
    deleteScheduledReport,
  };
};
