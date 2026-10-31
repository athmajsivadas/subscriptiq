import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarginTrendTimeSeries } from "@/hooks/useProfitabilityData";

interface MarginTrendsChartProps {
  className?: string;
  data?: MarginTrendTimeSeries[];
  onPointClick?: (metric: string, period: string, dateKey: string) => void;
}

export function MarginTrendsChart({ className, data, onPointClick }: MarginTrendsChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-card-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(1)}%
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Margin Trends (6 Months)</CardTitle>
      </CardHeader>
      <CardContent>
        {data && data.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                tickFormatter={(value) => `${value}%`}
                domain={['dataMin - 2', 'dataMax + 2']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
              <Line 
                type="monotone" 
                dataKey="grossMargin" 
                stroke="hsl(var(--success-500))" 
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--success-500))', strokeWidth: 2, r: 4, cursor: 'pointer' }}
                name="Gross Margin"
                activeDot={{ 
                  r: 6, 
                  stroke: 'hsl(var(--success-500))', 
                  strokeWidth: 2, 
                  cursor: 'pointer',
                  onClick: (_: any, payload: any) => onPointClick?.('Gross Margin', payload.payload.period, payload.payload.dateKey)
                }}
              />
              <Line 
                type="monotone" 
                dataKey="operatingMargin" 
                stroke="hsl(var(--primary-500))" 
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--primary-500))', strokeWidth: 2, r: 4, cursor: 'pointer' }}
                name="Operating Margin"
                activeDot={{ 
                  r: 6, 
                  stroke: 'hsl(var(--primary-500))', 
                  strokeWidth: 2, 
                  cursor: 'pointer',
                  onClick: (_: any, payload: any) => onPointClick?.('Operating Margin', payload.payload.period, payload.payload.dateKey)
                }}
              />
              <Line 
                type="monotone" 
                dataKey="netMargin" 
                stroke="hsl(var(--secondary-500))" 
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--secondary-500))', strokeWidth: 2, r: 4, cursor: 'pointer' }}
                name="Net Margin"
                activeDot={{ 
                  r: 6, 
                  stroke: 'hsl(var(--secondary-500))', 
                  strokeWidth: 2, 
                  cursor: 'pointer',
                  onClick: (_: any, payload: any) => onPointClick?.('Net Margin', payload.payload.period, payload.payload.dateKey)
                }}
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
  );
}