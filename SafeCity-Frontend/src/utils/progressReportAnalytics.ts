/**
 * progressReportAnalytics.ts
 * ============================================================
 * Analytics helpers that derive secondary metrics and status
 * summaries from ReportData for use in PDF/PPT exports.
 *
 * These functions are pure — they never fetch from backend.
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

// ── Decision summary bullets ──────────────────────────────────

export function buildDecisionBullets(report: ReportData): string[] {
  const { kpis, hierarchyUnits, attentionProjects, distribution } = report;
  const bullets: string[] = [];

  // Strongest geography
  if (hierarchyUnits.length > 0) {
    const best = hierarchyUnits[0];
    bullets.push(
      `Strongest unit: ${best.name} — ${formatProgress(best.physical_progress)}% physical progress.`,
    );
  }

  // Weakest geography
  if (hierarchyUnits.length > 1) {
    const worst = hierarchyUnits[hierarchyUnits.length - 1];
    bullets.push(
      `Weakest unit: ${worst.name} — ${formatProgress(worst.physical_progress)}%. Management follow-up needed.`,
    );
  }

  // Attention count
  if (attentionProjects.length > 0) {
    bullets.push(
      `${attentionProjects.length} project(s) require attention (0%, <25%, or delay-affected).`,
    );
  }

  // Zero projects
  const zeroBucket = distribution.find((d) => d.bucket === "0%");
  if (zeroBucket && zeroBucket.count > 0) {
    bullets.push(`${zeroBucket.count} project(s) at 0% — no physical progress recorded.`);
  }

  // Completion
  if (kpis.completedProjects > 0) {
    bullets.push(
      `${kpis.completedProjects} of ${kpis.totalProjects} project(s) completed (100%).`,
    );
  }

  // Recommendation
  if (kpis.overallPhysical < 25) {
    bullets.push("Recommended: Escalate monitoring cadence for all active geographies.");
  } else if (kpis.overallPhysical < 50) {
    bullets.push("Recommended: Focus resources on below-25% geographies to close the gap.");
  } else {
    bullets.push("Recommended: Sustain momentum and ensure delayed projects receive priority support.");
  }

  return bullets.slice(0, 5);
}

// ── Table row builders ────────────────────────────────────────

export interface ManagementTableRow {
  project: string;
  division: string;
  district: string;
  tehsil: string;
  physical: string;
  status: string;
  delay: string;
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
        : "#f59e0b",
    meta: `${u.project_count} project(s)`,
  }));
}

export function buildTopProjectBars(projects: ProjectSummaryRow[], maxItems = 10): ChartBar[] {
  return projects.slice(0, maxItems).map((p) => ({
    label: p.project_name,
    value: p.physical_progress,
    color:
      p.physical_progress >= 75
        ? "#22c55e"
        : p.physical_progress >= 25
        ? "#3b82f6"
        : "#f59e0b",
    meta: `${p.division_name} / ${p.district_name}`,
  }));
}

export function buildAttentionBars(projects: ProjectSummaryRow[], maxItems = 10): ChartBar[] {
  return projects.slice(0, maxItems).map((p) => ({
    label: p.project_name,
    value: p.physical_progress,
    color: p.has_delay ? "#ef4444" : "#f59e0b",
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
