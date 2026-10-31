import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  fullValue?: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  hasData?: boolean;
  icon?: ReactNode;
  className?: string;
  gradient?: "primary" | "secondary" | "success" | "none";
  onClick?: () => void;
}

export function MetricCard({
  title,
  value,
  fullValue,
  change,
  changeType = "neutral",
  hasData = true,
  icon,
  className,
  gradient = "none",
  onClick
}: MetricCardProps) {
  const getGradientClass = () => {
    switch (gradient) {
      case "primary":
        return "bg-gradient-primary text-primary-foreground";
      case "secondary":
        return "bg-gradient-secondary text-secondary-foreground";
      case "success":
        return "bg-gradient-success text-success-foreground";
      default:
        return "bg-card text-card-foreground hover:bg-card-hover";
    }
  };

  const getChangeColor = () => {
    // Use high-contrast colors when gradient is applied
    if (gradient !== "none") {
      if (change?.includes('-')) {
        return "text-white/90";
      } else if (change?.includes('+')) {
        return "text-white/90";
      }
      return "text-white/70";
    }
    
    // Standard colors for non-gradient cards
    if (change?.includes('-')) {
      return "text-destructive";
    } else if (change?.includes('+')) {
      return "text-success";
    }
    return "text-muted-foreground";
  };

  const getChangeIcon = () => {
    if (change?.includes('-')) {
      return <TrendingDown className="w-4 h-4" />;
    } else if (change?.includes('+')) {
      return <TrendingUp className="w-4 h-4" />;
    }
    return null;
  };

  return (
    <Card 
      className={cn(
        "p-4 rounded-xl border shadow-md transition-all duration-200 hover:shadow-lg",
        onClick && "cursor-pointer",
        getGradientClass(),
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <p className={cn(
            "text-sm font-medium",
            gradient !== "none" ? "text-inherit opacity-90" : "text-muted-foreground"
          )}>
            {title}
          </p>
          {fullValue ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-2xl font-bold tracking-tight cursor-help">{value}</p>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{fullValue}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          )}
          {hasData && change && (
            <div className={cn(
              "flex items-center gap-1 text-sm font-medium",
              getChangeColor()
            )}>
              {getChangeIcon()}
              {change}
            </div>
          )}
        </div>
        {icon && (
          <div className={cn(
            "flex-shrink-0 p-2 rounded-lg",
            gradient !== "none" ? "bg-white/20" : "bg-muted"
          )}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}