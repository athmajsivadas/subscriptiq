import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle, CheckIcon, DollarSign, Plus } from "lucide-react";
import { FilterHeader, FilterState } from "@/components/FilterHeader";
import { useARData, useAPData, useDSO, formatCurrency, useRecentActivity, useARDetailedData, useAPDetailedData } from "@/hooks/useReceivablesData";
import { ARTable } from "@/components/ARTable";
import { APTable } from "@/components/APTable";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";
import { InvoiceDialog } from "@/components/InvoiceDialog";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DonutChart } from "@/components/DonutChart";

const Receivables = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {},
    currency: "USD",
  });
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [arSortBy, setArSortBy] = useState('due_date_asc');
  const [apSortBy, setApSortBy] = useState('due_date_asc');
  const [arPage, setArPage] = useState(1);

  const { data: arData, isLoading: arLoading } = useARData(filters.dateRange);
  const { data: apData, isLoading: apLoading } = useAPData(filters.dateRange);
  const { data: dso } = useDSO();
  const { data: recentActivity, isLoading: activityLoading } = useRecentActivity();
  const { data: arDetailedResult, isLoading: arDetailedLoading } = useARDetailedData(filters.dateRange, arSortBy, arPage, 20);
  const { data: apDetailedData, isLoading: apDetailedLoading } = useAPDetailedData(filters.dateRange, apSortBy);
  const { convertAmount, currencySymbol } = useCurrencyConversion(filters.currency);

  // Handle search result navigation
  useEffect(() => {
    const invoiceId = searchParams.get('invoiceId');
    const paymentId = searchParams.get('paymentId');
    const customerId = searchParams.get('customerId');

    if (invoiceId) {
      setHighlightedId(invoiceId);
      toast({
        title: "Invoice Found",
        description: "Showing invoice details",
      });
      // Scroll to the activity section
      setTimeout(() => {
        document.querySelector(`[data-id="${invoiceId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
    } else if (paymentId) {
      setHighlightedId(paymentId);
      toast({
        title: "Payment Found",
        description: "Showing payment details",
      });
      setTimeout(() => {
        document.querySelector(`[data-id="${paymentId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
    } else if (customerId) {
      toast({
        title: "Customer Filter Applied",
        description: "Showing transactions for selected customer",
      });
    }

    // Clear the search params after handling
    if (invoiceId || paymentId || customerId) {
      setTimeout(() => {
        setSearchParams({});
        setHighlightedId(null);
      }, 3000);
    }
  }, [searchParams, setSearchParams, toast]);

  const formatWithCurrency = (amount: number, fromCurrency: string = 'USD', transactionDate?: string) => {
    const converted = convertAmount(amount, fromCurrency, transactionDate);
    return `${currencySymbol}${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (arLoading || apLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading receivables data...</p>
        </div>
      </div>
    );
  }

  const avgCollectionPeriod = arData?.averageCollectionPeriod
    ? `${Math.round(arData.averageCollectionPeriod)} days`
    : "N/A";

  const hasARData = arData && arData.total > 0;
  const hasAPData = apData && apData.total > 0;
  const hasDSOData = dso !== null && dso !== undefined;

  return (
    <div className="space-y-0">
      <FilterHeader filters={filters} onFiltersChange={setFilters} showFxCurrency={true} />

      <div className="space-y-6 p-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl tracking-tight">Accounts Receivable & Payable</h1>
            <p className="text-muted-foreground">Manage outstanding invoices and payment obligations</p>
          </div>
          <Button onClick={() => setInvoiceDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Invoice
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Outstanding Receivables"
            value={arData ? formatWithCurrency(arData.total) : `${currencySymbol}0`}
            change={hasARData ? "-8.2%" : undefined}
            changeType="positive"
            hasData={hasARData}
            icon={<DollarSign className="w-5 h-5" />}
          />
          <MetricCard
            title="Average Collection Period"
            value={avgCollectionPeriod}
            change={hasARData ? "+2 days" : undefined}
            changeType="negative"
            hasData={hasARData}
            icon={<Clock className="w-5 h-5" />}
          />
          <MetricCard
            title="Outstanding Payables"
            value={apData ? formatWithCurrency(apData.total) : `${currencySymbol}0`}
            change={hasAPData ? "+5.1%" : undefined}
            changeType="neutral"
            hasData={hasAPData}
            icon={<AlertTriangle className="w-5 h-5" />}
          />
          <MetricCard
            title="DSO (Days Sales Outstanding)"
            value={dso ? `${dso} days` : "N/A"}
            change={dso ? `${dso} day(s)` : undefined}
            changeType="positive"
            hasData={hasDSOData}
            icon={<Clock className="w-5 h-5" />}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Accounts Receivable */}
          <div className="grid gap-4">
            <Card className="p-6 min-h-[280px] flex flex-col">
              <h3 className="text-lg mb-4">Accounts Receivable</h3>
              {hasARData && arData?.buckets && arData.buckets.length > 0 ? (
                <div className="space-y-4 flex-1">
                  {arData.buckets.map((bucket, index) => {
                  const iconColor = index === 0 ? "bg-green-100" : index === 1 ? "bg-yellow-100" : "bg-red-100";
                  const textColor = index === 0 ? "text-green-600" : index === 1 ? "text-yellow-600" : "text-red-600";
                  const Icon = index === 0 ? CheckIcon : index === 1 ? Clock : AlertTriangle;

                  return (
                    <div key={bucket.bucket} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 ${iconColor} rounded-full flex items-center justify-center`}>
                          <Icon className={`w-4 h-4 ${textColor}`} />
                        </div>
                        <div>
                          <div className="font-medium">{bucket.bucket}</div>
                          <div className="text-sm text-muted-foreground">{bucket.count} invoices</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatWithCurrency(bucket.amount)}</div>
                        <div className={`text-sm ${textColor}`}>{bucket.percentage.toFixed(0)}% of total</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Badge variant="secondary">No Data</Badge>
                </div>
              )}
            </Card>
            
            {hasARData && arData?.buckets && arData.buckets.length > 0 && (
              <DonutChart
                title="Aging Analysis"
                data={arData.buckets.map((bucket, index) => ({
                  name: bucket.bucket,
                  value: bucket.amount,
                  color: index === 0 ? "hsl(142, 76%, 36%)" : index === 1 ? "hsl(45, 93%, 47%)" : "hsl(0, 84%, 60%)"
                }))}
                centerValue={formatWithCurrency(arData.total)}
                centerLabel="Total AR"
              />
            )}
          </div>

          {/* Accounts Payable */}
          <div className="grid gap-4">
            <Card className="p-6 min-h-[280px] flex flex-col">
              <h3 className="text-lg mb-4">Accounts Payable</h3>
              {hasAPData && apData?.groups && apData.groups.length > 0 ? (
              <div className="space-y-4">
                {apData.groups.map((group) => {
                  const badgeVariant =
                    group.badge === "Urgent" ? "destructive" : group.badge === "Current" ? "secondary" : "outline";

                  return (
                    <div key={group.name} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <div>
                        <div className="font-medium">{group.name}</div>
                        <div className="text-sm text-muted-foreground">{group.count} bills</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatWithCurrency(group.amount)}</div>
                        <Badge variant={badgeVariant} className="ml-2">
                          {group.badge}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Badge variant="secondary">No Data</Badge>
                </div>
              )}
            </Card>
            
            {hasAPData && apData?.groups && apData.groups.length > 0 && (
              <DonutChart
                title="Payment Urgency"
                data={apData.groups.map((group) => ({
                  name: group.name,
                  value: group.amount,
                  color: group.badge === "Urgent" ? "hsl(0, 84%, 60%)" : 
                         group.badge === "Current" ? "hsl(221, 83%, 53%)" : 
                         "hsl(240, 5%, 65%)"
                }))}
                centerValue={formatWithCurrency(apData.total)}
                centerLabel="Total AP"
              />
            )}
          </div>
        </div>

        {/* Accounts Receivable Table */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-lg">Open Invoices</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              <Select value={arSortBy} onValueChange={setArSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="due_date_asc">Due Date (Soonest)</SelectItem>
                  <SelectItem value="due_date_desc">Due Date (Latest)</SelectItem>
                  <SelectItem value="issue_date_desc">Most Recent</SelectItem>
                  <SelectItem value="issue_date_asc">Oldest First</SelectItem>
                  <SelectItem value="amount_desc">Amount (High to Low)</SelectItem>
                  <SelectItem value="amount_asc">Amount (Low to High)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {arDetailedLoading ? (
            <Card className="p-6">
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Loading invoices...</p>
                </div>
              </div>
            </Card>
          ) : (
            <ARTable 
              data={arDetailedResult?.data || []} 
              formatCurrency={formatWithCurrency}
              page={arDetailedResult?.page || 1}
              totalPages={arDetailedResult?.totalPages || 1}
              onPageChange={setArPage}
            />
          )}
        </div>

        {/* Accounts Payable Table */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-lg">Open Vendor Bills</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              <Select value={apSortBy} onValueChange={setApSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="due_date_asc">Due Date (Soonest)</SelectItem>
                  <SelectItem value="due_date_desc">Due Date (Latest)</SelectItem>
                  <SelectItem value="issue_date_desc">Most Recent</SelectItem>
                  <SelectItem value="issue_date_asc">Oldest First</SelectItem>
                  <SelectItem value="amount_desc">Amount (High to Low)</SelectItem>
                  <SelectItem value="amount_asc">Amount (Low to High)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {apDetailedLoading ? (
            <Card className="p-6">
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Loading bills...</p>
                </div>
              </div>
            </Card>
          ) : (
            <APTable data={apDetailedData || []} formatCurrency={formatWithCurrency} />
          )}
        </div>

        {/* Recent Activity */}
        <Card className="p-6">
          <h3 className="text-lg mb-4">Recent Activity</h3>
          {activityLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            </div>
          ) : recentActivity && recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div 
                  key={activity.id} 
                  data-id={activity.id}
                  className={`flex justify-between items-center p-3 rounded-lg transition-all ${
                    highlightedId === activity.id 
                      ? 'bg-primary-light-20 ring-2 ring-primary' 
                      : 'bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        activity.type === "payment" ? "bg-green-100" : "bg-primary-light"
                      }`}
                    >
                      {activity.type === "payment" ? (
                        <CheckIcon className={`w-4 h-4 text-green-600`} />
                      ) : (
                        <DollarSign className={`w-4 h-4 text-primary`} />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">
                        {activity.customerName} - {activity.type === "payment" ? "Payment Received" : "Invoice Created"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(activity.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatWithCurrency(activity.amount, activity.currency, activity.date)}</div>
                    <Badge
                      variant={
                        activity.status === "paid" || activity.status === "completed"
                          ? "default"
                          : activity.status === "pending"
                            ? "secondary"
                            : "outline"
                      }
                      className="text-xs"
                    >
                      {activity.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Badge variant="secondary">No Data</Badge>
            </div>
          )}
        </Card>
      </div>

      <InvoiceDialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen} />
    </div>
  );
};

export default Receivables;
