/**
 * ProgressOverviewChart.tsx
 * ============================================================
 * Reusable Overall Progress donut chart component.
 *
 * Accepts a single `value` prop (physical progress 0–100) and
 * renders the same Planned / Actual / Variance donut that
 * Dashboard.tsx uses, sourced from buildCurrentPhysicalChartData.
 *
 * Rules:
 *   - Uses only `value` (currentScopePhysical) as the actual.
 *   - Never reads data.overall, overall_progress, or any other field.
 *   - Never uses Math.round — always toFixed(2) via formatProgress.
 *   - Visual design matches the existing dashboard donut exactly.
 * ============================================================
 */

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  Label as RechartsLabel,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildCurrentPhysicalChartData,
  formatProgress,
} from "@/utils/dashboardPhysicalProgress";
import { useWindowSize } from "@/hooks/use-window-size";

// ── Props ─────────────────────────────────────────────────────

export interface ProgressOverviewChartProps {
  /** Physical progress percentage (0–100). This is the ONLY source of truth. */
  value: number;
  /** Card title. Defaults to "Overall Progress". */
  title?: string;
  /** Optional subtitle rendered below the title. */
  subtitle?: string;
  /** Extra class names applied to the wrapping Card element. */
  className?: string;
}

// ── Component ─────────────────────────────────────────────────

const ProgressOverviewChart: React.FC<ProgressOverviewChartProps> = ({
  value,
  title = "Overall Progress",
  subtitle,
  className,
}) => {
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;

  // Single canonical computation — matches the one in renderAggregatedCharts.
  const chart = buildCurrentPhysicalChartData(value);

  const pieData = [
    {
      name: "Planned",
      value: chart.normalizedPlanned,
      originalValue: chart.planned,
      fill: "#60a5fa",
    },
    {
      name: "Actual",
      value: chart.normalizedActual,
      originalValue: chart.actual,
      fill: "#22c55e",
    },
    {
      name: "Variance",
      value: chart.normalizedVariance,
      originalValue: chart.variance,
      fill: "#ef4444",
    },
  ];

  return (
    <Card
      className={`overflow-hidden border border-border/80 bg-card shadow-lg shadow-primary/5 transition-shadow hover:shadow-xl hover:shadow-primary/10${className ? ` ${className}` : ""}`}
    >
      <CardHeader className="py-3 px-4 pb-1">
        <CardTitle className="text-base font-heading">{title}</CardTitle>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-4">
        <div
          className="relative w-full"
          style={{
            height: isMobile ? "200px" : isTablet ? "220px" : "260px",
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 2, right: 2, bottom: 32, left: 2 }}>
              <Pie
                data={pieData}
                cx="50%"
                cy={isMobile ? "46%" : "50%"}
                innerRadius={isMobile ? 42 : isTablet ? 44 : 54}
                outerRadius={isMobile ? 60 : isTablet ? 72 : 88}
                paddingAngle={2}
                dataKey="value"
                stroke="rgba(255,255,255,0.9)"
                strokeWidth={2}
                isAnimationActive
                animationDuration={800}
                animationBegin={0}
              >
                {/* Center label: two-decimal actual % */}
                <RechartsLabel
                  content={({ viewBox }: any) => {
                    const cx = viewBox?.cx ?? 0;
                    const cy = viewBox?.cy ?? 0;
                    const valueText = `${formatProgress(chart.actual)}%`;
                    return (
                      <g>
                        <text
                          x={cx}
                          y={cy - (isMobile ? 2 : 3)}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="font-heading font-bold tabular-nums fill-foreground"
                          style={{ fontSize: isMobile ? 14 : 18 }}
                        >
                          {valueText}
                        </text>
                        <text
                          x={cx}
                          y={cy + (isMobile ? 12 : 14)}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="font-medium uppercase tracking-wider fill-muted-foreground"
                          style={{ fontSize: isMobile ? 9 : 10 }}
                        >
                          Actual
                        </text>
                      </g>
                    );
                  }}
                />
                {(["#60a5fa", "#22c55e", "#ef4444"] as const).map(
                  (fill, index) => (
                    <Cell
                      key={`cell-poc-${index}`}
                      fill={fill}
                      stroke="rgba(255,255,255,0.9)"
                      strokeWidth={2}
                    />
                  ),
                )}
              </Pie>

              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  fontSize: isMobile ? "11px" : "13px",
                  boxShadow: "0 10px 40px -10px rgba(0,0,0,0.15)",
                }}
                formatter={(
                  _value: number,
                  _name: string,
                  props: any,
                ) => {
                  const originalValue = props.payload?.originalValue ?? _value;
                  return [`${formatProgress(originalValue)}%`, _name];
                }}
              />

              <Legend
                verticalAlign="bottom"
                align="center"
                layout="horizontal"
                wrapperStyle={{
                  paddingTop: 6,
                  fontSize: isMobile ? "10px" : "11px",
                }}
                iconType="circle"
                iconSize={8}
                formatter={(legendValue) => {
                  let itemValue = 0;
                  if (legendValue === "Planned") itemValue = chart.planned;
                  else if (legendValue === "Actual") itemValue = chart.actual;
                  else if (legendValue === "Variance")
                    itemValue = chart.variance;
                  return (
                    <span className="text-muted-foreground font-medium">
                      {legendValue}{" "}
                      <span className="font-semibold text-foreground">
                        {formatProgress(itemValue)}%
                      </span>
                    </span>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProgressOverviewChart;
