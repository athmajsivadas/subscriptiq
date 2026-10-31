import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Database, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ETLJob {
  name: string;
  function: string;
  description: string;
  status: "idle" | "running" | "success" | "error";
  lastRun?: Date;
}

export const ETLManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [jobs, setJobs] = useState<ETLJob[]>([
    {
      name: "Revenue ETL",
      function: "etl-revenue",
      description: "Process invoices and payments into daily revenue facts",
      status: "idle"
    },
    {
      name: "Expenses ETL",
      function: "etl-expenses",
      description: "Aggregate expenses by category and date",
      status: "idle"
    },
    {
      name: "Cash Flow ETL",
      function: "etl-cashflow",
      description: "Calculate daily cash inflows and outflows",
      status: "idle"
    },
    {
      name: "AR ETL",
      function: "etl-ar",
      description: "Process accounts receivable aging",
      status: "idle"
    },
    {
      name: "FX Imputation",
      function: "fx-imputation",
      description: "Fill missing foreign exchange rates",
      status: "idle"
    }
  ]);

  const runETL = async (jobIndex: number) => {
    const job = jobs[jobIndex];
    
    // Update status to running
    setJobs(prev => prev.map((j, i) => 
      i === jobIndex ? { ...j, status: "running" as const } : j
    ));

    try {
      // Get company_id from user profile
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user?.id)
        .single();

      if (!profile?.company_id) {
        throw new Error('Company ID not found');
      }

      // Calculate date range (last 12 months)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12);

      const { data, error } = await supabase.functions.invoke(job.function, {
        body: {
          company_id: profile.company_id,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        }
      });

      if (error) throw error;

      // Update status to success
      setJobs(prev => prev.map((j, i) => 
        i === jobIndex ? { ...j, status: "success" as const, lastRun: new Date() } : j
      ));

      // Invalidate all relevant queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: ['financial-metrics'] });
      await queryClient.invalidateQueries({ queryKey: ['period-comparison'] });
      
      // Invalidate specific queries based on job type
      if (job.function === 'etl-revenue') {
        await queryClient.invalidateQueries({ queryKey: ['revenue-data'] });
        await queryClient.invalidateQueries({ queryKey: ['revenue-sources'] });
        await queryClient.invalidateQueries({ queryKey: ['revenue-trends'] });
        await queryClient.invalidateQueries({ queryKey: ['revenue-profit-data'] });
        await queryClient.invalidateQueries({ queryKey: ['profitability-data'] });
        await queryClient.invalidateQueries({ queryKey: ['regional-revenue'] });
      } else if (job.function === 'etl-expenses') {
        await queryClient.invalidateQueries({ queryKey: ['expense-data'] });
        await queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
        await queryClient.invalidateQueries({ queryKey: ['expense-trends'] });
        await queryClient.invalidateQueries({ queryKey: ['profitability-data'] });
      } else if (job.function === 'etl-cashflow') {
        await queryClient.invalidateQueries({ queryKey: ['cashflow-data'] });
        await queryClient.invalidateQueries({ queryKey: ['cashflow-daily'] });
      } else if (job.function === 'etl-ar') {
        await queryClient.invalidateQueries({ queryKey: ['ar-data'] });
        await queryClient.invalidateQueries({ queryKey: ['receivables-data'] });
      }

      toast({
        title: "ETL Job Complete",
        description: `${job.name} completed successfully`,
      });

      console.log(`${job.name} result:`, data);
    } catch (error) {
      console.error(`Error running ${job.name}:`, error);
      
      // Update status to error
      setJobs(prev => prev.map((j, i) => 
        i === jobIndex ? { ...j, status: "error" as const } : j
      ));

      toast({
        title: "ETL Job Failed",
        description: `${job.name} encountered an error`,
        variant: "destructive"
      });
    }
  };

  const runAllETL = async () => {
    toast({
      title: "Running All ETL Jobs",
      description: "This may take a few moments...",
    });

    for (let i = 0; i < jobs.length; i++) {
      await runETL(i);
      // Small delay between jobs
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    toast({
      title: "All ETL Jobs Complete",
      description: "Your data has been refreshed",
    });
  };

  const getStatusIcon = (status: ETLJob["status"]) => {
    switch (status) {
      case "running":
        return <RefreshCw className="w-4 h-4 animate-spin" />;
      case "success":
        return <CheckCircle className="w-4 h-4 text-success" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: ETLJob["status"]) => {
    switch (status) {
      case "running":
        return <Badge variant="secondary">Running</Badge>;
      case "success":
        return <Badge className="bg-success text-success-foreground">Success</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Idle</Badge>;
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-primary" />
          <div>
            <h3 className="text-lg">ETL Data Processing</h3>
            <p className="text-sm text-muted-foreground">
              Process and refresh financial data
            </p>
          </div>
        </div>
        <Button onClick={runAllETL} disabled={jobs.some(j => j.status === "running")}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Run All
        </Button>
      </div>

      <div className="space-y-3">
        {jobs.map((job, index) => (
          <div
            key={job.function}
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted-50 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1">
              {getStatusIcon(job.status)}
              <div className="flex-1">
                <div className="font-medium">{job.name}</div>
                <div className="text-sm text-muted-foreground">{job.description}</div>
                {job.lastRun && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Last run: {job.lastRun.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(job.status)}
              <Button
                size="sm"
                variant="outline"
                onClick={() => runETL(index)}
                disabled={job.status === "running"}
              >
                {job.status === "running" ? "Running..." : "Run"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-muted rounded-lg">
        <h4 className="text-sm mb-2">About ETL Processing</h4>
        <p className="text-sm text-muted-foreground">
          ETL (Extract, Transform, Load) jobs process your raw transaction data into optimized
          fact tables for faster analytics. Run these jobs after importing new data or to refresh
          your dashboard metrics.
        </p>
      </div>
    </Card>
  );
};
