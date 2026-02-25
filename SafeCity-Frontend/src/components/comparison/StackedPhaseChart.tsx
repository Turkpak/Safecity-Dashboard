import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWindowSize } from "@/hooks/use-window-size";

interface StackedPhaseChartProps {
  data: {
    city: string;
    surveys: number;
    foundations: number;
    cabinet: number;
    cable: number;
    controlRoom: number;
    ppic3: number;
  }[];
}

const PHASE_COLORS = {
  surveys: "#3b82f6",
  foundations: "#10b981",
  cabinet: "#f59e0b",
  cable: "#a855f7",
  controlRoom: "#ef4444",
  ppic3: "#eab308",
};

export function StackedPhaseChart({ data }: StackedPhaseChartProps) {
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;

  // Calculate average progress for each city and transform data
  // Each phase segment will be proportional to its value, but total bar height = average (0-100)
  const transformedData = data.map(city => {
    const average = (city.surveys + city.foundations + city.cabinet + city.cable + city.controlRoom + city.ppic3) / 6;
    const total = city.surveys + city.foundations + city.cabinet + city.cable + city.controlRoom + city.ppic3;
    
    // Scale each phase proportionally so total equals average
    // Each segment = (phase_value / total) * average
    return {
      city: city.city,
      surveys: total > 0 ? (city.surveys / total) * average : 0,
      foundations: total > 0 ? (city.foundations / total) * average : 0,
      cabinet: total > 0 ? (city.cabinet / total) * average : 0,
      cable: total > 0 ? (city.cable / total) * average : 0,
      controlRoom: total > 0 ? (city.controlRoom / total) * average : 0,
      ppic3: total > 0 ? (city.ppic3 / total) * average : 0,
      average: average // Store for sorting
    };
  });

  const sortedData = [...transformedData].sort((a, b) => {
    return b.average - a.average;
  });

  return (
    <Card className="shadow-lg border-border/50 border-2 transition-colors hover:border-[#101a3c]">
      <CardHeader className="pb-4">
        <CardTitle className="font-heading text-xl font-bold">Phase Progress Comparison</CardTitle>
        <CardDescription className="text-sm">Stacked view of best performing projects citywise</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full" style={{ height: isMobile ? '320px' : isTablet ? '380px' : '450px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={sortedData} 
              margin={{ 
                top: isMobile ? 5 : 10, 
                right: isMobile ? 5 : 10, 
                left: isMobile ? 5 : 10, 
                bottom: isMobile ? 110 : isTablet ? 90 : 80 
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
                  value: "Average Progress (%)", 
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
                formatter={(value: number, name: string) => [`${value}%`, name]}
              />
              <Legend 
                wrapperStyle={{ 
                  paddingTop: isMobile ? "8px" : isTablet ? "15px" : "20px",
                  fontSize: isMobile ? '9px' : isTablet ? '10px' : '12px'
                }}
              />
              <Bar dataKey="surveys" stackId="a" fill={PHASE_COLORS.surveys} />
              <Bar dataKey="foundations" stackId="a" fill={PHASE_COLORS.foundations} />
              <Bar dataKey="cabinet" stackId="a" fill={PHASE_COLORS.cabinet} />
              <Bar dataKey="cable" stackId="a" fill={PHASE_COLORS.cable} />
              <Bar dataKey="controlRoom" stackId="a" fill={PHASE_COLORS.controlRoom} />
              <Bar dataKey="ppic3" stackId="a" fill={PHASE_COLORS.ppic3} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

