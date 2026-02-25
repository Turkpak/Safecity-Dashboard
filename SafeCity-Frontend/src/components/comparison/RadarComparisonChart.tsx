import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWindowSize } from "@/hooks/use-window-size";

interface RadarComparisonChartProps {
  data: {
    phase: string;
    [city: string]: string | number;
  }[];
  cities: string[];
}

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ef4444", 
  "#eab308", "#06b6d4", "#8b5cf6", "#f97316", "#ec4899"
];

export function RadarComparisonChart({ data, cities }: RadarComparisonChartProps) {
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  
  const topCities = cities.slice(0, isMobile ? 3 : 5); // Show fewer cities on mobile

  return (
    <Card className="shadow-lg border-border/50 border-2 transition-colors hover:border-[#101a3c]">
      <CardHeader className="pb-4">
        <CardTitle className="font-heading text-xl font-bold">Multi-City Phase Comparison</CardTitle>
        <CardDescription className="text-sm">Radar chart comparing top {isMobile ? 3 : 5} cities across all phases</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full" style={{ height: isMobile ? '320px' : isTablet ? '400px' : '500px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis 
                dataKey="phase" 
                tick={{ fontSize: isMobile ? 9 : isTablet ? 10 : 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <PolarRadiusAxis 
                angle={90} 
                domain={[0, 100]}
                tick={{ fontSize: isMobile ? 8 : isTablet ? 9 : 10, fill: "hsl(var(--muted-foreground))" }}
              />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                borderColor: "hsl(var(--border))", 
                borderRadius: "8px",
                fontSize: isMobile ? '10px' : '12px',
                padding: isMobile ? '4px 6px' : '8px 12px'
              }}
            />
            <Legend 
              wrapperStyle={{ fontSize: isMobile ? '10px' : '12px' }}
            />
            {topCities.map((city, index) => (
              <Radar
                key={city}
                name={city}
                dataKey={city}
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.3}
                strokeWidth={isMobile ? 1.5 : 2}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

