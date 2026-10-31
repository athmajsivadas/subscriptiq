import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid } from 'recharts';

interface RevenueProfitChartProps {
  data: Array<{
    period: string;
    dateKey: string;
    revenue: number;
    profit: number;
  }>;
  formatCurrency: (value: number) => string;
  onPointClick?: (dateKey: string) => void;
}

export function RevenueProfitChart({ data, formatCurrency, onPointClick }: RevenueProfitChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Revenue vs Profit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-80">
            <Badge variant="secondary">No Data</Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Revenue vs Profit</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={data} 
              margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
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
                tick={{ fontSize: 12, dx: -10 }}
                className="fill-muted-foreground"
                tickFormatter={(value) => formatCurrency(value)}
                width={90}
              />
              <Tooltip 
                formatter={(value: any) => [formatCurrency(value), '']}
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
                dataKey="revenue" 
                stroke="hsl(var(--primary-500))" 
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--primary-500))', strokeWidth: 2, r: 4, cursor: 'pointer' }}
                name="Revenue"
                activeDot={{ 
                  r: 6, 
                  stroke: 'hsl(var(--primary-500))', 
                  strokeWidth: 2,
                  cursor: 'pointer',
                  onClick: (_: any, payload: any) => onPointClick?.(payload.payload.dateKey)
                }}
              />
              <Line 
                type="monotone" 
                dataKey="profit" 
                stroke="hsl(var(--success-500))" 
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--success-500))', strokeWidth: 2, r: 4, cursor: 'pointer' }}
                name="Profit"
                activeDot={{ 
                  r: 6, 
                  stroke: 'hsl(var(--success-500))', 
                  strokeWidth: 2,
                  cursor: 'pointer',
                  onClick: (_: any, payload: any) => onPointClick?.(payload.payload.dateKey)
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
