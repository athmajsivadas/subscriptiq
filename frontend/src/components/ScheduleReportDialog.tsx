import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScheduledReport, ScheduledReportInput } from "@/hooks/useScheduledReports";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScheduleReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ScheduledReportInput) => void;
  initialData?: ScheduledReport | null;
}

export const ScheduleReportDialog = ({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: ScheduleReportDialogProps) => {
  const [formData, setFormData] = useState<ScheduledReportInput>({
    report_type: "profit-loss",
    report_name: "",
    frequency: "monthly",
    next_run_date: "",
    recipients: [],
    format: "pdf",
    is_active: true,
  });
  const [recipientInput, setRecipientInput] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  useEffect(() => {
    if (initialData) {
      setFormData({
        report_type: initialData.report_type,
        report_name: initialData.report_name,
        frequency: initialData.frequency,
        next_run_date: initialData.next_run_date,
        recipients: initialData.recipients,
        format: initialData.format,
        is_active: initialData.is_active,
      });
      setRecipientInput(initialData.recipients.join(", "));
      if (initialData.next_run_date) {
        setSelectedDate(new Date(initialData.next_run_date));
      }
    } else {
      setFormData({
        report_type: "profit-loss",
        report_name: "",
        frequency: "monthly",
        next_run_date: "",
        recipients: [],
        format: "pdf",
        is_active: true,
      });
      setRecipientInput("");
      setSelectedDate(undefined);
    }
  }, [initialData, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const recipients = recipientInput
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email.length > 0);
    
    onSubmit({ ...formData, recipients });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Scheduled Report" : "Schedule New Report"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report_name">Report Name</Label>
            <Input
              id="report_name"
              value={formData.report_name}
              onChange={(e) => setFormData({ ...formData, report_name: e.target.value })}
              placeholder="e.g., Monthly P&L Report"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report_type">Report Type</Label>
            <Select
              value={formData.report_type}
              onValueChange={(value) => setFormData({ ...formData, report_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="profit-loss">Profit & Loss Statement</SelectItem>
                <SelectItem value="balance-sheet">Balance Sheet</SelectItem>
                <SelectItem value="cash-flow">Cash Flow Statement</SelectItem>
                <SelectItem value="tax-summary">Tax Summary Report</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency</Label>
            <Select
              value={formData.frequency}
              onValueChange={(value) => setFormData({ ...formData, frequency: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="next_run_date">Next Run Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-background border z-50" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setFormData({ 
                      ...formData, 
                      next_run_date: date ? format(date, "yyyy-MM-dd") : "" 
                    });
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="format">Export Format</Label>
            <Select
              value={formData.format}
              onValueChange={(value) => setFormData({ ...formData, format: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="excel">Excel (XLSX)</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipients">Email Recipients (comma-separated)</Label>
            <Input
              id="recipients"
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is_active">Active</Label>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {initialData ? "Update Schedule" : "Create Schedule"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
