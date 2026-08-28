/**
 * progressReportAnalytics.ts
 * ============================================================
 * Analytics helpers that derive secondary metrics and status
 * summaries from ReportData for use in PDF/PPT exports.
 *
 * These functions are pure — they never fetch from backend.
 *
 * v2 — Added: buildFinancialSummary, buildRagIndicators,
 *      buildPerformanceGap, buildRiskMatrix, buildProgressTrend.
 *      Upgraded buildDecisionBullets with severity-coded output.
 * ============================================================
 */

import type { ReportData, HierarchyUnit, ProjectSummaryRow, DistributionBucket } from "./buildProgressReportData";
import { formatProgress } from "./dashboardPhysicalProgress";

// ── Status helpers ─────────────────────────────────────────────

export type ProjectStatus = "completed" | "in_progress" | "in_delay" | "pending";

export interface StatusComposition {
  label: string;
  count: number;
  pct: number;
  color: string;
}

export function buildStatusComposition(projects: ProjectSummaryRow[]): StatusComposition[] {
  const total = projects.length || 1;
  const map: Record<ProjectStatus, { label: string; color: string }> = {
    completed:   { label: "Completed",   color: "#22c55e" },
    in_progress: { label: "In Progress", color: "#3b82f6" },
    in_delay:    { label: "Delayed",     color: "#ef4444" },
    pending:     { label: "Pending",     color: "#94a3b8" },
  };

  return (Object.entries(map) as Array<[ProjectStatus, { label: string; color: string }]>).map(
    ([status, meta]) => {
      const count = projects.filter(
        (p) => p.status === status || (status === "in_delay" && p.has_delay),
      ).length;
      return {
        label: meta.label,
        count,
        pct: Number(((count / total) * 100).toFixed(1)),
        color: meta.color,
      };
    },
  );
}

// ── Attention summary ──────────────────────────────────────────

export interface AttentionProfile {
  zeroProgress: number;
  below25: number;
  between25and50: number;
  above75: number;
  completed: number;
  withDelay: number;
}

export function buildAttentionProfile(projects: ProjectSummaryRow[]): AttentionProfile {
  return {
    zeroProgress:    projects.filter((p) => p.physical_progress === 0).length,
    below25:         projects.filter((p) => p.physical_progress > 0 && p.physical_progress < 25).length,
    between25and50:  projects.filter((p) => p.physical_progress >= 25 && p.physical_progress < 50).length,
    above75:         projects.filter((p) => p.physical_progress >= 75 && p.physical_progress < 100).length,
    completed:       projects.filter((p) => p.physical_progress >= 100).length,
    withDelay:       projects.filter((p) => p.has_delay).length,
  };
}

// ── Financial summary ──────────────────────────────────────────

export interface FinancialSummary {
  totalBudget: number;
  budgetUtilized: number;
  budgetRemaining: number;
  utilizationPct: number;
  avgFinancialProgress: number;
}

/**
 * Aggregate financial metrics from project rows.
 * Uses `total_budget` and `budget_utilized` fields already on ProjectSummaryRow.
 */
export function buildFinancialSummary(projects: ProjectSummaryRow[]): FinancialSummary {
  let totalBudget = 0;
  let budgetUtilized = 0;
  let finSum = 0;
  let finCount = 0;

  for (const p of projects) {
    totalBudget += p.total_budget ?? 0;
    budgetUtilized += p.budget_utilized ?? 0;
    if (p.financial_progress !== undefined) {
      finSum += p.financial_progress;
      finCount++;
    }
  }

  const budgetRemaining = Math.max(0, totalBudget - budgetUtilized);
  const utilizationPct = totalBudget > 0
    ? Number(((budgetUtilized / totalBudget) * 100).toFixed(2))
    : 0;
  const avgFinancialProgress = finCount > 0
    ? Number((finSum / finCount).toFixed(2))
    : 0;

  return { totalBudget, budgetUtilized, budgetRemaining, utilizationPct, avgFinancialProgress };
}

// ── RAG indicators ─────────────────────────────────────────────

export type RagLevel = "red" | "amber" | "green";

export interface RagIndicator {
  label: string;
  value: string;
  rag: RagLevel;
  color: string;
}

/**
 * Produce RAG (Red / Amber / Green) status indicators for key KPIs.
 */
