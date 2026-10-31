import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type SegmentType = 'project' | 'department' | 'product' | 'region';

export interface FilterSegment {
  id: string;
  company_id: string;
  segment_type: SegmentType;
  segment_value: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FilterSegmentInput {
  segment_type: SegmentType;
  segment_value: string;
  is_active?: boolean;
}

export function useFilterSegments(segmentType?: SegmentType) {
  const queryClient = useQueryClient();

  const { data: segments = [], isLoading, error } = useQuery({
    queryKey: ["filter-segments", segmentType],
    queryFn: async () => {
      let query = supabase
        .from("filter_segments")
        .select("*")
        .eq("is_active", true)
        .order("segment_value", { ascending: true });

      if (segmentType) {
        query = query.eq("segment_type", segmentType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as FilterSegment[];
    },
  });

  const createSegment = useMutation({
    mutationFn: async (input: FilterSegmentInput) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) {
        throw new Error("Company ID not found");
      }

      const { data, error } = await supabase
        .from("filter_segments")
        .insert([{ ...input, company_id: profile.company_id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["filter-segments"] });
      toast({
        title: "Segment created",
        description: "The filter segment has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating segment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateSegment = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<FilterSegmentInput> }) => {
      const { data, error } = await supabase
        .from("filter_segments")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["filter-segments"] });
      toast({
        title: "Segment updated",
        description: "The filter segment has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating segment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteSegment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("filter_segments").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["filter-segments"] });
      toast({
        title: "Segment deleted",
        description: "The filter segment has been removed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting segment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    segments,
    isLoading,
    error,
    createSegment: createSegment.mutate,
    updateSegment: updateSegment.mutate,
    deleteSegment: deleteSegment.mutate,
    isCreating: createSegment.isPending,
    isUpdating: updateSegment.isPending,
    isDeleting: deleteSegment.isPending,
  };
}

// Helper hook to get segment values by type
export function useSegmentValuesByType() {
  const { segments } = useFilterSegments();

  const getSegmentValues = (type: SegmentType): string[] => {
    return segments
      .filter(s => s.segment_type === type)
      .map(s => s.segment_value);
  };

  return {
    projects: getSegmentValues('project'),
    departments: getSegmentValues('department'),
    products: getSegmentValues('product'),
    regions: getSegmentValues('region'),
  };
}
