/**
 * buildProgressReportData.ts
 * ============================================================
 * Transforms raw DashboardPageData + scope context into the
 * structured payload consumed by PDF and PPT export functions.
 *
 * Uses only `physical_progress` via the shared helper.
 * Never references overall_progress, financial_progress,
 * elapsed progress, or schedule variance for physical values.
 * ============================================================
 */

import type { DashboardPageData, DivisionRow, DistrictRow, TehsilRow, DashboardProject } from "@/api/dashboard";
import {
  averageProgress,
  getRowPhysical,
  getParentDivisionId,
  getParentDistrictId,
  getParentTehsilId,
  formatProgress,
} from "./dashboardPhysicalProgress";
import {
  buildFinancialSummary,
  buildRiskMatrix,
  type FinancialSummary,
  type RiskMatrix,
} from "./progressReportAnalytics";

// ── Types ─────────────────────────────────────────────────────

export type ScopeType =
  | "all-divisions"
  | "all-districts"
  | "all-tehsils"
  | "all-projects"
  | "selected-division"
  | "selected-district"
  | "selected-tehsil"
  | "selected-project";

export interface HierarchyUnit {
  id: number;
  name: string;
  physical_progress: number;
  project_count: number;
  /** Parent ID — used for filtering. 0 = no parent / root level. */
  parent_id: number;
}

export interface ProjectSummaryRow {
  id: number;
  project_name: string;
  division_name: string;
  district_name: string;
  tehsil_name: string;
  physical_progress: number;
  financial_progress: number;
  status: string;
  has_delay: boolean;
  total_budget: number;
  budget_utilized: number;
}

export interface DistributionBucket {
  bucket: string;
  count: number;
  color: string;
}

export interface ReportScope {
  scopeType: ScopeType;
  scopeName: string;
  /** Canonical physical progress for this scope — computed from child rows. */
  currentScopePhysical: number;
  generatedAt: string;
  /** The selected geography's own ID (null for root views). */
  selectedId: number | null;
  selectedName: string | null;
  selectedType: "division" | "district" | "tehsil" | "project" | null;
}

export interface ReportKpis {
  overallPhysical: number;
  totalProjects: number;
  completedProjects: number;
  inProgressProjects: number;
  delayedProjects: number;
  pendingProjects: number;
  activeUnits: number;
  /** Label for active units e.g. "Divisions", "Districts" */
  activeUnitsLabel: string;
}

export interface ReportData {
  scope: ReportScope;
  kpis: ReportKpis;
  /** Primary hierarchy units for this scope (sorted by physical_progress DESC). */
  hierarchyUnits: HierarchyUnit[];
  /** All projects within the scope. */
  projects: ProjectSummaryRow[];
  /** Top 10 by physical progress. */
  topProjects: ProjectSummaryRow[];
  /** Bottom 10 (attention — low progress). */
  bottomProjects: ProjectSummaryRow[];
  /** Projects needing attention. */
  attentionProjects: ProjectSummaryRow[];
  /** Distribution buckets for physical progress. */
  distribution: DistributionBucket[];
  /** Insights / observations generated from data. */
  insights: string[];
  /** Aggregated financial metrics from project rows. */
  financialSummary: FinancialSummary;
  /** Risk quadrant categorization of projects. */
  riskMatrix: RiskMatrix;
}

// ── Constants ─────────────────────────────────────────────────

const NUM = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function toProjectSummary(p: DashboardProject): ProjectSummaryRow {
  return {
    id: p.id,
    project_name: p.project_name ?? `Project ${p.id}`,
    division_name: (p as any).division_name ?? (p as any).zone_name ?? "—",
    district_name: (p as any).district_name ?? (p as any).circle_name ?? "—",
    tehsil_name: (p as any).tehsil_name ?? "—",
    physical_progress: NUM(p.physical_progress),
    financial_progress: NUM(p.financial_progress),
    status: p.status ?? "pending",
    has_delay: Boolean(p.has_delay),
    total_budget: NUM(p.total_budget_allocated),
    budget_utilized: NUM(p.budget_utilized),
  };
}

function buildDistribution(projects: ProjectSummaryRow[]): DistributionBucket[] {
  const buckets: Array<{ bucket: string; min: number; max: number; color: string }> = [
    { bucket: "0%",       min: 0,    max: 0,   color: "#ef4444" },
    { bucket: ">0–25%",  min: 0.01, max: 25,  color: "#f97316" },
    { bucket: ">25–50%", min: 25.01,max: 50,  color: "#f59e0b" },
    { bucket: ">50–75%", min: 50.01,max: 75,  color: "#3b82f6" },
    { bucket: ">75–<100%",min:75.01,max:99.99,color: "#10b981" },
    { bucket: "100%",    min: 100,  max: 100, color: "#22c55e" },
  ];
  return buckets.map((b) => ({
    bucket: b.bucket,
    count: projects.filter((p) => {
      const v = p.physical_progress;
      if (b.min === 0 && b.max === 0) return v === 0;
      if (b.min === 100) return v >= 100;
      return v >= b.min && v <= b.max;
    }).length,
    color: b.color,
  }));
}

