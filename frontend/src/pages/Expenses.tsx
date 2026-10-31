import { useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DonutChart } from "@/components/DonutChart";
import { TrendingDown, CreditCard, Users, Zap, Building, Car, AlertTriangle } from "@/components/icons";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useFinancialMetrics,
  useExpenseCategories,
  useExpenseTrends,
  useVendors,
  formatCurrency,
  formatPercentage,
} from "@/hooks/useFinancialData";
import { FilterHeader, FilterState } from "@/components/FilterHeader";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from "recharts";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";
import { useExpenseDrillDown } from "@/hooks/useExpenseDrillDown";
import { ExpenseDrillDownTable } from "@/components/ExpenseDrillDownTable";

// Note: Expense trend data is now fetched and aggregated from the backend with dynamic granularity

const Expenses = () => {
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {},
    currency: "USD",
  });
  const [vendorPage, setVendorPage] = useState(1);
  const vendorsPerPage = 5;
  const { data: metrics, isLoading: metricsLoading } = useFinancialMetrics(filters.dateRange);
  const { data: expenseCategories, isLoading: expensesLoading } = useExpenseCategories(filters.dateRange);
  const { data: expenseTrendData, isLoading: trendsLoading } = useExpenseTrends(filters.dateRange);
  const { data: vendors, isLoading: vendorsLoading } = useVendors(filters.dateRange);
  const { convertAmount, currencySymbol } = useCurrencyConversion(filters.currency);
  const {
    drillDownData,
    isLoading: drillDownLoading,
    openCategoryDrillDown,
    openPeriodDrillDown,
    clearDrillDown,
  } = useExpenseDrillDown(filters.dateRange);

  const formatWithCurrency = (amount: number, date?: string) => {
    const converted = convertAmount(amount, 'USD', date);
    return `${currencySymbol}${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Pagination calculations
  const totalVendors = vendors?.length || 0;
  const totalPages = Math.ceil(totalVendors / vendorsPerPage);
  const startIndex = (vendorPage - 1) * vendorsPerPage;
  const endIndex = startIndex + vendorsPerPage;
  const paginatedVendors = vendors?.slice(startIndex, endIndex) || [];

  // Helper function to get metric by type
  const getMetric = (type: string) => {
    return metrics?.find((m) => m.metric_type === type);
  };

  if (metricsLoading || expensesLoading || trendsLoading || vendorsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading expense data...</p>
        </div>
      </div>
    );
  }

  const colorPalette = [
    "#FF6B6B",
    "#FFD93D",
    "#6BCB77",
    "#4D96FF",
    "#845EC2",
    "#FF9671",
    "#FFC75F",
    "#008F7A",
    "#C34A36",
    "#FF8066",
    "#6A2C70",
    "#00C9A7",
    "#F9F871",
    "#0081CF",
    "#D65DB1",
    "#2C73D2",
    "#FF5F40",
    "#5D9C59",
    "#F15BB5",
    "#00BBF9",
    "#9B5DE5",
    "#FEE440",
    "#00F5D4",
    "#FB5607",
    "#8338EC",
  ];

  const expenses = getMetric("expenses");
  const totalExpenses = expenseCategories?.reduce((sum, exp) => sum + exp.amount, 0) || 0;
  const totalBudget = expenseCategories?.reduce((sum, exp) => sum + (exp.budget_amount || 0), 0) || 0;

  // Calculate operating expenses (exclude COGS)
  const operatingExpenses =
    expenseCategories?.filter((exp) => exp.category !== "cogs").reduce((sum, exp) => sum + exp.amount, 0) || 0;

  // Prepare donut chart data
  const donutData =
    expenseCategories?.map((expense, index) => ({
      name: expense.name,
      value: expense.amount,
      color: colorPalette[index % colorPalette.length],
    })) || [];

  return (
    <div className="space-y-0">
      <FilterHeader filters={filters} onFiltersChange={setFilters} showFxCurrency={true} />

      <div className="space-y-6 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl text-foreground">Expense Management</h1>
            <p className="text-muted-foreground">Monitor and control business expenses</p>
          </div>
        </div>

        {/* Expense Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Expenses"
            value={formatWithCurrency(totalExpenses)}
            // change={expenses ? "+5.2% vs last month" : undefined}
            changeType="negative"
            gradient="primary"
            icon={<TrendingDown className="w-6 h-6" />}
          />
          <MetricCard
            title="Operating Expenses"
            value={formatWithCurrency(operatingExpenses)}
            // change={expenseCategories && expenseCategories.length > 0 ? "+3.1% vs last month" : undefined}
            changeType="negative"
            icon={<Building className="w-6 h-6 text-orange-600" />}
          />
          <MetricCard
            title="Budget Variance"
            value={formatWithCurrency(totalBudget - totalExpenses)}
            change={totalBudget > 0 ? (totalExpenses > totalBudget ? "Over budget" : "Under budget") : undefined}
            changeType={totalExpenses > totalBudget ? "negative" : "positive"}
            icon={<CreditCard className="w-6 h-6 text-red-600" />}
          />
          <MetricCard
            title="Average Daily Spend"
            value={formatWithCurrency(totalExpenses / 31)}
            // change={expenses ? "+1.8% vs last month" : undefined}
            changeType="negative"
            icon={<AlertTriangle className="w-6 h-6 text-secondary" />}
          />
        </div>

        {/* Expense Categories */}
        <Card className="p-6">
          <h3 className="text-lg mb-4">Expenses by Category</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              {expenseCategories?.slice(0, Math.ceil(expenseCategories.length / 2)).map((expense) => {
                const iconMap = {
                  salaries: Users,
                  marketing: CreditCard,
                  operations: Building,
                  technology: Zap,
                };
                const IconComponent = iconMap[expense.category as keyof typeof iconMap] || AlertTriangle;

                return (
                  <div key={expense.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <IconComponent className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium">{expense.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatWithCurrency(expense.amount)} ({expense.percentage?.toFixed(0)}%)
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-4">
              {expenseCategories?.slice(Math.ceil(expenseCategories.length / 2)).map((expense) => {
                const iconMap = {
                  salaries: Users,
                  marketing: CreditCard,
                  operations: Car,
                  technology: Zap,
                };
                const IconComponent = iconMap[expense.category as keyof typeof iconMap] || AlertTriangle;

                return (
                  <div key={expense.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <IconComponent className="w-5 h-5 text-secondary" />
                      <div>
                        <p className="font-medium">{expense.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatWithCurrency(expense.amount)} ({expense.percentage?.toFixed(0)}%)
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expense Category Donut Chart */}
          <DonutChart
            data={donutData}
            title="Expense Category Breakdown"
            centerValue={formatWithCurrency(totalExpenses)}
            centerLabel="Total Expenses"
            onSliceClick={(entry) => openCategoryDrillDown(entry.name)}
          />

          {/* Expense Trends Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly Expense Trends</CardTitle>
            </CardHeader>
            <CardContent>
              {expenseTrendData && expenseTrendData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={expenseTrendData} 
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      barSize={45}
                      barGap={8}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
                      <XAxis
                        dataKey="period"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                        tickFormatter={(value) => {
                          const converted = convertAmount(value, 'USD');
                          if (converted >= 1000000) return `${currencySymbol}${(converted / 1000000).toFixed(1)}M`;
                          if (converted >= 1000) return `${currencySymbol}${(converted / 1000).toFixed(0)}K`;
                          return `${currencySymbol}${converted.toFixed(0)}`;
                        }}
                      />
                      <Tooltip
                        formatter={(value: any) => [formatWithCurrency(value), ""]}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid var(--color-border)",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar
                        dataKey="expenses"
                        fill="hsl(var(--primary-500))"
                        name="Total Expenses"
                        radius={[8, 8, 0, 0]}
                        onClick={(data: any) => {
                          const payload = data?.payload;
                          if (!payload) return;
                          const dateKey = payload.dateKey as string | undefined;
                          if (!dateKey) return;
                          const granularity: "day" | "month" = dateKey.length === 10 ? "day" : "month";
                          openPeriodDrillDown(dateKey, payload.period, granularity);
                        }}
                        cursor="pointer"
                      />
                      <Bar 
                        dataKey="cogs" 
                        fill="hsl(var(--primary-400))" 
                        name="COGS" 
                        radius={[8, 8, 0, 0]} 
                      />
                      <Bar 
                        dataKey="opex" 
                        fill="hsl(var(--primary-300))" 
                        name="Operating Expenses" 
                        radius={[8, 8, 0, 0]} 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <span className="inline-flex items-center justify-center rounded-md bg-muted px-3 py-1 text-sm text-muted-foreground">
                    No Data
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Budget vs Actual */}
          <Card className="p-6">
            <h3 className="text-lg mb-4">Budget vs Actual</h3>
            {totalBudget > 0 || totalExpenses > 0 ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Budgeted</span>
                    <span className="text-sm">{formatWithCurrency(totalBudget)}</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full">
                    <div
                      className="h-full bg-success rounded-full"
                      style={{ width: totalBudget > 0 ? "100%" : "0%" }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Actual</span>
                    <span className="text-sm">{formatWithCurrency(totalExpenses)}</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full">
                    <div
                      className={`h-full rounded-full ${totalBudget > 0 ? (totalExpenses > totalBudget ? "bg-destructive" : "bg-success") : "bg-muted"}`}
                      style={{
                        width: totalBudget > 0 ? `${Math.min((totalExpenses / totalBudget) * 100, 100)}%` : "0%",
                      }}
                    ></div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Variance</span>
                    <span
                      className={`text-sm font-semibold ${totalBudget > 0 ? (totalExpenses > totalBudget ? "text-destructive" : "text-success") : "text-muted-foreground"}`}
                    >
                      {totalBudget > 0 && (totalExpenses > totalBudget ? "+" : "-")}
                      {formatWithCurrency(Math.abs(totalBudget - totalExpenses))}(
                      {totalBudget > 0 ? (((totalExpenses - totalBudget) / totalBudget) * 100).toFixed(1) + "%" : "N/A"}
                      )
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Badge variant="secondary">No Data</Badge>
              </div>
            )}
          </Card>
        </div>

        {drillDownData && (
          <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
            <ExpenseDrillDownTable
              drillDownData={drillDownData}
              onClose={clearDrillDown}
              isLoading={drillDownLoading}
              formatCurrency={formatWithCurrency}
            />
          </div>
        )}

        {/* Top Vendors */}
        <Card className="p-6">
          <h3 className="text-lg mb-4">Top Vendors & Suppliers</h3>
          <div className="space-y-3">
            {paginatedVendors.map((vendor) => (
              <div
                key={vendor.id}
                className="flex items-center justify-between p-3 hover:bg-muted rounded-lg transition-colors"
              >
                <div>
                  <p className="font-medium">{vendor.name}</p>
                  <p className="text-xs text-muted-foreground">{vendor.category}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatWithCurrency(vendor.amount)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndex, totalVendors)} of {totalVendors}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVendorPage((prev) => Math.max(1, prev - 1))}
                  disabled={vendorPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {vendorPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVendorPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={vendorPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Expenses;

