import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useWindowSize } from "@/hooks/use-window-size";

interface CityComparisonChartProps {
  cityData: Record<string, { overall: number; name: string }>;
  selectedCity?: string;
}

export function CityComparisonChart({ cityData, selectedCity }: CityComparisonChartProps) {
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  
  const chartData = Object.entries(cityData)
    .map(([key, data]) => ({
      city: data.name,
      progress: data.overall,
    }))
    .sort((a, b) => b.progress - a.progress);

  const getColor = (progress: number): string => {
    if (progress >= 80) return "#10b981";
    if (progress >= 60) return "#3b82f6";
    if (progress >= 40) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <Card className="shadow-lg border-border/50 border-2 transition-colors hover:border-[#101a3c]">
      <CardHeader className="pb-4">
        <CardTitle className="font-heading text-xl font-bold">City Comparison</CardTitle>
        <CardDescription className="text-sm">Overall installation progress across all cities</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full" style={{ height: isMobile ? '280px' : isTablet ? '320px' : '350px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ 
              top: 10, 
              right: isMobile ? 5 : 10, 
              left: isMobile ? -10 : 0, 
              bottom: isMobile ? 80 : 20 
            }} key={selectedCity}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="city" 
                angle={isMobile ? -60 : -45}
                textAnchor="end"
                height={isMobile ? 100 : 80}
                tick={{ fontSize: isMobile ? 9 : isTablet ? 10 : 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis 
                domain={[0, 100]}
                tick={{ fontSize: isMobile ? 10 : isTablet ? 11 : 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={isMobile ? 35 : 50}
              />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                borderColor: "hsl(var(--border))", 
                borderRadius: "8px",
                fontSize: isMobile ? '10px' : '12px',
                padding: isMobile ? '4px 6px' : '8px 12px'
              }}
              formatter={(value: number) => [`${value}%`, "Overall Progress"]}
            />
            <Bar dataKey="progress" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getColor(entry.progress)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

