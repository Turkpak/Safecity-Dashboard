import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface Milestone {
  id: string;
  name: string;
  duration: number;
  startDate: string | null;
  finishDate: string | null;
}

export interface SubProject {
  id: string;
  name: string;
  actualProgress: number;
  plannedProgress: number;
  weight: number; // Contribution weight to parent project (0-1)
  startDate?: string | null; // Real deadline from Excel
  finishDate?: string | null; // Real deadline from Excel
  milestones?: Milestone[]; // Real activities/milestones from Excel
}

interface SubProjectCardProps {
  subProject: SubProject;
  color: string;
  isExpanded?: boolean;
}

export function SubProjectCard({ subProject, color, isExpanded = false }: SubProjectCardProps) {
  const variance = subProject.actualProgress - subProject.plannedProgress;
  const varianceColor = variance >= 0 ? "text-emerald-600" : "text-red-600";
  const status = variance >= 0 ? "Ahead" : "Behind";
  
  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-200 hover:shadow-md",
      "border-l-2 border-l-current",
      "bg-card/50"
    )} style={{ borderLeftColor: color }}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground truncate">
              {subProject.name}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Weight: {(subProject.weight * 100).toFixed(0)}%
            </p>
          </div>
          <div className={cn("text-xs font-bold px-2 py-1 rounded", varianceColor, "bg-muted/50")}>
            {status} {Math.abs(variance).toFixed(1)}%
          </div>
        </div>
        
        <div className="space-y-2">
          {/* Actual Progress */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Actual</span>
              <span className="font-semibold text-foreground">{subProject.actualProgress.toFixed(1)}%</span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/50">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, subProject.actualProgress)}%`, backgroundColor: color }}
              />
            </div>
          </div>
          
          {/* Planned Progress */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Planned</span>
              <span className="font-semibold text-foreground">{subProject.plannedProgress.toFixed(1)}%</span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/50">
              <div 
                className="h-full rounded-full transition-all duration-500 border-2 border-dashed"
                style={{ 
                  width: `${Math.min(100, subProject.plannedProgress)}%`, 
                  backgroundColor: "transparent",
                  borderColor: color,
                  opacity: 0.5
                }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

