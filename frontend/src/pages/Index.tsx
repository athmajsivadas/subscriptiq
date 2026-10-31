import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Upload,
  RefreshCw,
  Eye,
  Download
} from "@/components/icons";
import { 
  useFinancialMetrics, 
  useRevenueSources,
  useExpenseCategories,
  formatCurrency,
  formatPercentage
} from "@/hooks/useFinancialData";
import { useProfitabilityData } from "@/hooks/useProfitabilityData";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useState } from "react";

// Mock data for Revenue vs Profit chart
const revenueVsProfitData = [
  { month: 'Jan', revenue: 245000, profit: 54000 },
  { month: 'Feb', revenue: 268000, profit: 59000 },
  { month: 'Mar', revenue: 285000, profit: 67000 },
  { month: 'Apr', revenue: 272000, profit: 61000 },
  { month: 'May', revenue: 295000, profit: 72000 },
  { month: 'Jun', revenue: 310000, profit: 75000 }
];

export default function Index() {
  const { data: metrics, isLoading: metricsLoading } = useFinancialMetrics();
  const { data: revenueSources, isLoading: revenueLoading } = useRevenueSources();
  const { data: expenseCategories, isLoading: expensesLoading } = useExpenseCategories();
  const { data: profitabilityData, isLoading: profitLoading } = useProfitabilityData();
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  // Helper function to get metric by type
  const getMetric = (type: string) => {
    return metrics?.find(m => m.metric_type === type);
  };

  if (metricsLoading || revenueLoading || expensesLoading || profitLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  const revenue = getMetric('revenue');
  const expenses = getMetric('expenses');
  const totalExpenses = expenseCategories?.reduce((sum, exp) => sum + exp.amount, 0) || 0;
  const totalRevenue = revenueSources?.reduce((sum, rev) => sum + rev.amount, 0) || 0;
  const netProfit = totalRevenue - totalExpenses;
  const cashFlow = netProfit * 0.85; // Simplified cash flow calculation

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-card-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-foreground">Financial Overview</h1>
          <p className="text-muted-foreground">Key metrics and performance indicators</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowImportModal(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync Data
          </Button>
          <Badge variant="secondary">This Month</Badge>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue"
          value={revenue ? formatCurrency(revenue.amount) : formatCurrency(totalRevenue)}
          change="+12.5% vs last month"
          changeType="positive"
          gradient="primary"
          icon={<DollarSign className="w-6 h-6" />}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setSelectedMetric('revenue')}
        />
        <MetricCard
          title="Total Expenses"
          value={expenses ? formatCurrency(expenses.amount) : formatCurrency(totalExpenses)}
          change="+5.2% vs last month"
          changeType="negative"
          icon={<TrendingDown className="w-6 h-6" />}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setSelectedMetric('expenses')}
        />
        <MetricCard
          title="Net Profit"
          value={profitabilityData ? formatCurrency(profitabilityData.netProfit) : formatCurrency(netProfit)}
          change="+18.7% vs last month"
          changeType="positive"
          gradient="success"
          icon={<TrendingUp className="w-6 h-6" />}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setSelectedMetric('profit')}
        />
        <MetricCard
          title="Cash Flow"
          value={formatCurrency(cashFlow)}
          change="+15.3% vs last month"
          changeType="positive"
          icon={<Activity className="w-6 h-6" />}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setSelectedMetric('cashflow')}
        />
      </div>

      {/* Revenue vs Profit Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl">Revenue vs Profit Trend</CardTitle>
            <p className="text-sm text-muted-foreground">6-month performance comparison</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueVsProfitData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis 
                  dataKey="month" 
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
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--primary-500))" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--primary-500))', strokeWidth: 2, r: 4 }}
                  name="Revenue"
                  activeDot={{ r: 6, stroke: 'hsl(var(--primary-500))', strokeWidth: 2 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="hsl(var(--success-500))" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--success-500))', strokeWidth: 2, r: 4 }}
                  name="Net Profit"
                  activeDot={{ r: 6, stroke: 'hsl(var(--success-500))', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Period Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Growth vs Last Quarter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Revenue Growth</span>
              <span className="font-semibold text-success">+12.5%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Profit Growth</span>
              <span className="font-semibold text-success">+18.7%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Expense Growth</span>
              <span className="font-semibold text-warning">+5.2%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Growth vs Last Year</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Revenue Growth</span>
              <span className="font-semibold text-success">+28.3%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Profit Growth</span>
              <span className="font-semibold text-success">+35.1%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Expense Growth</span>
              <span className="font-semibold text-success">+15.8%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Key Ratios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Profit Margin</span>
              <span className="font-semibold">{profitabilityData ? `${profitabilityData.netMargin.toFixed(1)}%` : '24.2%'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Revenue per Employee</span>
              <span className="font-semibold">$425K</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">ROI</span>
              <span className="font-semibold text-success">32.5%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drill-down Table (conditional rendering) */}
      {selectedMetric && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              {selectedMetric === 'revenue' && 'Revenue Breakdown'}
              {selectedMetric === 'expenses' && 'Expense Breakdown'}
              {selectedMetric === 'profit' && 'Profit Analysis'}
              {selectedMetric === 'cashflow' && 'Cash Flow Details'}
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSelectedMetric(null)}
            >
              Close
            </Button>
          </CardHeader>
          <CardContent>
            {selectedMetric === 'revenue' && (
              <div className="space-y-2">
                {revenueSources?.map((source) => (
                  <div key={source.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="font-medium">{source.name}</span>
                    <div className="text-right">
                      <span className="font-semibold">{formatCurrency(source.amount)}</span>
                      <span className="text-sm text-muted-foreground ml-2">({source.percentage?.toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedMetric === 'expenses' && (
              <div className="space-y-2">
                {expenseCategories?.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="font-medium">{expense.name}</span>
                    <div className="text-right">
                      <span className="font-semibold">{formatCurrency(expense.amount)}</span>
                      <span className="text-sm text-muted-foreground ml-2">({expense.percentage?.toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}