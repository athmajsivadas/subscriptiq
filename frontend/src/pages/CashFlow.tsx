import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/MetricCard";
import { TrendingUp, TrendingDown, DollarSign, Banknote } from "lucide-react";
import { FilterHeader, FilterState } from "@/components/FilterHeader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subMonths, format, parseISO, differenceInDays } from "date-fns";
import { formatCurrency } from "@/hooks/useFinancialData";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";
import { toast } from "sonner";
import { useCashFlowDrillDown } from "@/hooks/useCashFlowDrillDown";
import { CashFlowDataTable } from "@/components/CashFlowDataTable";

const CashFlow = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {},
    currency: 'USD'
  });

  const { convertAmount, currencySymbol } = useCurrencyConversion(filters.currency);
  const { drillDownData, handlePeriodClick, clearDrillDown } = useCashFlowDrillDown();

  // Format currency - amounts are already converted in the query
  const formatWithCurrency = (amount: number) => {
    return `${currencySymbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // ETL trigger mutation
  const triggerETL = useMutation({
    mutationFn: async () => {
      const today = new Date();
      const startDate = format(subMonths(today, 12), 'yyyy-MM-dd');
      const endDate = format(today, 'yyyy-MM-dd');
      
      const { data, error } = await supabase.functions.invoke('etl-cashflow', {
        body: {
          company_id: '550e8400-e29b-41d4-a716-446655440000',
          start_date: startDate,
          end_date: endDate
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashflow-data"] });
      toast.success("Cash flow data processed successfully");
    },
    onError: (error) => {
      console.error('ETL error:', error);
      toast.error("Failed to process cash flow data");
    }
  });

  const { data: cashflowData } = useQuery({
    queryKey: ["cashflow-data", filters.dateRange, filters.currency],
    queryFn: async () => {
      let query = supabase.from("facts_cashflow_daily").select("*").order("date");

      // Apply date filters if provided - using local date format to avoid timezone issues
      if (filters.dateRange?.from) {
        const fromDate = format(filters.dateRange.from, 'yyyy-MM-dd');
        console.log('Cash flow filter FROM:', fromDate);
        query = query.gte("date", fromDate);
      }
      if (filters.dateRange?.to) {
        const toDate = format(filters.dateRange.to, 'yyyy-MM-dd');
        console.log('Cash flow filter TO:', toDate);
        query = query.lte("date", toDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      console.log('Cash flow data returned:', data?.length || 0, 'records');

      // Convert each transaction at its date's FX rate, then calculate totals
      const totals = data.reduce((acc, row) => ({
        inflow: acc.inflow + convertAmount(row.inflow, 'USD', row.date),
        outflow: acc.outflow + convertAmount(row.outflow, 'USD', row.date)
      }), { inflow: 0, outflow: 0 });

      // Determine granularity based on date range
      const dateRangeDays = filters.dateRange?.from && filters.dateRange?.to 
        ? differenceInDays(filters.dateRange.to, filters.dateRange.from)
        : data.length > 0 
          ? differenceInDays(parseISO(data[data.length - 1].date), parseISO(data[0].date))
          : 0;
      
      const useDailyGranularity = dateRangeDays <= 30;

      // Aggregate by day or month based on range, converting each transaction at its date's FX rate
      const aggregatedData = data.reduce((acc: any, row) => {
        const key = useDailyGranularity 
          ? format(parseISO(row.date), "MMM dd")
          : format(parseISO(row.date), "MMM yyyy");
        const dateKey = useDailyGranularity
          ? format(parseISO(row.date), "yyyy-MM-dd")
          : format(parseISO(row.date), "yyyy-MM");
        
        if (!acc[key]) {
          acc[key] = { period: key, dateKey, inflow: 0, outflow: 0, net: 0 };
        }
        // Convert each transaction at its own date's FX rate
        const convertedInflow = convertAmount(row.inflow, 'USD', row.date);
        const convertedOutflow = convertAmount(row.outflow, 'USD', row.date);
        acc[key].inflow += convertedInflow;
        acc[key].outflow += convertedOutflow;
        acc[key].net += convertedInflow - convertedOutflow;
        return acc;
      }, {});

      // Sort by date and keep dateKey for drill-down
      const chartData = Object.values(aggregatedData)
        .sort((a: any, b: any) => a.dateKey.localeCompare(b.dateKey));

      return { totals, chartData };
    },
  });

  // Fetch actual cash balance from accounts (convert to selected currency)
  const { data: accountsData } = useQuery({
    queryKey: ["accounts-balance", filters.currency],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("balance, currency");
      
      if (error) throw error;
      
      // Convert each account balance to the selected currency using latest rate
      const totalBalance = data.reduce((sum, account) => {
        const converted = convertAmount(account.balance, account.currency || 'USD');
        return sum + converted;
      }, 0);
      return totalBalance;
    },
  });

  // Fetch AI-powered forecast
  const { data: forecastData, isLoading: isForecastLoading } = useQuery({
    queryKey: ["cashflow-forecast", cashflowData?.chartData],
    queryFn: async () => {
      if (!cashflowData?.chartData || cashflowData.chartData.length === 0) {
        return null;
      }

      const { data, error } = await supabase.functions.invoke('cashflow-forecast', {
        body: { historicalData: cashflowData.chartData }
      });

      if (error) throw error;
      return data.forecast;
    },
    enabled: !!cashflowData?.chartData && cashflowData.chartData.length > 0,
  });

  // Auto-trigger ETL if no cashflow data exists
  useEffect(() => {
    if (cashflowData && !cashflowData.totals.inflow && !cashflowData.totals.outflow && !triggerETL.isPending && !triggerETL.isSuccess) {
      supabase.from('bank_transactions').select('id', { count: 'exact', head: true }).then(({ count }) => {
        if (count && count > 0) {
          console.log('Auto-triggering ETL for', count, 'transactions');
          triggerETL.mutate();
        }
      });
    }
  }, [cashflowData, triggerETL.isPending, triggerETL.isSuccess]);

  const netCashFlow = (cashflowData?.totals.inflow || 0) - (cashflowData?.totals.outflow || 0);
  const totalOutflow = cashflowData?.totals.outflow || 0;
  
  // Calculate monthly burn rate based on the date range
  let dateRangeDays = 30; // default to 30 days
  if (filters.dateRange?.from && filters.dateRange?.to) {
    dateRangeDays = differenceInDays(filters.dateRange.to, filters.dateRange.from);
  } else if (cashflowData?.chartData && cashflowData.chartData.length > 0) {
    const firstDate = (cashflowData.chartData[0] as any).dateKey;
    const lastDate = (cashflowData.chartData[cashflowData.chartData.length - 1] as any).dateKey;
    if (firstDate && lastDate) {
      dateRangeDays = differenceInDays(parseISO(lastDate), parseISO(firstDate));
    }
  }
  const monthlyBurnRate = dateRangeDays > 0 ? (totalOutflow / dateRangeDays) * 30 : 0;
  
  const cashBalance = accountsData || 0;
  const freeCashFlow = netCashFlow;
  const hasData = (cashflowData?.totals.inflow || 0) > 0 || (cashflowData?.totals.outflow || 0) > 0;
  const runwayMonths = monthlyBurnRate > 0 && cashBalance > 0 ? cashBalance / monthlyBurnRate : 0;

  return (
    <div className="space-y-0">
      <FilterHeader 
        filters={filters}
        onFiltersChange={setFilters}
        showFxCurrency={true}
      />
      
      <div className="space-y-6 p-4">
      <div>
        <h1 className="text-3xl tracking-tight">Cash Flow Management</h1>
        <p className="text-muted-foreground">
          Monitor cash inflows and outflows to maintain healthy liquidity
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Operating Cash Flow"
          value={formatWithCurrency(netCashFlow)}
          changeType="positive"
          hasData={hasData}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          title="Free Cash Flow"
          value={formatWithCurrency(freeCashFlow)}
          changeType="positive"
          hasData={hasData}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          title="Cash Balance"
          value={formatWithCurrency(cashBalance)}
          changeType="positive"
          hasData={cashBalance > 0}
          icon={<Banknote className="w-5 h-5" />}
        />
        <MetricCard
          title="Monthly Burn Rate"
          value={formatWithCurrency(monthlyBurnRate)}
          changeType="negative"
          hasData={hasData}
          icon={<TrendingDown className="w-5 h-5" />}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Cash Flow Summary */}
        <Card className="p-6">
          <h3 className="text-lg mb-4">Cash Flow Summary</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Cash Inflows</span>
              <span className="font-medium text-green-600">+{formatWithCurrency(cashflowData?.totals.inflow || 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Cash Outflows</span>
              <span className="font-medium text-red-600">-{formatWithCurrency(cashflowData?.totals.outflow || 0)}</span>
            </div>
            <div className="flex justify-between items-center border-t pt-2">
              <span className="text-sm font-medium">Net Cash Flow</span>
              <span className="font-semibold text-green-600">+{formatWithCurrency(netCashFlow)}</span>
            </div>
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Cash Runway</div>
              <div className="font-semibold">{runwayMonths > 0 ? `${runwayMonths.toFixed(1)} months` : 'N/A'}</div>
              <div className="text-xs text-green-600">
                {runwayMonths > 0 
                  ? 'Based on monthly burn rate' 
                  : cashBalance === 0 
                    ? 'Add cash balance to accounts to see runway' 
                    : 'Add expenses data to calculate burn rate'}
              </div>
            </div>
          </div>
        </Card>

        {/* Monthly Trends */}
        <Card className="p-6">
          <h3 className="text-lg mb-4">Monthly Cash Flow Trends</h3>
          {hasData && cashflowData?.chartData && cashflowData.chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart 
                data={cashflowData.chartData}
                onClick={(data) => {
                  if (data && data.activePayload && data.activePayload[0]) {
                    const payload = data.activePayload[0].payload;
                    handlePeriodClick(payload.period, payload.dateKey);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => {
                  const converted = convertAmount(value, 'USD');
                  if (converted >= 1000000) return `${currencySymbol}${(converted / 1000000).toFixed(1)}M`;
                  if (converted >= 1000) return `${currencySymbol}${(converted / 1000).toFixed(0)}K`;
                  return `${currencySymbol}${converted.toFixed(0)}`;
                }} />
                <Tooltip formatter={(value) => formatWithCurrency(Number(value))} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="inflow" 
                  stroke="#10b981" 
                  name="Inflows" 
                  strokeWidth={2}
                  activeDot={{ cursor: 'pointer', r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="outflow" 
                  stroke="#ef4444" 
                  name="Outflows" 
                  strokeWidth={2}
                  activeDot={{ cursor: 'pointer', r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="net" 
                  stroke="#3b82f6" 
                  name="Net Cash Flow" 
                  strokeWidth={2}
                  activeDot={{ cursor: 'pointer', r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center py-8">
              <span className="inline-flex items-center justify-center rounded-md bg-muted px-3 py-1 text-sm text-muted-foreground">No Data</span>
            </div>
          )}
        </Card>
      </div>

      {/* Drill-down table */}
      {drillDownData && (
        <CashFlowDataTable 
          drillDownData={drillDownData} 
          onClose={clearDrillDown}
          formatCurrency={formatWithCurrency}
        />
      )}

      {/* Cash Flow Forecast */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg">12-Month Cash Flow Forecast</h3>
          <Badge variant="secondary" className="bg-secondary-light text-secondary hover:bg-secondary-light-20">
            AI Generated
          </Badge>
        </div>
        {isForecastLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="inline-flex items-center justify-center rounded-md bg-muted px-3 py-1 text-sm text-muted-foreground">Generating AI forecast...</span>
          </div>
        ) : forecastData && forecastData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(value) => formatWithCurrency(Number(value))} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="inflow" 
                stroke="#10b981" 
                name="Projected Inflows" 
                strokeWidth={2}
                strokeDasharray="5 5"
              />
              <Line 
                type="monotone" 
                dataKey="outflow" 
                stroke="#ef4444" 
                name="Projected Outflows" 
                strokeWidth={2}
                strokeDasharray="5 5"
              />
              <Line 
                type="monotone" 
                dataKey="net" 
                stroke="#3b82f6" 
                name="Projected Net" 
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center py-8">
            <span className="inline-flex items-center justify-center rounded-md bg-muted px-3 py-1 text-sm text-muted-foreground">
              {hasData ? "Unable to generate forecast" : "Add cash flow data to see forecast"}
            </span>
          </div>
        )}
      </Card>
      </div>
    </div>
  );
};

export default CashFlow;