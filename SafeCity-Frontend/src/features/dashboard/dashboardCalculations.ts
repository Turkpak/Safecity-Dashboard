import type { Project } from "@/api/types";
import { getProjectGanttData } from "@/api";
import type { SubProject } from "@/components/dashboard/SubProjectCard";

export interface PhaseProgress {
  actual: number;
  planned: number;
  subProjects?: SubProject[];
  timeline?: {
    month: string;
    actual: number;
    planned: number;
  }[];
}

export interface CityInstallationData {
  surveys: number | PhaseProgress;
  foundations: number | PhaseProgress;
  cabinet: number | PhaseProgress;
  cable: number | PhaseProgress;
  controlRoom: number | PhaseProgress;
  ppic3: number | PhaseProgress;
  overall: number;
  timeline?: {
    month: string;
    surveys: number;
    foundations: number;
    cabinet: number;
    cable: number;
    controlRoom: number;
    ppic3: number;
    overall: number;
  }[];
}

export type PhaseKey =
  | "surveys"
  | "foundations"
  | "cabinet"
  | "cable"
  | "controlRoom"
  | "ppic3";

export type ProjectGanttTask = Awaited<ReturnType<typeof getProjectGanttData>>[number];

export const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function safeParseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildMonthLabelsBetween(minDate: Date, maxDate: Date): string[] {
  const start = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  const labels: string[] = [];

  const cursor = new Date(start);
  while (cursor <= end) {
    labels.push(MONTH_LABELS[cursor.getMonth()] ?? "Jan");
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return labels;
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export function diffDaysInclusive(start: string | null | undefined, end: string | null | undefined): number {
  const s = safeParseDate(start ?? null);
  const e = safeParseDate(end ?? null);
  if (!s || !e) return 1;
  const ms = e.getTime() - s.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, days);
}

export function buildPhaseFromProjectGantt(
  tasks: ProjectGanttTask[],
  options?: { subtreeRootName?: string | null },
): {
  actual: number;
  planned: number;
  subProjects: SubProject[];
  timeline: { month: string; actual: number; planned: number }[];
} {
  const planned = 100;
  if (!tasks || tasks.length === 0) {
    return { actual: 0, planned, subProjects: [], timeline: [] };
  }

  type Row = {
    id: string;
    name: string;
    progress: number;
    plannedProgress: number;
    start: string;
    end: string;
    parentId?: string;
  };

  // 1) Filter out null-date rows (exclude from chart entirely)
  const datedRows: Row[] = [];
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (!t) continue;
    if (!t.start || !t.end) continue;
    datedRows.push({
      id: String(t.id),
      name: t.label,
      progress: clamp01(Number(t.progress ?? 0)),
      plannedProgress: planned,
      start: t.start,
      end: t.end,
      parentId: t.parent ? String(t.parent) : undefined,
    });
  }

  if (datedRows.length === 0) {
    return { actual: 0, planned, subProjects: [], timeline: [] };
  }

  // Lookup by id (uses API order preference naturally because we traverse `tasks`).
  const datedById = new Map<string, Row>();
  for (let i = 0; i < datedRows.length; i++) {
    datedById.set(datedRows[i].id, datedRows[i]);
  }

  // Optional: limit the whole phase to a single tehsil subtree based on tehsil name.
  // This prevents the WBS pie from including other geographies inside the same XER.
  const applySubtreeFilter = (subtreeRootName?: string | null): string | null => {
    if (!subtreeRootName) return null;
    const needle = subtreeRootName.trim().toLowerCase();
    if (!needle) return null;

    // Build children map across all dated rows.
    const childrenByParent = new Map<string | undefined, Row[]>();
    for (const r of datedRows) {
      const pid = r.parentId ? String(r.parentId) : undefined;
      const list = childrenByParent.get(pid) ?? [];
      list.push(r);
      childrenByParent.set(pid, list);
    }

    // Candidate roots: rows whose name matches the selected tehsil name.
    const candidates = datedRows.filter((r) => r.name.trim().toLowerCase() === needle || r.name.toLowerCase().includes(needle));
    if (candidates.length === 0) return null;

    // Pick the candidate whose subtree contains the most nodes (most likely the correct tehsil node).
    const subtreeSize = (rootId: string) => {
      const seen = new Set<string>();
      const queue: string[] = [rootId];
      while (queue.length) {
        const cur = queue.shift()!;
        if (seen.has(cur)) continue;
        seen.add(cur);
        const kids = childrenByParent.get(cur) ?? [];
        for (const k of kids) queue.push(k.id);
      }
      return seen.size;
    };

    let bestRoot: string | null = null;
    let bestSize = -1;
    for (const c of candidates) {
      const size = subtreeSize(c.id);
      if (size > bestSize) {
        bestSize = size;
        bestRoot = c.id;
      }
    }

    if (!bestRoot) return null;

    // Compute all descendants ids.
    const allowed = new Set<string>();
    const stack: string[] = [bestRoot];
    while (stack.length) {
      const cur = stack.pop()!;
      if (allowed.has(cur)) continue;
      allowed.add(cur);
      const kids = childrenByParent.get(cur) ?? [];
      for (const k of kids) stack.push(k.id);
    }

    // Mutate datedRows in place by filtering to allowed subtree.
    for (let i = datedRows.length - 1; i >= 0; i--) {
      if (!allowed.has(datedRows[i].id)) {
        datedRows.splice(i, 1);
      }
    }

    // Rebuild lookup map after filtering.
    datedById.clear();
    for (let i = 0; i < datedRows.length; i++) {
      datedById.set(datedRows[i].id, datedRows[i]);
    }

    return bestRoot;
  };

  const filteredRootId = applySubtreeFilter(options?.subtreeRootName);
  if (datedRows.length === 0) {
    return { actual: 0, planned, subProjects: [], timeline: [] };
  }

  // 2) Group by parent_id
  const groupMap = new Map<string, Row[]>();
  for (let i = 0; i < datedRows.length; i++) {
    const r = datedRows[i];
    // Only child rows (with parentId) participate in grouping.
    if (!r.parentId) continue;
    const list = groupMap.get(r.parentId);
    if (list) list.push(r);
    else groupMap.set(r.parentId, [r]);
  }

  type Group = { header: Row; children: Row[] };
  const groups: Group[] = [];

  // When in tehsil scope, only show tehsil-level nodes (depth 1 under the subtree root).
  // For non-tehsil usage, keep existing behaviour.
  const depthById = new Map<string, number>();
  if (filteredRootId) {
    depthById.set(filteredRootId, 0);
    const stack: string[] = [filteredRootId];
    while (stack.length) {
      const cur = stack.pop()!;
      const kids = groupMap.get(cur) ?? [];
      for (const k of kids) {
        if (!depthById.has(k.id)) {
          depthById.set(k.id, (depthById.get(cur) ?? 0) + 1);
          stack.push(k.id);
        }
      }
    }
  }

  for (const [parentId, rows] of Array.from(groupMap.entries())) {
    const realParent = datedById.get(parentId);
    const header = realParent ?? rows[0];
    const children = realParent ? rows.filter((r) => r.id !== realParent.id) : rows.slice(1);

    if (filteredRootId) {
      const depth = depthById.get(header.id);
      if (depth !== 1) continue; // tehsil-level only
    }

    groups.push({ header, children });
  }

  // Stable order: by first appearance of header id in API order.
  const apiIndex = new Map<string, number>();
  for (let i = 0; i < tasks.length; i++) {
    const id = String(tasks[i]?.id ?? "");
    if (!id) continue;
    if (!apiIndex.has(id)) apiIndex.set(id, i);
  }
  groups.sort((a, b) => (apiIndex.get(a.header.id) ?? 0) - (apiIndex.get(b.header.id) ?? 0));

  const subProjects: SubProject[] = groups.map((g) => {
    const milestones = g.children.map((c) => ({
      id: c.id,
      name: c.name,
      duration: diffDaysInclusive(c.start, c.end),
      startDate: c.start,
      finishDate: c.end,
      progress: c.progress,
      plannedProgress: c.plannedProgress,
    }));

    const dates: Date[] = [];
    const hs = safeParseDate(g.header.start);
    const he = safeParseDate(g.header.end);
    if (hs) dates.push(hs);
    if (he) dates.push(he);
    for (let i = 0; i < g.children.length; i++) {
      const cs = safeParseDate(g.children[i].start);
      const ce = safeParseDate(g.children[i].end);
      if (cs) dates.push(cs);
      if (ce) dates.push(ce);
    }
    const startDate = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString() : g.header.start;
    const finishDate = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString() : g.header.end;

    return {
      id: g.header.id,
      name: g.header.name,
      actualProgress: clamp01(Number(g.header.progress ?? 0)),
      plannedProgress: planned,
      // Weight is derived from total duration of direct children (data-driven, not hardcoded).
      weight: Math.max(
        0,
        milestones.reduce((sum, m) => sum + (Number(m.duration) || 0), 0),
      ),
      startDate,
      finishDate,
      milestones: milestones as any,
    };
  });

  // Normalize weight to 0..1 for the pie chart.
  const weightSum = subProjects.reduce((sum, sp) => sum + (Number(sp.weight) || 0), 0);
  if (weightSum > 0) {
    for (const sp of subProjects) {
      sp.weight = (sp.weight || 0) / weightSum;
    }
  } else if (subProjects.length > 0) {
    const w = 1 / subProjects.length;
    for (const sp of subProjects) sp.weight = w;
  }

  const overallActual = clamp01(
    subProjects.reduce((sum, sp) => sum + sp.actualProgress * sp.weight, 0) /
    Math.max(1e-9, subProjects.reduce((sum, sp) => sum + sp.weight, 0)),
  );

  const dates: Date[] = [];
  for (const sp of subProjects) {
    const s = safeParseDate(sp.startDate ?? null);
    const e = safeParseDate(sp.finishDate ?? null);
    if (s) dates.push(s);
    if (e) dates.push(e);
  }
  if (dates.length === 0) {
    return { actual: overallActual, planned, subProjects, timeline: [] };
  }
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
  const months = buildMonthLabelsBetween(minDate, maxDate);
  if (months.length === 0) {
    return { actual: overallActual, planned, subProjects, timeline: [] };
  }

  const timeline = months.map((m, idx) => {
    const t = months.length === 1 ? 1 : idx / (months.length - 1);
    return {
      month: m,
      planned: Math.round(t * planned),
      actual: Math.round(t * overallActual),
    };
  });

  return { actual: overallActual, planned, subProjects, timeline };
}