export function buildRagIndicators(report: ReportData): RagIndicator[] {
  const { kpis, attentionProjects } = report;
  const fin = report.financialSummary;

  function physicalRag(v: number): RagLevel {
    if (v >= 60) return "green";
    if (v >= 25) return "amber";
    return "red";
  }

  function finRag(v: number): RagLevel {
    if (v >= 50) return "green";
    if (v >= 20) return "amber";
    return "red";
  }

  function attnRag(attn: number, total: number): RagLevel {
    if (total === 0) return "green";
    const pct = (attn / total) * 100;
    if (pct <= 15) return "green";
    if (pct <= 40) return "amber";
    return "red";
  }

  const ragColorMap: Record<RagLevel, string> = {
    red: "#DC2626",
    amber: "#D97706",
    green: "#16A34A",
  };

  const physRag = physicalRag(kpis.overallPhysical);
  const fRag = fin ? finRag(fin.utilizationPct) : "amber" as RagLevel;
  const aRag = attnRag(attentionProjects.length, kpis.totalProjects);

  return [
    {
      label: "Physical Progress",
      value: `${formatProgress(kpis.overallPhysical)}%`,
      rag: physRag,
      color: ragColorMap[physRag],
    },
    {
      label: "Financial Utilization",
      value: fin ? `${formatProgress(fin.utilizationPct)}%` : "—",
      rag: fRag,
      color: ragColorMap[fRag],
    },
    {
      label: "Attention Ratio",
      value: `${attentionProjects.length}/${kpis.totalProjects}`,
      rag: aRag,
      color: ragColorMap[aRag],
    },
    {
      label: "Completion Rate",
      value: kpis.totalProjects > 0
        ? `${((kpis.completedProjects / kpis.totalProjects) * 100).toFixed(1)}%`
        : "—",
      rag: kpis.totalProjects > 0 && (kpis.completedProjects / kpis.totalProjects) >= 0.5
        ? "green" : (kpis.completedProjects / Math.max(kpis.totalProjects, 1)) >= 0.2
        ? "amber" : "red",
      color: ragColorMap[
        kpis.totalProjects > 0 && (kpis.completedProjects / kpis.totalProjects) >= 0.5
          ? "green" : (kpis.completedProjects / Math.max(kpis.totalProjects, 1)) >= 0.2
          ? "amber" : "red"
      ],
    },
  ];
}

// ── Performance gap ────────────────────────────────────────────

export interface PerformanceGap {
  bestUnit: string;
  bestValue: number;
  worstUnit: string;
  worstValue: number;
  spread: number;
  spreadLabel: string;
}

/**
 * Compute spread between best and worst hierarchy units.
 */
export function buildPerformanceGap(units: HierarchyUnit[]): PerformanceGap | null {
  if (units.length < 2) return null;
  const best = units[0];
  const worst = units[units.length - 1];
  const spread = Number((best.physical_progress - worst.physical_progress).toFixed(2));
  return {
    bestUnit: best.name,
    bestValue: best.physical_progress,
    worstUnit: worst.name,
    worstValue: worst.physical_progress,
    spread,
    spreadLabel: spread > 40 ? "Critical disparity" : spread > 20 ? "Moderate gap" : "Narrow gap",
  };
}

// ── Risk matrix ────────────────────────────────────────────────

export interface RiskMatrix {
  highRisk: number;     // Low progress + delay
  atRisk: number;       // Low progress, no delay
  onTrack: number;      // Progress >= 25, no delay
  completed: number;    // 100%
  highRiskProjects: ProjectSummaryRow[];
  atRiskProjects: ProjectSummaryRow[];
}

/**
 * Categorize projects into a 4-quadrant risk matrix.
 */
export function buildRiskMatrix(projects: ProjectSummaryRow[]): RiskMatrix {
  const highRiskProjects: ProjectSummaryRow[] = [];
  const atRiskProjects: ProjectSummaryRow[] = [];
  let onTrack = 0;
  let completed = 0;

  for (const p of projects) {
    if (p.physical_progress >= 100) {
      completed++;
    } else if (p.physical_progress < 25 && p.has_delay) {
      highRiskProjects.push(p);
    } else if (p.physical_progress < 25) {
      atRiskProjects.push(p);
    } else {
      onTrack++;
    }
  }

  return {
    highRisk: highRiskProjects.length,
    atRisk: atRiskProjects.length,
    onTrack,
    completed,
    highRiskProjects,
    atRiskProjects,
  };
}

// ── Progress trend summary ─────────────────────────────────────

export interface ProgressTrend {
  label: string;
  count: number;
  pct: number;
  color: string;
}

