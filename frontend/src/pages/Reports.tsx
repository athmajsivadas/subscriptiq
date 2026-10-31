import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Calendar, TrendingUp, BarChart3, PieChart, Plus, Trash2 } from "lucide-react";
import { FilterHeader, FilterState } from "@/components/FilterHeader";
import { ETLManager } from "@/components/ETLManager";
import { useFinancialMetrics, useRevenueSources, useExpenseCategories } from "@/hooks/useFinancialData";
import { useScheduledReports } from "@/hooks/useScheduledReports";
import { ScheduleReportDialog } from "@/components/ScheduleReportDialog";
import {
  generateProfitLossReport,
  generateBalanceSheetReport,
  generateCashFlowReport,
  generateTaxSummaryReport,
  generateBulkExport
} from "@/lib/reportGenerators";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Reports = () => {
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {},
    currency: 'USD'
  });
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);

  // Fetch financial data for reports
  const { data: metrics } = useFinancialMetrics(filters.dateRange);
  const { data: revenueSources } = useRevenueSources(filters.dateRange);
  const { data: expenseCategories } = useExpenseCategories(filters.dateRange);
  
  // Fetch scheduled reports
  const { 
    scheduledReports, 
    isLoading: isLoadingSchedules,
    createScheduledReport, 
    updateScheduledReport,
    deleteScheduledReport 
  } = useScheduledReports();

  const financialData = {
    metrics,
    revenueSources,
    expenseCategories
  };

  const handleDownloadReport = (reportType: string) => {
    try {
      switch (reportType) {
        case 'profit-loss':
          generateProfitLossReport(financialData, 'pdf', filters.currency);
          break;
        case 'balance-sheet':
          generateBalanceSheetReport(financialData, 'pdf', filters.currency);
          break;
        case 'cash-flow':
          generateCashFlowReport(financialData, 'pdf', filters.currency);
          break;
        case 'tax-summary':
          generateTaxSummaryReport(financialData, 'pdf', filters.currency);
          break;
      }
      toast({
        title: "Report downloaded",
        description: "Your report has been generated successfully.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "There was an error generating your report.",
        variant: "destructive",
      });
    }
  };

  const handleExportFormat = (formatType: string) => {
    try {
      let format: 'csv' | 'excel' | 'pdf' = 'pdf';
      
      if (formatType === 'Excel (XLSX)') format = 'excel';
      else if (formatType === 'CSV') format = 'csv';
      else if (formatType === 'PDF') format = 'pdf';
      
      if (formatType === 'QuickBooks') {
        toast({
          title: "Coming soon",
          description: "QuickBooks integration is not yet available.",
        });
        return;
      }

      generateBulkExport(financialData, format, filters.currency);
      toast({
        title: "Export complete",
        description: `All reports have been exported as ${formatType}.`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "There was an error exporting your data.",
        variant: "destructive",
      });
    }
  };

  const handleBulkExport = () => {
    try {
      generateBulkExport(financialData, 'pdf', filters.currency);
      toast({
        title: "Bulk export complete",
        description: "All reports have been downloaded as PDF files.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "There was an error with the bulk export.",
        variant: "destructive",
      });
    }
  };

  const handleScheduleSubmit = async (data: any) => {
    try {
      if (editingSchedule) {
        await updateScheduledReport.mutateAsync({ id: editingSchedule.id, ...data });
        toast({
          title: "Schedule updated",
          description: "Report schedule has been updated successfully.",
        });
      } else {
        await createScheduledReport.mutateAsync(data);
        toast({
          title: "Schedule created",
          description: "Report has been scheduled successfully.",
        });
      }
      setEditingSchedule(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save schedule.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSchedule = async () => {
    if (!scheduleToDelete) return;
    try {
      await deleteScheduledReport.mutateAsync(scheduleToDelete);
      toast({
        title: "Schedule deleted",
        description: "Report schedule has been deleted.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete schedule.",
        variant: "destructive",
      });
    }
    setDeleteDialogOpen(false);
    setScheduleToDelete(null);
  };
  const reports = [
    {
      id: 'profit-loss',
      name: "Profit & Loss Statement",
      description: "Comprehensive income statement for the selected period",
      icon: TrendingUp,
      lastGenerated: "2 hours ago",
      status: "ready"
    },
    {
      id: 'balance-sheet',
      name: "Balance Sheet",
      description: "Assets, liabilities, and equity overview",
      icon: BarChart3,
      lastGenerated: "1 day ago",
      status: "ready"
    },
    {
      id: 'cash-flow',
      name: "Cash Flow Statement",
      description: "Operating, investing, and financing activities",
      icon: PieChart,
      lastGenerated: "3 hours ago",
      status: "ready"
    },
    {
      id: 'tax-summary',
      name: "Tax Summary Report",
      description: "Tax obligations and deductions summary",
      icon: FileText,
      lastGenerated: "1 week ago",
      status: "ready"
    }
  ];

  const exportFormats = [
    { name: "Excel (XLSX)", description: "Spreadsheet format with formulas", icon: "📊" },
    { name: "PDF", description: "Professional formatted document", icon: "📄" },
    { name: "CSV", description: "Comma-separated values for analysis", icon: "📈" },
    { name: "QuickBooks", description: "Direct integration with QuickBooks", icon: "💼" }
  ];

  return (
    <div className="space-y-0">
      <FilterHeader 
        filters={filters}
        onFiltersChange={setFilters}
        showFxCurrency={true}
      />
      
      <div className="space-y-6 p-4">
        <div>
          <h1 className="text-3xl tracking-tight">Reports & Export</h1>
          <p className="text-muted-foreground">
            Generate financial reports and export data in various formats
          </p>
        </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => toast({ title: "Coming soon", description: "Custom report generation will be available soon." })}>
          <FileText className="w-4 h-4 mr-2" />
          Generate New Report
        </Button>
        <Button variant="outline" onClick={() => {
          setEditingSchedule(null);
          setScheduleDialogOpen(true);
        }}>
          <Calendar className="w-4 h-4 mr-2" />
          Schedule Report
        </Button>
        <Button variant="outline" onClick={handleBulkExport}>
          <Download className="w-4 h-4 mr-2" />
          Bulk Export
        </Button>
      </div>

      {/* Available Reports */}
      <Card className="p-6">
        <h3 className="text-lg mb-4">Available Reports</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {reports.map((report, index) => (
            <div key={index} className="flex flex-col justify-between p-4 border rounded-lg min-h-[160px]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-light rounded-lg flex items-center justify-center">
                    <report.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{report.name}</div>
                    <div className="text-sm text-muted-foreground">{report.description}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Last generated: {report.lastGenerated}
                    </div>
                  </div>
                </div>
                <Badge 
                  variant="secondary"
                  className="text-primary-foreground"
                >
                  {report.status === 'ready' ? 'Ready' : 'Generating...'}
                </Badge>
              </div>
              {report.status === 'ready' ? (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full"
                  onClick={() => handleDownloadReport(report.id)}
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="w-full" disabled>
                  <Download className="w-3 h-3 mr-1" />
                  Generating...
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* ETL Data Management */}
      <ETLManager />

      {/* Export Formats */}
      <Card className="p-6">
        <h3 className="text-lg mb-4">Export Formats</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {exportFormats.map((format, index) => (
            <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{format.icon}</span>
                <div>
                  <div className="font-medium">{format.name}</div>
                  <div className="text-sm text-muted-foreground">{format.description}</div>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleExportFormat(format.name)}
              >
                Export
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Scheduled Reports */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg">Scheduled Reports</h3>
          <Button size="sm" onClick={() => {
            setEditingSchedule(null);
            setScheduleDialogOpen(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            New Schedule
          </Button>
        </div>
        <div className="space-y-3">
          {isLoadingSchedules ? (
            <div className="text-center p-6 text-muted-foreground">
              Loading schedules...
            </div>
          ) : scheduledReports && scheduledReports.length > 0 ? (
            scheduledReports.map((schedule) => (
              <div key={schedule.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{schedule.report_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1)} • 
                    Next run: {new Date(schedule.next_run_date).toLocaleDateString()} • 
                    Format: {schedule.format.toUpperCase()}
                  </div>
                  {schedule.recipients.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Recipients: {schedule.recipients.join(", ")}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={schedule.is_active ? "secondary" : "outline"}>
                    {schedule.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      setEditingSchedule(schedule);
                      setScheduleDialogOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      setScheduleToDelete(schedule.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center p-6 border-2 border-dashed rounded-lg">
              <div className="text-center">
                <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <div className="font-medium">No scheduled reports</div>
                <div className="text-sm text-muted-foreground mb-3">
                  Set up automated report generation
                </div>
                <Button size="sm" onClick={() => {
                  setEditingSchedule(null);
                  setScheduleDialogOpen(true);
                }}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Report
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
      
      <ScheduleReportDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        onSubmit={handleScheduleSubmit}
        initialData={editingSchedule}
      />
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scheduled Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this scheduled report? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSchedule}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
};

export default Reports;