function generateInsights(data: Omit<ReportData, "insights">): string[] {
  const ins: string[] = [];
  const { kpis, hierarchyUnits, attentionProjects, distribution, financialSummary, riskMatrix } = data;

  ins.push(
    `Overall physical progress: ${formatProgress(kpis.overallPhysical)}% across ${kpis.totalProjects} project(s).`,
  );

  if (hierarchyUnits.length > 0) {
    const best = hierarchyUnits[0];
    const worst = hierarchyUnits[hierarchyUnits.length - 1];
    ins.push(
      `Highest performing unit: ${best.name} at ${formatProgress(best.physical_progress)}%.`,
    );
    if (worst.id !== best.id) {
      ins.push(
        `Lowest performing unit: ${worst.name} at ${formatProgress(worst.physical_progress)}%. Attention required.`,
      );
    }
  }

  const zeroPct = distribution.find((d) => d.bucket === "0%");
  if (zeroPct && zeroPct.count > 0) {
    ins.push(`${zeroPct.count} project(s) at 0% physical progress — immediate follow-up needed.`);
  }

  const completed = distribution.find((d) => d.bucket === "100%");
  if (completed && completed.count > 0) {
    ins.push(`${completed.count} project(s) fully completed (100%).`);
  }

  if (attentionProjects.length > 0) {
    const delayedCount = attentionProjects.filter((p) => p.has_delay).length;
    if (delayedCount > 0) {
      ins.push(`${delayedCount} project(s) have recorded delay logs.`);
    }
  }

  if (kpis.completedProjects > 0) {
    ins.push(`${kpis.completedProjects} project(s) completed, ${kpis.inProgressProjects} in progress, ${kpis.pendingProjects} pending.`);
  }

  // Financial insight
  if (financialSummary && financialSummary.totalBudget > 0) {
    ins.push(`Financial utilization: ${formatProgress(financialSummary.utilizationPct)}% of allocated budget consumed.`);
  }

  // Risk insight
  if (riskMatrix.highRisk > 0) {
    ins.push(`${riskMatrix.highRisk} project(s) are high-risk (low progress + delay recorded).`);
  }

  return ins.slice(0, 8);
}

// ── Main builder ──────────────────────────────────────────────

