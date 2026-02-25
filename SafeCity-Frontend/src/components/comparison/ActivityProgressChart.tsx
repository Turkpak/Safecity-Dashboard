import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWindowSize } from "@/hooks/use-window-size";

interface ActivityProgressChartProps {
  cityName: string;
  activityData: {
    activity: string;
    completion: number;
  }[];
}

const COLORS = {
  surveys: "#3b82f6",
  foundations: "#10b981",
  cabinet: "#f59e0b",
  cable: "#a855f7",
  controlRoom: "#ef4444",
  ppic3: "#eab308",
};

const getColor = (activity: string): string => {
  const key = activity.toLowerCase();
  if (key.includes("survey")) return COLORS.surveys;
  if (key.includes("foundation") || key.includes("pole")) return COLORS.foundations;
  if (key.includes("cabinet")) return COLORS.cabinet;
  if (key.includes("cable")) return COLORS.cable;
  if (key.includes("control")) return COLORS.controlRoom;
  if (key.includes("ppic")) return COLORS.ppic3;
  return "#6b7280";
};

export function ActivityProgressChart({ cityName, activityData }: ActivityProgressChartProps) {
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;

  return (
    <Card className="shadow-lg border-border/50 border-2 transition-colors hover:border-[#101a3c]">
      <CardHeader className="pb-4">
        <CardTitle className="font-heading text-xl font-bold">Smart Safe Cities Phase I (Completion %)</CardTitle>
        <CardDescription className="text-sm">District Wise Progress {cityName}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full" style={{ height: isMobile ? '300px' : isTablet ? '350px' : '400px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={activityData} 
              margin={{ 
                top: isMobile ? 5 : 10, 
                right: isMobile ? 5 : 10, 
                left: isMobile ? 5 : 10, 
                bottom: isMobile ? 120 : isTablet ? 100 : 100 
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="activity" 
                angle={isMobile ? -60 : -45}
                textAnchor="end"
                height={isMobile ? 140 : isTablet ? 120 : 120}
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
              <Bar dataKey="completion" radius={[4, 4, 0, 0]}>
                {activityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getColor(entry.activity)} />
                ))}
                {!isMobile && (
                  <LabelList 
                    dataKey="completion" 
                    position="top" 
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