// Helper function to get progress value (backward compatible)
export const getProgressValue = (progress: number | PhaseProgress): number => {
  const clampPct = (n: number) => Math.max(0, Math.min(100, n));
  if (typeof progress === "number") return clampPct(Number(progress) || 0);
  return clampPct(Number(progress.actual) || 0);
};

// Helper function to check if progress has detailed data
export const hasDetailedProgress = (
  progress: number | PhaseProgress,
): progress is PhaseProgress => {
  return typeof progress !== "number";
};

// Generate sub-projects for a phase
export const generateSubProjects = (
  _phaseKey: string,
  _actualProgress: number,
  _plannedProgress: number,
  _division?: string,
  _district?: string,
  _tehsil?: string,
): SubProject[] => {
  // Synthetic sub-project generation has intentionally been removed.
  // Project/WBS details must come from backend Gantt/activity APIs only.
  return [];
};

// Helper to convert a percentage to an empty PhaseProgress shell.
// It exists only for backward-compatible component props; it does not create
// fake sub-projects or fake timeline data.
export const convertToPhaseProgress = (
  currentValue: number,
  phaseKey: string,
  timelineData?: { month: string;[key: string]: number | string }[],
  division?: string,
  district?: string,
  tehsil?: string,
): PhaseProgress => {
  const value = clamp01(Number(currentValue) || 0);
  const timeline =
    timelineData?.map((point) => ({
      month: String(point.month ?? ""),
      actual: 0,
      planned: 0,
    })).filter((point) => point.month) || [];

  return {
    actual: value,
    planned: value,
    subProjects: generateSubProjects(phaseKey, value, value, division, district, tehsil),
    timeline: timeline.length > 0 ? timeline : undefined,
  };
};

