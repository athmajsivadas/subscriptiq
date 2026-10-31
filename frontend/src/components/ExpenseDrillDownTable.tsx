import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { ExpenseDrillDownData } from "@/hooks/useExpenseDrillDown";

interface ExpenseDrillDownTableProps {
  drillDownData: ExpenseDrillDownData | null;
  onClose: () => void;
  isLoading?: boolean;
  formatCurrency: (amount: number, date?: string) => string;
}

export function ExpenseDrillDownTable({
  drillDownData,
  onClose,
  isLoading,
  formatCurrency,
}: ExpenseDrillDownTableProps) {
  if (!drillDownData) return null;

  const getTitle = () => {
    if (drillDownData.filterType === "category") {
      return `Expenses - ${drillDownData.category}`;
    }
    return `Expenses - ${drillDownData.periodLabel}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">{getTitle()}</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close expense drill-down">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Loading transactions...
          </div>
        ) : drillDownData.data.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  {drillDownData.data[0]?.category && <TableHead>Category</TableHead>}
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillDownData.data.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    {row.category && (
                      <TableCell>
                        <Badge variant="secondary">{row.category}</Badge>
                      </TableCell>
                    )}
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
            No transactions found for this selection
          </div>
        )}
      </CardContent>
    </Card>
  );
}
