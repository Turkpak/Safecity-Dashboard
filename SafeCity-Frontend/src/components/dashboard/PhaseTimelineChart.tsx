import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWindowSize } from "@/hooks/use-window-size";

interface PhaseTimelineChartProps {
  timelineData?: {
    month: string;
    surveys: number;
    foundations: number;
    cabinet: number;
    cable: number;
    controlRoom: number;
    ppic3: number;
  }[];
  cityKey?: string;
}

export function PhaseTimelineChart({ timelineData, cityKey = "default" }: PhaseTimelineChartProps) {
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  
  if (!timelineData || timelineData.length === 0) {
    return null;
  }

  const gradientIds = {
    surveys: `gradient-surveys-${cityKey}`,
    foundations: `gradient-foundations-${cityKey}`,
    cabinet: `gradient-cabinet-${cityKey}`,
    cable: `gradient-cable-${cityKey}`,
    controlRoom: `gradient-controlRoom-${cityKey}`,
    ppic3: `gradient-ppic3-${cityKey}`,
  };

  return (
    <Card
      className="shadow-lg border-2 transition-colors"
      style={{
        borderColor: "var(--progress-accent-border, hsl(var(--border)))",
        boxShadow: "0 12px 30px var(--progress-accent-glow, transparent)",
        backgroundImage: [
          "radial-gradient(650px circle at 18% 14%, var(--progress-accent-soft, transparent), transparent 55%)",
          "linear-gradient(180deg, var(--progress-accent-soft, transparent), transparent 55%)",
        ].join(", "),
      }}
    >
      <CardHeader className="pb-4">
        <CardTitle className="font-heading text-xl font-bold">Phase Evolution Timeline</CardTitle>
        <CardDescription className="text-sm">All milestone progress over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full" style={{ height: isMobile ? '280px' : isTablet ? '320px' : '350px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timelineData} margin={{ 
              top: 10, 
              right: isMobile ? 5 : 10, 
              left: isMobile ? -10 : 0, 
              bottom: isMobile ? 5 : 0 
            }} key={cityKey}>
            <defs>
              <linearGradient id={gradientIds.surveys} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.0}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id={gradientIds.foundations} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.0}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id={gradientIds.cabinet} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.0}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id={gradientIds.cable} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.0}/>
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id={gradientIds.controlRoom} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.0}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id={gradientIds.ppic3} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#eab308" stopOpacity={0.0}/>
                <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
              </linearGradient>
            </defs>
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
              formatter={(value: number, name: string) => [`${value}%`, name]}
            />
            <Legend 
              wrapperStyle={{ fontSize: isMobile ? '10px' : '12px' }}
            />
            <Area type="monotone" dataKey="surveys" stackId="1" stroke="#3b82f6" fill="transparent" strokeWidth={isMobile ? 1.5 : 2} />
            <Area type="monotone" dataKey="foundations" stackId="1" stroke="#10b981" fill="transparent" strokeWidth={isMobile ? 1.5 : 2} />
            <Area type="monotone" dataKey="cabinet" stackId="1" stroke="#f59e0b" fill="transparent" strokeWidth={isMobile ? 1.5 : 2} />
            <Area type="monotone" dataKey="cable" stackId="1" stroke="#a855f7" fill="transparent" strokeWidth={isMobile ? 1.5 : 2} />
            <Area type="monotone" dataKey="controlRoom" stackId="1" stroke="#ef4444" fill="transparent" strokeWidth={isMobile ? 1.5 : 2} />
            <Area type="monotone" dataKey="ppic3" stackId="1" stroke="#eab308" fill="transparent" strokeWidth={isMobile ? 1.5 : 2} />
          </AreaChart>
        </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

