import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { X, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CashFlowDrillDownData } from "@/hooks/useCashFlowDrillDown";

interface CashFlowDataTableProps {
  drillDownData: CashFlowDrillDownData | null;
  onClose: () => void;
  formatCurrency: (amount: number, date?: string) => string;
}

export function CashFlowDataTable({ drillDownData, onClose, formatCurrency }: CashFlowDataTableProps) {
  if (!drillDownData) return null;

  const getTypeIcon = (type: 'inflow' | 'outflow') => {
    return type === 'inflow' 
      ? <ArrowUpCircle className="h-4 w-4 text-green-600" />
      : <ArrowDownCircle className="h-4 w-4 text-red-600" />;
  };

  const getTypeBadge = (type: 'inflow' | 'outflow') => {
    return type === 'inflow'
      ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
      : 'bg-red-500/10 text-red-500 hover:bg-red-500/20';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">
          Cash Flow Details - {drillDownData.period}
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {drillDownData.data.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillDownData.data.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell>
                      {row.category && (
                        <Badge variant="secondary">{row.category}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(row.type)}
                        <Badge variant="secondary" className={getTypeBadge(row.type)}>
                          {row.type === 'inflow' ? 'Inflow' : 'Outflow'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(row.amount, row.dateKey)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No transactions found for this period
          </div>
        )}
      </CardContent>
    </Card>
  );
}
