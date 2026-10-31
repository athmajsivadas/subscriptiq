import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, FileUp, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/useNotifications";
import { Progress } from "@/components/ui/progress";
import { useQueryClient } from "@tanstack/react-query";

interface CSVUploaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DataType = "invoices" | "expenses" | "bank_transactions" | "fx_rates" | "vendor_bills" | "accounts";
type UploadStep = "select" | "upload" | "processing" | "complete";

interface ProcessResult {
  success: boolean;
  processed: number;
  rejected: number;
  message: string;
}

const dataTypeInfo = {
  invoices: {
    label: "Invoices",
    description: "Customer invoices with amounts, dates, and status",
    requiredColumns: ["Customer Name", "Issue Date", "Due Date", "Amount Total", "Status"],
    statusNote: "Supported: Draft, Open, Paid, Partially Paid, Cancelled, Canceled, Overdue, Pending",
  },
  expenses: {
    label: "Expenses",
    description: "Company expenses by category and vendor",
    requiredColumns: ["Date", "Amount", "Category"],
  },
  bank_transactions: {
    label: "Bank Transactions",
    description: "Bank account transactions with categorization",
    requiredColumns: ["Date", "Amount", "Type", "Account Name"],
  },
  fx_rates: {
    label: "FX Rates",
    description: "Foreign exchange rates for currency conversion",
    requiredColumns: ["Date", "Currency", "Rate to Base"],
  },
  vendor_bills: {
    label: "Vendor Bills",
    description: "Bills from vendors (money you owe) with due dates",
    requiredColumns: ["Vendor Name", "Issue Date", "Due Date", "Amount Total", "Status"],
    statusNote: "Supported: open, partial, paid",
  },
  accounts: {
    label: "Accounts (Cash Balances)",
    description: "Bank and cash accounts with current balances",
    requiredColumns: ["Account Name", "Balance", "Currency"],
    statusNote: "Balance should be a positive number for assets",
  },
};

