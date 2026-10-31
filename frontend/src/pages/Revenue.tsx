import { useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StackedBarChart } from "@/components/StackedBarChart";
import { 
  DollarSign, 
  TrendingUp, 
  Repeat,
  BarChart3
} from "@/components/icons";
import { 
  useFinancialMetrics, 
  useRevenueSources, 
  useRevenueTrends,
  formatCurrency,
  formatPercentage
} from "@/hooks/useFinancialData";
import { FilterHeader, FilterState } from "@/components/FilterHeader";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";
import { useRevenueDrillDown } from "@/hooks/useRevenueDrillDown";
import { RevenueDrillDownTable } from "@/components/RevenueDrillDownTable";
import { useRevenueDimensions } from "@/hooks/useRevenueDimensions";
import { RevenueDimensionTable } from "@/components/RevenueDimensionTable";

// Mock data for enhanced charts
const mrrData = [
  { month: 'Jan', mrr: 45000, arr: 540000 },
  { month: 'Feb', mrr: 48500, arr: 582000 },
  { month: 'Mar', mrr: 52000, arr: 624000 },
  { month: 'Apr', mrr: 54200, arr: 650400 },
  { month: 'May', mrr: 57800, arr: 693600 },
  { month: 'Jun', mrr: 62500, arr: 750000 }
];

const stackedRevenueData = [
  { month: 'Jan', dateKey: '2024-01', product1: 95000, product2: 65000, product3: 45000, services: 40000 },
  { month: 'Feb', dateKey: '2024-02', product1: 105000, product2: 68000, product3: 50000, services: 45000 },
  { month: 'Mar', dateKey: '2024-03', product1: 110000, product2: 72000, product3: 53000, services: 50000 },
  { month: 'Apr', dateKey: '2024-04', product1: 108000, product2: 69000, product3: 48000, services: 47000 },
  { month: 'May', dateKey: '2024-05', product1: 115000, product2: 75000, product3: 55000, services: 50000 },
  { month: 'Jun', dateKey: '2024-06', product1: 125000, product2: 80000, product3: 60000, services: 45000 }
];

const stackedRegionData = [
  { month: 'Jan', dateKey: '2024-01', 'North America': 120000, 'Europe': 80000, 'Asia': 45000 },
  { month: 'Feb', dateKey: '2024-02', 'North America': 135000, 'Europe': 85000, 'Asia': 48000 },
  { month: 'Mar', dateKey: '2024-03', 'North America': 142000, 'Europe': 90000, 'Asia': 53000 },
  { month: 'Apr', dateKey: '2024-04', 'North America': 135000, 'Europe': 87000, 'Asia': 50000 },
  { month: 'May', dateKey: '2024-05', 'North America': 148000, 'Europe': 92000, 'Asia': 55000 },
  { month: 'Jun', dateKey: '2024-06', 'North America': 155000, 'Europe': 100000, 'Asia': 55000 }
];

