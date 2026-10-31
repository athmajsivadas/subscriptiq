import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
export type TimePeriod = 'month' | 'quarter' | 'year';
interface TimePeriodSelectorProps {
  selectedPeriod: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  className?: string;
}
const periodLabels: Record<TimePeriod, string> = {
  month: 'This Month',
  quarter: 'This Quarter',
  year: 'This Year'
};
const periodOptions: {
  value: TimePeriod;
  label: string;
  description: string;
}[] = [{
  value: 'month',
  label: 'Monthly',
  description: 'Current month data'
}, {
  value: 'quarter',
  label: 'Quarterly',
  description: 'Current quarter data'
}, {
  value: 'year',
  label: 'Yearly',
  description: 'Current year data'
}];
export function TimePeriodSelector({
  selectedPeriod,
  onPeriodChange,
  className
}: TimePeriodSelectorProps) {
  return <div className={`p-4 ${className}`}>
      <div className="flex items-center justify-between px-0 mx-0">
        <div className="flex items-center gap-2 mx-[16px]">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Time Period</span>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              {periodLabels[selectedPeriod]}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {periodOptions.map(option => <DropdownMenuItem key={option.value} onClick={() => onPeriodChange(option.value)} className="flex flex-col items-start gap-1">
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>;
}