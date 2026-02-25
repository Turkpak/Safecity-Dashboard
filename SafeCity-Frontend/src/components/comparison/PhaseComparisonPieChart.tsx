import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWindowSize } from "@/hooks/use-window-size";

interface PhaseComparisonPieChartProps {
  phaseName: string;
  cityData: {
    city: string;
    value: number;
  }[];
}

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ef4444", 
  "#eab308", "#06b6d4", "#8b5cf6", "#f97316", "#ec4899"
];

export function PhaseComparisonPieChart({ phaseName, cityData }: PhaseComparisonPieChartProps) {
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  
  const sortedData = [...cityData].sort((a, b) => b.value - a.value).slice(0, 6); // Top 6 cities

  return (
    <Card className="shadow-lg border-border/50 border-2 transition-colors hover:border-[#101a3c]">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg font-bold">{phaseName}</CardTitle>
        <CardDescription className="text-sm">Top 6 cities comparison</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pie Chart */}
        <div className="w-full" style={{ height: isMobile ? '220px' : isTablet ? '260px' : '280px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sortedData}
                cx="50%"
                cy="50%"
                label={false}
                outerRadius={isMobile ? 60 : isTablet ? 80 : 100}
                innerRadius={isMobile ? 20 : isTablet ? 30 : 40}
                fill="#8884d8"
                dataKey="value"
                paddingAngle={3}
              >
              {sortedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="white" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                borderColor: "hsl(var(--border))", 
                borderRadius: "8px",
                padding: isMobile ? "4px 6px" : "8px 12px",
                fontSize: isMobile ? '10px' : '12px'
              }}
              formatter={(value: number, name: string, props: any) => [
                `${props.payload.city}: ${value}%`,
                "Progress"
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        </div>

        {/* Legend with City Names */}
        <div className="flex flex-wrap justify-center gap-3 text-xs">
          {sortedData.map((entry, index) => (
            <div key={entry.city} className="flex items-center gap-1.5">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-muted-foreground font-medium">
                {entry.city}: {entry.value}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
