import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/MetricCard";
import { TrendingUp, TrendingDown, DollarSign, Percent, Target, PieChart } from "lucide-react";
import { ProfitWaterfallChart } from "@/components/ProfitWaterfallChart";
import { MarginTrendsChart } from "@/components/MarginTrendsChart";
import { ProfitabilityDataTable } from "@/components/ProfitabilityDataTable";
import {
  useProfitabilityData,
  useProfitBreakdown,
  useMarginTrends,
  useMarginTrendsTimeSeries,
  formatProfitCurrency,
  formatMarginPercentage,
  formatChange,
} from "@/hooks/useProfitabilityData";
import { useProfitabilityDrillDown } from "@/hooks/useProfitabilityDrillDown";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterHeader, FilterState } from "@/components/FilterHeader";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";

const Profitability = () => {
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {},
    currency: "USD",
  });
  const { data: profitabilityData, isLoading } = useProfitabilityData({ ...filters, currency: filters.currency || "USD" });
  const profitBreakdown = useProfitBreakdown({ ...filters, currency: filters.currency || "USD" });
  const marginTrends = useMarginTrends({ ...filters, currency: filters.currency || "USD" });
  const { data: marginTrendsData } = useMarginTrendsTimeSeries({ ...filters, currency: filters.currency || "USD" });
  const { convertAmount, currencySymbol } = useCurrencyConversion(filters.currency || "USD");
  const { drillDownData, handleWaterfallClick, handleMarginClick, clearDrillDown } = useProfitabilityDrillDown();

  // Format currency - amounts are already converted in the hooks
  const formatWithCurrency = (amount: number) => {
    return `${currencySymbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Check if there's any actual data - memoized to prevent recalculation on every render
  const hasData = useMemo(
    () => profitBreakdown.revenue > 0 || profitBreakdown.cogs > 0 || profitBreakdown.operatingExpenses > 0,
    [profitBreakdown.revenue, profitBreakdown.cogs, profitBreakdown.operatingExpenses]
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl tracking-tight">Profitability Analysis</h1>
          <p className="text-muted-foreground">Track your profit margins and analyze business profitability</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!profitabilityData) return null;

  const getChangeType = (change: number): "positive" | "negative" | "neutral" => {
    if (change > 0.5) return "positive";
    if (change < -0.5) return "negative";
    return "neutral";
  };

  return (
    <div className="space-y-0">
      <FilterHeader filters={filters} onFiltersChange={setFilters} showFxCurrency={true} />

      <div className="space-y-6 p-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl tracking-tight">Profitability Analysis</h1>
            <p className="text-muted-foreground">Track your profit margins and analyze business profitability</p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Gross Profit Margin"
            value={hasData ? formatMarginPercentage(profitabilityData.grossMargin) : "0.0%"}
            // change={hasData ? formatChange(2.1) : undefined}
            changeType="positive"
            hasData={hasData}
            icon={<Percent className="w-5 h-5" />}
          />
          <MetricCard
            title="Net Profit Margin"
            value={hasData ? formatMarginPercentage(profitabilityData.netMargin) : "0.0%"}
            // change={hasData ? formatChange(1.8) : undefined}
            changeType="positive"
            hasData={hasData}
            icon={<DollarSign className="w-5 h-5" />}
          />
          <MetricCard
            title="Operating Profit"
            value={hasData ? formatWithCurrency(profitabilityData.operatingProfit) : `${currencySymbol}0`}
            // change={hasData ? formatChange(profitabilityData.profitGrowth) : undefined}
            changeType={getChangeType(profitabilityData.profitGrowth)}
            hasData={hasData}
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <MetricCard
            title="EBITDA"
            value={hasData ? formatWithCurrency(profitabilityData.ebitda) : `${currencySymbol}0`}
            // change={hasData ? formatChange(profitabilityData.profitGrowth * 0.8) : undefined}
            changeType={getChangeType(profitabilityData.profitGrowth * 0.8)}
            hasData={hasData}
            icon={<Target className="w-5 h-5" />}
          />
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {hasData ? (
            <>
              {/* Profit Waterfall Chart */}
              <ProfitWaterfallChart
                revenue={profitBreakdown.revenue}
                cogs={profitBreakdown.cogs}
                operatingExpenses={profitBreakdown.operatingExpenses}
                onBarClick={handleWaterfallClick}
                formatCurrency={formatWithCurrency}
              />

              {/* Margin Trends Chart */}
              <MarginTrendsChart 
                data={marginTrendsData} 
                onPointClick={handleMarginClick}
              />
            </>
          ) : (
            <>
              <Card className="p-6">
                <h3 className="text-lg mb-4">Profit Waterfall</h3>
                <div className="flex items-center justify-center h-80">
                  <Badge variant="secondary">No Data</Badge>
                </div>
              </Card>
              <Card className="p-6">
                <h3 className="text-lg mb-4">Margin Trends</h3>
                <div className="flex items-center justify-center h-80">
                  <Badge variant="secondary">No Data</Badge>
                </div>
              </Card>
            </>
          )}
        </div>

        {/* Drill-down Data Table */}
        {drillDownData && (
          <ProfitabilityDataTable 
            drillDownData={drillDownData} 
            onClose={clearDrillDown}
            formatCurrency={formatWithCurrency}
          />
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Enhanced Profit Breakdown */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-5 h-5 text-primary" />
              <h3 className="text-lg">Profit Breakdown</h3>
            </div>
            {hasData ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Revenue</span>
                  <span className="font-medium text-success-600">{formatWithCurrency(profitBreakdown.revenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Cost of Goods Sold</span>
                  <span className="font-medium text-error-600">-{formatWithCurrency(profitBreakdown.cogs)}</span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-sm font-medium">Gross Profit</span>
                  <span className="font-semibold text-success-600">
                    {formatWithCurrency(profitBreakdown.grossProfit)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  Margin: {formatMarginPercentage(profitabilityData.grossMargin)}
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Operating Expenses</span>
                  <span className="font-medium text-error-600">
                    -{formatWithCurrency(profitBreakdown.operatingExpenses)}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-sm font-medium">Net Profit</span>
                  <span className="font-semibold text-primary-600">
                    {formatWithCurrency(profitBreakdown.netProfit)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  Margin: {formatMarginPercentage(profitabilityData.netMargin)}
                </div>

                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-sm font-medium">EBITDA</span>
                  <span className="font-semibold text-secondary-600">
                    {formatWithCurrency(profitBreakdown.ebitda)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  Margin: {formatMarginPercentage(profitabilityData.ebitdaMargin)}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Badge variant="secondary">No Data</Badge>
              </div>
            )}
          </Card>

          {/* Enhanced Margin Trends */}
          <Card className="p-6">
            <h3 className="text-lg mb-4">Current Margin Performance</h3>
            {hasData ? (
              <>
                <div className="space-y-4">
                  {marginTrends.map((trend, index) => {
                    const IconComponent =
                      trend.icon === "up" ? TrendingUp : trend.icon === "down" ? TrendingDown : Target;
                    const iconColor =
                      trend.changeType === "positive"
                        ? "text-success-600"
                        : trend.changeType === "negative"
                          ? "text-error-600"
                          : "text-warning-600";
                    const changeColor =
                      trend.changeType === "positive"
                        ? "text-success-600"
                        : trend.changeType === "negative"
                          ? "text-error-600"
                          : "text-warning-600";

                    return (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <IconComponent className={`w-4 h-4 ${iconColor}`} />
                          <span className="text-sm">{trend.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatMarginPercentage(trend.current)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Performance Indicators */}
                <div className="mt-6 pt-4 border-t">
                  <h4 className="text-sm mb-3">Performance Status</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Profitability Health</span>
                      <span
                        className={`font-medium ${
                          profitabilityData.netMargin >= 15
                            ? "text-success-600"
                            : profitabilityData.netMargin >= 8
                              ? "text-warning-600"
                              : "text-error-600"
                        }`}
                      >
                        {profitabilityData.netMargin >= 15
                          ? "Excellent"
                          : profitabilityData.netMargin >= 8
                            ? "Good"
                            : "Needs Improvement"}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Growth Trajectory</span>
                      <span
                        className={`font-medium ${profitabilityData.profitGrowth >= 5 ? "text-success-600" : "text-warning-600"}`}
                      >
                        {profitabilityData.profitGrowth >= 5 ? "Strong Growth" : "Stable"}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Badge variant="secondary">No Data</Badge>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profitability;
