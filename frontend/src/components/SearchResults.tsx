import { SearchResult } from '@/hooks/useGlobalSearch';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileText, User, DollarSign, UserCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface SearchResultsProps {
  results: SearchResult[];
  onResultClick: (result: SearchResult) => void;
}

const getResultIcon = (type: SearchResult['type']) => {
  switch (type) {
    case 'invoice':
      return <FileText className="w-4 h-4 text-primary" />;
    case 'customer':
      return <User className="w-4 h-4 text-secondary" />;
    case 'contact':
      return <UserCircle className="w-4 h-4 text-accent" />;
    case 'payment':
      return <DollarSign className="w-4 h-4 text-success" />;
  }
};

const getStatusBadgeVariant = (status?: string) => {
  if (!status) return 'outline';
  switch (status.toLowerCase()) {
    case 'paid':
      return 'default';
    case 'open':
      return 'secondary';
    case 'overdue':
      return 'destructive';
    default:
      return 'outline';
  }
};

export function SearchResults({ results, onResultClick }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <Card className="absolute top-[calc(100%+0.5rem)] left-0 right-0 p-4 z-[9999] shadow-2xl bg-card border border-border">
        <p className="text-sm text-muted-foreground text-center">No results found</p>
      </Card>
    );
  }

  return (
    <Card className="absolute top-[calc(100%+0.5rem)] left-0 right-0 z-[100] shadow-2xl bg-card border border-border max-w-full">
      <ScrollArea className="max-h-[70vh] w-full">
        <div className="p-2">
          {results.map((result) => (
            <button
              key={`${result.type}-${result.id}`}
              onClick={() => onResultClick(result)}
              className="w-full text-left p-3 hover:bg-muted rounded-md transition-colors flex items-start gap-3 group"
            >
              <div className="mt-1">{getResultIcon(result.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm truncate">{result.title}</span>
                  {result.status && (
                    <Badge variant={getStatusBadgeVariant(result.status)} className="text-xs">
                      {result.status}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
              </div>
              {result.amount !== undefined && (
                <div className="text-sm font-semibold text-foreground">
                  {formatCurrency(result.amount)}
                </div>
              )}
            </button>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
