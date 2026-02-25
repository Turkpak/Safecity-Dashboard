import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWindowSize } from "@/hooks/use-window-size";

interface PhaseVelocityChartProps {
  phaseData: {
    phase: string;
    percentage: number;
    velocity: number; // Monthly progress rate
  }[];
  cityKey?: string;
}

const COLORS = {
  surveys: "#3b82f6",
  foundations: "#10b981",
  cabinet: "#f59e0b",
  cable: "#a855f7",
  controlRoom: "#ef4444",
  ppic3: "#eab308",
};

const getColor = (phase: string): string => {
  const key = phase.toLowerCase().replace(/\s+/g, "");
  if (key.includes("survey")) return COLORS.surveys;
  if (key.includes("foundation")) return COLORS.foundations;
  if (key.includes("cabinet")) return COLORS.cabinet;
  if (key.includes("cable")) return COLORS.cable;
  if (key.includes("control")) return COLORS.controlRoom;
  if (key.includes("ppic")) return COLORS.ppic3;
  return "#6b7280";
};

export function PhaseVelocityChart({ phaseData, cityKey = "default" }: PhaseVelocityChartProps) {
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  
  // Calculate velocity (monthly progress rate) for each phase
  const chartData = phaseData.map(item => ({
    phase: item.phase.length > (isMobile ? 12 : 15) ? item.phase.substring(0, isMobile ? 12 : 15) + "..." : item.phase,
    fullPhase: item.phase,
    progress: item.percentage,
    velocity: item.velocity || Math.round(item.percentage / 6), // Approximate monthly rate
    remaining: 100 - item.percentage,
  }));

  return (
    <Card className="shadow-lg border-border/50 border-2 transition-colors hover:border-[#101a3c]">
      <CardHeader className="pb-4">
        <CardTitle className="font-heading text-xl font-bold">Phase Progress & Velocity</CardTitle>
        <CardDescription className="text-sm">Current progress and monthly completion rate by phase</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full" style={{ height: isMobile ? '280px' : isTablet ? '320px' : '350px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ 
              top: 10, 
              right: isMobile ? 5 : 10, 
              left: isMobile ? -10 : 0, 
              bottom: isMobile ? 80 : 60 
            }} key={cityKey}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="phase" 
                angle={isMobile ? -60 : -45}
                textAnchor="end"
                height={isMobile ? 100 : 80}
                tick={{ fontSize: isMobile ? 9 : isTablet ? 10 : 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis 
                yAxisId="left"
                domain={[0, 100]}
                label={{ value: "Progress %", angle: -90, position: "insideLeft", style: { fontSize: isMobile ? '9px' : '11px' } }}
                tick={{ fontSize: isMobile ? 10 : isTablet ? 11 : 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={isMobile ? 35 : 50}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                domain={[0, 20]}
                label={{ value: "Velocity (%/month)", angle: 90, position: "insideRight", style: { fontSize: isMobile ? '9px' : '11px' } }}
                tick={{ fontSize: isMobile ? 10 : isTablet ? 11 : 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={isMobile ? 40 : 60}
              />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                borderColor: "hsl(var(--border))", 
                borderRadius: "8px",
                fontSize: isMobile ? '10px' : '12px',
                padding: isMobile ? '4px 6px' : '8px 12px'
              }}
              formatter={(value: number, name: string) => {
                if (name === "progress") return [`${value}%`, "Progress"];
                if (name === "velocity") return [`${value}%`, "Monthly Rate"];
                return [value, name];
              }}
            />
            <Legend 
              wrapperStyle={{ fontSize: isMobile ? '10px' : '12px' }}
            />
            <Bar yAxisId="left" dataKey="progress" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getColor(entry.fullPhase)} />
              ))}
            </Bar>
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="velocity" 
              stroke="#ef4444" 
              strokeWidth={isMobile ? 2 : 3}
              dot={{ fill: "#ef4444", r: isMobile ? 4 : 5 }}
              activeDot={{ r: isMobile ? 6 : 7 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

