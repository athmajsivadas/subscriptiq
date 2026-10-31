import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DonutChartData {
  name: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutChartData[];
  title: string;
  centerValue?: string;
  centerLabel?: string;
  className?: string;
  onSliceClick?: (entry: DonutChartData) => void;
}

export function DonutChart({ data, title, centerValue, centerLabel, className, onSliceClick }: DonutChartProps) {
  /** Custom tooltip */
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataItem = payload[0];
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg z-50 pointer-events-none">
          <p className="font-medium text-card-foreground">{dataItem.name}</p>
          <p className="text-sm text-muted-foreground">
            Value: {typeof dataItem.value === "number" ? dataItem.value.toLocaleString() : dataItem.value}
          </p>
        </div>
      );
    }
    return null;
  };

  /** Simple legend */
  const CustomLegend = () => (
    <div className="border-t border-border pt-4 mt-4">
      <div className="space-y-2">
        {data.map((entry, index) => (
          <div key={`legend-${index}`} className="flex items-center justify-between gap-3 px-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-sm text-foreground truncate">{entry.name}</span>
            </div>
            <span className="text-sm font-medium text-foreground whitespace-nowrap">
              {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pb-6">
        <div className="space-y-4">
          {/* Chart */}
          <div className="relative h-[450px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={95} outerRadius={160} paddingAngle={0} dataKey="value">
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      onClick={() => onSliceClick?.(entry)}
                      cursor={onSliceClick ? "pointer" : "default"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={<CustomTooltip />}
                  wrapperStyle={{ zIndex: 9999 }} // ensure tooltip is above center text
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center value display */}
            {centerValue && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="text-center">
                  <div className="text-3xl font-bold text-foreground">{centerValue}</div>
                  {centerLabel && <div className="text-base text-muted-foreground">{centerLabel}</div>}
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <CustomLegend />
        </div>
      </CardContent>
    </Card>
  );
}