export function buildReportData(
  pageData: DashboardPageData,
  scopeType: ScopeType,
  scopeName: string,
  currentScopePhysical: number,
  currentScopeRows: any[],
  selectedId: number | null = null,
  selectedName: string | null = null,
  selectedType: "division" | "district" | "tehsil" | "project" | null = null,
): ReportData {
  const allProjects = (pageData.projects ?? []) as DashboardProject[];

  // ── Filter projects to current scope ──────────────────────
  let scopeProjects: DashboardProject[];

  if (scopeType === "selected-project" && selectedId !== null) {
    scopeProjects = allProjects.filter((p) => p.id === selectedId);
  } else if (scopeType === "selected-tehsil" && selectedId !== null) {
    scopeProjects = allProjects.filter(
      (p) => Number(getParentTehsilId(p)) === selectedId,
    );
  } else if (scopeType === "selected-district" && selectedId !== null) {
    // Projects whose tehsil is inside this district
    const tehsilIds = new Set(
      (pageData.tehsils ?? [])
        .filter((t) => Number(getParentDistrictId(t)) === selectedId)
        .map((t) => t.id),
    );
    scopeProjects = allProjects.filter((p) =>
      tehsilIds.has(Number(getParentTehsilId(p))),
    );
  } else if (scopeType === "selected-division" && selectedId !== null) {
    // Projects whose division matches
    scopeProjects = allProjects.filter(
      (p) => Number(getParentDivisionId(p)) === selectedId,
    );
  } else {
    scopeProjects = allProjects;
  }

  const projectRows = scopeProjects.map(toProjectSummary);

  // ── KPIs ──────────────────────────────────────────────────
  const completed = scopeProjects.filter((p) => p.status === "completed").length;
  const inProgress = scopeProjects.filter((p) => p.status === "in_progress").length;
  const delayed = scopeProjects.filter((p) => p.status === "in_delay" || p.has_delay).length;
  const pending = scopeProjects.filter((p) => p.status === "pending").length;

  const unitsLabelMap: Record<ScopeType, string> = {
    "all-divisions": "Divisions",
    "all-districts": "Districts",
    "all-tehsils": "Tehsils",
    "all-projects": "Projects",
    "selected-division": "Districts",
    "selected-district": "Tehsils",
    "selected-tehsil": "Projects",
    "selected-project": "WBS Units",
  };

  const kpis: ReportKpis = {
    overallPhysical: currentScopePhysical,
    totalProjects: scopeProjects.length,
    completedProjects: completed,
    inProgressProjects: inProgress,
    delayedProjects: delayed,
    pendingProjects: pending,
    activeUnits: currentScopeRows.length,
    activeUnitsLabel: unitsLabelMap[scopeType] ?? "Units",
  };

  // ── Hierarchy units ────────────────────────────────────────
  let hierarchyUnits: HierarchyUnit[] = [];

  if (scopeType === "all-divisions") {
    hierarchyUnits = (pageData.divisions ?? []).map((d: DivisionRow) => ({
      id: d.id,
      name: d.name ?? (d as any).division_name ?? "Unknown",
      physical_progress: NUM(d.physical_progress),
      project_count: d.project_count ?? 0,
      parent_id: 0,
    }));
  } else if (scopeType === "all-districts") {
    hierarchyUnits = (pageData.districts ?? []).map((d: DistrictRow) => ({
      id: d.id,
      name: d.name ?? (d as any).district_name ?? "Unknown",
      physical_progress: NUM(d.physical_progress),
      project_count: d.project_count ?? 0,
      parent_id: NUM((d as any).division ?? 0),
    }));
  } else if (scopeType === "all-tehsils") {
    hierarchyUnits = (pageData.tehsils ?? []).map((t: TehsilRow) => ({
      id: t.id,
      name: t.name ?? (t as any).tehsil_name ?? "Unknown",
      physical_progress: NUM(t.physical_progress),
      project_count: t.project_count ?? 0,
      parent_id: NUM((t as any).district ?? 0),
    }));
  } else if (scopeType === "all-projects") {
    hierarchyUnits = scopeProjects.map((p) => ({
      id: p.id,
      name: p.project_name ?? `Project ${p.id}`,
      physical_progress: NUM(p.physical_progress),
      project_count: 1,
      parent_id: 0,
    }));
  } else if (scopeType === "selected-division" && selectedId !== null) {
    // Districts inside the selected division
    hierarchyUnits = (pageData.districts ?? [])
      .filter((d) => Number(getParentDivisionId(d)) === selectedId)
      .map((d: DistrictRow) => ({
        id: d.id,
        name: d.name ?? (d as any).district_name ?? "Unknown",
        physical_progress: NUM(d.physical_progress),
        project_count: d.project_count ?? 0,
        parent_id: selectedId,
      }));
  } else if (scopeType === "selected-district" && selectedId !== null) {
    hierarchyUnits = (pageData.tehsils ?? [])
      .filter((t) => Number(getParentDistrictId(t)) === selectedId)
      .map((t: TehsilRow) => ({
        id: t.id,
        name: t.name ?? (t as any).tehsil_name ?? "Unknown",
        physical_progress: NUM(t.physical_progress),
        project_count: t.project_count ?? 0,
        parent_id: selectedId,
      }));
  } else if (scopeType === "selected-tehsil" && selectedId !== null) {
    hierarchyUnits = scopeProjects.map((p) => ({
      id: p.id,
      name: p.project_name ?? `Project ${p.id}`,
      physical_progress: NUM(p.physical_progress),
      project_count: 1,
      parent_id: selectedId,
    }));
  } else if (scopeType === "selected-project") {
    // WBS-level breakdown is handled by the backend physical report
    hierarchyUnits = [];
  }

  hierarchyUnits.sort((a, b) => b.physical_progress - a.physical_progress);

  // ── Top / bottom / attention ───────────────────────────────
  const sortedDesc = [...projectRows].sort(
    (a, b) => b.physical_progress - a.physical_progress,
  );
  const topProjects = sortedDesc.slice(0, 10);
  const bottomProjects = [...projectRows]
    .sort((a, b) => a.physical_progress - b.physical_progress)
    .slice(0, 10);

  const attentionProjects = projectRows.filter(
    (p) =>
      p.physical_progress === 0 ||
      p.physical_progress < 25 ||
      p.has_delay ||
      p.status === "in_delay",
  );

  const distribution = buildDistribution(projectRows);
  const financialSummary = buildFinancialSummary(projectRows);
  const riskMatrix = buildRiskMatrix(projectRows);

  const partial: Omit<ReportData, "insights"> = {
    scope: {
      scopeType,
      scopeName,
      currentScopePhysical,
      generatedAt: new Date().toISOString(),
      selectedId,
      selectedName,
      selectedType,
    },
    kpis,
    hierarchyUnits,
    projects: projectRows,
    topProjects,
    bottomProjects,
    attentionProjects,
    distribution,
    financialSummary,
    riskMatrix,
  };

  return { ...partial, insights: generateInsights(partial) };
}
