import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useWindowSize } from "@/hooks/use-window-size";

interface PhaseDistributionChartProps {
  data: {
    phase: string;
    percentage: number;
  }[];
  title?: string;
  description?: string;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ef4444", "#eab308"];

export function PhaseDistributionChart({
  data,
  title = "Phase Distribution",
  description = "Progress distribution across milestone progress",
}: PhaseDistributionChartProps) {
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  
  const chartData = data.map((item, index) => ({
    name: item.phase,
    value: item.percentage,
    fullName: item.phase,
    color: COLORS[index % COLORS.length],
  }));

  // Create a unique key based on data to force re-render
  const dataKey = JSON.stringify(data);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-sm mb-1">{data.fullName}</p>
          <p className="text-primary font-bold text-lg">{`${data.value}%`}</p>
        </div>
      );
    }
    return null;
  };

  // Custom label function - only show percentage on slice, no text
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, payload }: any) => {
    const RADIAN = Math.PI / 180;
    // Bias towards the outer edge so text doesn't fall into the donut hole.
    const radius = innerRadius + (outerRadius - innerRadius) * 0.65;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    // Only show label if slice is large enough (>5%)
    if (percent < 0.05) return null;

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
        style={{ pointerEvents: "none" }}
      >
        {`${Number(payload?.value ?? 0).toFixed(2)}%`}
      </text>
    );
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
        <CardTitle className="font-heading text-xl font-bold">{title}</CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-4 min-w-0">
          {/* Pie Chart */}
          <div className="flex-1 min-w-0">
            <div className="w-full" style={{ height: isMobile ? '220px' : isTablet ? '260px' : '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
              <PieChart
                key={dataKey}
                margin={{ top: 12, right: 12, bottom: 12, left: 12 }}
              >
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={isMobile ? 56 : isTablet ? 70 : 84}
                  innerRadius={isMobile ? 18 : isTablet ? 24 : 30}
                  fill="#8884d8"
                  dataKey="value"
                  paddingAngle={2}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            </div>
          </div>

          {/* Custom Legend */}
          <div className="w-full lg:w-auto lg:min-w-[220px]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
            {chartData.map((entry, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors min-w-0"
              >
                <div
                  className="w-4 h-4 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground leading-tight break-words">
                    {entry.fullName}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <p className="text-sm font-bold tabular-nums" style={{ color: entry.color }}>
                    {entry.value}%
                  </p>
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