export function CSVUploader({ open, onOpenChange }: CSVUploaderProps) {
  const [step, setStep] = useState<UploadStep>("select");
  const [dataType, setDataType] = useState<DataType>("invoices");
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const { toast } = useToast();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  const resetState = () => {
    setStep("select");
    setFile(null);
    setProgress(0);
    setResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast({
          title: "Invalid file type",
          description: "Please select a CSV file",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      setStep("upload");
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setProcessing(true);
    setStep("processing");
    setProgress(25);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload file to storage
      const fileName = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('csv-imports')
        .upload(fileName, file);

      if (uploadError) throw uploadError;
      setProgress(50);

      // Call processing function with extended timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute timeout

      try {
        const { data: processResult, error: processError } = await supabase.functions.invoke('process-csv', {
          body: { 
            file_path: fileName, 
            data_type: dataType 
          },
        });

        clearTimeout(timeoutId);

        if (processError) {
          // Check if it's a timeout
          if (processError.message?.includes('aborted')) {
            throw new Error('Processing timeout - file may be too large. Please try a smaller batch.');
          }
          throw processError;
        }
        
        setProgress(100);

        setResult(processResult as ProcessResult);
        setStep("complete");

        // Reset queries to clear cache and force immediate refetch
        // This is more aggressive than invalidate and ensures fresh data
        const resets: Promise<void>[] = [];
        
        if (dataType === 'expenses') {
          resets.push(
            queryClient.resetQueries({ queryKey: ['expense-data'] }),
            queryClient.resetQueries({ queryKey: ['expense-categories'] }),
            queryClient.resetQueries({ queryKey: ['expense-trends'] }),
            queryClient.resetQueries({ queryKey: ['profitability-data'] }),
            queryClient.resetQueries({ queryKey: ['profit-breakdown'] }),
            queryClient.resetQueries({ queryKey: ['margin-trends'] }),
            queryClient.resetQueries({ queryKey: ['margin-trends-timeseries'] }),
            queryClient.resetQueries({ queryKey: ['financial-metrics'] }),
            queryClient.resetQueries({ queryKey: ['vendors'] })
          );
        } else if (dataType === 'invoices') {
          resets.push(
            queryClient.resetQueries({ queryKey: ['financial-metrics'] }),
            queryClient.resetQueries({ queryKey: ['revenue-data'] }),
            queryClient.resetQueries({ queryKey: ['revenue-sources'] }),
            queryClient.resetQueries({ queryKey: ['revenue-trends'] }),
            queryClient.resetQueries({ queryKey: ['profitability-data'] }),
            queryClient.resetQueries({ queryKey: ['profit-breakdown'] }),
            queryClient.resetQueries({ queryKey: ['margin-trends'] }),
            queryClient.resetQueries({ queryKey: ['margin-trends-timeseries'] }),
            queryClient.resetQueries({ queryKey: ['regional-revenue'] }),
            queryClient.resetQueries({ queryKey: ['top-clients'] }),
            queryClient.resetQueries({ queryKey: ['ar-data'] }),
            queryClient.resetQueries({ queryKey: ['ap-data'] }),
            queryClient.resetQueries({ queryKey: ['dso'] }),
            queryClient.resetQueries({ queryKey: ['recent-activity'] })
          );
        } else if (dataType === 'bank_transactions') {
          resets.push(
            queryClient.resetQueries({ queryKey: ['cashflow-data'] }),
            queryClient.resetQueries({ queryKey: ['cashflow-daily'] }),
            queryClient.resetQueries({ queryKey: ['profitability-data'] }),
            queryClient.resetQueries({ queryKey: ['profit-breakdown'] }),
            queryClient.resetQueries({ queryKey: ['margin-trends'] }),
            queryClient.resetQueries({ queryKey: ['margin-trends-timeseries'] }),
            queryClient.resetQueries({ queryKey: ['financial-metrics'] })
          );
        } else if (dataType === 'vendor_bills') {
          resets.push(
            queryClient.resetQueries({ queryKey: ['ap-data'] }),
            queryClient.resetQueries({ queryKey: ['recent-activity'] }),
            queryClient.resetQueries({ queryKey: ['financial-metrics'] })
          );
        } else if (dataType === 'fx_rates') {
          // Reset all queries since FX rates affect all monetary calculations
          resets.push(queryClient.resetQueries());
        } else if (dataType === 'accounts') {
          resets.push(
            queryClient.resetQueries({ queryKey: ['accounts'] }),
            queryClient.resetQueries({ queryKey: ['cashflow-data'] }),
            queryClient.resetQueries({ queryKey: ['financial-metrics'] })
          );
        }

        // Wait for all resets to complete in parallel
        await Promise.all(resets);

        const isSuccess = processResult.processed > 0;
        
        toast({
          title: isSuccess ? "Import successful" : "Import failed",
          description: isSuccess 
            ? `Processed ${processResult.processed} records${processResult.rejected > 0 ? `, ${processResult.rejected} rejected` : ''}`
            : `All ${processResult.rejected} records were rejected`,
          variant: isSuccess ? "default" : "destructive",
        });

        // Add in-app notification
        addNotification({
          title: `${dataTypeInfo[dataType].label} Import ${isSuccess ? 'Complete' : 'Failed'}`,
          message: isSuccess 
            ? `Successfully processed ${processResult.processed} records${processResult.rejected > 0 ? ` (${processResult.rejected} rejected)` : ''}`
            : `All ${processResult.rejected} records were rejected. Please check the CSV format.`,
          type: isSuccess ? 'success' : 'error',
        });
      } finally {
        clearTimeout(timeoutId);
      }

      // Clean up file from storage
      await supabase.storage.from('csv-imports').remove([fileName]);

    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to process CSV file",
        variant: "destructive",
      });
      setStep("upload");
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import CSV Data</DialogTitle>
          <DialogDescription>
            Upload CSV files to import financial data into your system
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {step === "select" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="data-type">Data Type</Label>
                <Select value={dataType} onValueChange={(value) => setDataType(value as DataType)}>
                  <SelectTrigger id="data-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(dataTypeInfo).map(([key, info]) => (
                      <SelectItem key={key} value={key}>
                        {info.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {dataTypeInfo[dataType].description}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Required Columns</Label>
                <div className="flex flex-wrap gap-2">
                  {dataTypeInfo[dataType].requiredColumns.map((col) => (
                    <span key={col} className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full">
                      {col}
                    </span>
                  ))}
                </div>
                {dataType === 'invoices' && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {dataTypeInfo.invoices.statusNote}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Select CSV File</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                />
              </div>
            </>
          )}

          {step === "upload" && file && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <FileUp className="h-8 w-8 text-primary" />
                <div className="flex-1">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB • {dataTypeInfo[dataType].label}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setStep("select")} variant="outline" className="flex-1">
                  Back
                </Button>
                <Button onClick={handleUpload} className="flex-1" disabled={processing}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & Process
                </Button>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-lg font-medium">Processing CSV...</p>
                <p className="text-sm text-muted-foreground">This may take a moment</p>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {step === "complete" && result && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-6">
                {result.success ? (
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                ) : (
                  <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                )}
                <p className="text-lg font-medium">{result.message}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Processed</p>
                  <p className="text-2xl font-bold text-green-600">{result.processed}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                  <p className="text-2xl font-bold text-destructive">{result.rejected}</p>
                </div>
              </div>

              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
