import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { DollarSign, TrendingUp } from "lucide-react";

type Project = {
  id: number;
  project_name?: string | null;
  division?: number | null;
  district?: number | null;
  tehsil?: number | null;
  allocation_total_cost?: number | null;
  pd_release_total_cost?: number | null;
  spending_release_total_cost?: number | null;
  pifra_utilization_total_cost?: number | null;
  percentage_utilization_total?: number | null;
  [key: string]: any;
};

type Division = { id: number; division_name?: string | null };
type District = { id: number; district_name?: string | null; division?: number | null };
type Tehsil = { id: number; tehsil_name?: string | null; district?: number | null; division?: number | null };

interface Props {
  projects: Project[];
  divisions: Division[];
  districts: District[];
  tehsils: Tehsil[];
  viewType: "divisions" | "districts" | "tehsils" | "projects" | "";
  selectedItemType: "division" | "district" | "tehsil" | null;
  selectedItemId: number | null;
  parentDivisionId: number | null;
  parentDistrictId: number | null;
  isMobile: boolean;
  isTablet: boolean;
}

const num = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const formatCurrency = (val: number) => {
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(2)}K`;
  return `${val.toFixed(0)}`;
};

export default function FinancialProgressOverviewChart({
  projects,
  divisions,
  districts,
  tehsils,
  viewType,
  selectedItemType,
  selectedItemId,
  parentDivisionId,
  parentDistrictId,
  isMobile,
  isTablet,
}: Props) {
  const data = (() => {
    // Scope filtering
    let scopedProjects = projects;
    if (selectedItemType === "division" && selectedItemId != null) {
      scopedProjects = projects.filter((p) => p.division === selectedItemId);
    } else if (selectedItemType === "district" && selectedItemId != null) {
      scopedProjects = projects.filter((p) => p.district === selectedItemId);
    } else if (selectedItemType === "tehsil" && selectedItemId != null) {
      scopedProjects = projects.filter((p) => p.tehsil === selectedItemId);
    }

    // Determine grouping key
    let rows: Array<{
      key: string;
      name: string;
      allocation: number;
      pdRelease: number;
      spendingRelease: number;
      pifraUtilization: number;
      pctUtilization: number;
      count: number;
    }> = [];

    if (selectedItemType === "tehsil" || (viewType === "projects" && !selectedItemType)) {
      // Group by Project
      const map = new Map<string, typeof rows[0]>();
      for (const p of scopedProjects) {
        const k = String(p.id);
        if (!map.has(k)) {
          map.set(k, {
            key: k,
            name: p.project_name || `Project ${p.id}`,
            allocation: 0,
            pdRelease: 0,
            spendingRelease: 0,
            pifraUtilization: 0,
            pctUtilization: 0,
            count: 0,
          });
        }
        const row = map.get(k)!;
        row.allocation += num(p.allocation_total_cost);
        row.pdRelease += num(p.pd_release_total_cost);
        row.spendingRelease += num(p.spending_release_total_cost);
        row.pifraUtilization += num(p.pifra_utilization_total_cost);
        row.pctUtilization += num(p.percentage_utilization_total);
        row.count += 1;
      }
      rows = Array.from(map.values());
    } else if (selectedItemType === "district") {
      // Group by Tehsil
      const map = new Map<string, typeof rows[0]>();
      for (const p of scopedProjects) {
        const t = tehsils.find((th) => th.id === p.tehsil);
        const k = String(p.tehsil ?? "unknown");
        if (!map.has(k)) {
          map.set(k, {
            key: k,
            name: t?.tehsil_name || `Tehsil ${k}`,
            allocation: 0,
            pdRelease: 0,
            spendingRelease: 0,
            pifraUtilization: 0,
            pctUtilization: 0,
            count: 0,
          });
        }
        const row = map.get(k)!;
        row.allocation += num(p.allocation_total_cost);
        row.pdRelease += num(p.pd_release_total_cost);
        row.spendingRelease += num(p.spending_release_total_cost);
        row.pifraUtilization += num(p.pifra_utilization_total_cost);
        row.pctUtilization += num(p.percentage_utilization_total);
        row.count += 1;
      }
      rows = Array.from(map.values());
    } else if (selectedItemType === "division") {
      // Group by District
      const map = new Map<string, typeof rows[0]>();
      for (const p of scopedProjects) {
        const d = districts.find((di) => di.id === p.district);
        const k = String(p.district ?? "unknown");
        if (!map.has(k)) {
          map.set(k, {
            key: k,
            name: d?.district_name || `District ${k}`,
            allocation: 0,
            pdRelease: 0,
            spendingRelease: 0,
            pifraUtilization: 0,
            pctUtilization: 0,
            count: 0,
          });
        }
        const row = map.get(k)!;
        row.allocation += num(p.allocation_total_cost);
        row.pdRelease += num(p.pd_release_total_cost);
        row.spendingRelease += num(p.spending_release_total_cost);
        row.pifraUtilization += num(p.pifra_utilization_total_cost);
        row.pctUtilization += num(p.percentage_utilization_total);
        row.count += 1;
      }
      rows = Array.from(map.values());
    } else {
      // Root view: group by Division
      const map = new Map<string, typeof rows[0]>();
      for (const p of scopedProjects) {
        const d = divisions.find((di) => di.id === p.division);
        const k = String(p.division ?? "unknown");
        if (!map.has(k)) {
          map.set(k, {
            key: k,
            name: d?.division_name || `Division ${k}`,
            allocation: 0,
            pdRelease: 0,
            spendingRelease: 0,
            pifraUtilization: 0,
            pctUtilization: 0,
            count: 0,
          });
        }
        const row = map.get(k)!;
        row.allocation += num(p.allocation_total_cost);
        row.pdRelease += num(p.pd_release_total_cost);
        row.spendingRelease += num(p.spending_release_total_cost);
        row.pifraUtilization += num(p.pifra_utilization_total_cost);
        row.pctUtilization += num(p.percentage_utilization_total);
        row.count += 1;
      }
      rows = Array.from(map.values());
    }

    // Average the percentage and sort by allocation desc
    return rows
      .map((r) => ({
        ...r,
        pctUtilization: r.count > 0 ? r.pctUtilization / r.count : 0,
      }))
      .sort((a, b) => b.allocation - a.allocation);
  })();

  const chartHeight = isMobile ? 280 : isTablet ? 320 : 380;

  if (data.length === 0) {
    return (
      <Card className="border border-border/80 bg-card shadow-sm">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Financial Progress Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
            No financial data available for the selected scope.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border border-border/80 bg-card shadow-lg shadow-primary/5 transition-shadow hover:shadow-xl hover:shadow-primary/10">
      <CardHeader className="py-3 px-4 pb-1">
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          Financial Progress Overview
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Allocation · PD Release · Spending Release · PIFRA Utilization · Utilization %
        </p>
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-4">
        <div className="relative w-full" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 10, right: 10, bottom: isMobile ? 40 : 20, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: isMobile ? 9 : 11, fill: "hsl(var(--muted-foreground))" }}
                angle={isMobile ? -35 : 0}
                textAnchor={isMobile ? "end" : "middle"}
                height={isMobile ? 50 : 30}
                interval={0}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: isMobile ? 9 : 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v: number) => formatCurrency(v)}
                width={60}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: isMobile ? 9 : 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                width={45}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  fontSize: isMobile ? "11px" : "13px",
                  boxShadow: "0 10px 40px -10px rgba(0,0,0,0.15)",
                }}
                formatter={(value: number, name: string) => {
                  if (name === "Utilization %") return [`${value.toFixed(2)}%`, name];
                  return [`${formatCurrency(value)}`, name];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: isMobile ? "10px" : "11px", paddingTop: 8 }}
                iconType="circle"
                iconSize={8}
              />
              <Bar
                yAxisId="left"
                dataKey="allocation"
                name="Allocation"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                yAxisId="left"
                dataKey="pdRelease"
                name="PD Release"
                fill="#a855f7"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                yAxisId="left"
                dataKey="spendingRelease"
                name="Spending Release"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                yAxisId="left"
                dataKey="pifraUtilization"
                name="PIFRA Utilization"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="pctUtilization"
                name="Utilization %"
                stroke="#ef4444"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#ef4444" }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}