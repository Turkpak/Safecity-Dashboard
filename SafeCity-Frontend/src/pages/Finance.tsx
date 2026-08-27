import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, TrendingDown, LucideBanknote, Wallet, AlertCircle, CheckCircle2, Filter, Percent } from "lucide-react";
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { useWindowSize } from "@/hooks/use-window-size";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import {
  getProjectById,
  getProjectSummary,
  listProjects,
  listDivisions,
  listDistricts,
  listTehsils,
} from "@/api";
import type { Project } from "@/api/types";

// Backend project financials are PKR millions (M).
const formatPKRMillions = (m: number) => {
  const sign = m < 0 ? "−" : "";
  const abs = Math.abs(m);
  return `${sign}PKR ${abs.toFixed(2)} M`;
};

const STAGE_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#f59e0b", "#10b981"];

export default function Finance() {
  const { width } = useWindowSize();
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>("all");
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>("all");
  const [selectedTehsilId, setSelectedTehsilId] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

  const isMobile = width < 640;

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  const projectLookupById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const projectsByDivisionId = useMemo(() => {
    const map = new Map<number, Project[]>();
    for (const project of projects) {
      const divisionId = Number(project.division ?? 0);
      if (!divisionId) continue;
      const list = map.get(divisionId) ?? [];
      list.push(project);
      map.set(divisionId, list);
    }
    return map;
  }, [projects]);

  const projectsByDistrictId = useMemo(() => {
    const map = new Map<number, Project[]>();
    for (const project of projects) {
      const districtId = Number(project.district ?? 0);
      if (!districtId) continue;
      const list = map.get(districtId) ?? [];
      list.push(project);
      map.set(districtId, list);
    }
    return map;
  }, [projects]);

  const projectsByTehsilId = useMemo(() => {
    const map = new Map<number, Project[]>();
    for (const project of projects) {
      const tehsilId = Number(project.tehsil ?? 0);
      if (!tehsilId) continue;
      const list = map.get(tehsilId) ?? [];
      list.push(project);
      map.set(tehsilId, list);
    }
    return map;
  }, [projects]);

  const { data: divisions = [], isLoading: divisionsLoading } = useQuery({
    queryKey: ["finance", "list-division"],
    queryFn: () => listDivisions(),
    staleTime: 5 * 60 * 1000,
  });

  const divisionNumeric =
    selectedDivisionId !== "all" ? Number(selectedDivisionId) : null;
  const { data: districts = [], isFetching: districtsLoading } = useQuery({
    queryKey: ["finance", "list-district", divisionNumeric],
    queryFn: () => listDistricts(divisionNumeric!),
    enabled: divisionNumeric != null && Number.isFinite(divisionNumeric),
    staleTime: 5 * 60 * 1000,
  });

  const districtNumeric =
    selectedDistrictId !== "all" ? Number(selectedDistrictId) : null;
  const { data: tehsils = [], isFetching: tehsilsLoading } = useQuery({
    queryKey: ["finance", "list-tehsil", districtNumeric],
    queryFn: () => listTehsils(districtNumeric!),
    enabled: districtNumeric != null && Number.isFinite(districtNumeric),
    staleTime: 5 * 60 * 1000,
  });

  const isAllFilters =
    selectedDivisionId === "all" &&
    selectedDistrictId === "all" &&
    selectedTehsilId === "all" &&
    selectedProjectId === "all";

  const { data: projectSummary } = useQuery({
    queryKey: ["project-summary"],
    queryFn: getProjectSummary,
    enabled: isAllFilters,
    staleTime: 60 * 1000,
  });

  const filteredProjects = useMemo((): Project[] => {
    if (selectedDivisionId === "all") return projects;

    const divNum = Number(selectedDivisionId);
    const distNum = selectedDistrictId !== "all" ? Number(selectedDistrictId) : null;
    const tehNum = selectedTehsilId !== "all" ? Number(selectedTehsilId) : null;

    let list: Project[] = [];

    if (divNum > 0) {
      list = projectsByDivisionId.get(divNum) ?? [];
    }

    if (selectedDistrictId !== "all" && distNum != null) {
      const districtList = projectsByDistrictId.get(distNum) ?? [];
      const districtSet = new Set(districtList.map((project) => project.id));
      list = list.filter((project) => districtSet.has(project.id));
    }

    if (selectedTehsilId !== "all" && tehNum != null) {
      const tehsilList = projectsByTehsilId.get(tehNum) ?? [];
      const tehsilSet = new Set(tehsilList.map((project) => project.id));
      list = list.filter((project) => tehsilSet.has(project.id));
    }

    return list;
  }, [
    projects,
    selectedDivisionId,
    selectedDistrictId,
    selectedTehsilId,
    projectsByDivisionId,
    projectsByDistrictId,
    projectsByTehsilId,
  ]);

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
  const selectedProject = useMemo(() => {
    if (selectedProjectNumericId == null || !Number.isFinite(selectedProjectNumericId)) return null;
    return projectLookupById.get(selectedProjectNumericId) ?? null;
  }, [projectLookupById, selectedProjectNumericId]);

  // When a project is selected first, list-project/?id=… fills division/district/tehsil (ids + names).
  useEffect(() => {
    if (!selectedProject) return;
    if (selectedProject.division != null && Number.isFinite(Number(selectedProject.division))) {
      setSelectedDivisionId(String(selectedProject.division));
    }
    if (selectedProject.district != null && Number.isFinite(Number(selectedProject.district))) {
      setSelectedDistrictId(String(selectedProject.district));
    }
    if (selectedProject.tehsil != null && Number.isFinite(Number(selectedProject.tehsil))) {
      setSelectedTehsilId(String(selectedProject.tehsil));
    }
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
    const EPS = 1e-6;
    const rows = filteredProjects.map((p, i) => {
      const baseName = (p.project_name?.trim() || `#${p.id}`) as string;
      return {
        division: baseName,
        approvedM: Number(p.allocation_total_cost ?? 0),
        pifraM: Number(p.pifra_utilization_total_cost ?? 0),
        id: p.id,
        color: STAGE_COLORS[i % STAGE_COLORS.length],
      };
    });
    const nameCounts = new Map<string, number>();
    for (const r of rows) nameCounts.set(r.division, (nameCounts.get(r.division) ?? 0) + 1);
    const seen = new Map<string, number>();
    const withUniqueLabels = rows.map((r) => {
      if ((nameCounts.get(r.division) ?? 0) > 1) {
        const n = (seen.get(r.division) ?? 0) + 1;
        seen.set(r.division, n);
        return { ...r, division: `${r.division} (#${r.id})` };
      }
      return r;
    });
    return withUniqueLabels.filter((r) => r.approvedM > EPS || r.pifraM > EPS);
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
    const pifraVsKpi = {
      valueM: kpiDerived.utilVsAllocationPct,
      label: "PIFRA vs allocation",
      icon: Percent,
      trend: kpiDerived.utilVsAllocationPct - 100,
      format: "percent" as const,
    };
    if (selectedProject) {
      return {
        allocation: {
          valueM: Number(selectedProject.allocation_total_cost ?? 0),
          label: "Allocation (total)",
          icon: Wallet,
          trend: 0,
        },
        pdRelease: {
          valueM: Number(selectedProject.pd_release_total_cost ?? 0),
          label: "P&D release (total)",
          icon: LucideBanknote,
          trend: 0,
        },
        spendingRelease: {
          valueM: Number(selectedProject.spending_release_total_cost ?? 0),
          label: "Spending release (total)",
          icon: AlertCircle,
          trend: 0,
        },
        pifra: {
          valueM: Number(selectedProject.pifra_utilization_total_cost ?? 0),
          label: "PIFRA utilization (total)",
          icon: CheckCircle2,
          trend: kpiDerived.utilVsSpendingPct,
        },
        pifraVsAllocation: pifraVsKpi,
      } as const;
    }
    if (!isAllFilters) {
      return {
        allocation: {
          valueM: aggregatedFinancials.allocation_total_cost,
          label: `Allocation • ${filteredProjects.length} proj.`,
          icon: Wallet,
          trend: 0,
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
        pifraVsAllocation: pifraVsKpi,
      } as const;
    }
    return {
      allocation: {
        valueM: Number(projectSummary?.total_allocation ?? 0),
        label: "Total allocation",
        icon: Wallet,
        trend: 0,
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
      pifraVsAllocation: pifraVsKpi,
    } as const;
  }, [selectedProject, projectSummary, kpiDerived, aggregatedFinancials, isAllFilters, filteredProjects.length]);

  const utilizationRate = kpiDerived.utilVsAllocationPct;
  const totalPlannedM = kpiDerived.allocationM;
  const totalActualM = kpiDerived.pifraM;

  const handleDivisionChange = (value: string) => {
    setSelectedDivisionId(value);
    setSelectedDistrictId("all");
    setSelectedTehsilId("all");
    setSelectedProjectId("all");
  };

  const handleDistrictChange = (value: string) => {
    setSelectedDistrictId(value);
    setSelectedTehsilId("all");
    setSelectedProjectId("all");
  };

  const handleTehsilChange = (value: string) => {
    setSelectedTehsilId(value);
    setSelectedProjectId("all");
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
    pifraVsAlloc: {
      accent: "border-l-sky-600",
      bg: "bg-gradient-to-br from-card via-card to-sky-50/40 dark:to-sky-950/20",
      blob: "bg-sky-500/10",
      iconWrap: "bg-sky-50 dark:bg-sky-950/40",
      icon: "text-sky-700 dark:text-sky-300",
      value: "text-sky-900 dark:text-sky-100",
      trend: "text-sky-700 dark:text-sky-300",
    },
  } as const;

  const getKpiVariant = (key: string, value: number) => {
    if (key === "allocation") return kpiCardVariants.totalBudget;
    if (key === "pdRelease") return kpiCardVariants.ytdUtilization;
    if (key === "spendingRelease") return value <= 0 ? kpiCardVariants.varianceGood : kpiCardVariants.varianceBad;
    if (key === "pifra") return kpiCardVariants.remaining;
    if (key === "pifraVsAllocation") return kpiCardVariants.pifraVsAlloc;
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

  const stageBreakdownWithBarScale = useMemo(() => {
    const maxPct = Math.max(
      ...stageBreakdownItems.map((i) => i.pctOfApproved),
      1e-9,
    );
    return stageBreakdownItems.map((item) => ({
      ...item,
      barWidthPct: maxPct > 0 ? (item.pctOfApproved / maxPct) * 100 : 0,
    }));
  }, [stageBreakdownItems]);

  return (
    <Layout title={isMobile ? "FINANCIAL ANALYTICS" : "Financial & Budget Analytics"}>
      <div className="flex flex-col gap-4 sm:gap-6 w-full min-w-0">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-3 min-w-0">
            <div className="flex flex-col gap-1 min-w-0 sm:flex sm:flex-wrap sm:flex-row sm:items-center sm:gap-2">
              <label className="text-sm font-medium text-muted-foreground">Division</label>
              <Select value={selectedDivisionId} onValueChange={handleDivisionChange} disabled={divisionsLoading}>
                <SelectTrigger className="h-9 w-full sm:w-[140px] border-border/50 bg-background rounded-md">
                  <SelectValue placeholder={divisionsLoading ? "Loading…" : "All"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {divisions.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.division_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 min-w-0 sm:flex sm:flex-wrap sm:flex-row sm:items-center sm:gap-2">
              <label className="text-sm font-medium text-muted-foreground">District</label>
              <Select
                value={selectedDistrictId}
                onValueChange={handleDistrictChange}
                disabled={selectedDivisionId === "all" || districtsLoading}
              >
                <SelectTrigger
                  className={cn(
                    "h-9 w-full sm:w-[140px] border-border/50 bg-background rounded-md",
                    (selectedDivisionId === "all" || districtsLoading) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <SelectValue placeholder={districtsLoading ? "Loading…" : "All"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {selectedDivisionId !== "all" &&
                    districts.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.district_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 min-w-0 sm:flex sm:flex-wrap sm:flex-row sm:items-center sm:gap-2">
              <label className="text-sm font-medium text-muted-foreground">Tehsil</label>
              <Select
                value={selectedTehsilId}
                onValueChange={handleTehsilChange}
                disabled={selectedDivisionId === "all" || selectedDistrictId === "all" || tehsilsLoading}
              >
                <SelectTrigger
                  className={cn(
                    "h-9 w-full sm:w-[140px] border-border/50 bg-background rounded-md",
                    (selectedDivisionId === "all" ||
                      selectedDistrictId === "all" ||
                      tehsilsLoading) &&
                    "opacity-50 cursor-not-allowed"
                  )}
                >
                  <SelectValue placeholder={tehsilsLoading ? "Loading…" : "All"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {selectedDivisionId !== "all" &&
                    selectedDistrictId !== "all" &&
                    tehsils.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.tehsil_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 min-w-0 sm:flex sm:flex-wrap sm:flex-row sm:items-center sm:gap-2">
              <label className="text-sm font-medium text-muted-foreground">Project</label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="h-9 w-full sm:w-[160px] border-border/50 bg-background rounded-md">
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
          </div>
          {(selectedDivisionId !== "all" ||
            selectedDistrictId !== "all" ||
            selectedTehsilId !== "all" ||
            selectedProjectId !== "all") && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setSelectedDivisionId("all");
                  setSelectedDistrictId("all");
                  setSelectedTehsilId("all");
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="rounded-xl border border-border/50 shadow-sm overflow-hidden">
                  <CardHeader className="space-y-0 px-3 pb-1 pt-3">
                    <div className="flex items-start justify-between gap-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-8 w-8 rounded-lg" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 px-3 pb-3 pt-0">
                    <Skeleton className="h-6 w-28" />
                    <Skeleton className="h-2.5 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="border-2">
              <CardHeader>
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-80 max-w-full" />
              </CardHeader>
              <CardContent className="h-[360px] sm:h-[420px] lg:h-[480px]">
                <Skeleton className="h-full w-full rounded-xl" />
              </CardContent>
            </Card>
          </>
        ) : null}

        {(!isAllFilters || projectSummary) && (
          <>
            {/* KPI row: five compact cards incl. PIFRA vs allocation */}
            <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
              {Object.entries(kpiDataWithIcons).map(([key, kpi]) => {
                const Icon = kpi.icon;
                const isPercentKpi = (kpi as { format?: string }).format === "percent";
                const isPositive = kpi.trend >= 0;
                const variant = getKpiVariant(key, Number((kpi as any).valueM ?? 0));

                const footerTrend =
                  key === "pifraVsAllocation" ? (
                    <div className="w-full space-y-1">
                      <p className="text-[10px] leading-tight text-muted-foreground">Share of allocation in PIFRA</p>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, utilizationRate)}%` }}
                        />
                      </div>
                      <div className="flex justify-between gap-1 text-[10px] leading-tight text-muted-foreground">
                        <span className="min-w-0 truncate" title={formatPKRMillions(totalActualM)}>
                          {formatPKRMillions(totalActualM)}
                        </span>
                        <span className="min-w-0 truncate text-right" title={formatPKRMillions(totalPlannedM)}>
                          {formatPKRMillions(totalPlannedM)}
                        </span>
                      </div>
                    </div>
                  ) : key === "pifra" ? (
                    <div className="flex items-center gap-1">
                      {isPositive ? (
                        <TrendingUp className={cn("h-3 w-3 shrink-0", variant.trend)} />
                      ) : (
                        <TrendingDown className={cn("h-3 w-3 shrink-0", variant.trend)} />
                      )}
                      <p className={cn("text-[11px] leading-snug", variant.trend)}>
                        {`${kpiDerived.utilVsSpendingPct.toFixed(1)}% of spending release`}
                      </p>
                    </div>
                  ) : key === "pct" ? (
                    <p className="text-[11px] leading-snug text-muted-foreground">Share of approved allocation</p>
                  ) : key === "pdRelease" ? (
                    <p className="text-[11px] leading-snug text-muted-foreground">Planning &amp; development</p>
                  ) : key === "allocation" ? (
                    <p className="text-[11px] leading-snug text-muted-foreground">Approved / planned baseline</p>
                  ) : (
                    <p className="text-[11px] leading-snug text-muted-foreground">Released for expenditure</p>
                  );

                return (
                  <Card
                    key={key}
                    className={cn(
                      "relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/50 shadow-sm transition-all hover:shadow-md",
                      "border-l-4",
                      variant.accent,
                      variant.bg
                    )}
                  >
                    <div className={cn("pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl", variant.blob)} />
                    <CardHeader className="relative flex-shrink-0 space-y-0 px-3 pb-1 pt-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="min-h-[2.25rem] max-w-[calc(100%-2.25rem)] text-xs font-medium leading-snug text-muted-foreground line-clamp-2">
                          {kpi.label}
                        </CardTitle>
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/40 shadow-sm",
                            variant.iconWrap
                          )}
                        >
                          <Icon className={cn("h-4 w-4", variant.icon)} />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="relative flex flex-col px-3 pb-3 pt-0">
                      <div className="text-lg font-bold font-heading text-foreground xl:text-xl">
                        {isPercentKpi
                          ? `${Number((kpi as any).valueM ?? 0).toFixed(1)}%`
                          : key === "pct"
                            ? `${Number((kpi as any).valueM ?? 0).toFixed(2)}%`
                            : formatPKRMillions(Number((kpi as any).valueM ?? 0))}
                      </div>
                      <div className="mt-2 min-h-[2.5rem]">{footerTrend}</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Scheme financial flow — full width */}
            <Card className="flex min-h-0 w-full flex-col border-2 transition-colors hover:border-[#101a3c]">
              <CardHeader className="flex-shrink-0">
                <CardTitle>Scheme financial flow</CardTitle>
                <CardDescription>
                  Totals (PKR millions) by stage — Allocation → P&amp;D → Spending release → PIFRA
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[360px] w-full sm:h-[420px] lg:h-[480px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={flowChartData}
                    margin={{ top: 16, right: 32, left: 16, bottom: isMobile ? 52 : 36 }}
                  >
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
                    <Legend wrapperStyle={{ paddingTop: 8 }} />
                    <Bar
                      dataKey="totalM"
                      fill="url(#colorFlowTotal)"
                      radius={[4, 4, 0, 0]}
                      name="Total (M)"
                    />
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

            {/* Project comparison — only projects with financial data; duplicate names disambiguated */}
            <Card className="border-2 transition-colors hover:border-[#101a3c]">
              <CardHeader>
                <CardTitle>Project comparison</CardTitle>
                <CardDescription>Allocation vs PIFRA utilization (PKR millions), projects with data only</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] sm:h-[330px] lg:h-[380px]">
                {divisionComparisonData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No projects with allocation or PIFRA totals in the current filter.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={divisionComparisonData}
                      margin={{ top: 10, right: 24, left: 8, bottom: divisionComparisonData.length > 6 ? 72 : 56 }}
                      barGap={4}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="division"
                        angle={-35}
                        textAnchor="end"
                        height={divisionComparisonData.length > 6 ? 88 : 72}
                        interval={0}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                        tickFormatter={(v) => `${v}M`}
                        width={48}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number, name: string) => [`PKR ${Number(value).toFixed(2)} M`, name]}
                      />
                      <Legend wrapperStyle={{ paddingTop: 8 }} />
                      <Bar dataKey="approvedM" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Approved (M)" maxBarSize={56} />
                      <Bar dataKey="pifraM" fill="#10b981" radius={[4, 4, 0, 0]} name="PIFRA (M)" maxBarSize={56} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Stage breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Stage breakdown (totals)</CardTitle>

              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {stageBreakdownWithBarScale.map((item) => (
                    <div key={item.label} className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="font-bold text-primary">{item.label}</span>
                        <div className="text-xs font-mono text-muted-foreground flex items-center gap-3 sm:gap-0 sm:space-y-0.5 sm:block sm:text-right">
                          <span className="whitespace-nowrap">C: {item.triple.capital.toFixed(2)} M</span>
                          <span className="whitespace-nowrap">R: {item.triple.revenue.toFixed(2)} M</span>
                          <span className="whitespace-nowrap font-bold text-foreground">T: {item.triple.total.toFixed(2)} M</span>
                        </div>
                      </div>
                      <div className="w-full bg-muted h-3 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, item.barWidthPct)}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.pctOfApproved.toFixed(1)}% of approved total
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
