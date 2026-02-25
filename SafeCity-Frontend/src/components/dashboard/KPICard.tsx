import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  trend?: number; // percentage
  trendLabel?: string;
  icon: React.ElementType;
  className?: string;
}

export function KPICard({ title, value, trend, trendLabel = "vs last hour", icon: Icon, className }: KPICardProps) {
  const isPositive = trend && trend > 0;
  const isNeutral = trend === 0;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground font-mono uppercase tracking-wider">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-heading">{value}</div>
        {trend !== undefined && (
          <p className="text-xs text-muted-foreground flex items-center mt-1">
            {isPositive ? (
              <ArrowUpRight className="h-4 w-4 text-emerald-500 mr-1" />
            ) : isNeutral ? (
              <Minus className="h-4 w-4 text-yellow-500 mr-1" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-rose-500 mr-1" />
            )}
            <span className={isPositive ? "text-emerald-500 font-medium" : isNeutral ? "text-yellow-500" : "text-rose-500"}>
              {Math.abs(trend)}%
            </span>
            <span className="ml-1 opacity-70">{trendLabel}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}