const Revenue = () => {
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {},
    currency: 'USD'
  });

  const [drillDownParams, setDrillDownParams] = useState<{
    startDate: string;
    endDate: string;
    category?: string;
    categoryType?: "product" | "region" | "channel";
  } | null>(null);

  const { data: metrics, isLoading: metricsLoading } = useFinancialMetrics(filters.dateRange);
  const { data: revenueSources, isLoading: revenueLoading } = useRevenueSources(filters.dateRange);
  const { data: revenueTrends, isLoading: trendsLoading } = useRevenueTrends(filters.dateRange);
  const { convertAmount, currencySymbol } = useCurrencyConversion(filters.currency);
  
  const { data: drillDownData, isLoading: drillDownLoading } = useRevenueDrillDown(drillDownParams);
  const { data: dimensionsData } = useRevenueDimensions(filters.dateRange);

  const handlePeriodClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const payload = data.activePayload[0].payload;
      const dateKey = payload.dateKey;
      
      // Determine the date range based on the dateKey format
      let startDate: string;
      let endDate: string;
      
      if (dateKey.length === 7) {
        // Monthly format (YYYY-MM)
        const [year, month] = dateKey.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        startDate = `${year}-${month}-01`;
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
      } else {
        // Daily format (YYYY-MM-DD)
        startDate = dateKey;
        endDate = dateKey;
      }
      
      setDrillDownParams({ startDate, endDate });
    }
  };

  const closeDrillDown = () => {
    setDrillDownParams(null);
  };

  const handleDimensionClick = (dimension: string, dimensionType: "product" | "region" | "channel") => {
    if (!filters.dateRange?.from || !filters.dateRange?.to) return;
    
    const startDate = filters.dateRange.from.toISOString().split('T')[0];
    const endDate = filters.dateRange.to.toISOString().split('T')[0];
    
    setDrillDownParams({
      startDate,
      endDate,
      category: dimension === "Unspecified" ? undefined : dimension,
      categoryType: dimensionType
    });
  };

  const handleStackedBarClick = (monthKey: string, productKey: string) => {
    // Extract the date from the monthKey (format: YYYY-MM)
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    
    // Map product keys to product IDs
    const productMap: Record<string, string> = {
      'product1': 'Product A',
      'product2': 'Product B', 
      'product3': 'Product C',
      'services': 'Services'
    };
    
    setDrillDownParams({
      startDate,
      endDate,
      category: productMap[productKey],
      categoryType: 'product'
    });
  };

  const handleRegionBarClick = (monthKey: string, regionKey: string) => {
    // Extract the date from the monthKey (format: YYYY-MM)
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    
    setDrillDownParams({
      startDate,
      endDate,
      category: regionKey,
      categoryType: 'region'
    });
  };

  // Helper function to get metric by type
  const getMetric = (type: string) => {
    return metrics?.find(m => m.metric_type === type);
  };

  if (metricsLoading || revenueLoading || trendsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading revenue data...</p>
        </div>
      </div>
    );
  }

  const revenue = getMetric('revenue');
  const mrr = getMetric('mrr');
  const arr = getMetric('arr');

  // Helper to format currency with the selected currency symbol
  const formatWithCurrency = (amount: number, date?: string) => {
    const converted = convertAmount(amount, 'USD', date);
    return `${currencySymbol}${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-0">
      <FilterHeader 
        filters={filters}
        onFiltersChange={setFilters}
        showFxCurrency={true}
      />
      
      <div className="space-y-6 p-4">
      {/* Header */}
      <div>
        <h1 className="text-3xl text-foreground">Revenue Analytics</h1>
        <p className="text-muted-foreground">Track and analyze all revenue streams</p>
      </div>

      {/* Revenue Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue"
          value={revenue ? formatWithCurrency(revenue.amount) : `${currencySymbol}0`}
          change={revenue ? "+12.5% vs last month" : undefined}
          changeType="positive"
          gradient="primary"
          icon={<DollarSign className="w-6 h-6" />}
        />
        <MetricCard
          title="Monthly Recurring"
          value={mrr ? formatWithCurrency(mrr.amount) : `${currencySymbol}0`}
          change={mrr ? "+8.3% vs last month" : undefined}
          changeType="positive"
          icon={<Repeat className="w-6 h-6 text-success" />}
        />
        <MetricCard
          title="Annual Recurring"
          value={arr ? formatWithCurrency(arr.amount) : `${currencySymbol}0`}
          change={arr ? "+15.7% vs last year" : undefined}
          changeType="positive"
          gradient="success"
          icon={<TrendingUp className="w-6 h-6" />}
        />
        <MetricCard
          title="Average Deal Size"
          value={`${currencySymbol}0`}
          change={undefined}
          changeType="positive"
          icon={<BarChart3 className="w-6 h-6 text-secondary" />}
        />
      </div>


      {/* MRR/ARR Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monthly Recurring Revenue Trends</CardTitle>
        </CardHeader>
          <CardContent>
            {revenueTrends && revenueTrends.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={revenueTrends} 
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    onClick={handlePeriodClick}
                  >
                    <XAxis 
                      dataKey="period"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12 }}
                      className="fill-muted-foreground"
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12 }}
                      className="fill-muted-foreground"
                      tickFormatter={(value) => formatWithCurrency(value)}
                    />
                    <Tooltip 
                      formatter={(value: any) => [formatWithCurrency(value), '']}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="accrual" 
                      stroke="hsl(var(--primary-500))" 
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--primary-500))', strokeWidth: 2, r: 4 }}
                      name="Accrual Revenue"
                      activeDot={{ r: 6, stroke: 'hsl(var(--primary-500))', strokeWidth: 2 }}
                      cursor="pointer"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="cash" 
                      stroke="hsl(var(--secondary-500))" 
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--secondary-500))', strokeWidth: 2, r: 4 }}
                      name="Cash Revenue"
                      activeDot={{ r: 6, stroke: 'hsl(var(--secondary-500))', strokeWidth: 2 }}
                      cursor="pointer"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-80">
                <Badge variant="secondary">No Data</Badge>
              </div>
          )}
          </CardContent>
      </Card>

      {/* Revenue by Product & Region Stacked Bar Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {dimensionsData && dimensionsData.productData.length > 0 && (
          <StackedBarChart
            data={stackedRevenueData}
            title="Revenue by Product"
            xAxisKey="month"
            bars={[
              { dataKey: 'product1', name: 'Product A', color: 'hsl(var(--primary-500))' },
              { dataKey: 'product2', name: 'Product B', color: 'hsl(var(--secondary-500))' },
              { dataKey: 'product3', name: 'Product C', color: 'hsl(var(--success-500))' },
              { dataKey: 'services', name: 'Services', color: 'hsl(var(--warning-500))' }
            ]}
            formatValue={formatWithCurrency}
            onBarClick={(monthKey, productKey) => {
              const data = stackedRevenueData.find(d => d.month === monthKey);
              if (data?.dateKey) {
                handleStackedBarClick(data.dateKey, productKey);
              }
            }}
          />
        )}
        
        {dimensionsData && dimensionsData.regionData.length > 0 && (
          <StackedBarChart
            data={stackedRegionData}
            title="Revenue by Region"
            xAxisKey="month"
            bars={[
              { dataKey: 'North America', name: 'North America', color: 'hsl(var(--primary-500))' },
              { dataKey: 'Europe', name: 'Europe', color: 'hsl(var(--secondary-500))' },
              { dataKey: 'Asia', name: 'Asia', color: 'hsl(var(--success-500))' }
            ]}
            formatValue={formatWithCurrency}
            onBarClick={(monthKey, regionKey) => {
              const data = stackedRegionData.find(d => d.month === monthKey);
              if (data?.dateKey) {
                handleRegionBarClick(data.dateKey, regionKey);
              }
            }}
          />
        )}
      </div>

      {/* Revenue Breakdown by Dimension */}
      <RevenueDimensionTable
        productData={dimensionsData?.productData || []}
        regionData={dimensionsData?.regionData || []}
        channelData={dimensionsData?.channelData || []}
        formatCurrency={formatWithCurrency}
        onDimensionClick={handleDimensionClick}
      />

      {/* Drill-down table */}
      {drillDownParams && (
        <RevenueDrillDownTable
          data={drillDownData || []}
          title={`Revenue Transactions - ${drillDownParams.startDate}${
            drillDownParams.endDate !== drillDownParams.startDate ? ` to ${drillDownParams.endDate}` : ""
          }`}
          onClose={closeDrillDown}
          isLoading={drillDownLoading}
        />
      )}

      {/* Revenue by Product/Region Stacked Chart - Hidden for now */}
      {/* {revenueSources && revenueSources.length > 0 ? (
        <StackedBarChart
          data={stackedRevenueData}
          title="Revenue by Product & Region"
          xAxisKey="month"
          bars={[
            { dataKey: 'product1', name: 'Product A', color: 'hsl(var(--primary-500))' },
            { dataKey: 'product2', name: 'Product B', color: 'hsl(var(--secondary-500))' },
            { dataKey: 'product3', name: 'Product C', color: 'hsl(var(--success-500))' },
            { dataKey: 'services', name: 'Services', color: 'hsl(var(--warning-500))' }
          ]}
          formatValue={formatCurrency}
        />
      ) : (
        <Card className="p-6">
          <h3 className="text-lg mb-4">Revenue by Product & Region</h3>
          <div className="flex items-center justify-center py-8">
            <Badge variant="secondary">No Data</Badge>
          </div>
        </Card>
      )} */}

      {/* SaaS Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-4 bg-gradient-primary text-primary-foreground">
          <div className="text-center">
            <div className="text-2xl font-bold">
              {mrr ? formatWithCurrency(mrr.amount) : `${currencySymbol}0`}
            </div>
            <div className="text-sm opacity-90">Monthly Recurring Revenue</div>
            {mrr && <div className="text-xs opacity-80">+8.3% vs last month</div>}
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-secondary text-secondary-foreground">
          <div className="text-center">
            <div className="text-2xl font-bold">
              {arr ? formatWithCurrency(arr.amount) : `${currencySymbol}0`}
            </div>
            <div className="text-sm opacity-90">Annual Recurring Revenue</div>
            {arr && <div className="text-xs opacity-80">+15.7% vs last year</div>}
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-success text-success-foreground">
          <div className="text-center">
            <div className="text-2xl font-bold">{revenue ? "92.3%" : "0%"}</div>
            <div className="text-sm opacity-90">Revenue Retention Rate</div>
            {revenue && <div className="text-xs opacity-80">+2.1% vs last quarter</div>}
          </div>
        </Card>
      </div>
      </div>
    </div>
  );
};

export default Revenue;