import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ARTableProps {
  data: Array<{
    id: string;
    invoiceNumber: string;
    customer: string;
    issueDate: string;
    dueDate: string;
    status: string;
    amount: number;
    currency: string;
    daysOutstanding: number;
    agingBucket: string;
  }>;
  formatCurrency: (amount: number, currency: string, transactionDate?: string) => string;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export function ARTable({ data, formatCurrency, page = 1, totalPages = 1, onPageChange }: ARTableProps) {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "success" | "outline"> = {
      Open: "default",
      Partial: "secondary",
      Paid: "success",
      Overdue: "destructive",
    };
    return variants[status] || "default";
  };

  const getAgingBadge = (bucket: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      current: "default",
      "30-60": "secondary",
      "60+": "destructive",
    };
    return variants[bucket] || "default";
  };

  if (data.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">No open invoices found</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aging</TableHead>
              <TableHead className="text-right">Days Outstanding</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                <TableCell>{invoice.customer}</TableCell>
                <TableCell>{new Date(invoice.issueDate).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadge(invoice.status)}>{invoice.status}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={getAgingBadge(invoice.agingBucket)}>
                    {invoice.agingBucket === "current" ? "0-30 days" : 
                     invoice.agingBucket === "30-60" ? "30-60 days" : "60+ days"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{invoice.daysOutstanding}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(invoice.amount, invoice.currency, invoice.issueDate)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between p-4 border-t">
          <div className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