// ---- API helpers (file-level, no component dependencies) ----

/** Calculate overall financial progress % from a list of projects */
export const calcOverallProgress = (projects: Project[]): number => {
  const num = (v: unknown): number => {
    if (v === null || v === undefined) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const clampPct = (n: number) => Math.max(0, Math.min(100, n));

  const allocated = projects.reduce(
    (acc, p) => acc + num((p as any)?.total_budget_allocated),
    0,
  );
  const utilized = projects.reduce(
    (acc, p) => acc + num((p as any)?.budget_utilized),
    0,
  );
  return allocated > 0 ? clampPct((utilized / allocated) * 100) : 0;
};

/** Build CityInstallationData from an overall financial progress number (API-only; no synthetic phase or timeline data). */
export const generateCityDataFromOverall = (
  overall: number,
  _division?: string,
  _district?: string,
  _tehsil?: string,
): CityInstallationData => {
  const value = Math.min(100, Math.max(0, overall));
  return {
    surveys: value,
    foundations: value,
    cabinet: value,
    cable: value,
    controlRoom: value,
    ppic3: value,
    overall: value,
    timeline: undefined,
  };
};

// Color palette for cards
export const CARD_COLORS = [
  "green",
  "blue",
  "orange",
  "purple",
  "indigo",
  "teal",
  "pink",
  "cyan",
  "amber",
  "red",
];

export type ProgressRangeMeta = {
  label:
  | "Low Progress"
  | "Moderate Progress"
  | "Good Progress"
  | "High Progress"
  | "Fully Completed";
  color: string; // hex
  min: number;
  max: number;
};

export const getProgressRangeMeta = (overall: number): ProgressRangeMeta => {
  if (overall >= 100)
    return { label: "Fully Completed", color: "#10b981", min: 100, max: 100 }; // emerald
  if (overall >= 75)
    return { label: "High Progress", color: "#22c55e", min: 75, max: 100 }; // green
  if (overall >= 50)
    return { label: "Good Progress", color: "#3b82f6", min: 50, max: 75 }; // blue
  if (overall >= 25)
    return { label: "Moderate Progress", color: "#f59e0b", min: 25, max: 50 }; // amber
  return { label: "Low Progress", color: "#ef4444", min: 0, max: 25 }; // red
};
