import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WaterfallData {
  name: string;
  value: number;
  cumulative: number;
  type: 'positive' | 'negative' | 'total';
}

interface ProfitWaterfallChartProps {
  revenue: number;
  cogs: number;
  operatingExpenses: number;
  className?: string;
  onBarClick?: (metric: string) => void;
  formatCurrency: (amount: number) => string;
}

export function ProfitWaterfallChart({ revenue, cogs, operatingExpenses, className, onBarClick, formatCurrency }: ProfitWaterfallChartProps) {
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - operatingExpenses;

  const waterfallData: WaterfallData[] = [
    { name: 'Revenue', value: revenue, cumulative: revenue, type: 'positive' },
    { name: 'COGS', value: -cogs, cumulative: grossProfit, type: 'negative' },
    { name: 'Gross Profit', value: grossProfit, cumulative: grossProfit, type: 'total' },
    { name: 'Op. Expenses', value: -operatingExpenses, cumulative: netProfit, type: 'negative' },
    { name: 'Net Profit', value: netProfit, cumulative: netProfit, type: 'total' }
  ];

  const getBarColor = (type: string) => {
    switch (type) {
      case 'positive':
        return 'hsl(var(--success-500))';
      case 'negative':
        return 'hsl(var(--error-500))';
      case 'total':
        return 'hsl(var(--primary-500))';
      default:
        return 'hsl(var(--neutral-400))';
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-card-foreground">{label}</p>
          <p className="text-sm text-muted-foreground">
            Value: {formatCurrency(Math.abs(data.value))}
          </p>
          <p className="text-sm text-muted-foreground">
            Cumulative: {formatCurrency(data.cumulative)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Profit Waterfall</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={waterfallData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <XAxis 
                dataKey="name" 
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
              <Bar 
                dataKey="cumulative" 
                radius={[4, 4, 0, 0]}
                maxBarSize={60}
                onClick={(data) => onBarClick?.(data.name)}
                cursor="pointer"
              >
                {waterfallData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.type)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="flex justify-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(var(--success-500))' }}></div>
            <span className="text-muted-foreground">Revenue</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(var(--error-500))' }}></div>
            <span className="text-muted-foreground">Expenses</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(var(--primary-500))' }}></div>
            <span className="text-muted-foreground">Profit</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}