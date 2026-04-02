import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWindowSize } from "@/hooks/use-window-size";

interface CityCompletionChartProps {
  cityData: {
    city: string;
    completion: number;
  }[];
  description?: string;
}

const getColor = (completion: number): string => {
  if (completion >= 80) return "#10b981"; // emerald
  if (completion >= 60) return "#3b82f6"; // blue
  if (completion >= 40) return "#f59e0b"; // orange
  return "#ef4444"; // red
};

export function CityCompletionChart({ cityData, description = "District Wise Progress" }: CityCompletionChartProps) {
  const { width } = useWindowSize();
  const sortedData = [...cityData].sort((a, b) => b.completion - a.completion);
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  // Keep bar width visually consistent even when the number of divisions changes.
  const barSize = isMobile ? 28 : isTablet ? 34 : 42;

  return (
    <Card className="shadow-lg border-border/50 border-2 transition-colors hover:border-[#101a3c]">
      <CardHeader className="pb-4">
        <CardTitle className="font-heading text-lg sm:text-xl font-bold leading-tight">Smart Safe Cities Phase I (Completion %)</CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full" style={{ height: isMobile ? '320px' : isTablet ? '380px' : '450px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={sortedData} 
              barCategoryGap={isMobile ? 12 : 18}
              barGap={4}
              margin={{ 
                top: isMobile ? 5 : 10, 
                right: isMobile ? 5 : 10, 
                left: isMobile ? 18 : 30, 
                bottom: isMobile ? 130 : isTablet ? 110 : 95 
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="city" 
                angle={isMobile ? -60 : -45}
                textAnchor="end"
                height={isMobile ? 130 : isTablet ? 110 : 100}
                tick={{ 
                  fontSize: isMobile ? 8 : isTablet ? 10 : 11, 
                  fill: "hsl(var(--muted-foreground))" 
                }}
                interval={0}
              />
              <YAxis 
                domain={[0, 100]}
                tick={{ 
                  fontSize: isMobile ? 9 : isTablet ? 10 : 12, 
                  fill: "hsl(var(--muted-foreground))" 
                }}
                axisLine={false}
                tickLine={false}
                width={isMobile ? 30 : isTablet ? 40 : 50}
                label={{ 
                  value: "Completion %", 
                  angle: -90, 
                  position: "insideLeft",
                  style: { fontSize: isMobile ? '9px' : isTablet ? '10px' : '12px' }
                }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))", 
                  borderColor: "hsl(var(--border))", 
                  borderRadius: "8px",
                  fontSize: isMobile ? '10px' : isTablet ? '11px' : '12px',
                  padding: isMobile ? '4px 6px' : isTablet ? '6px 8px' : '8px 12px'
                }}
                formatter={(value: number) => [`${value}%`, "Completion"]}
              />
              <Legend 
                wrapperStyle={{ 
                  paddingTop: isMobile ? "8px" : isTablet ? "15px" : "20px",
                  fontSize: isMobile ? '9px' : isTablet ? '10px' : '12px'
                }}
                iconType="circle"
              />
              <Bar
                dataKey="completion"
                radius={[4, 4, 0, 0]}
                barSize={barSize}
              >
                {sortedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getColor(entry.completion)} />
                ))}
                {!isMobile && (
                  <LabelList 
                    dataKey="completion" 
                    // Use insideTop so the "100%" label never overlaps the 100% grid line.
                    position="insideTop"
                    offset={6}
                    formatter={(value: number) => `${value}%`}
                    style={{ 
                      fontSize: isTablet ? "9px" : "11px", 
                      fill: "hsl(var(--foreground))", 
                      fontWeight: "bold" 
                    }}
                  />
                )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

