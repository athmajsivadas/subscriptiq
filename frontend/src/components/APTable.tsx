import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface APTableProps {
  data: Array<{
    id: string;
    billNumber: string;
    vendor: string;
    issueDate: string;
    dueDate: string;
    status: string;
    amount: number;
    currency: string;
    daysUntilDue: number;
    category: string | null;
  }>;
  formatCurrency: (amount: number, currency: string, transactionDate?: string) => string;
}

export function APTable({ data, formatCurrency }: APTableProps) {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "success" | "outline"> = {
      Open: "default",
      Partial: "secondary",
      Paid: "success",
      Overdue: "destructive",
    };
    return variants[status] || "default";
  };

  const getUrgencyBadge = (daysUntilDue: number) => {
    if (daysUntilDue < 0) return { variant: "destructive" as const, label: "Overdue" };
    if (daysUntilDue <= 7) return { variant: "destructive" as const, label: "Due Soon" };
    if (daysUntilDue <= 30) return { variant: "secondary" as const, label: "Current" };
    return { variant: "default" as const, label: "Future" };
  };

  if (data.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">No open vendor bills found</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill #</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Urgency</TableHead>
              <TableHead className="text-right">Days Until Due</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((bill) => {
              const urgency = getUrgencyBadge(bill.daysUntilDue);
              return (
                <TableRow key={bill.id}>
                  <TableCell className="font-medium">{bill.billNumber}</TableCell>
                  <TableCell>{bill.vendor}</TableCell>
                  <TableCell>{bill.category || "—"}</TableCell>
                  <TableCell>{new Date(bill.issueDate).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(bill.dueDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadge(bill.status)}>{bill.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={urgency.variant}>{urgency.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {bill.daysUntilDue < 0 ? `${Math.abs(bill.daysUntilDue)} days` : bill.daysUntilDue}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(bill.amount, bill.currency, bill.issueDate)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
