import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface InstallationCardProps {
  title: string;
  percentage: number;
  icon: LucideIcon;
  className?: string;
  color?: "blue" | "green" | "orange" | "purple" | "red" | "yellow" | "primary";
  actualProgress?: number;
  plannedProgress?: number;
  onClick?: () => void;
  selected?: boolean;
}

export function InstallationCard({ 
  title, 
  percentage, 
  icon: Icon, 
  className, 
  color = "primary",
  actualProgress,
  plannedProgress,
  onClick,
  selected = false,
}: InstallationCardProps) {
  const showDualProgress = actualProgress !== undefined && plannedProgress !== undefined;
  
  // Calculate actual vs planned variance
  const variance = showDualProgress ? actualProgress - plannedProgress : null;
  const getColorClasses = () => {
    switch (color) {
      case "blue": return { 
        icon: "text-blue-600", 
        iconBg: "bg-blue-50 dark:bg-blue-950", 
        border: "border-l-4 border-l-blue-500", 
        progress: "bg-blue-500",
        percentage: "text-blue-600 dark:text-blue-400",
        selectedRing: "ring-2 ring-blue-500 ring-offset-2 ring-offset-background"
      };
      case "green": return { 
        icon: "text-emerald-600", 
        iconBg: "bg-emerald-50 dark:bg-emerald-950", 
        border: "border-l-4 border-l-emerald-500", 
        progress: "bg-emerald-500",
        percentage: "text-emerald-600 dark:text-emerald-400",
        selectedRing: "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background"
      };
      case "orange": return { 
        icon: "text-orange-600", 
        iconBg: "bg-orange-50 dark:bg-orange-950", 
        border: "border-l-4 border-l-orange-500", 
        progress: "bg-orange-500",
        percentage: "text-orange-600 dark:text-orange-400",
        selectedRing: "ring-2 ring-orange-500 ring-offset-2 ring-offset-background"
      };
      case "purple": return { 
        icon: "text-purple-600", 
        iconBg: "bg-purple-50 dark:bg-purple-950", 
        border: "border-l-4 border-l-purple-500", 
        progress: "bg-purple-500",
        percentage: "text-purple-600 dark:text-purple-400",
        selectedRing: "ring-2 ring-purple-500 ring-offset-2 ring-offset-background"
      };
      case "red": return { 
        icon: "text-red-600", 
        iconBg: "bg-red-50 dark:bg-red-950", 
        border: "border-l-4 border-l-red-500", 
        progress: "bg-red-500",
        percentage: "text-red-600 dark:text-red-400",
        selectedRing: "ring-2 ring-red-500 ring-offset-2 ring-offset-background"
      };
      case "yellow": return { 
        icon: "text-yellow-600", 
        iconBg: "bg-yellow-50 dark:bg-yellow-950", 
        border: "border-l-4 border-l-yellow-500", 
        progress: "bg-yellow-500",
        percentage: "text-yellow-600 dark:text-yellow-400",
        selectedRing: "ring-2 ring-yellow-500 ring-offset-2 ring-offset-background"
      };
      default: return { 
        icon: "text-primary", 
        iconBg: "bg-primary/10", 
        border: "border-l-4 border-l-primary", 
        progress: "bg-primary",
        percentage: "text-primary",
        selectedRing: "ring-2 ring-primary ring-offset-2 ring-offset-background"
      };
    }
  };

  const colors = getColorClasses();
  const status = percentage === 100 ? "Completed" : percentage >= 80 ? "Near Complete" : percentage >= 50 ? "In Progress" : "Started";

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1.5 group",
      colors.border,
      "border-r border-t border-b border-border/40 hover:border-border",
      "bg-gradient-to-br from-card to-card/95",
      onClick && "cursor-pointer select-none",
      selected && colors.selectedRing,
      selected && "shadow-2xl",
      className
    )}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Subtle background gradient */}
      <div className={cn(
        "absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-20 -mr-12 -mt-12 transition-opacity group-hover:opacity-30",
        colors.iconBg.replace("bg-", "bg-").replace("-50", "-200")
      )}></div>
      
      <CardHeader className="relative flex flex-row items-start justify-between space-y-0 pb-3 pt-4 px-3.5">
        <div className="flex-1 min-w-0 pr-2">
          <CardTitle className="text-[9px] font-bold text-foreground/90 uppercase tracking-wide leading-tight line-clamp-2">
            {title}
          </CardTitle>
        </div>
        <div className={cn(
          "flex-shrink-0 p-1.5 rounded-md shadow-sm group-hover:shadow transition-all",
          colors.iconBg
        )}>
          <Icon className={cn("h-3.5 w-3.5", colors.icon)} />
        </div>
      </CardHeader>
      <CardContent className="relative px-3.5 pb-4 pt-0">
        <div className="space-y-2.5">
          <div className="flex items-end justify-between gap-1">
            <span className={cn("text-2xl font-bold tabular-nums leading-none", colors.percentage)}>
              {percentage}
              <span className="text-sm font-semibold ml-0.5">%</span>
            </span>
            <span className="text-[8px] font-semibold text-muted-foreground/80 uppercase tracking-wider px-1 py-0.5 rounded bg-muted/50 leading-tight">
              {status}
            </span>
          </div>
          
          {/* Show dual progress bars if actual/planned provided */}
          {showDualProgress ? (
            <div className="space-y-1.5">
              {/* Planned Progress - Above */}
              <div>
                <div className="flex justify-between text-[7px] mb-0.5 text-muted-foreground">
                  <span>Planned</span>
                  <span className="font-semibold">{plannedProgress.toFixed(1)}%</span>
                  {variance !== null && (
                    <span className={cn(
                      "font-semibold ml-1",
                      variance >= 0 ? "text-emerald-600" : "text-red-600"
                    )}>
                      {variance >= 0 ? "+" : ""}{variance.toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/50 shadow-inner">
                  <div 
                    className={cn("h-full rounded-full transition-all duration-1000 ease-out opacity-40", colors.progress)}
                    style={{ width: `${Math.min(100, plannedProgress)}%` }}
                  />
                </div>
              </div>
              
              {/* Actual Progress - Below */}
              <div>
                <div className="flex justify-between text-[7px] mb-0.5 text-muted-foreground">
                  <span>Actual</span>
                  <span className="font-semibold">{actualProgress.toFixed(1)}%</span>
                </div>
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/50 shadow-inner">
                  <div 
                    className={cn("h-full rounded-full transition-all duration-1000 ease-out", colors.progress)}
                    style={{ width: `${Math.min(100, actualProgress)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Single progress bar (legacy) */
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/50 shadow-inner">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-1000 ease-out shadow-md relative overflow-hidden",
                  colors.progress
                )}
                style={{ width: `${percentage}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
              </div>
              </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