/**
 * Group projects by progress bands for trend / composition view.
 */
export function buildProgressTrend(projects: ProjectSummaryRow[]): ProgressTrend[] {
  const total = Math.max(projects.length, 1);
  const bands = [
    { label: "Not Started (0%)",    min: 0,     max: 0,     color: "#DC2626" },
    { label: "Early (1–25%)",       min: 0.01,  max: 25,    color: "#2563EB" },
    { label: "Mid (26–50%)",        min: 25.01, max: 50,    color: "#1E40AF" },
    { label: "Advanced (51–75%)",   min: 50.01, max: 75,    color: "#3B82F6" },
    { label: "Near Complete (76–99%)", min: 75.01, max: 99.99, color: "#10B981" },
    { label: "Completed (100%)",    min: 100,   max: 100,   color: "#059669" },
  ];

  return bands.map((b) => {
    const count = projects.filter((p) => {
      const v = p.physical_progress;
      if (b.min === 0 && b.max === 0) return v === 0;
      if (b.min === 100) return v >= 100;
      return v >= b.min && v <= b.max;
    }).length;
    return {
      label: b.label,
      count,
      pct: Number(((count / total) * 100).toFixed(1)),
      color: b.color,
    };
  });
}

// ── Decision summary bullets (upgraded) ───────────────────────

export type DecisionSeverity = "critical" | "warning" | "positive" | "info";

export interface DecisionBullet {
  text: string;
  severity: DecisionSeverity;
}

/**
 * Generate context-aware decision bullets with severity coding.
 * The plain-string overload is kept for backward-compat.
 */
export function buildDecisionBullets(report: ReportData): string[] {
  return buildSeverityBullets(report).map((b) => b.text);
}

export function buildSeverityBullets(report: ReportData): DecisionBullet[] {
  const { kpis, hierarchyUnits, attentionProjects, distribution } = report;
  const bullets: DecisionBullet[] = [];

  // Strongest geography
  if (hierarchyUnits.length > 0) {
    const best = hierarchyUnits[0];
    bullets.push({
      text: `Strongest unit: ${best.name} — ${formatProgress(best.physical_progress)}% physical progress.`,
      severity: "positive",
    });
  }

  // Weakest geography
  if (hierarchyUnits.length > 1) {
    const worst = hierarchyUnits[hierarchyUnits.length - 1];
    const sev: DecisionSeverity = worst.physical_progress < 10 ? "critical" : "warning";
    bullets.push({
      text: `Weakest unit: ${worst.name} — ${formatProgress(worst.physical_progress)}%. Management follow-up needed.`,
      severity: sev,
    });
  }

  // Attention count
  if (attentionProjects.length > 0) {
    const ratio = kpis.totalProjects > 0 ? attentionProjects.length / kpis.totalProjects : 0;
    const sev: DecisionSeverity = ratio > 0.4 ? "critical" : "warning";
    bullets.push({
      text: `${attentionProjects.length} project(s) require attention (0%, <25%, or delay-affected).`,
      severity: sev,
    });
  }

  // Zero projects
  const zeroBucket = distribution.find((d) => d.bucket === "0%");
  if (zeroBucket && zeroBucket.count > 0) {
    bullets.push({
      text: `${zeroBucket.count} project(s) at 0% — no physical progress recorded.`,
      severity: "critical",
    });
  }

  // Delayed projects
  const delayCount = attentionProjects.filter((p) => p.has_delay).length;
  if (delayCount > 0) {
    bullets.push({
      text: `${delayCount} project(s) have recorded delay logs — escalation recommended.`,
      severity: "critical",
    });
  }

  // Completion
  if (kpis.completedProjects > 0) {
    bullets.push({
      text: `${kpis.completedProjects} of ${kpis.totalProjects} project(s) completed (100%).`,
      severity: "positive",
    });
  }

  // Performance gap
  if (hierarchyUnits.length >= 2) {
    const spread = hierarchyUnits[0].physical_progress - hierarchyUnits[hierarchyUnits.length - 1].physical_progress;
    if (spread > 40) {
      bullets.push({
        text: `Performance gap of ${formatProgress(spread)}pp between top and bottom units — critical disparity.`,
        severity: "critical",
      });
    } else if (spread > 20) {
      bullets.push({
        text: `Performance gap of ${formatProgress(spread)}pp between top and bottom units — moderate disparity.`,
        severity: "warning",
      });
    }
  }

  // Financial utilization insight
  const fin = report.financialSummary;
  if (fin && fin.totalBudget > 0) {
    if (fin.utilizationPct > 100) {
      bullets.push({
        text: `Budget utilization exceeds allocation at ${formatProgress(fin.utilizationPct)}% — financial review required.`,
        severity: "critical",
      });
    } else if (fin.utilizationPct < 20) {
      bullets.push({
        text: `Budget utilization at ${formatProgress(fin.utilizationPct)}% — significant underspend detected.`,
        severity: "warning",
      });
    } else if (fin.utilizationPct > 90) {
      bullets.push({
        text: `Budget utilization at ${formatProgress(fin.utilizationPct)}% — near full utilization.`,
        severity: "info",
      });
    }
  }

  // Recommendation
  if (kpis.overallPhysical < 25) {
    bullets.push({
      text: "Recommended: Escalate monitoring cadence for all active geographies.",
      severity: "critical",
    });
  } else if (kpis.overallPhysical < 50) {
    bullets.push({
      text: "Recommended: Focus resources on below-25% geographies to close the gap.",
      severity: "warning",
    });
  } else {
    bullets.push({
      text: "Recommended: Sustain momentum and ensure delayed projects receive priority support.",
      severity: "info",
    });
  }

  return bullets.slice(0, 8);
}

