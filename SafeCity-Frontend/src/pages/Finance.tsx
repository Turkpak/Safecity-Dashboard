import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, TrendingDown, LucideBanknote, Wallet, AlertCircle, CheckCircle2, Filter, FileSpreadsheet } from "lucide-react";
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { useWindowSize } from "@/hooks/use-window-size";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { getProjectById, getProjectSummary, listProjects } from "@/api";
import type { Project } from "@/api/types";
import {
  getAllDivisions,
  getDistrictsByDivision,
  getTehsilsByDivisionAndDistrict,
} from "@/data/punjabHierarchy";

// Backend project financials are PKR millions (M).
const formatPKRMillions = (m: number) => {
  const sign = m < 0 ? "−" : "";
  const abs = Math.abs(m);
  return `${sign}PKR ${abs.toFixed(2)} M`;
};

const STAGE_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#f59e0b", "#10b981"];

export default function Finance() {
  const { width } = useWindowSize();
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [selectedTehsil, setSelectedTehsil] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

  const isMobile = width < 640;

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  const isAllFilters =
    selectedDivision === "all" &&
    selectedDistrict === "all" &&
    selectedTehsil === "all" &&
    selectedProjectId === "all";

  const { data: projectSummary } = useQuery({
    queryKey: ["project-summary"],
    queryFn: getProjectSummary,
    enabled: isAllFilters,
    staleTime: 60 * 1000,
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

  const aggregatedFinancials = useMemo(() => {
    const toNum = (v: unknown) => {
      const n = typeof v === "number" ? v : Number(String(v ?? ""));
      return Number.isFinite(n) ? n : 0;
    };
    const sum = <K extends keyof Project>(key: K) =>
      filteredProjects.reduce((acc, p) => acc + toNum((p as any)[key]), 0);

    return {
      allocation_capital_cost: sum("allocation_capital_cost" as any),
      allocation_revenue_cost: sum("allocation_revenue_cost" as any),
      allocation_total_cost: sum("allocation_total_cost" as any),
      pd_release_capital_cost: sum("pd_release_capital_cost" as any),
      pd_release_cost: sum("pd_release_cost" as any),
      pd_release_total_cost: sum("pd_release_total_cost" as any),
      spending_release_capital_cost: sum("spending_release_capital_cost" as any),
      spending_release_revenue_cost: sum("spending_release_revenue_cost" as any),
      spending_release_total_cost: sum("spending_release_total_cost" as any),
      pifra_utilization_capital_cost: sum("pifra_utilization_capital_cost" as any),
      pifra_utilization_revenue_cost: sum("pifra_utilization_revenue_cost" as any),
      pifra_utilization_total_cost: sum("pifra_utilization_total_cost" as any),
      percentage_utilization_total: (() => {
        const alloc = sum("allocation_total_cost" as any);
        const pifra = sum("pifra_utilization_total_cost" as any);
        return alloc > 0 ? (pifra / alloc) * 100 : 0;
      })(),
    };
  }, [filteredProjects]);

  const selectedProjectNumericId = selectedProjectId !== "all" ? Number(selectedProjectId) : null;
  const { data: selectedProject } = useQuery({
    queryKey: ["project-by-id", selectedProjectNumericId],
    queryFn: async () => {
      if (!selectedProjectNumericId) return null;
      return await getProjectById(selectedProjectNumericId);
    },
    enabled: selectedProjectNumericId != null && Number.isFinite(selectedProjectNumericId),
    staleTime: 30 * 1000,
  });

  // When a project is selected, auto-fill Division/District/Tehsil from API response.
  useEffect(() => {
    if (!selectedProject) return;
    if (selectedProject.division_name) setSelectedDivision(selectedProject.division_name);
    if (selectedProject.district_name) setSelectedDistrict(selectedProject.district_name);
    if (selectedProject.tehsil_name) setSelectedTehsil(selectedProject.tehsil_name);
  }, [selectedProject]);

  const flowChartData = useMemo(() => {
    if (selectedProject) {
      return [
        {
          stage: "Allocation",
          totalM: Number(selectedProject.allocation_total_cost ?? 0),
          capitalM: Number(selectedProject.allocation_capital_cost ?? 0),
          revenueM: Number(selectedProject.allocation_revenue_cost ?? 0),
        },
        {
          stage: "P&D Release",
          totalM: Number(selectedProject.pd_release_total_cost ?? 0),
          capitalM: Number(selectedProject.pd_release_capital_cost ?? 0),
          revenueM: Number(selectedProject.pd_release_cost ?? 0),
        },
        {
          stage: "Spending Release",
          totalM: Number(selectedProject.spending_release_total_cost ?? 0),
          capitalM: Number(selectedProject.spending_release_capital_cost ?? 0),
          revenueM: Number(selectedProject.spending_release_revenue_cost ?? 0),
        },
        {
          stage: "PIFRA Utilization",
          totalM: Number(selectedProject.pifra_utilization_total_cost ?? 0),
          capitalM: Number(selectedProject.pifra_utilization_capital_cost ?? 0),
          revenueM: Number(selectedProject.pifra_utilization_revenue_cost ?? 0),
        },
      ];
    }
    // If filtering by area (but not selecting a single project), aggregate from list-project.
    if (!isAllFilters && selectedProjectId === "all") {
      return [
        {
          stage: "Allocation",
          totalM: aggregatedFinancials.allocation_total_cost,
          capitalM: aggregatedFinancials.allocation_capital_cost,
          revenueM: aggregatedFinancials.allocation_revenue_cost,
        },
        {
          stage: "P&D Release",
          totalM: aggregatedFinancials.pd_release_total_cost,
          capitalM: aggregatedFinancials.pd_release_capital_cost,
          revenueM: aggregatedFinancials.pd_release_cost,
        },
        {
          stage: "Spending Release",
          totalM: aggregatedFinancials.spending_release_total_cost,
          capitalM: aggregatedFinancials.spending_release_capital_cost,
          revenueM: aggregatedFinancials.spending_release_revenue_cost,
        },
        {
          stage: "PIFRA Utilization",
          totalM: aggregatedFinancials.pifra_utilization_total_cost,
          capitalM: aggregatedFinancials.pifra_utilization_capital_cost,
          revenueM: aggregatedFinancials.pifra_utilization_revenue_cost,
        },
      ];
    }
    if (projectSummary) {
      return [
        { stage: "Allocation", totalM: Number(projectSummary.total_allocation ?? 0), capitalM: 0, revenueM: 0 },
        { stage: "P&D Release", totalM: Number(projectSummary.total_pd_release ?? 0), capitalM: 0, revenueM: 0 },
        { stage: "Spending Release", totalM: Number(projectSummary.total_spending_release ?? 0), capitalM: 0, revenueM: 0 },
        { stage: "PIFRA Utilization", totalM: Number(projectSummary.total_pifra ?? 0), capitalM: 0, revenueM: 0 },
      ];
    }
    return [];
  }, [selectedProject, projectSummary, aggregatedFinancials, isAllFilters, selectedProjectId]);

  const divisionComparisonData = useMemo(() => {
    // Compare projects by Allocation vs PIFRA (using current filters).
    return filteredProjects.map((p, i) => ({
      division: p.project_name || `#${p.id}`,
      approvedM: Number(p.allocation_total_cost ?? 0),
      pifraM: Number(p.pifra_utilization_total_cost ?? 0),
      color: STAGE_COLORS[i % STAGE_COLORS.length],
    }));
  }, [filteredProjects]);

  const kpiDerived = useMemo(() => {
    const allocationM = selectedProject
      ? Number(selectedProject.allocation_total_cost ?? 0)
      : !isAllFilters
        ? aggregatedFinancials.allocation_total_cost
        : Number(projectSummary?.total_allocation ?? 0);
    const spendingM = selectedProject
      ? Number(selectedProject.spending_release_total_cost ?? 0)
      : !isAllFilters
        ? aggregatedFinancials.spending_release_total_cost
        : Number(projectSummary?.total_spending_release ?? 0);
    const pifraM = selectedProject
      ? Number(selectedProject.pifra_utilization_total_cost ?? 0)
      : !isAllFilters
        ? aggregatedFinancials.pifra_utilization_total_cost
        : Number(projectSummary?.total_pifra ?? 0);

    const utilVsAllocationPct = allocationM > 0 ? (pifraM / allocationM) * 100 : 0;
    const utilVsSpendingPct = spendingM > 0 ? (pifraM / spendingM) * 100 : 0;
    return { allocationM, spendingM, pifraM, utilVsAllocationPct, utilVsSpendingPct };
  }, [selectedProject, projectSummary, aggregatedFinancials, isAllFilters]);

  const kpiDataWithIcons = useMemo(() => {
    if (selectedProject) {
      return {
        allocation: {
          valueM: Number(selectedProject.allocation_total_cost ?? 0),
          label: "Allocation (total)",
          icon: Wallet,
          trend: kpiDerived.utilVsAllocationPct,
        },
        pdRelease: {
          valueM: Number(selectedProject.pd_release_total_cost ?? 0),
          label: "P&D release (total)",
          icon: LucideBanknote,
          trend: 0,
        },
        pifra: {
          valueM: Number(selectedProject.pifra_utilization_total_cost ?? 0),
          label: "PIFRA utilization (total)",
          icon: CheckCircle2,
          trend: kpiDerived.utilVsSpendingPct,
        },
        pct: {
          valueM: Number(selectedProject.percentage_utilization_total ?? 0),
          label: "% utilization (total)",
          icon: AlertCircle,
          trend: Number(selectedProject.percentage_utilization_total ?? 0),
        },
      } as const;
    }
    if (!isAllFilters) {
      return {
        allocation: {
          valueM: aggregatedFinancials.allocation_total_cost,
          label: `Allocation (total) • ${filteredProjects.length} project${filteredProjects.length === 1 ? "" : "s"}`,
          icon: Wallet,
          trend: kpiDerived.utilVsAllocationPct,
        },
        pdRelease: {
          valueM: aggregatedFinancials.pd_release_total_cost,
          label: "P&D release (total)",
          icon: LucideBanknote,
          trend: 0,
        },
        spendingRelease: {
          valueM: aggregatedFinancials.spending_release_total_cost,
          label: "Spending release (total)",
          icon: AlertCircle,
          trend: 0,
        },
        pifra: {
          valueM: aggregatedFinancials.pifra_utilization_total_cost,
          label: "PIFRA utilization (total)",
          icon: CheckCircle2,
          trend: kpiDerived.utilVsSpendingPct,
        },
      } as const;
    }
    return {
      allocation: {
        valueM: Number(projectSummary?.total_allocation ?? 0),
        label: "Total allocation",
        icon: Wallet,
        trend: kpiDerived.utilVsAllocationPct,
      },
      pdRelease: {
        valueM: Number(projectSummary?.total_pd_release ?? 0),
        label: "Total P&D release",
        icon: LucideBanknote,
        trend: 0,
      },
      spendingRelease: {
        valueM: Number(projectSummary?.total_spending_release ?? 0),
        label: "Total spending release",
        icon: AlertCircle,
        trend: 0,
      },
      pifra: {
        valueM: Number(projectSummary?.total_pifra ?? 0),
        label: "Total PIFRA utilization",
        icon: CheckCircle2,
        trend: kpiDerived.utilVsSpendingPct,
      },
    } as const;
  }, [selectedProject, projectSummary, kpiDerived, aggregatedFinancials, isAllFilters, filteredProjects.length]);

  const utilizationRate = kpiDerived.utilVsAllocationPct;
  const totalPlannedM = kpiDerived.allocationM;
  const totalActualM = kpiDerived.pifraM;

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
    if (key === "allocation") return kpiCardVariants.totalBudget;
    if (key === "pdRelease") return kpiCardVariants.ytdUtilization;
    if (key === "spendingRelease") return value <= 0 ? kpiCardVariants.varianceGood : kpiCardVariants.varianceBad;
    if (key === "pifra") return kpiCardVariants.remaining;
    if (key === "pct") return kpiCardVariants.varianceBad;
    return kpiCardVariants.remaining;
  };

  const stageBreakdownItems = useMemo(() => {
  const alloc = {
    capital: selectedProject
      ? Number(selectedProject.allocation_capital_cost ?? 0)
      : Number(projectSummary?.total_allocation_capital ?? 0),

    revenue: selectedProject
      ? Number(selectedProject.allocation_revenue_cost ?? 0)
      : Number(projectSummary?.total_allocation_revenue ?? 0),

    total: selectedProject
      ? Number(selectedProject.allocation_total_cost ?? 0)
      : Number(projectSummary?.total_allocation ?? 0),
  };

  const pd = {
    capital: selectedProject
      ? Number(selectedProject.pd_release_capital_cost ?? 0)
      : Number(projectSummary?.total_pd_release_capital ?? 0),

    revenue: selectedProject
      ? Number(selectedProject.pd_release_cost ?? 0)
      : Number(projectSummary?.total_pd_release_revenue ?? 0),

    total: selectedProject
      ? Number(selectedProject.pd_release_total_cost ?? 0)
      : Number(projectSummary?.total_pd_release ?? 0),
  };

  const spending = {
    capital: selectedProject
      ? Number(selectedProject.spending_release_capital_cost ?? 0)
      : Number(projectSummary?.total_spending_release_capital ?? 0),

    revenue: selectedProject
      ? Number(selectedProject.spending_release_revenue_cost ?? 0)
      : Number(projectSummary?.total_spending_release_revenue ?? 0),

    total: selectedProject
      ? Number(selectedProject.spending_release_total_cost ?? 0)
      : Number(projectSummary?.total_spending_release ?? 0),
  };

  const pifra = {
    capital: selectedProject
      ? Number(selectedProject.pifra_utilization_capital_cost ?? 0)
      : Number(projectSummary?.total_pifra_capital ?? 0),

    revenue: selectedProject
      ? Number(selectedProject.pifra_utilization_revenue_cost ?? 0)
      : Number(projectSummary?.total_pifra_revenue ?? 0),

    total: selectedProject
      ? Number(selectedProject.pifra_utilization_total_cost ?? 0)
      : Number(projectSummary?.total_pifra ?? 0),
  };

  const base = alloc.total || 1;

  return [
    { label: "Allocation", triple: alloc, color: STAGE_COLORS[1] },
    { label: "P&D release", triple: pd, color: STAGE_COLORS[2] },
    { label: "Spending release", triple: spending, color: STAGE_COLORS[3] },
    { label: "PIFRA utilization", triple: pifra, color: STAGE_COLORS[4] },
  ].map((item) => ({
    ...item,
    totalM: item.triple.total,
    pctOfApproved: base > 0 ? (item.triple.total / base) * 100 : 0,
  }));
}, [selectedProject, projectSummary]);

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

        {(selectedProjectId !== "all" && !selectedProject) || (isAllFilters && !projectSummary) ? (
          <>
            {/* Skeleton loader: keep layout stable while loading */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-10 w-10 rounded-xl" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-7 w-40" />
                    <Skeleton className="h-3 w-48" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-12">
              <Card className="lg:col-span-8">
                <CardHeader>
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-3 w-80" />
                </CardHeader>
                <CardContent className="h-[320px] sm:h-[380px] lg:h-[400px]">
                  <Skeleton className="h-full w-full rounded-xl" />
                </CardContent>
              </Card>
              <Card className="lg:col-span-4">
                <CardHeader>
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}

        {(!isAllFilters || projectSummary) && (
          <>
            {/* KPI Cards */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {Object.entries(kpiDataWithIcons).map(([key, kpi]) => {
                const Icon = kpi.icon;
                const isPositive = kpi.trend >= 0;
                const variant = getKpiVariant(key, Number((kpi as any).valueM ?? 0));

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
                      <div className={cn("text-2xl font-bold font-heading", "text-foreground")}>
                        {key === "pct"
                          ? `${Number((kpi as any).valueM ?? 0).toFixed(2)}%`
                          : formatPKRMillions(Number((kpi as any).valueM ?? 0))}
                      </div>

                      {key !== "pdRelease" && key !== "spendingRelease" && key !== "pct" && (
                        <div className="flex items-center gap-1 mt-2">
                          {isPositive ? (
                            <TrendingUp className={cn("h-3 w-3", variant.trend)} />
                          ) : (
                            <TrendingDown className={cn("h-3 w-3", variant.trend)} />
                          )}
                          <p className={cn("text-xs", variant.trend)}>
                            {key === "pifra"
                              ? `${kpiDerived.utilVsSpendingPct.toFixed(1)}% of spending release`
                              : `${kpiDerived.utilVsAllocationPct.toFixed(1)}% utilized vs allocation`}
                          </p>
                        </div>
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
                    Totals (PKR millions) by stage — Allocation → P&amp;D → Spending release → PIFRA
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
                      {flowChartData.some((x) => Number((x as any).revenueM) > 0) && (
                        <Line
                          type="monotone"
                          dataKey="revenueM"
                          stroke="#10b981"
                          strokeWidth={2}
                          name="Revenue (M)"
                          dot={{ fill: "#10b981", r: 3 }}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="lg:col-span-4">
                <CardHeader>
                  <CardTitle>PIFRA vs allocation</CardTitle>
                  <CardDescription>Share of allocation booked in PIFRA</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Utilized (PIFRA / allocation)</span>
                      <span className="font-bold">{utilizationRate.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-muted h-3 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, utilizationRate)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatPKRMillions(totalActualM)}</span>
                      <span>{formatPKRMillions(totalPlannedM)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Division comparison */}
            <Card className="border-2 transition-colors hover:border-[#101a3c]">
              <CardHeader>
                <CardTitle>Division comparison</CardTitle>
                <CardDescription>Allocation vs PIFRA utilization by project (PKR millions)</CardDescription>
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
