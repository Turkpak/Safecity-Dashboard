import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, TrendingDown, LucideBanknote, Wallet, AlertCircle, CheckCircle2, Filter, FileSpreadsheet } from "lucide-react";
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { useWindowSize } from "@/hooks/use-window-size";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { listProjects } from "@/api";
import type { Project } from "@/api/types";
import {
  getAllDivisions,
  getDistrictsByDivision,
  getTehsilsByDivisionAndDistrict,
} from "@/data/punjabHierarchy";
import {
  parseTehsilSchemesWorkbook,
  excelTitleToAppDivision,
  aggregateRows,
  utilizationPctVsSpending,
  type TehsilSchemeFinanceRow,
} from "@/utils/parseTehsilSchemesFinance";

const FINANCE_XLSX_PATH = "/Assets/Financial%20Data/Tehsil%20Schemes%20Financial%20Details.xlsx";

/** Workbook figures are PKR millions; formatPKR expects rupees. */
const millionsToRupees = (m: number) => m * 1_000_000;

// Format PKR currency (Finance page: show in Millions instead of Crore)
const formatPKR = (amount: number) => {
  const sign = amount < 0 ? "−" : "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    return `${sign}PKR ${(abs / 1_000_000).toFixed(2)} M`;
  }
  if (abs >= 1_000) {
    return `${sign}PKR ${(abs / 1_000).toFixed(2)} K`;
  }
  return `${sign}PKR ${abs.toLocaleString()}`;
};

const STAGE_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#f59e0b", "#10b981"];

function findRowForDivision(rows: TehsilSchemeFinanceRow[], division: string): TehsilSchemeFinanceRow | undefined {
  const d = division.trim().toLowerCase();
  return rows.find((r) => {
    const app = excelTitleToAppDivision(r.projectTitle);
    return app?.trim().toLowerCase() === d;
  });
}

function buildFlowChartData(row: TehsilSchemeFinanceRow) {
  return [
    { stage: "Approved Cost", totalM: row.approved.total, capitalM: row.approved.capital, revenueM: row.approved.revenue },
    { stage: "Allocation", totalM: row.allocation.total, capitalM: row.allocation.capital, revenueM: row.allocation.revenue },
    { stage: "P&D Release", totalM: row.pdRelease.total, capitalM: row.pdRelease.capital, revenueM: row.pdRelease.revenue },
    { stage: "Spending Release", totalM: row.spendingRelease.total, capitalM: row.spendingRelease.capital, revenueM: row.spendingRelease.revenue },
    { stage: "PIFRA Utilization", totalM: row.pifraUtilization.total, capitalM: row.pifraUtilization.capital, revenueM: row.pifraUtilization.revenue },
  ];
}

