import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StackedBarChartData {
  [key: string]: any;
}

interface StackedBarChartProps {
  data: StackedBarChartData[];
  title: string;
  bars: Array<{
    dataKey: string;
    name: string;
    color: string;
  }>;
  xAxisKey: string;
  className?: string;
  formatValue?: (value: number) => string;
  onBarClick?: (dataKey: string, barKey: string) => void;
}

export function StackedBarChart({ 
  data, 
  title, 
  bars, 
  xAxisKey, 
  className,
  formatValue = (value) => value.toLocaleString(),
  onBarClick
}: StackedBarChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-card-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatValue(entry.value)}
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
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={data} 
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis 
                dataKey={xAxisKey}
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
                tickFormatter={formatValue}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
              />
              {bars.map((bar) => (
                <Bar 
                  key={bar.dataKey}
                  dataKey={bar.dataKey} 
                  stackId="a"
                  fill={bar.color}
                  name={bar.name}
                  radius={[2, 2, 0, 0]}
                  onClick={(data) => onBarClick?.(data[xAxisKey], bar.dataKey)}
                  cursor={onBarClick ? "pointer" : "default"}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}