// ── Table row builders ────────────────────────────────────────

export interface ManagementTableRow {
  project: string;
  division: string;
  district: string;
  tehsil: string;
  physical: string;
  physicalNum: number;
  status: string;
  delay: string;
  [key: string]: string | number;
}

export function buildManagementTableRows(
  projects: ProjectSummaryRow[],
  maxRows = 30,
): ManagementTableRow[] {
  return projects.slice(0, maxRows).map((p) => ({
    project:  p.project_name.length > 32 ? `${p.project_name.slice(0, 30)}…` : p.project_name,
    division: p.division_name || "—",
    district: p.district_name || "—",
    tehsil:   p.tehsil_name   || "—",
    physical: `${formatProgress(p.physical_progress)}%`,
    physicalNum: p.physical_progress,
    status:   statusLabel(p.status),
    delay:    p.has_delay ? "Yes" : "—",
  }));
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    completed:   "Completed",
    in_progress: "In Progress",
    in_delay:    "Delayed",
    pending:     "Pending",
  };
  return map[status] ?? status;
}

// ── Chart data builders ────────────────────────────────────────

export interface ChartBar {
  label: string;
  value: number;
  color: string;
  meta?: string;
}

export function buildHierarchyBars(units: HierarchyUnit[], maxItems = 15): ChartBar[] {
  return units.slice(0, maxItems).map((u) => ({
    label: u.name,
    value: u.physical_progress,
    color:
      u.physical_progress >= 75
        ? "#22c55e"
        : u.physical_progress >= 25
        ? "#3b82f6"
        : "#2563EB",
    meta: `${u.project_count} project(s)`,
  }));
}

export function buildTopProjectBars(projects: ProjectSummaryRow[], maxItems = 10): ChartBar[] {
  return projects.slice(0, maxItems).map((p) => ({
    label: `${p.project_name}${p.district_name ? ` — ${p.district_name}` : ""}`,
    value: p.physical_progress,
    color:
      p.physical_progress >= 75
        ? "#22c55e"
        : p.physical_progress >= 25
        ? "#3b82f6"
        : "#2563EB",
    meta: `${p.division_name} / ${p.district_name}`,
  }));
}

export function buildAttentionBars(projects: ProjectSummaryRow[], maxItems = 10): ChartBar[] {
  return projects.slice(0, maxItems).map((p) => ({
    label: `${p.project_name}${p.district_name ? ` — ${p.district_name}` : ""}`,
    value: p.physical_progress,
    color: p.has_delay || p.physical_progress === 0 ? "#DC2626" : "#1E3A8A",
    meta: p.has_delay
      ? "Delay recorded"
      : p.physical_progress === 0
      ? "Not started"
      : "Below 25%",
  }));
}

export function buildProjectLoadBars(
  units: HierarchyUnit[],
  maxItems = 15,
): ChartBar[] {
  return units
    .slice(0, maxItems)
    .sort((a, b) => b.project_count - a.project_count)
    .map((u) => ({
      label: u.name,
      value: u.project_count,
      color: "#3b82f6",
      meta: `${formatProgress(u.physical_progress)}% avg`,
    }));
}
