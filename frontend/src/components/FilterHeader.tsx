import React, { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, X, RotateCcw, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { useAccountingSettings, useUpdateAccountingBasis } from '@/hooks/useAccountingSettings';
import { useFilterSegments } from '@/hooks/useFilterSegments';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface FilterState {
  dateRange: {
    from?: Date;
    to?: Date;
  };
  project?: string;
  department?: string;
  product?: string;
  region?: string;
  currency?: string;
}

interface FilterHeaderProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  showFxCurrency?: boolean;
  className?: string;
}

// Fallback segments if none are in database
const fallbackSegments = {
  projects: ['Project Alpha', 'Project Beta', 'Project Gamma', 'Project Delta'],
  departments: ['Sales', 'Marketing', 'Engineering', 'Operations', 'Finance'],
  products: ['Product A', 'Product B', 'Product C', 'Product D'],
  regions: ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East']
};

const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];

export const FilterHeader: React.FC<FilterHeaderProps> = ({
  filters,
  onFiltersChange,
  showFxCurrency = true,
  className
}) => {
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [tempDateRange, setTempDateRange] = useState<{ from?: Date; to?: Date }>({});
  const { data: settings } = useAccountingSettings();
  const updateBasis = useUpdateAccountingBasis();
  const { segments: dbSegments } = useFilterSegments();
  
  // Group database segments by type
  const segmentsByType = {
    projects: dbSegments.filter(s => s.segment_type === 'project').map(s => s.segment_value),
    departments: dbSegments.filter(s => s.segment_type === 'department').map(s => s.segment_value),
    products: dbSegments.filter(s => s.segment_type === 'product').map(s => s.segment_value),
    regions: dbSegments.filter(s => s.segment_type === 'region').map(s => s.segment_value),
  };

  // Use database segments if available, otherwise use fallback
  const segments = {
    projects: segmentsByType.projects.length > 0 ? segmentsByType.projects : fallbackSegments.projects,
    departments: segmentsByType.departments.length > 0 ? segmentsByType.departments : fallbackSegments.departments,
    products: segmentsByType.products.length > 0 ? segmentsByType.products : fallbackSegments.products,
    regions: segmentsByType.regions.length > 0 ? segmentsByType.regions : fallbackSegments.regions,
  };

  const updateFilter = (key: keyof FilterState, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const resetFilters = () => {
    onFiltersChange({
      dateRange: {},
      project: undefined,
      department: undefined,
      product: undefined,
      region: undefined,
      currency: showFxCurrency ? 'USD' : undefined
    });
  };

  const removeFilter = (key: keyof FilterState) => {
    if (key === 'dateRange') {
      updateFilter('dateRange', {});
    } else {
      updateFilter(key, undefined);
    }
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.dateRange.from || filters.dateRange.to) count++;
    if (filters.project) count++;
    if (filters.department) count++;
    if (filters.product) count++;
    if (filters.region) count++;
    if (filters.currency && showFxCurrency) count++; // Always count currency when FX is shown
    return count;
  };

  const formatDateRange = () => {
    if (filters.dateRange.from && filters.dateRange.to) {
      return `${format(filters.dateRange.from, 'MMM dd')} - ${format(filters.dateRange.to, 'MMM dd, yyyy')}`;
    }
    if (filters.dateRange.from) {
      return `From ${format(filters.dateRange.from, 'MMM dd, yyyy')}`;
    }
    if (filters.dateRange.to) {
      return `Until ${format(filters.dateRange.to, 'MMM dd, yyyy')}`;
    }
    return 'Select date range';
  };

  return (
    <div className={cn(
      "sticky top-0 z-50 bg-background-95 backdrop-blur supports-[backdrop-filter]:bg-background-60 border-b",
      className
    )}>
      <div className="flex flex-col gap-4 p-4">
        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
          </div>

          {/* Date Range Picker */}
          <Popover 
            open={dateRangeOpen} 
            onOpenChange={(open) => {
              setDateRangeOpen(open);
              if (open) {
                setTempDateRange(filters.dateRange);
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[280px] justify-start text-left font-normal",
                  (!filters.dateRange.from && !filters.dateRange.to) && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formatDateRange()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={filters.dateRange.from}
                selected={{
                  from: tempDateRange.from || filters.dateRange.from,
                  to: tempDateRange.to || filters.dateRange.to
                }}
                onSelect={(range) => {
                  setTempDateRange({
                    from: range?.from,
                    to: range?.to
                  });
                  if (range?.from && range?.to) {
                    updateFilter('dateRange', {
                      from: range.from,
                      to: range.to
                    });
                    setDateRangeOpen(false);
                  }
                }}
                numberOfMonths={2}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* Project Filter */}
          <Select value={filters.project || 'all'} onValueChange={(value) => updateFilter('project', value === 'all' ? undefined : value)}>
            <SelectTrigger className="w-[160px] bg-background">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="all">All Projects</SelectItem>
              {segments.projects.map((project) => (
                <SelectItem key={project} value={project}>{project}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Department Filter */}
          <Select value={filters.department || 'all'} onValueChange={(value) => updateFilter('department', value === 'all' ? undefined : value)}>
            <SelectTrigger className="w-[160px] bg-background">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="all">All Departments</SelectItem>
              {segments.departments.map((dept) => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Product Filter */}
          <Select value={filters.product || 'all'} onValueChange={(value) => updateFilter('product', value === 'all' ? undefined : value)}>
            <SelectTrigger className="w-[160px] bg-background">
              <SelectValue placeholder="Product" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="all">All Products</SelectItem>
              {segments.products.map((product) => (
                <SelectItem key={product} value={product}>{product}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Region Filter */}
          <Select value={filters.region || 'all'} onValueChange={(value) => updateFilter('region', value === 'all' ? undefined : value)}>
            <SelectTrigger className="w-[160px] bg-background">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="all">All Regions</SelectItem>
              {segments.regions.map((region) => (
                <SelectItem key={region} value={region}>{region}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Accounting Basis Toggle */}
          <Select 
            value={settings?.basis || 'accrual'} 
            onValueChange={(value) => updateBasis.mutate(value as 'accrual' | 'cash')}
          >
            <SelectTrigger className="w-[130px] bg-background">
              <SelectValue placeholder="Basis" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="accrual">Accrual</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
            </SelectContent>
          </Select>

          {/* Currency Filter */}
          {showFxCurrency && (
            <Select value={filters.currency || 'USD'} onValueChange={(value) => updateFilter('currency', value)}>
              <SelectTrigger className="w-[100px] bg-background">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                {currencies.map((currency) => (
                  <SelectItem key={currency} value={currency}>{currency}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Reset Button */}
          {getActiveFiltersCount() > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </Button>
          )}
        </div>

        {/* Active Filter Chips */}
        {getActiveFiltersCount() > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Active filters:</span>
            
            {(filters.dateRange.from || filters.dateRange.to) && (
              <Badge variant="secondary" className="gap-1">
                {formatDateRange()}
                <button
                  onClick={() => removeFilter('dateRange')}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {filters.project && (
              <Badge variant="secondary" className="gap-1">
                Project: {filters.project}
                <button
                  onClick={() => removeFilter('project')}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {filters.department && (
              <Badge variant="secondary" className="gap-1">
                Dept: {filters.department}
                <button
                  onClick={() => removeFilter('department')}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {filters.product && (
              <Badge variant="secondary" className="gap-1">
                Product: {filters.product}
                <button
                  onClick={() => removeFilter('product')}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {filters.region && (
              <Badge variant="secondary" className="gap-1">
                Region: {filters.region}
                <button
                  onClick={() => removeFilter('region')}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {filters.currency && showFxCurrency && (
              <Badge variant="secondary" className="gap-1">
                Currency: {filters.currency}
                <button
                  onClick={() => removeFilter('currency')}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
};