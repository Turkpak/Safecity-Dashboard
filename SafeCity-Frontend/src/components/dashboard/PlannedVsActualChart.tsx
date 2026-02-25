import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWindowSize } from "@/hooks/use-window-size";

interface TimelinePoint {
  month: string;
  actual: number;
  planned: number;
}

interface PlannedVsActualChartProps {
  timelineData?: TimelinePoint[];
  phaseName: string;
  color: string;
}

export function PlannedVsActualChart({ timelineData, phaseName, color }: PlannedVsActualChartProps) {
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  
  if (!timelineData || timelineData.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-lg border-border/50 border-2 transition-colors hover:border-[#101a3c]">
      <CardHeader className="pb-4">
        <CardTitle className="font-heading text-xl font-bold">Planned vs Actual Progress</CardTitle>
        <CardDescription className="text-sm">{phaseName} - Timeline Comparison</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full" style={{ height: isMobile ? '240px' : isTablet ? '280px' : '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timelineData} margin={{ 
              top: 10, 
              right: isMobile ? 5 : 10, 
              left: isMobile ? -10 : 0, 
              bottom: isMobile ? 5 : 0 
            }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: isMobile ? 10 : isTablet ? 11 : 12, fill: "hsl(var(--muted-foreground))" }} 
              />
              <YAxis 
                domain={[0, 100]}
                axisLine={false} 
                tickLine={false} 
                width={isMobile ? 35 : 50}
                tick={{ fontSize: isMobile ? 10 : isTablet ? 11 : 12, fill: "hsl(var(--muted-foreground))" }} 
              />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                borderColor: "hsl(var(--border))", 
                borderRadius: "8px",
                fontSize: isMobile ? '10px' : '12px',
                padding: isMobile ? '4px 6px' : '8px 12px'
              }}
              formatter={(value: number, name: string) => [
                `${value.toFixed(1)}%`, 
                name === "actual" ? "Actual Progress" : "Planned Progress"
              ]}
            />
            <Legend 
              wrapperStyle={{ fontSize: isMobile ? '10px' : '12px' }}
              formatter={(value: string) => value === "actual" ? "Actual Progress" : "Planned Progress"}
            />
            <Line 
              type="monotone" 
              dataKey="planned" 
              stroke={color}
              strokeWidth={isMobile ? 1.5 : 2}
              strokeDasharray="5 5"
              dot={{ fill: color, r: isMobile ? 3 : 4 }}
              name="planned"
            />
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke={color}
              strokeWidth={isMobile ? 2 : 3}
              dot={{ fill: color, r: isMobile ? 4 : 5 }}
              name="actual"
            />
          </LineChart>
        </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

