import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, ArrowRight } from "lucide-react";

interface HierarchyCardProps {
  title: string;
  overallProgress: number;
  onClick: () => void;
  className?: string;
  color?: string; // Color for the card theme
}

export function HierarchyCard({ title, overallProgress, onClick, className, color }: HierarchyCardProps) {
  const status = overallProgress === 100 
    ? "Completed" 
    : overallProgress >= 80 
    ? "Near Complete" 
    : overallProgress >= 50 
    ? "In Progress" 
    : "Started";
  
  // Use provided color or default based on progress
  const cardColor = color || (overallProgress === 100
    ? "emerald"
    : overallProgress >= 80
    ? "blue"
    : overallProgress >= 50
    ? "orange"
    : "red");

  const colorClasses: Record<string, { border: string; bg: string; text: string; progress: string; iconBg: string }> = {
    emerald: {
      border: "border-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      text: "text-emerald-600 dark:text-emerald-400",
      progress: "bg-emerald-500",
      iconBg: "bg-emerald-100 dark:bg-emerald-900"
    },
    blue: {
      border: "border-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      text: "text-blue-600 dark:text-blue-400",
      progress: "bg-blue-500",
      iconBg: "bg-blue-100 dark:bg-blue-900"
    },
    orange: {
      border: "border-orange-500",
      bg: "bg-orange-50 dark:bg-orange-950/30",
      text: "text-orange-600 dark:text-orange-400",
      progress: "bg-orange-500",
      iconBg: "bg-orange-100 dark:bg-orange-900"
    },
    red: {
      border: "border-red-500",
      bg: "bg-red-50 dark:bg-red-950/30",
      text: "text-red-600 dark:text-red-400",
      progress: "bg-red-500",
      iconBg: "bg-red-100 dark:bg-red-900"
    },
    purple: {
      border: "border-purple-500",
      bg: "bg-purple-50 dark:bg-purple-950/30",
      text: "text-purple-600 dark:text-purple-400",
      progress: "bg-purple-500",
      iconBg: "bg-purple-100 dark:bg-purple-900"
    },
    indigo: {
      border: "border-indigo-500",
      bg: "bg-indigo-50 dark:bg-indigo-950/30",
      text: "text-indigo-600 dark:text-indigo-400",
      progress: "bg-indigo-500",
      iconBg: "bg-indigo-100 dark:bg-indigo-900"
    },
    teal: {
      border: "border-teal-500",
      bg: "bg-teal-50 dark:bg-teal-950/30",
      text: "text-teal-600 dark:text-teal-400",
      progress: "bg-teal-500",
      iconBg: "bg-teal-100 dark:bg-teal-900"
    },
    pink: {
      border: "border-pink-500",
      bg: "bg-pink-50 dark:bg-pink-950/30",
      text: "text-pink-600 dark:text-pink-400",
      progress: "bg-pink-500",
      iconBg: "bg-pink-100 dark:bg-pink-900"
    },
    cyan: {
      border: "border-cyan-500",
      bg: "bg-cyan-50 dark:bg-cyan-950/30",
      text: "text-cyan-600 dark:text-cyan-400",
      progress: "bg-cyan-500",
      iconBg: "bg-cyan-100 dark:bg-cyan-900"
    },
    amber: {
      border: "border-amber-500",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      text: "text-amber-600 dark:text-amber-400",
      progress: "bg-amber-500",
      iconBg: "bg-amber-100 dark:bg-amber-900"
    }
  };

  const colors = colorClasses[cardColor] || colorClasses.blue;

  return (
    <Card 
      className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer group",
        "border-l-4",
        colors.border,
        "border-r border-t border-b border-border/40 hover:border-opacity-100",
        colors.bg,
        className
      )}
      onClick={onClick}
    >
      {/* Background gradient */}
      <div className={cn("absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl -mr-16 -mt-16 opacity-20 group-hover:opacity-30 transition-opacity", colors.bg)}></div>
      
      <CardContent className="relative p-4">
        <div className="flex flex-col space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-base font-bold font-heading text-foreground mb-0.5">
                {title}
              </h3>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {status}
              </p>
            </div>
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              colors.iconBg
            )}>
              <TrendingUp className={cn("h-4 w-4", colors.text)} />
            </div>
          </div>

          {/* Progress Section */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className={cn("text-2xl font-bold font-heading tabular-nums", colors.text)}>
                {overallProgress}
                <span className="text-base ml-1">%</span>
              </span>
              <ArrowRight className={cn("h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-all", colors.text)} />
            </div>
            
            {/* Progress Bar */}
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted/60 shadow-inner">
              <div 
                className={cn(
                  "h-full transition-all duration-1000 ease-out rounded-full shadow-lg relative overflow-hidden",
                  colors.progress
                )}
                style={{ width: `${overallProgress}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