export default function Finance() {
  const { width } = useWindowSize();
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [selectedTehsil, setSelectedTehsil] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

  const isMobile = width < 640;

  const {
    data: workbookParsed,
    isLoading: financeFileLoading,
    isError: financeFileError,
    error: financeFileErr,
  } = useQuery({
    queryKey: ["tehsil-schemes-finance-xlsx"],
    queryFn: async () => {
      const res = await fetch(FINANCE_XLSX_PATH);
      if (!res.ok) throw new Error(`Failed to load finance workbook (${res.status})`);
      const ab = await res.arrayBuffer();
      return parseTehsilSchemesWorkbook(ab);
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  const filteredProjects = useMemo((): Project[] => {
    if (selectedDivision === "all") return projects;
    let list = projects.filter(
      (p) => p.division_name && p.division_name.trim().toLowerCase() === selectedDivision.trim().toLowerCase()
    );
    if (selectedDistrict !== "all") {
      list = list.filter(
        (p) => p.district_name && p.district_name.trim().toLowerCase() === selectedDistrict.trim().toLowerCase()
      );
    }
    if (selectedTehsil !== "all") {
      list = list.filter(
        (p) => p.tehsil_name && p.tehsil_name.trim().toLowerCase() === selectedTehsil.trim().toLowerCase()
      );
    }
    return list;
  }, [projects, selectedDivision, selectedDistrict, selectedTehsil]);

  const effectiveDivision = useMemo(() => {
    if (selectedProjectId !== "all") {
      const p = filteredProjects.find((x) => String(x.id) === selectedProjectId);
      return p?.division_name ?? selectedDivision;
    }
    return selectedDivision;
  }, [selectedProjectId, filteredProjects, selectedDivision]);

  const activeFinanceRow = useMemo((): TehsilSchemeFinanceRow | null => {
    if (!workbookParsed) return null;
    const { rows, totals } = workbookParsed;
    if (effectiveDivision === "all") {
      if (totals && totals.category.toLowerCase() === "total") return totals;
      return aggregateRows(rows);
    }
    return findRowForDivision(rows, effectiveDivision) ?? null;
  }, [workbookParsed, effectiveDivision]);

  const flowChartData = useMemo(() => {
    if (!activeFinanceRow) return [];
    return buildFlowChartData(activeFinanceRow);
  }, [activeFinanceRow]);

  /** Division vs Approved / PIFRA for comparison chart (all divisions). */
  const divisionComparisonData = useMemo(() => {
    if (!workbookParsed) return [];
    return workbookParsed.rows.map((r, i) => ({
      division: excelTitleToAppDivision(r.projectTitle) ?? r.projectTitle.slice(0, 24) + "…",
      approvedM: r.approved.total,
      pifraM: r.pifraUtilization.total,
      color: STAGE_COLORS[i % STAGE_COLORS.length],
    }));
  }, [workbookParsed]);

  const kpiDerived = useMemo(() => {
    if (!activeFinanceRow) {
      return {
        approvedRupees: 0,
        pifraRupees: 0,
        spendingRupees: 0,
        varianceRupees: 0,
        remainingRupees: 0,
        utilVsApprovedPct: 0,
        utilVsSpendingPct: 0,
      };
    }
    const r = activeFinanceRow;
    const approvedRupees = millionsToRupees(r.approved.total);
    const pifraRupees = millionsToRupees(r.pifraUtilization.total);
    const spendingRupees = millionsToRupees(r.spendingRelease.total);
    const varianceRupees = spendingRupees - pifraRupees;
    const remainingRupees = approvedRupees - pifraRupees;
    const utilVsApprovedPct = approvedRupees > 0 ? (pifraRupees / approvedRupees) * 100 : 0;
    const utilVsSpendingPct = utilizationPctVsSpending(r);
    return {
      approvedRupees,
      pifraRupees,
      spendingRupees,
      varianceRupees,
      remainingRupees,
      utilVsApprovedPct,
      utilVsSpendingPct,
    };
  }, [activeFinanceRow]);

  const kpiDataWithIcons = {
    totalBudget: {
      value: kpiDerived.approvedRupees,
      label: "Approved cost (total)",
      icon: Wallet,
      trend: kpiDerived.utilVsApprovedPct,
    },
    ytdUtilization: {
      value: kpiDerived.pifraRupees,
      label: "PIFRA utilization (total)",
      icon: LucideBanknote,
      trend: kpiDerived.utilVsSpendingPct,
    },
    variance: {
      value: kpiDerived.varianceRupees,
      label: "Spending release − PIFRA",
      icon: AlertCircle,
      trend: kpiDerived.utilVsSpendingPct,
    },
    remaining: {
      value: kpiDerived.remainingRupees,
      label: "Approved − PIFRA (balance)",
      icon: CheckCircle2,
      trend:
        kpiDerived.approvedRupees > 0
          ? (kpiDerived.remainingRupees / kpiDerived.approvedRupees) * 100
          : 0,
    },
  };

  const utilizationRate = kpiDerived.utilVsApprovedPct;
  const totalPlanned = kpiDerived.approvedRupees;
  const totalActual = kpiDerived.pifraRupees;

  const handleDivisionChange = (value: string) => {
    setSelectedDivision(value);
    setSelectedDistrict("all");
    setSelectedTehsil("all");
    setSelectedProjectId("all");
  };

  const handleDistrictChange = (value: string) => {
    setSelectedDistrict(value);
    setSelectedTehsil("all");
    setSelectedProjectId("all");
  };

  const handleTehsilChange = (value: string) => {
    setSelectedTehsil(value);
    setSelectedProjectId("all");
  };

  const getLocationName = () => {
    if (selectedDivision === "all") return "All Punjab (aggregated)";
    if (selectedDistrict === "all") return selectedDivision;
    if (selectedTehsil === "all") return `${selectedDistrict}, ${selectedDivision}`;
    return `${selectedTehsil}, ${selectedDistrict}`;
  };

  const kpiCardVariants = {
    totalBudget: {
      accent: "border-l-blue-500",
      bg: "bg-gradient-to-br from-card via-card to-blue-50/40 dark:to-blue-950/20",
      blob: "bg-blue-500/10",
      iconWrap: "bg-blue-50 dark:bg-blue-950/40",
      icon: "text-blue-700 dark:text-blue-300",
      value: "text-blue-900 dark:text-blue-100",
      trend: "text-emerald-600 dark:text-emerald-400",
    },
    ytdUtilization: {
      accent: "border-l-emerald-500",
      bg: "bg-gradient-to-br from-card via-card to-emerald-50/40 dark:to-emerald-950/20",
      blob: "bg-emerald-500/10",
      iconWrap: "bg-emerald-50 dark:bg-emerald-950/40",
      icon: "text-emerald-700 dark:text-emerald-300",
      value: "text-emerald-900 dark:text-emerald-100",
      trend: "text-emerald-600 dark:text-emerald-400",
    },
    remaining: {
      accent: "border-l-violet-500",
      bg: "bg-gradient-to-br from-card via-card to-violet-50/40 dark:to-violet-950/20",
      blob: "bg-violet-500/10",
      iconWrap: "bg-violet-50 dark:bg-violet-950/40",
      icon: "text-violet-700 dark:text-violet-300",
      value: "text-violet-900 dark:text-violet-100",
      trend: "text-rose-600 dark:text-rose-400",
    },
    varianceGood: {
      accent: "border-l-emerald-500",
      bg: "bg-gradient-to-br from-card via-card to-emerald-50/40 dark:to-emerald-950/20",
      blob: "bg-emerald-500/10",
      iconWrap: "bg-emerald-50 dark:bg-emerald-950/40",
      icon: "text-emerald-700 dark:text-emerald-300",
      value: "text-emerald-600 dark:text-emerald-400",
      trend: "text-emerald-600 dark:text-emerald-400",
    },
    varianceBad: {
      accent: "border-l-rose-500",
      bg: "bg-gradient-to-br from-card via-card to-rose-50/40 dark:to-rose-950/20",
      blob: "bg-rose-500/10",
      iconWrap: "bg-rose-50 dark:bg-rose-950/40",
      icon: "text-rose-700 dark:text-rose-300",
      value: "text-rose-600 dark:text-rose-400",
      trend: "text-rose-600 dark:text-rose-400",
    },
  } as const;

  const getKpiVariant = (key: string, value: number) => {
    if (key === "variance") return value <= 0 ? kpiCardVariants.varianceGood : kpiCardVariants.varianceBad;
    if (key === "totalBudget") return kpiCardVariants.totalBudget;
    if (key === "ytdUtilization") return kpiCardVariants.ytdUtilization;
    return kpiCardVariants.remaining;
  };

  const stageBreakdownItems = useMemo(() => {
    if (!activeFinanceRow) return [];
    const r = activeFinanceRow;
    const approved = r.approved.total || 1;
    return [
      { label: "Approved cost", triple: r.approved, color: STAGE_COLORS[0] },
      { label: "Allocation", triple: r.allocation, color: STAGE_COLORS[1] },
      { label: "P&D release", triple: r.pdRelease, color: STAGE_COLORS[2] },
      { label: "Spending release", triple: r.spendingRelease, color: STAGE_COLORS[3] },
      { label: "PIFRA utilization", triple: r.pifraUtilization, color: STAGE_COLORS[4] },
    ].map((item) => ({
      ...item,
      totalM: item.triple.total,
      pctOfApproved: approved > 0 ? (item.triple.total / approved) * 100 : 0,
    }));
  }, [activeFinanceRow]);

  return (
    <Layout title="Financial & Budget Analytics">
      <div className="flex flex-col gap-6">
        {/* Filters */}
        <div className="flex flex-nowrap items-center gap-3 overflow-x-auto pb-1">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm font-medium text-muted-foreground shrink-0">Division</label>
            <Select value={selectedDivision} onValueChange={handleDivisionChange}>
              <SelectTrigger className="h-9 w-[140px] border-border/50 bg-background rounded-md">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {getAllDivisions().map((div) => (
                  <SelectItem key={div} value={div}>
                    {div}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm font-medium text-muted-foreground shrink-0">District</label>
            <Select value={selectedDistrict} onValueChange={handleDistrictChange} disabled={selectedDivision === "all"}>
              <SelectTrigger
                className={cn(
                  "h-9 w-[140px] border-border/50 bg-background rounded-md",
                  selectedDivision === "all" && "opacity-50 cursor-not-allowed"
                )}
                disabled={selectedDivision === "all"}
              >
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {selectedDivision !== "all" &&
                  getDistrictsByDivision(selectedDivision).map((dist) => (
                    <SelectItem key={dist} value={dist}>
                      {dist}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm font-medium text-muted-foreground shrink-0">Tehsil</label>
            <Select
              value={selectedTehsil}
              onValueChange={handleTehsilChange}
              disabled={selectedDivision === "all" || selectedDistrict === "all"}
            >
              <SelectTrigger
                className={cn(
                  "h-9 w-[140px] border-border/50 bg-background rounded-md",
                  (selectedDivision === "all" || selectedDistrict === "all") && "opacity-50 cursor-not-allowed"
                )}
                disabled={selectedDivision === "all" || selectedDistrict === "all"}
              >
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {selectedDivision !== "all" &&
                  selectedDistrict !== "all" &&
                  getTehsilsByDivisionAndDistrict(selectedDivision, selectedDistrict).map((teh) => (
                    <SelectItem key={teh} value={teh}>
                      {teh}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm font-medium text-muted-foreground shrink-0">Project</label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="h-9 w-[160px] border-border/50 bg-background rounded-md">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ({filteredProjects.length})</SelectItem>
                {filteredProjects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.project_name || `#${p.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(selectedDivision !== "all" ||
            selectedDistrict !== "all" ||
            selectedTehsil !== "all" ||
            selectedProjectId !== "all") && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setSelectedDivision("all");
                setSelectedDistrict("all");
                setSelectedTehsil("all");
                setSelectedProjectId("all");
              }}
              className="h-8 px-3 text-xs font-medium text-white bg-red-600 hover:bg-red-700 border-0 shrink-0"
            >
              Clear
            </Button>
          )}
        </div>

        {financeFileLoading && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">Loading finance workbook…</CardContent>
          </Card>
        )}

        {financeFileError && (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Could not load finance data</CardTitle>
              <CardDescription>
                {financeFileErr instanceof Error ? financeFileErr.message : "Unknown error"}. Ensure the file exists at{" "}
                <code className="text-xs">public/Assets/Financial Data/Tehsil Schemes Financial Details.xlsx</code>.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {!financeFileLoading && !financeFileError && !activeFinanceRow && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No finance row for this division. Check that the Excel file includes a scheme line for &quot;{effectiveDivision}&quot;.
            </CardContent>
          </Card>
        )}

        {!financeFileLoading && !financeFileError && activeFinanceRow && (
          <>
            {/* KPI Cards */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {Object.entries(kpiDataWithIcons).map(([key, kpi]) => {
                const Icon = kpi.icon;
                const isPositive = kpi.trend >= 0;
                const isVariance = key === "variance";
                const variant = getKpiVariant(key, kpi.value);

                return (
                  <Card
                    key={key}
                    className={cn(
                      "relative overflow-hidden rounded-2xl border border-border/50 shadow-sm transition-all hover:shadow-lg",
                      "border-l-4",
                      variant.accent,
                      variant.bg
                    )}
                  >
                    <div className={cn("absolute top-0 right-0 h-28 w-28 rounded-full blur-2xl -mr-12 -mt-12", variant.blob)} />
                    <CardHeader className="pb-2 relative">
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground leading-tight">{kpi.label}</CardTitle>
                        <div
                          className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center border border-border/40 shadow-sm",
                            variant.iconWrap
                          )}
                        >
                          <Icon className={cn("h-5 w-5", variant.icon)} />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="relative">
                      <div className={cn("text-2xl font-bold font-heading", isVariance ? variant.value : "text-foreground")}>
                        {formatPKR(kpi.value)}
                      </div>

                      {!isVariance && (
                        <div className="flex items-center gap-1 mt-2">
                          {isPositive ? (
                            <TrendingUp className={cn("h-3 w-3", variant.trend)} />
                          ) : (
                            <TrendingDown className={cn("h-3 w-3", variant.trend)} />
                          )}
                          <p className={cn("text-xs", variant.trend)}>
                            {key === "ytdUtilization"
                              ? `${kpi.trend.toFixed(1)}% of spending release (PIFRA)`
                              : key === "totalBudget"
                                ? `${kpi.trend.toFixed(1)}% utilized vs approved`
                                : `${Math.abs(kpi.trend).toFixed(1)}% of approved`}
                          </p>
                        </div>
                      )}

                      {isVariance && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {kpi.value <= 0 ? "PIFRA ≥ spending release" : "PIFRA below spending release"}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Financial flow + utilization */}
            <div className="grid gap-6 lg:grid-cols-12">
              <Card className="lg:col-span-8 border-2 transition-colors hover:border-[#101a3c]">
                <CardHeader>
                  <CardTitle>Scheme financial flow</CardTitle>
                  <CardDescription>
                    Totals (PKR millions) by stage — Approved → Allocation → P&D → Spending release → PIFRA
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[320px] sm:h-[380px] lg:h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={flowChartData} margin={{ top: 10, right: 30, left: 0, bottom: isMobile ? 48 : 24 }}>
                      <defs>
                        <linearGradient id="colorFlowTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="stage"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        interval={0}
                        angle={isMobile ? -35 : 0}
                        textAnchor={isMobile ? "end" : "middle"}
                        height={isMobile ? 70 : 40}
                      />
                      <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${v}M`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number, name: string) => {
                          if (name === "Total (M)") return [`PKR ${Number(value).toFixed(2)} M`, name];
                          return [`PKR ${Number(value).toFixed(2)} M`, name];
                        }}
                      />
                      <Legend />
                      <Bar dataKey="totalM" fill="url(#colorFlowTotal)" radius={[4, 4, 0, 0]} name="Total (M)" />
                      <Line
                        type="monotone"
                        dataKey="revenueM"
                        stroke="#10b981"
                        strokeWidth={2}
                        name="Revenue (M)"
                        dot={{ fill: "#10b981", r: 3 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="lg:col-span-4">
                <CardHeader>
                  <CardTitle>PIFRA vs approved</CardTitle>
                  <CardDescription>Share of approved cost booked in PIFRA</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Utilized (PIFRA / approved)</span>
                      <span className="font-bold">{utilizationRate.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-muted h-3 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, utilizationRate)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatPKR(totalActual)}</span>
                      <span>{formatPKR(totalPlanned)}</span>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Approved − PIFRA</span>
                        <span className="font-bold text-emerald-600">{formatPKR(kpiDerived.remainingRupees)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Spending release − PIFRA</span>
                        <span
                          className={cn(
                            "font-bold",
                            kpiDerived.varianceRupees <= 0 ? "text-emerald-600" : "text-red-600"
                          )}
                        >
                          {formatPKR(kpiDerived.varianceRupees)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Division comparison */}
            <Card className="border-2 transition-colors hover:border-[#101a3c]">
              <CardHeader>
                <CardTitle>Division comparison</CardTitle>
                <CardDescription>Approved cost vs PIFRA utilization by division (PKR millions)</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] sm:h-[330px] lg:h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={divisionComparisonData} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="division"
                      angle={-40}
                      textAnchor="end"
                      height={90}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${v}M`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number, name: string) => [`PKR ${Number(value).toFixed(2)} M`, name]}
                    />
                    <Legend />
                    <Bar dataKey="approvedM" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Approved (M)" />
                    <Bar dataKey="pifraM" fill="#10b981" radius={[4, 4, 0, 0]} name="PIFRA (M)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Stage breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Stage breakdown (totals)</CardTitle>
                <CardDescription>Capital / revenue / total in PKR millions; bar length vs approved cost total</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {stageBreakdownItems.map((item) => (
                    <div key={item.label} className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                        <span className="font-bold text-primary">{item.label}</span>
                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 bg-muted/30 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                          <div className="text-left sm:text-right text-xs font-mono text-muted-foreground space-y-0.5">
                            <div>C: {item.triple.capital.toFixed(2)} M</div>
                            <div>R: {item.triple.revenue.toFixed(2)} M</div>
                            <div className="font-bold text-foreground">T: {item.triple.total.toFixed(2)} M</div>
                          </div>
                        </div>
                      </div>
                      <div className="w-full bg-muted h-3 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, item.pctOfApproved)}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{item.pctOfApproved.toFixed(1)}% of approved total</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
