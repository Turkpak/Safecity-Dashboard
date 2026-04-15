import { Layout } from "@/components/layout/Layout";
import { InstallationCard } from "@/components/dashboard/InstallationCard";
import { InstallationMap } from "@/components/dashboard/InstallationMap";
import { PhaseDistributionChart } from "@/components/dashboard/PhaseDistributionChart";
import { PhaseTimelineChart } from "@/components/dashboard/PhaseTimelineChart";
import { PlannedVsActualChart } from "@/components/dashboard/PlannedVsActualChart";
import { HierarchyCard } from "@/components/dashboard/HierarchyCard";
import { SubProject } from "@/components/dashboard/SubProjectCard";
import { MilestoneDetailsPanel } from "@/components/dashboard/MilestoneDetailsPanel";
import { exportDashboardToPPTX } from "@/utils/exportToPPTX";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  Label as RechartsLabel,
} from "recharts";
import { useWindowSize } from "@/hooks/use-window-size";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import {
  getProjectGanttAll,
  getProjectGanttData,
  listDivisions,
  listDistricts,
  listTehsils,
} from "@/api";
import type { Division, District, Tehsil, Project } from "@/api/types";
import {
  ClipboardCheck,
  Building2,
  Camera,
  Zap,
  Home,
  Radio,
  TrendingUp,
  FileDown,
  Filter,
  ChevronDown,
  ChevronUp,
  Search,
  DollarSign,
  FolderKanban,
  Info,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listProjects, getProjectById } from "@/api/project";
import { useSidebar } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";

// Enhanced installation progress data with sub-projects and planned vs actual
interface PhaseProgress {
  actual: number;
  planned: number;
  subProjects?: SubProject[];
  timeline?: {
    month: string;
    actual: number;
    planned: number;
  }[];
}

interface CityInstallationData {
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

type PhaseKey =
  | "surveys"
  | "foundations"
  | "cabinet"
  | "cable"
  | "controlRoom"
  | "ppic3";

type ProjectGanttTask = Awaited<ReturnType<typeof getProjectGanttData>>[number];

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function safeParseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildMonthLabelsBetween(minDate: Date, maxDate: Date): string[] {
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

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function diffDaysInclusive(start: string | null | undefined, end: string | null | undefined): number {
  const s = safeParseDate(start ?? null);
  const e = safeParseDate(end ?? null);
  if (!s || !e) return 1;
  const ms = e.getTime() - s.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, days);
}

function buildPhaseFromProjectGantt(
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
const getProgressValue = (progress: number | PhaseProgress): number => {
  const clampPct = (n: number) => Math.max(0, Math.min(100, n));
  if (typeof progress === "number") return clampPct(Number(progress) || 0);
  return clampPct(Number(progress.actual) || 0);
};

// Helper function to check if progress has detailed data
const hasDetailedProgress = (
  progress: number | PhaseProgress,
): progress is PhaseProgress => {
  return typeof progress !== "number";
};

// Generate sub-projects for a phase
const generateSubProjects = (
  phaseKey: string,
  actualProgress: number,
  plannedProgress: number,
  division?: string,
  district?: string,
  tehsil?: string,
): SubProject[] => {
  // Backend progress logic not implemented yet — show 0% everywhere (no synthetic subprojects).
  return [];
  const subProjectTemplates: Record<
    string,
    { names: string[]; weights: number[] }
  > = {
    surveys: {
      names: [
        "Site Survey & Assessment",
        "Technical Feasibility Study",
        "Site Selection & Approval",
        "Environmental Clearance",
      ],
      weights: [0.3, 0.25, 0.25, 0.2],
    },
    foundations: {
      names: [
        "Excavation Work",
        "Foundation Pouring",
        "Curing & Quality Check",
        "Backfilling & Compaction",
      ],
      weights: [0.25, 0.35, 0.2, 0.2],
    },
    cabinet: {
      names: [
        "Cabinet Installation",
        "Electrical Connections",
        "Network Setup",
        "Equipment Mounting",
      ],
      weights: [0.3, 0.25, 0.25, 0.2],
    },
    cable: {
      names: [
        "Cable Trenching",
        "Fiber Optic Laying",
        "Power Cable Installation",
        "Cable Termination & Testing",
      ],
      weights: [0.25, 0.3, 0.25, 0.2],
    },
    controlRoom: {
      names: [
        "Room Renovation",
        "Server Installation",
        "Display Systems",
        "Control Systems Integration",
      ],
      weights: [0.25, 0.3, 0.25, 0.2],
    },
    ppic3: {
      names: [
        "System Integration",
        "Software Deployment",
        "Testing & Commissioning",
        "Go-Live Preparation",
      ],
      weights: [0.3, 0.25, 0.25, 0.2],
    },
  };

  const template = subProjectTemplates[phaseKey] || {
    names: ["Sub-Project 1", "Sub-Project 2", "Sub-Project 3"],
    weights: [0.33, 0.33, 0.34],
  };

  // Generate sub-projects with variance based on parent progress (only for non-Bahawalpur)
  const variance = actualProgress - plannedProgress;

  return template.names.map((name, index) => {
    const weight = template.weights[index];
    const baseActual = actualProgress * (0.8 + Math.random() * 0.4); // Vary around parent
    const basePlanned = plannedProgress * (0.8 + Math.random() * 0.4);

    return {
      id: `${phaseKey}-${index}`,
      name,
      actualProgress: Math.min(100, Math.max(0, baseActual)),
      plannedProgress: Math.min(100, Math.max(0, basePlanned)),
      weight,
    };
  });
};

// Helper to convert legacy data to new format
const convertToPhaseProgress = (
  currentValue: number,
  phaseKey: string,
  timelineData?: { month: string; [key: string]: number | string }[],
  division?: string,
  district?: string,
  tehsil?: string,
): PhaseProgress => {
  // Backend progress logic not implemented yet — keep everything at 0%.
  const plannedProgress = 0;

  // Generate timeline if not provided
  const timeline =
    timelineData?.map((point) => {
      const actual = 0;
      const planned = 0;
      return {
        month: point.month as string,
        actual,
        planned,
      };
    }) || [];

  return {
    actual: 0,
    planned: plannedProgress,
    subProjects: generateSubProjects(
      phaseKey,
      0,
      plannedProgress,
      division,
      district,
      tehsil,
    ),
    timeline: timeline.length > 0 ? timeline : undefined,
  };
};

// ---- API helpers (file-level, no component dependencies) ----

/** Calculate overall financial progress % from a list of projects */
const calcOverallProgress = (projects: Project[]): number => {
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
const generateCityDataFromOverall = (
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
const CARD_COLORS = [
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

type ProgressRangeMeta = {
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

const getProgressRangeMeta = (overall: number): ProgressRangeMeta => {
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

export default function Dashboard() {
  const { isCollapsed, setCollapsed } = useSidebar();
  const sidebarPrevCollapsedRef = useRef<boolean | null>(null);
  const [location, setLocation] = useLocation();
  const [viewType, setViewType] = useState<
    "divisions" | "districts" | "tehsils" | "projects" | ""
  >("divisions");
  const [selectedItemName, setSelectedItemName] = useState<string | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<
    "division" | "district" | "tehsil" | null
  >(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [expandedDivisions, setExpandedDivisions] = useState(false);
  const [expandedDistricts, setExpandedDistricts] = useState(false);
  const [expandedTehsilGroups, setExpandedTehsilGroups] = useState<
    Record<string, boolean>
  >({});
  const [tehsilSearchQuery, setTehsilSearchQuery] = useState("");
  const [allTehsilGroupsExpanded, setAllTehsilGroupsExpanded] = useState(false);
  const [isFilterBarExpanded, setIsFilterBarExpanded] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [progressLegendOpen, setProgressLegendOpen] = useState(false);
  const [selectedMilestoneKey, setSelectedMilestoneKey] =
    useState<PhaseKey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [progressType, setProgressType] = useState<"physical" | "financial">(
    "physical",
  );
  // track project selection within tehsil view for KPI/Gantt
  const [selectedProjectForDetails, setSelectedProjectForDetails] = useState<Project | null>(null);
  const [selectedProjectGanttTasks, setSelectedProjectGanttTasks] = useState<ProjectGanttTask[]>([]);
  const selectedProjectPhase = useMemo(
    () =>
      buildPhaseFromProjectGantt(selectedProjectGanttTasks, {
        subtreeRootName: selectedItemType === "tehsil" ? selectedItemName : null,
      }),
    [selectedProjectGanttTasks, selectedItemType, selectedItemName],
  );

  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;

  // Parent-tracking state for drill-down navigation
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [parentDivisionId, setParentDivisionId] = useState<number | null>(null);
  const [parentDivisionName, setParentDivisionName] = useState<string | null>(
    null,
  );
  const [parentDistrictId, setParentDistrictId] = useState<number | null>(null);
  const [parentDistrictName, setParentDistrictName] = useState<string | null>(
    null,
  );
  const skipNextUrlSyncRef = useRef(false);

  // API queries
  const { data: apiDivisions = [] } = useQuery({
    queryKey: ["divisions"],
    queryFn: () => listDivisions(),
  });
  const { data: apiDistricts = [] } = useQuery({
    queryKey: ["districts"],
    queryFn: () => listDistricts(),
  });
  const { data: apiTehsils = [] } = useQuery({
    queryKey: ["tehsils"],
    queryFn: () => listTehsils(),
  });
  const { data: apiProjects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
  });

  // Fetch all gantt schedules once and use root task progress for each project card.
  const { data: apiProjectGanttAll = [] } = useQuery({
    queryKey: ["project-gantt-all"],
    queryFn: () => getProjectGanttAll(),
  });

  const ganttProgressByProjectId = useMemo(() => {
    const findNodeById = (
      nodes: any[],
      targetId: string,
    ): { progress?: number } | null => {
      for (const n of nodes) {
        if (String(n?._id ?? n?.id ?? "") === targetId) return n;
        const children: any[] = Array.isArray(n?.subtasks) ? n.subtasks : [];
        const hit = children.length ? findNodeById(children, targetId) : null;
        if (hit) return hit;
      }
      return null;
    };

    const clampPct = (n: number) => Math.max(0, Math.min(100, n));
    const toPct = (v: unknown): number => {
      const n = Number(v);
      return Number.isFinite(n) ? clampPct(n) : 0;
    };

    const map = new Map<number, number>();
    for (const s of apiProjectGanttAll as any[]) {
      const pid = Number(s?._id);
      if (!Number.isFinite(pid)) continue;
      const tasks: any[] = Array.isArray(s?.tasks) ? s.tasks : [];
      const root = findNodeById(tasks, "1") ?? tasks[0] ?? null;
      map.set(pid, toPct(root?.progress));
    }
    return map;
  }, [apiProjectGanttAll]);

  // All Projects overall % (average of root task `_id:"1"` progress across projects)
  const allProjectsOverallFromGantt = useMemo(() => {
    if (apiProjects.length === 0) return 0;
    let sum = 0;
    let count = 0;
    for (const p of apiProjects) {
      const v = ganttProgressByProjectId.get(p.id);
      if (v === undefined) continue;
      sum += v;
      count++;
    }
    return count > 0 ? sum / count : 0;
  }, [apiProjects, ganttProgressByProjectId]);

  const toSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

  // Hydrate dashboard hierarchy state from clean URL query params (slug-based, no IDs).
  useEffect(() => {
    if (apiDivisions.length === 0 || apiDistricts.length === 0 || apiTehsils.length === 0) return;

    const urlParams = new URLSearchParams(window.location.search);
    const level = urlParams.get("level");
    const viewParam = urlParams.get("view");
    if (viewParam === "divisions" || viewParam === "districts" || viewParam === "tehsils" || viewParam === "projects") {
      setViewType(viewParam);
    }

    const divisionSlug = urlParams.get("division");
    const districtSlug = urlParams.get("district");
    const tehsilSlug = urlParams.get("tehsil");

    if (level === "tehsil" && tehsilSlug) {
      const foundTehsil = apiTehsils.find((t) => {
        if (toSlug(t.tehsil_name) !== tehsilSlug) return false;
        if (districtSlug && toSlug(t.district_name) !== districtSlug) return false;
        if (divisionSlug && toSlug(t.division_name) !== divisionSlug) return false;
        return true;
      });
      if (foundTehsil) {
        skipNextUrlSyncRef.current = true;
        setSelectedItemType("tehsil");
        setSelectedItemId(foundTehsil.id);
        setSelectedItemName(foundTehsil.tehsil_name);
        setParentDistrictId(foundTehsil.district);
        setParentDistrictName(foundTehsil.district_name);
        setParentDivisionId(foundTehsil.division);
        setParentDivisionName(foundTehsil.division_name);
      }
      return;
    }

    if (level === "district" && districtSlug) {
      const foundDistrict = apiDistricts.find((d) => {
        if (toSlug(d.district_name) !== districtSlug) return false;
        if (divisionSlug && toSlug(d.division_name) !== divisionSlug) return false;
        return true;
      });
      if (foundDistrict) {
        skipNextUrlSyncRef.current = true;
        setSelectedItemType("district");
        setSelectedItemId(foundDistrict.id);
        setSelectedItemName(foundDistrict.district_name);
        setParentDivisionId(foundDistrict.division);
        setParentDivisionName(foundDistrict.division_name);
        setParentDistrictId(null);
        setParentDistrictName(null);
      }
      return;
    }

    if (level === "division" && divisionSlug) {
      const foundDivision = apiDivisions.find((d) => toSlug(d.division_name) === divisionSlug);
      if (foundDivision) {
        skipNextUrlSyncRef.current = true;
        setSelectedItemType("division");
        setSelectedItemId(foundDivision.id);
        setSelectedItemName(foundDivision.division_name);
        setParentDivisionId(null);
        setParentDivisionName(null);
        setParentDistrictId(null);
        setParentDistrictName(null);
      }
      return;
    }

    // Backward compatibility with old ?tehsil=<name> link format.
    const tehsilParam = urlParams.get("tehsil");
    if (tehsilParam) {
      const found = apiTehsils.find(
        (t) => t.tehsil_name.toLowerCase() === decodeURIComponent(tehsilParam).toLowerCase(),
      );
      if (found) {
        skipNextUrlSyncRef.current = true;
        setSelectedItemName(found.tehsil_name);
        setSelectedItemType("tehsil");
        setSelectedItemId(found.id);
        setParentDistrictId(found.district);
        setParentDistrictName(found.district_name);
        setParentDivisionId(found.division);
        setParentDivisionName(found.division_name);
      }
    }
  }, [location, apiDivisions, apiDistricts, apiTehsils]);

  // Keep URL in sync with drilldown selection.
  useEffect(() => {
    if (skipNextUrlSyncRef.current) {
      skipNextUrlSyncRef.current = false;
      return;
    }

    const params = new URLSearchParams();
    if (viewType) params.set("view", viewType);

    if (selectedItemType === "division" && selectedItemId && selectedItemName) {
      params.set("level", "division");
      params.set("division", toSlug(selectedItemName));
    } else if (selectedItemType === "district" && selectedItemId && selectedItemName) {
      params.set("level", "district");
      params.set("district", toSlug(selectedItemName));
      if (parentDivisionId && parentDivisionName) {
        params.set("division", toSlug(parentDivisionName));
      }
    } else if (selectedItemType === "tehsil" && selectedItemId && selectedItemName) {
      params.set("level", "tehsil");
      params.set("tehsil", toSlug(selectedItemName));
      if (parentDistrictId && parentDistrictName) {
        params.set("district", toSlug(parentDistrictName));
      }
      if (parentDivisionId && parentDivisionName) {
        params.set("division", toSlug(parentDivisionName));
      }
    }

    const nextUrl = params.toString() ? `/?${params.toString()}` : "/";
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) {
      setLocation(nextUrl);
    }
  }, [
    viewType,
    selectedItemType,
    selectedItemId,
    selectedItemName,
    parentDivisionId,
    parentDivisionName,
    parentDistrictId,
    parentDistrictName,
    setLocation,
  ]);

  // Simulate loading on initial mount and when view type changes
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800); // 800ms loading simulation
    return () => clearTimeout(timer);
  }, [viewType, selectedItemName, selectedItemType]);

  // clear project selection when leaving tehsil view or projects view
  useEffect(() => {
    if (selectedItemType !== "tehsil" && viewType !== "projects") {
      setSelectedProjectForDetails(null);
    }
  }, [selectedItemType, viewType]);

  // Keep filter controls open at top-level, collapse while drilled in.
  useEffect(() => {
    if (selectedItemType) {
      setShowFilters(false);
    } else {
      setShowFilters(true);
    }
  }, [selectedItemType]);

  // Fetch project-gantt data whenever selected project changes (card or dropdown).
  useEffect(() => {
    let ignore = false;

    const run = async () => {
      if (!selectedProjectForDetails?.id) {
        setSelectedProjectGanttTasks([]);
        return;
      }
      try {
        const data = await getProjectGanttData(selectedProjectForDetails.id);
        if (ignore) return;
        setSelectedProjectGanttTasks(Array.isArray(data) ? data : []);
      } catch {
        if (ignore) return;
        setSelectedProjectGanttTasks([]);
      }
    };

    run();
    return () => {
      ignore = true;
    };
  }, [selectedProjectForDetails?.id]);

  /** Refetch nested gantt after delay log POST so `has_delay` / `delay_info` update in the UI. */
  const refetchSelectedProjectGantt = useCallback(async () => {
    const pid = selectedProjectForDetails?.id;
    if (!pid) return;
    try {
      const data = await getProjectGanttData(pid);
      setSelectedProjectGanttTasks(Array.isArray(data) ? data : []);
    } catch {
      setSelectedProjectGanttTasks([]);
    }
  }, [selectedProjectForDetails?.id]);

  // Auto-collapse sidebar while project details (Gantt) are open, and restore prior state on close.
  useEffect(() => {
    const detailsOpen = !!selectedProjectForDetails?.id;
    // Only auto-collapse once on open. Do NOT keep forcing it closed,
    // so the user can expand/collapse via the sidebar icon while Gantt is open.
    if (detailsOpen) {
      if (sidebarPrevCollapsedRef.current == null) {
        sidebarPrevCollapsedRef.current = isCollapsed;
        setCollapsed(true);
      }
      return;
    }
    if (sidebarPrevCollapsedRef.current != null) {
      setCollapsed(sidebarPrevCollapsedRef.current);
      sidebarPrevCollapsedRef.current = null;
    }
  }, [selectedProjectForDetails?.id, isCollapsed, setCollapsed]);

  // Filter options from API data
  const divisions = useMemo(
    () => ["all", ...apiDivisions.map((d) => d.division_name)],
    [apiDivisions],
  );
  const districts = useMemo(
    () => ["all", ...apiDistricts.map((d) => d.district_name)],
    [apiDistricts],
  );
  const tehsils = useMemo(
    () => ["all", ...apiTehsils.map((t) => t.tehsil_name)],
    [apiTehsils],
  );

  type NavigationStep = {
    key: "all" | "division" | "district" | "tehsil";
    label: string;
    clickable: boolean;
  };

  const navigationFlow = useMemo<NavigationStep[]>(() => {
    const flow: NavigationStep[] = [
      {
        key: "all",
        label: "All Divisions",
        clickable: selectedItemType !== null,
      },
    ];

    if (selectedItemType === "division" && selectedItemName) {
      flow.push({
        key: "division",
        label: `${selectedItemName} Division`,
        clickable: false,
      });
    } else if (selectedItemType === "district" && selectedItemName) {
      if (parentDivisionName) {
        flow.push({
          key: "division",
          label: `${parentDivisionName} Division`,
          clickable: true,
        });
      }
      flow.push({
        key: "district",
        label: `${selectedItemName} District`,
        clickable: false,
      });
    } else if (selectedItemType === "tehsil" && selectedItemName) {
      if (parentDivisionName) {
        flow.push({
          key: "division",
          label: `${parentDivisionName} Division`,
          clickable: true,
        });
      }
      if (parentDistrictName) {
        flow.push({
          key: "district",
          label: `${parentDistrictName} District`,
          clickable: true,
        });
      }
      flow.push({
        key: "tehsil",
        label: `${selectedItemName} Tehsil`,
        clickable: false,
      });
    }
    return flow;
  }, [
    selectedItemType,
    selectedItemName,
    parentDivisionId,
    parentDivisionName,
    parentDistrictId,
    parentDistrictName,
  ]);

  const handleNavigateToLevel = (level: NavigationStep["key"]) => {
    if (level === "all") {
      setSelectedItemName(null);
      setSelectedItemType(null);
      setSelectedItemId(null);
      setParentDivisionId(null);
      setParentDivisionName(null);
      setParentDistrictId(null);
      setParentDistrictName(null);
      return;
    }

    if (level === "division" && parentDivisionId && parentDivisionName) {
      setSelectedItemId(parentDivisionId);
      setSelectedItemName(parentDivisionName);
      setSelectedItemType("division");
      return;
    }

    if (level === "district" && parentDistrictId && parentDistrictName) {
      setSelectedItemId(parentDistrictId);
      setSelectedItemName(parentDistrictName);
      setSelectedItemType("district");
    }
  };

  // Helper: calculate overall financial progress from a set of projects
  const calcProjectsOverall = (projects: Project[]): number => {
    const clampPct = (n: number) => Math.max(0, Math.min(100, n));

    // Required source of truth: nested gantt root task `_id:"1"` progress per project.
    let sum = 0;
    let count = 0;
    for (const p of projects) {
      const v = ganttProgressByProjectId.get(p.id);
      if (v === undefined) continue;
      sum += v;
      count++;
    }
    return count > 0 ? clampPct(sum / count) : 0;
  };

  const distributionChart = useMemo(() => {
    if (!selectedItemType || !selectedItemId) return null;

    const avg = (values: number[]): number => {
      if (values.length === 0) return 0;
      const sum = values.reduce((acc, v) => acc + v, 0);
      return sum / values.length;
    };

    const roundPct = (n: number) => Math.max(0, Math.min(100, Number(n.toFixed(2))));

    const tehsilOverall = (tehsilId: number): number => {
      const tehsilProjects = apiProjects.filter((p) => p.tehsil === tehsilId);
      if (tehsilProjects.length === 0) return 0;
      return calcProjectsOverall(tehsilProjects);
    };

    const districtOverallFromTehsils = (districtId: number): number => {
      const distTehsils = apiTehsils.filter((t) => t.district === districtId);
      if (distTehsils.length === 0) return 0;
      const tehsilOveralls = distTehsils.map((t) => tehsilOverall(t.id));
      return avg(tehsilOveralls);
    };

    if (selectedItemType === "division") {
      const divDistricts = apiDistricts.filter((d) => d.division === selectedItemId);
      const rows = divDistricts.map((d) => ({
        phase: d.district_name,
        percentage: roundPct(districtOverallFromTehsils(d.id)),
      }));
      return {
        title: "District Progress Distribution",
        description: "Progress % of all districts within the selected division",
        data: rows.sort((a, b) => b.percentage - a.percentage),
      };
    }

    if (selectedItemType === "district") {
      const distTehsils = apiTehsils.filter((t) => t.district === selectedItemId);
      const rows = distTehsils.map((t) => ({
        phase: t.tehsil_name,
        percentage: roundPct(tehsilOverall(t.id)),
      }));
      return {
        title: "Tehsil Progress Distribution",
        description: "Progress % of all tehsils within the selected district",
        data: rows.sort((a, b) => b.percentage - a.percentage),
      };
    }

    return null;
  }, [
    selectedItemType,
    selectedItemId,
    apiDistricts,
    apiTehsils,
    apiProjects,
    ganttProgressByProjectId,
  ]);

  // Calculate aggregated data from a list of projects
  const getAggregatedDataFromProjects = (
    projects: Project[],
  ): CityInstallationData => {
    const overall = calcProjectsOverall(projects);
    return generateCityDataFromOverall(overall);
  };

  // Get single item data from API projects by ID
  const getSingleItemData = (
    itemId: number | null,
    itemType: "division" | "district" | "tehsil",
  ): CityInstallationData | null => {
    if (!itemId) return null;
    let filtered: Project[];
    if (itemType === "division") {
      filtered = apiProjects.filter((p) => p.division === itemId);
    } else if (itemType === "district") {
      filtered = apiProjects.filter((p) => p.district === itemId);
    } else {
      filtered = apiProjects.filter((p) => p.tehsil === itemId);
    }
    return getAggregatedDataFromProjects(filtered);
  };

  // Get single item data
  const singleItemData = useMemo(() => {
    if (selectedItemId && selectedItemType) {
      return getSingleItemData(selectedItemId, selectedItemType);
    }
    return null;
  }, [selectedItemId, selectedItemType, apiProjects]);

  // Projects in the currently selected geography (division / district / tehsil) for "Best Performing Projects" cards
  const projectsInSelectedGeography = useMemo((): Project[] => {
    if (!selectedItemId || !selectedItemType) return [];
    if (selectedItemType === "division") {
      return apiProjects.filter((p) => p.division === selectedItemId);
    }
    if (selectedItemType === "district") {
      return apiProjects.filter((p) => p.district === selectedItemId);
    }
    return apiProjects.filter((p) => p.tehsil === selectedItemId);
  }, [selectedItemId, selectedItemType, apiProjects]);

  // Get aggregated data based on view type (all projects)
  const aggregatedData = useMemo(() => {
    return getAggregatedDataFromProjects(apiProjects);
  }, [apiProjects]);

  /** Top projects by budget utilization for root "All Punjab *" views (real API data, not duplicate phase placeholders). */
  const topProjectsForAggregateViews = useMemo((): Project[] => {
    if (apiProjects.length === 0) return [];
    return [...apiProjects]
      .map((p) => {
        const total = parseFloat(p.total_budget_allocated || "0") || 0;
        const utilized = parseFloat(p.budget_utilized || "0") || 0;
        const ratio = total > 0 ? utilized / total : 0;
        return { p, ratio };
      })
      .sort((a, b) => b.ratio - a.ratio)
      .map((x) => x.p)
      .slice(0, 6);
  }, [apiProjects]);

  // Overall for All Punjab Divisions (average of division overalls)
  const allDivisionsOverall = useMemo(() => {
    if (apiDivisions.length === 0) return 0;
    let sum = 0;
    let count = 0;
    for (const div of apiDivisions) {
      const projects = apiProjects.filter((p) => p.division === div.id);
      sum += calcProjectsOverall(projects);
      count++;
    }
    return count > 0 ? sum / count : 0;
  }, [apiDivisions, apiProjects]);

  // Overall for All Punjab Districts (average of district overalls)
  const allDistrictsOverall = useMemo(() => {
    if (apiDistricts.length === 0) return 0;
    let sum = 0;
    let count = 0;
    for (const dist of apiDistricts) {
      const projects = apiProjects.filter((p) => p.district === dist.id);
      sum += calcProjectsOverall(projects);
      count++;
    }
    return count > 0 ? sum / count : 0;
  }, [apiDistricts, apiProjects]);

  // Context theme: follow the currently visible/selected area overall %
  const contextOverall = useMemo(() => {
    if (selectedItemName && singleItemData) return singleItemData.overall ?? 0;
    if (viewType === "projects" && !selectedItemName && !selectedItemType)
      return allProjectsOverallFromGantt;
    if (viewType === "tehsils" && !selectedItemName && !selectedItemType)
      return allProjectsOverallFromGantt;
    if (viewType === "divisions" && !selectedItemName && !selectedItemType)
      return allDivisionsOverall;
    if (viewType === "districts" && !selectedItemName && !selectedItemType)
      return allDistrictsOverall;
    return aggregatedData?.overall ?? 0;
  }, [
    selectedItemName,
    singleItemData,
    aggregatedData,
    viewType,
    selectedItemType,
    allProjectsOverallFromGantt,
    allDivisionsOverall,
    allDistrictsOverall,
  ]);

  const contextTheme = useMemo(() => {
    const meta = getProgressRangeMeta(contextOverall);
    return {
      meta,
      // hex with alpha (CSS supports #RRGGBBAA)
      accent: meta.color,
      // stronger tint/border so the theme is clearly visible
      accentSoft: `${meta.color}33`, // ~20% alpha
      accentBorder: `${meta.color}80`, // ~50% alpha
      accentGlow: `${meta.color}4D`, // ~30% alpha (for shadows)
    };
  }, [contextOverall]);

  // Divisions data for cards view (API-driven)
  const divisionsData = useMemo(() => {
    return apiDivisions
      .map((div, index) => {
        const projects = apiProjects.filter((p) => p.division === div.id);
        const overall = calcProjectsOverall(projects);
        return {
          id: div.id,
          name: div.division_name,
          overall,
          data: generateCityDataFromOverall(overall),
          color: CARD_COLORS[index % CARD_COLORS.length],
        };
      })
      .sort((a, b) => b.overall - a.overall);
  }, [apiDivisions, apiProjects]);

  // Districts data for cards view (API-driven)
  const districtsData = useMemo(() => {
    return apiDistricts
      .map((dist, index) => {
        const projects = apiProjects.filter((p) => p.district === dist.id);
        const overall = calcProjectsOverall(projects);
        return {
          id: dist.id,
          name: dist.district_name,
          divisionId: dist.division,
          overall,
          data: generateCityDataFromOverall(overall),
          color: CARD_COLORS[index % CARD_COLORS.length],
        };
      })
      .sort((a, b) => b.overall - a.overall);
  }, [apiDistricts, apiProjects]);


  // Tehsils data grouped by district name (API-driven)
  const tehsilsDataByDistrict = useMemo(() => {
    const result: Record<
      string,
      Array<{
        id: number;
        name: string;
        districtId: number;
        overall: number;
        data: CityInstallationData;
        color: string;
      }>
    > = {};
    apiTehsils.forEach((teh, index) => {
      const districtName = teh.district_name;
      if (!result[districtName]) result[districtName] = [];
      const projects = apiProjects.filter((p) => p.tehsil === teh.id);
      const overall = calcProjectsOverall(projects);
      result[districtName].push({
        id: teh.id,
        name: teh.tehsil_name,
        districtId: teh.district,
        overall,
        data: generateCityDataFromOverall(overall),
        color: CARD_COLORS[index % CARD_COLORS.length],
      });
    });
    // Sort tehsils within each district
    Object.keys(result).forEach((district) => {
      result[district].sort((a, b) => b.overall - a.overall);
    });
    return result;
  }, [apiTehsils, apiProjects]);

  // Skeleton loader component
  const renderSkeletonLoader = () => (
    <div className="space-y-6">
      {/* Installation Phase Cards Skeleton */}
      <div className="w-full">
        <div className="mb-3">
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-5 w-24 mb-3" />
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-2 w-full rounded-full" />
            </Card>
          ))}
        </div>
      </div>

      {/* Overall Progress Card Skeleton */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-3">
              <Skeleton className="h-14 w-14 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          </div>
          <div className="text-center md:text-right">
            <Skeleton className="h-16 w-24 mb-2" />
            <Skeleton className="h-8 w-32 rounded-full" />
          </div>
        </div>
        <div className="mt-6">
          <Skeleton className="h-5 w-full rounded-full mb-3" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-8" />
          </div>
        </div>
      </Card>

      {/* Pie Charts Skeleton */}
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64 mb-6" />
            <Skeleton className="h-80 w-full rounded-lg" />
          </Card>
        ))}
      </div>

      {/* Phase Distribution Chart Skeleton (drilldown only) */}
      {selectedItemName && selectedItemType ? (
        <Card className="p-6">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-64 mb-6" />
          <Skeleton className="h-80 w-full rounded-lg" />
        </Card>
      ) : null}
    </div>
  );

  // Convert physical progress to financial progress
  const convertToFinancialProgress = (
    physicalPhase: PhaseProgress,
  ): PhaseProgress => {
    const financialMultiplier = 0.92; // Financial is typically 92% of physical
    const varianceAdjustment = 0.85; // Financial variance is typically 85% of physical variance

    const financialActual = Math.min(
      100,
      physicalPhase.actual * financialMultiplier,
    );
    const variance = physicalPhase.actual - physicalPhase.planned;
    const financialVariance = variance * varianceAdjustment;
    const financialPlanned = financialActual - financialVariance;

    // Convert sub-projects to financial
    const financialSubProjects: SubProject[] = (
      physicalPhase.subProjects || []
    ).map((sub) => {
      const subFinancialActual = Math.min(
        100,
        sub.actualProgress * financialMultiplier,
      );
      const subVariance = sub.actualProgress - sub.plannedProgress;
      const subFinancialVariance = subVariance * varianceAdjustment;
      const subFinancialPlanned = subFinancialActual - subFinancialVariance;

      return {
        ...sub,
        name: sub.name.replace(
          /(Survey|Assessment|Collection|Measurements|Study|Documentation|Feasibility|Installation|Laying|Renovations|Go Live)/g,
          "$1 Budget",
        ),
        actualProgress: subFinancialActual,
        plannedProgress: Math.max(0, subFinancialPlanned),
      };
    });

    // Convert timeline to financial
    const financialTimeline = (physicalPhase.timeline || []).map((t) => ({
      month: t.month,
      actual: Math.min(100, t.actual * financialMultiplier),
      planned: Math.min(100, t.planned * financialMultiplier),
    }));

    return {
      actual: financialActual,
      planned: Math.max(0, financialPlanned),
      subProjects: financialSubProjects,
      timeline: financialTimeline,
    };
  };

  // Valid InstallationCard colors for project cards
  const PROJECT_CARD_COLORS: Array<
    "blue" | "green" | "orange" | "purple" | "red" | "yellow"
  > = ["blue", "green", "orange", "purple", "red", "yellow"];

  // Only show this section on the main (no-filter) All Divisions view.
  const showBestPerformingSection =
    viewType === "divisions" && !selectedItemType && !selectedItemName;

  // Render aggregated charts function
  const renderAggregatedCharts = (
    title: string,
    data: CityInstallationData,
    projectsInGeography?: Project[],
    /** When false (division/district drill-down), project cards are display-only — no Gantt fetch. */
    projectCardsInteractive: boolean = true,
  ) => {
    const isAggregatedView = title.startsWith("All Punjab");
    const useProjectCards =
      Array.isArray(projectsInGeography) && projectsInGeography.length > 0;
    const scopeProjects: Project[] =
      Array.isArray(projectsInGeography) && projectsInGeography.length > 0
        ? projectsInGeography
        : apiProjects;

    const clamp01 = (n: number) => Math.max(0, Math.min(100, n));
    const num = (v: unknown): number => {
      if (v === null || v === undefined) return 0;
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const getActivityProgress = (a: any): number =>
      clamp01(num(a?.progress ?? a?.percent_complete ?? 0));

    // Financial utilization % (All divisions / scoped)
    const sumBudgetAllocated = scopeProjects.reduce(
      (acc, p) => acc + num((p as any)?.total_budget_allocated),
      0,
    );
    const sumBudgetUtilized = scopeProjects.reduce(
      (acc, p) => acc + num((p as any)?.budget_utilized),
      0,
    );
    const utilizationPct =
      sumBudgetAllocated > 0 ? clamp01((sumBudgetUtilized / sumBudgetAllocated) * 100) : 0;

    // Physical progress %: average of activity progresses (project-level avg, then avg across projects)
    const physicalPct = (() => {
      if (!scopeProjects.length) return 0;
      let sum = 0;
      for (const p of scopeProjects) {
        const acts: any[] = Array.isArray((p as any)?.activities) ? (p as any).activities : [];
        if (acts.length === 0) {
          sum += 0;
          continue;
        }
        const projAvg =
          acts.reduce((acc, a) => acc + getActivityProgress(a), 0) / Math.max(1, acts.length);
        sum += projAvg;
      }
      return clamp01(sum / Math.max(1, scopeProjects.length));
    })();

    // Calculate overall planned and actual from all phases
    let totalPlanned = 0;
    let totalActual = 0;
    let phaseCount = 0;

    installationPhases.forEach((phase) => {
      const progress = data[phase.key];
      if (hasDetailedProgress(progress)) {
        totalPlanned += progress.planned;
        totalActual += progress.actual;
        phaseCount++;
      } else {
        // If no detailed progress, use the number value as both planned and actual
        const value = getProgressValue(progress);
        totalPlanned += value;
        totalActual += value;
        phaseCount++;
      }
    });

    const avgPlanned = phaseCount > 0 ? totalPlanned / phaseCount : 0;
    const avgActual = phaseCount > 0 ? totalActual / phaseCount : 0;
    const variance = avgActual - avgPlanned;
    const absVariance = Math.abs(variance);

    // Financial donut (percent-based): planned=100, actual=util%, variance=remaining to 100
    const financialPlanned = 100;
    const financialActual = utilizationPct;
    const absFinancialVariance = Math.max(0, 100 - financialActual);

    // Overall progress donut (physical, percent-based)
    const overallPlannedPct = 100;
    const overallActualPct = physicalPct;
    const overallVariancePct = Math.max(0, 100 - overallActualPct);
    const overallMax = Math.max(overallPlannedPct, overallActualPct);
    const overallTotalForPie = overallMax + overallVariancePct;
    const normalizedOverallPlanned =
      overallTotalForPie > 0 ? (overallPlannedPct / overallTotalForPie) * 100 : 0;
    const normalizedOverallActual =
      overallTotalForPie > 0 ? (overallActualPct / overallTotalForPie) * 100 : 0;
    const normalizedOverallVariance =
      overallTotalForPie > 0 ? (overallVariancePct / overallTotalForPie) * 100 : 0;

    // Calculate totals for pie chart normalization (installation progress)
    const maxValue = Math.max(avgPlanned, avgActual);
    const totalForPie = maxValue + absVariance;

    // Normalize values for installation progress pie chart
    const normalizedPlanned =
      totalForPie > 0 ? (avgPlanned / totalForPie) * 100 : 0;
    const normalizedActual =
      totalForPie > 0 ? (avgActual / totalForPie) * 100 : 0;
    const normalizedVariance =
      totalForPie > 0 ? (absVariance / totalForPie) * 100 : 0;

    // Calculate totals for financial pie chart normalization
    const maxFinancialValue = Math.max(financialPlanned, financialActual);
    const totalForFinancialPie = maxFinancialValue + absFinancialVariance;

    // Normalize values for financial progress pie chart
    const normalizedFinancialPlanned =
      totalForFinancialPie > 0
        ? (financialPlanned / totalForFinancialPie) * 100
        : 0;
    const normalizedFinancialActual =
      totalForFinancialPie > 0
        ? (financialActual / totalForFinancialPie) * 100
        : 0;
    const normalizedFinancialVariance =
      totalForFinancialPie > 0
        ? (absFinancialVariance / totalForFinancialPie) * 100
        : 0;

    const isSelectedProjectInThisScope =
      projectCardsInteractive &&
      useProjectCards &&
      !!selectedProjectForDetails &&
      projectsInGeography!.some((p) => p.id === selectedProjectForDetails.id);

    // Selected milestone (if any) for this current view
    const selectedPhaseMeta = selectedMilestoneKey
      ? installationPhases.find((p) => p.key === selectedMilestoneKey)
      : null;
    const selectedProgress = selectedMilestoneKey
      ? data[selectedMilestoneKey]
      : null;

    const colorMap: Record<string, string> = {
      blue: "#3b82f6",
      green: "#10b981",
      orange: "#f59e0b",
      purple: "#a855f7",
      red: "#ef4444",
      yellow: "#eab308",
    };

    return (
      <>
        {/* Best Performing Projects (hide inside selected division/district/tehsil views) */}
        {showBestPerformingSection && (
          <div className="w-full">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 min-w-0">
            <div className="min-w-0">
              <h2 className="text-xl font-bold font-heading mb-1">
                Best Performing Projects
              </h2>
              
            </div>
            {(selectedMilestoneKey || isSelectedProjectInThisScope) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedMilestoneKey(null);
                  if (useProjectCards && projectCardsInteractive) {
                    setSelectedProjectForDetails(null);
                  }
                }}
                className="h-8 px-3 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-700 border-0 transition-colors whitespace-nowrap flex-shrink-0"
              >
                Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {useProjectCards
              ? projectsInGeography!.map((project, index) => {
                  const percentage = Math.round(
                    ganttProgressByProjectId.get(project.id) ?? 0,
                  );
                  const displayName =
                    project.project_name || `Project ${project.id}`;
                  return (
                    <InstallationCard
                      key={`${title}-project-${project.id}`}
                      title={displayName}
                      percentage={percentage}
                      icon={FolderKanban}
                      color={PROJECT_CARD_COLORS[index % PROJECT_CARD_COLORS.length]}
                      // Don't show planned/actual until backend exists.
                      actualProgress={undefined}
                      plannedProgress={undefined}
                      selected={
                        projectCardsInteractive &&
                        selectedProjectForDetails?.id === project.id
                      }
                      nonInteractive={!projectCardsInteractive}
                      onClick={
                        projectCardsInteractive
                          ? () => {
                              setSelectedMilestoneKey(null);
                              setSelectedProjectForDetails((prev) =>
                                prev?.id === project.id ? null : project,
                              );
                            }
                          : undefined
                      }
                    />
                  );
                })
              : installationPhases.map((phase) => {
                  const progress = data[phase.key];
                  const hasDetails = hasDetailedProgress(progress);
                  const progressValue = hasDetails
                    ? Math.round(progress.actual)
                    : Math.round(getProgressValue(progress));

                  return (
                    <InstallationCard
                      key={`${title}-${phase.key}`}
                      title={phase.title}
                      percentage={progressValue}
                      icon={phase.icon}
                      color={phase.color as unknown as "green"}
                      actualProgress={hasDetails ? progress.actual : undefined}
                      plannedProgress={hasDetails ? progress.planned : undefined}
                      selected={selectedMilestoneKey === phase.key}
                      onClick={() => {
                        setSelectedMilestoneKey((prev) =>
                          prev === phase.key ? null : phase.key,
                        );
                      }}
                    />
                  );
                })}
          </div>

          {/* Selected project details (Gantt / WBS) for Division/District views */}
          {isSelectedProjectInThisScope && (
            <div className="mt-6">
              <MilestoneDetailsPanel
                milestoneTitle={`${selectedProjectForDetails!.project_name || `Project ${selectedProjectForDetails!.id}`} - Project Gantt`}
                phase={selectedProjectPhase}
                phaseColor="#3b82f6"
                flatGanttTasks={selectedProjectGanttTasks as any}
                ganttProjectId={selectedProjectForDetails!.id}
                onProjectGanttRefresh={refetchSelectedProjectGantt}
                onClear={() => setSelectedProjectForDetails(null)}
              />
            </div>
          )}
          </div>
        )}

        {/* Financial Progress Pie Charts (hide when a milestone KPI or a single project is selected) */}
        {!selectedMilestoneKey && !isSelectedProjectInThisScope && (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Financial Progress Donut Chart */}
            <Card className="overflow-hidden border border-border/80 bg-card shadow-lg shadow-primary/5 transition-shadow hover:shadow-xl hover:shadow-primary/10">
              <CardHeader className="py-3 px-4 pb-1">
                <CardTitle className="text-base font-heading">
                  Financial Progress Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div
                  className="relative w-full"
                  style={{
                    height: isMobile ? "200px" : isTablet ? "220px" : "260px",
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart
                      margin={{ top: 2, right: 2, bottom: 32, left: 2 }}
                    >
                      <Pie
                        data={[
                          {
                            name: "Planned",
                            value: normalizedFinancialPlanned,
                            originalValue: financialPlanned,
                            fill: "#60a5fa",
                          },
                          {
                            name: "Actual",
                            value: normalizedFinancialActual,
                            originalValue: financialActual,
                            fill: "#22c55e",
                          },
                          {
                            name: "Variance",
                            value: normalizedFinancialVariance,
                            originalValue: absFinancialVariance,
                            fill: "#ef4444",
                          },
                        ]}
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
                        <RechartsLabel
                          content={({ viewBox }: any) => {
                            const cx = viewBox?.cx ?? 0;
                            const cy = viewBox?.cy ?? 0;
                            const valueText = `${financialActual.toFixed(1)}%`;
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
                        {["#60a5fa", "#22c55e", "#ef4444"].map((fill, index) => (
                          <Cell
                            key={`cell-f-${index}`}
                            fill={fill}
                            stroke="rgba(255,255,255,0.9)"
                            strokeWidth={2}
                          />
                        ))}
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
                          value: number,
                          name: string,
                          props: any,
                        ) => {
                          const originalValue =
                            props.payload?.originalValue ?? value;
                          return [`${originalValue.toFixed(1)}%`, name];
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
                        formatter={(value) => {
                          let itemValue = 0;
                          if (value === "Planned") itemValue = financialPlanned;
                          else if (value === "Actual")
                            itemValue = financialActual;
                          else if (value === "Variance")
                            itemValue = absFinancialVariance;
                          return (
                            <span className="text-muted-foreground font-medium">
                              {value}{" "}
                              <span className="font-semibold text-foreground">
                                {itemValue.toFixed(1)}%
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

            {/* Overall Progress Donut Chart */}
            <Card className="overflow-hidden border border-border/80 bg-card shadow-lg shadow-primary/5 transition-shadow hover:shadow-xl hover:shadow-primary/10">
              <CardHeader className="py-3 px-4 pb-1">
                <CardTitle className="text-base font-heading">
                  Overall Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div
                  className="relative w-full"
                  style={{
                    height: isMobile ? "200px" : isTablet ? "220px" : "260px",
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart
                      margin={{ top: 2, right: 2, bottom: 32, left: 2 }}
                    >
                      <Pie
                        data={[
                          {
                            name: "Planned",
                            value: normalizedOverallPlanned,
                            originalValue: overallPlannedPct,
                            fill: "#60a5fa",
                          },
                          {
                            name: "Actual",
                            value: normalizedOverallActual,
                            originalValue: overallActualPct,
                            fill: "#22c55e",
                          },
                          {
                            name: "Variance",
                            value: normalizedOverallVariance,
                            originalValue: overallVariancePct,
                            fill: "#ef4444",
                          },
                        ]}
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
                        <RechartsLabel
                          content={({ viewBox }: any) => {
                            const cx = viewBox?.cx ?? 0;
                            const cy = viewBox?.cy ?? 0;
                            const valueText = `${overallActualPct.toFixed(1)}%`;
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
                        {["#60a5fa", "#22c55e", "#ef4444"].map((fill, index) => (
                          <Cell
                            key={`cell-o-${index}`}
                            fill={fill}
                            stroke="rgba(255,255,255,0.9)"
                            strokeWidth={2}
                          />
                        ))}
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
                          value: number,
                          name: string,
                          props: any,
                        ) => {
                          const originalValue =
                            props.payload?.originalValue ?? value;
                          return [`${originalValue.toFixed(1)}%`, name];
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
                        formatter={(value) => {
                          let itemValue = 0;
                          if (value === "Planned") itemValue = overallPlannedPct;
                          else if (value === "Actual") itemValue = overallActualPct;
                          else if (value === "Variance") itemValue = overallVariancePct;
                          return (
                            <span className="text-muted-foreground font-medium">
                              {value}{" "}
                              <span className="font-semibold text-foreground">
                                {itemValue.toFixed(1)}%
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
          </div>
        )}

        {/* Milestone details should appear beneath Overall Progress (and replace the old charts when selected) */}
        {selectedMilestoneKey &&
          selectedPhaseMeta &&
          selectedProgress &&
          hasDetailedProgress(selectedProgress) && (
            <div className="space-y-4">
              {/* Header with Toggle - Right side where charts are shown */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 min-w-0">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold font-heading mb-1">
                    {progressType === "financial"
                      ? `${selectedPhaseMeta.title} - Financial Progress`
                      : `${selectedPhaseMeta.title} - Milestone KPIs`}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {progressType === "financial"
                      ? "Financial progress charts and analysis"
                      : "Gantt chart and WBS breakdown"}
                  </p>
                </div>
                {/* Progress Type Toggle - Right side */}
                <div className="flex items-center gap-2 px-3 py-2 sm:px-4 rounded-lg border-2 border-primary/20 bg-background shadow-sm hover:border-primary/40 transition-colors flex-shrink-0 w-full sm:w-auto justify-center sm:justify-start">
                  <TrendingUp
                    className={`h-4 w-4 ${progressType === "physical" ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span
                    className={`text-sm font-semibold ${progressType === "physical" ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    Physical
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setProgressType((prev) =>
                        prev === "physical" ? "financial" : "physical",
                      )
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                      progressType === "financial" ? "bg-primary" : "bg-muted"
                    }`}
                    aria-label="Toggle between Physical and Financial Progress"
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        progressType === "financial"
                          ? "translate-x-6"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                  <DollarSign
                    className={`h-4 w-4 ${progressType === "financial" ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span
                    className={`text-sm font-semibold ${progressType === "financial" ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    Financial
                  </span>
                </div>
              </div>
              <MilestoneDetailsPanel
                milestoneTitle={
                  progressType === "financial"
                    ? `${selectedPhaseMeta.title} - Financial Progress`
                    : selectedPhaseMeta.title
                }
                phase={
                  progressType === "financial"
                    ? convertToFinancialProgress({
                        actual: selectedProgress.actual,
                        planned: selectedProgress.planned,
                        subProjects: selectedProgress.subProjects,
                        timeline: selectedProgress.timeline,
                      })
                    : {
                        actual: selectedProgress.actual,
                        planned: selectedProgress.planned,
                        subProjects: selectedProgress.subProjects,
                        timeline: selectedProgress.timeline,
                      }
                }
                phaseColor={colorMap[selectedPhaseMeta.color] || "#6b7280"}
                onClear={() => setSelectedMilestoneKey(null)}
              />
            </div>
          )}

        {/* Charts Grid (drilldown only; hide in All Divisions/Districts/Tehsils views and when a single project is selected) */}
        {!selectedMilestoneKey && !isAggregatedView && !isSelectedProjectInThisScope && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold font-heading mb-1">
                Analytics & Insights
              </h2>
              <p className="text-sm text-muted-foreground">
                Detailed progress analysis for {title}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-12">
              {/* (Removed) Installation Progress Timeline + Phase Breakdown charts */}
            </div>

            {/* Phase Distribution Pie Chart */}
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="lg:col-span-12">
                <PhaseDistributionChart
                  title={distributionChart?.title}
                  description={distributionChart?.description}
                  data={
                    distributionChart?.data ??
                    installationPhases.map((phase) => ({
                      phase: phase.title,
                      percentage: getProgressValue(data[phase.key]),
                    }))
                  }
                />
              </div>
            </div>

            {/* Planned vs Actual Charts for Each Phase - Only show when specific item is selected (not aggregated view) */}
            {title.startsWith("All Punjab") ? null : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold font-heading mb-2">
                    Planned vs Actual Progress
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Compare actual progress against planned milestones for each
                    project phase
                  </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {installationPhases.map((phase) => {
                    const progress = data[phase.key];
                    if (!hasDetailedProgress(progress) || !progress.timeline)
                      return null;

                    const colorMap: Record<string, string> = {
                      blue: "#3b82f6",
                      green: "#10b981",
                      orange: "#f59e0b",
                      purple: "#a855f7",
                      red: "#ef4444",
                      yellow: "#eab308",
                    };

                    return (
                      <PlannedVsActualChart
                        key={`planned-actual-${phase.key}`}
                        phaseName={phase.title}
                        timelineData={progress.timeline}
                        color={colorMap[phase.color] || "#6b7280"}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Phase Timeline Chart */}
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="lg:col-span-12">
                <PhaseTimelineChart
                  timelineData={data.timeline}
                  cityKey={title}
                />
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const installationPhases = [
    {
      key: "surveys" as const,
      title: "Surveys",
      icon: ClipboardCheck,
      color: "blue" as const,
    },
    {
      key: "foundations" as const,
      title: "Foundations Pole Installations",
      icon: Building2,
      color: "emerald" as const,
    },
    {
      key: "cabinet" as const,
      title: "Cabinet Cameras Installation",
      icon: Camera,
      color: "orange" as const,
    },
    {
      key: "cable" as const,
      title: "Cable Laying & Power Connections",
      icon: Zap,
      color: "purple" as const,
    },
    {
      key: "controlRoom" as const,
      title: "Control Room Renovations",
      icon: Home,
      color: "red" as const,
    },
    {
      key: "ppic3" as const,
      title: "PPIC3 Go Live",
      icon: Radio,
      color: "indigo" as const,
    },
  ];

  return (
    <Layout title="PSCA Progress Dashboard">
      <div
        className="flex flex-col gap-4"
        style={{
          // Page-level theme variables (used by chart cards, headers, etc.)
          ["--progress-accent" as any]: contextTheme.accent,
          ["--progress-accent-soft" as any]: contextTheme.accentSoft,
          ["--progress-accent-border" as any]: contextTheme.accentBorder,
          ["--progress-accent-glow" as any]: contextTheme.accentGlow,
        }}
      >
        {/* Top Header Section - Enhanced Design with Filter Bar */}
        <div
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border shadow-lg flex flex-col"
          style={{
            borderColor: "var(--progress-accent-border)",
            boxShadow: `0 16px 40px var(--progress-accent-glow)`,
          }}
        >
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]"></div>
          {/* soft tint overlay so the page feels \"on track\" based on context */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: [
                // stronger radial tint
                `radial-gradient(900px circle at 18% 22%, var(--progress-accent-soft), transparent 55%)`,
                // subtle top-to-bottom wash
                `linear-gradient(180deg, var(--progress-accent-soft), transparent 55%)`,
              ].join(", "),
            }}
          />

          {/* Filter Bar Section - Radio Buttons */}
          <div
            className={`relative transition-all duration-300 order-2 md:order-1 ${
              isFilterBarExpanded
                ? "border-b border-border/30 pb-3 px-3 sm:px-6 pt-3 sm:pt-4"
                : "pb-2 px-3 sm:px-4 pt-2 sm:pt-3"
            }`}
          >
            <div className="flex items-start justify-between gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0 overflow-hidden">
                {/* Filters Label / Toggle */}
                <div
                  className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter
                    className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary transition-transform duration-300 ${showFilters ? "rotate-180" : ""}`}
                  />
                  <span className="text-xs sm:text-sm font-semibold text-foreground">
                    {showFilters ? "View:" : navigationFlow.length > 1 ? "Path:" : "View:"}
                  </span>
                </div>

                {/* Radio Button Group with Animation */}
                <AnimatePresence>
                  {showFilters && (
                    <motion.div
                      initial={{ width: 0, opacity: 0, x: -20 }}
                      animate={{ width: "auto", opacity: 1, x: 0 }}
                      exit={{ width: 0, opacity: 0, x: -20 }}
                      transition={{ duration: 0.4, ease: "circOut" }}
                      className="overflow-hidden flex items-center min-w-0 w-full pb-1"
                    >
                      <RadioGroup
                        value={viewType}
                        onValueChange={(value) => {
                          setViewType(
                            value as "divisions" | "districts" | "tehsils" | "projects" | "",
                          );
                          setSelectedItemName(null);
                          setSelectedItemType(null);
                          setExpandedDivisions(false);
                          setExpandedDistricts(false);
                          // Initialize default districts (Lahore and Sheikhupura) when switching to tehsils view
                          if (value === "tehsils") {
                            const DEFAULT_DISTRICTS = ["Lahore", "Sheikhupura"];
                            const defaultState: Record<string, boolean> = {};
                            DEFAULT_DISTRICTS.forEach((districtName) => {
                              defaultState[districtName] = true;
                            });
                            setExpandedTehsilGroups(defaultState);
                            setAllTehsilGroupsExpanded(false);
                          } else {
                            setExpandedTehsilGroups({});
                            setAllTehsilGroupsExpanded(false);
                          }
                          setTehsilSearchQuery("");
                        }}
                        className="grid grid-cols-2 gap-2 pl-1 sm:pl-2 sm:flex sm:items-center sm:gap-4 md:gap-6 sm:whitespace-nowrap"
                      >
                        <div className="flex items-center space-x-1.5 sm:space-x-2 rounded-md bg-background/40 px-2 py-1">
                          <RadioGroupItem
                            value="divisions"
                            id="divisions"
                            className="h-4 w-4 sm:h-5 sm:w-5"
                          />
                          <Label
                            htmlFor="divisions"
                            className="text-xs sm:text-sm font-medium text-foreground cursor-pointer"
                          >
                            <span className="hidden sm:inline">
                              All Divisions
                            </span>
                            <span className="sm:hidden">Divisions</span>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-1.5 sm:space-x-2 rounded-md bg-background/40 px-2 py-1">
                          <RadioGroupItem
                            value="districts"
                            id="districts"
                            className="h-4 w-4 sm:h-5 sm:w-5"
                          />
                          <Label
                            htmlFor="districts"
                            className="text-xs sm:text-sm font-medium text-foreground cursor-pointer"
                          >
                            <span className="hidden sm:inline">
                              All Districts
                            </span>
                            <span className="sm:hidden">Districts</span>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-1.5 sm:space-x-2 rounded-md bg-background/40 px-2 py-1">
                          <RadioGroupItem
                            value="tehsils"
                            id="tehsils"
                            className="h-4 w-4 sm:h-5 sm:w-5"
                          />
                          <Label
                            htmlFor="tehsils"
                            className="text-xs sm:text-sm font-medium text-foreground cursor-pointer"
                          >
                            <span className="hidden sm:inline">
                              All Tehsils
                            </span>
                            <span className="sm:hidden">Tehsils</span>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-1.5 sm:space-x-2 rounded-md bg-background/40 px-2 py-1">
                          <RadioGroupItem
                            value="projects"
                            id="projects"
                            className="h-4 w-4 sm:h-5 sm:w-5"
                          />
                          <Label
                            htmlFor="projects"
                            className="text-xs sm:text-sm font-medium text-foreground cursor-pointer"
                          >
                            <span className="hidden sm:inline">
                              All Projects
                            </span>
                            <span className="sm:hidden">Projects</span>
                          </Label>
                        </div>
                      </RadioGroup>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Compact breadcrumb on same row when filters are collapsed */}
                {!showFilters && navigationFlow.length > 1 && (
                  <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm min-w-0 sm:flex sm:flex-wrap sm:items-center">
                    {navigationFlow.map((step, idx) => (
                      <button
                        key={`${step.key}-compact-${idx}`}
                        type="button"
                        onClick={() =>
                          step.clickable && handleNavigateToLevel(step.key)
                        }
                        disabled={!step.clickable}
                        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors min-w-0 justify-center sm:justify-start ${
                          step.clickable
                            ? "border-[#1e3a8a] bg-[#1e3a8a] text-white hover:bg-[#1d4ed8] cursor-pointer"
                            : "border-[#b91c1c] bg-[#b91c1c] text-white cursor-default"
                        }`}
                      >
                        {idx > 0 && (
                          <span className="text-white/80" aria-hidden>
                            {"->"}
                          </span>
                        )}
                        <span className="truncate">{step.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Expand/Collapse Button */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsFilterBarExpanded(!isFilterBarExpanded)}
                className="rounded-xl w-9 h-9 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all shadow-sm flex-shrink-0"
                title={isFilterBarExpanded ? "Collapse" : "Expand"}
              >
                {isFilterBarExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Drilldown navigation flow (shown in header bar) */}
            {showFilters && navigationFlow.length > 1 && (
              <div className="mt-2 ml-1 sm:ml-2 text-xs sm:text-sm">
                <span className="font-medium text-muted-foreground">
                  Navigation:
                </span>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-0 sm:ml-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
                  {navigationFlow.map((step, idx) => (
                    <button
                      key={`${step.key}-${idx}`}
                      type="button"
                      onClick={() =>
                        step.clickable && handleNavigateToLevel(step.key)
                      }
                      disabled={!step.clickable}
                      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors min-w-0 justify-center sm:justify-start ${
                        step.clickable
                          ? "border-[#1e3a8a] bg-[#1e3a8a] text-white hover:bg-[#1d4ed8] cursor-pointer"
                          : "border-[#b91c1c] bg-[#b91c1c] text-white cursor-default"
                      }`}
                    >
                      {idx > 0 && (
                        <span className="text-white/80" aria-hidden>
                          {"->"}
                        </span>
                      )}
                      <span className="truncate">{step.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Header Content Section - Collapsible */}
          <div
            className={`relative flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 ease-in-out overflow-hidden order-1 md:order-2 ${
              isFilterBarExpanded
                ? "max-h-[500px] opacity-100 px-4 md:px-6 pt-2 pb-4 md:pb-5"
                : "max-h-0 opacity-0 p-0"
            }`}
          >
            <div className="flex-1 min-w-0">
              {(() => {
                const titleText =
                  selectedItemName && selectedItemType === "division"
                    ? `${selectedItemName} Division`
                    : selectedItemName && selectedItemType === "district"
                      ? `${selectedItemName} District`
                      : selectedItemName && selectedItemType === "tehsil"
                        ? `${selectedItemName} Tehsil`
                        : viewType === "divisions"
                          ? "All Punjab Divisions"
                          : viewType === "districts"
                            ? "All Punjab Districts"
                            : viewType === "tehsils"
                              ? "All Punjab Tehsils"
                              : "PSCA Progress Dashboard";

                if (isLoading) {
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <h1 className="text-xl sm:text-3xl md:text-4xl font-bold font-heading bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent truncate sm:whitespace-normal">
                          {titleText}
                        </h1>
                        <Skeleton className="h-7 w-28 rounded-full shrink-0" />
                      </div>
                    </div>
                  );
                }

                if (!((selectedItemName && singleItemData) || aggregatedData)) {
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <h1 className="text-xl sm:text-3xl md:text-4xl font-bold font-heading bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent truncate sm:whitespace-normal">
                          {titleText}
                        </h1>
                      </div>
                    </div>
                  );
                }

                return (() => {
                  const overall =
                    selectedItemName && singleItemData
                      ? singleItemData.overall
                      : viewType === "projects" &&
                          !selectedItemName &&
                          !selectedItemType
                        ? allProjectsOverallFromGantt
                        : viewType === "tehsils" &&
                            !selectedItemName &&
                            !selectedItemType
                          ? allProjectsOverallFromGantt
                          : viewType === "divisions" &&
                              !selectedItemName &&
                              !selectedItemType
                            ? allDivisionsOverall
                          : viewType === "districts" &&
                              !selectedItemName &&
                              !selectedItemType
                            ? allDistrictsOverall
                        : aggregatedData?.overall || 0;
                  const meta = getProgressRangeMeta(overall);
                  const overallLabel =
                    viewType === "projects" && !selectedItemName && !selectedItemType
                      ? `${overall.toFixed(2)}`
                      : viewType === "tehsils" && !selectedItemName && !selectedItemType
                        ? `${overall.toFixed(2)}`
                        : viewType === "divisions" && !selectedItemName && !selectedItemType
                          ? `${overall.toFixed(2)}`
                        : viewType === "districts" && !selectedItemName && !selectedItemType
                          ? `${overall.toFixed(2)}`
                      : `${Math.round(overall)}`;

                  // Map color to Tailwind classes
                  const getBadgeClasses = (color: string) => {
                    if (color === "#ef4444") {
                      // red - Low
                      return "px-3 py-1 text-xs sm:px-4 sm:py-1.5 sm:text-sm font-semibold bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors";
                    } else if (color === "#f59e0b") {
                      // orange/amber - Moderate
                      return "px-3 py-1 text-xs sm:px-4 sm:py-1.5 sm:text-sm font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors";
                    } else if (color === "#3b82f6") {
                      // blue - Good
                      return "px-3 py-1 text-xs sm:px-4 sm:py-1.5 sm:text-sm font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors";
                    } else if (color === "#22c55e" || color === "#10b981") {
                      // green/emerald - High/Fully Completed
                      return "px-3 py-1 text-xs sm:px-4 sm:py-1.5 sm:text-sm font-semibold bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors";
                    }
                    return "px-3 py-1 text-xs sm:px-4 sm:py-1.5 sm:text-sm font-semibold bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors";
                  };

                  const getIconClasses = (color: string) => {
                    if (color === "#ef4444")
                      return "h-3.5 w-3.5 mr-1.5 text-red-600 dark:text-red-400";
                    else if (color === "#f59e0b")
                      return "h-3.5 w-3.5 mr-1.5 text-amber-600 dark:text-amber-400";
                    else if (color === "#3b82f6")
                      return "h-3.5 w-3.5 mr-1.5 text-blue-600 dark:text-blue-400";
                    else if (color === "#22c55e" || color === "#10b981")
                      return "h-3.5 w-3.5 mr-1.5 text-green-600 dark:text-green-400";
                    return "h-3.5 w-3.5 mr-1.5 text-red-600 dark:text-red-400";
                  };

                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold font-heading bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent truncate sm:whitespace-normal">
                          {titleText}
                        </h1>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge
                            className={cn(
                              getBadgeClasses(meta.color),
                              "flex items-center gap-1.5 pr-1",
                            )}
                          >
                            <TrendingUp className={getIconClasses(meta.color)} />
                            <span className="whitespace-nowrap">
                              Overall: {overallLabel}%
                            </span>
                            <button
                              type="button"
                              className={cn(
                                "ml-1 inline-flex h-6 w-6 items-center justify-center rounded-md",
                                "bg-white/60 hover:bg-white/80 dark:bg-white/10 dark:hover:bg-white/15",
                                "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              )}
                              aria-expanded={progressLegendOpen}
                              aria-controls="dashboard-progress-color-legend"
                              aria-label={
                                progressLegendOpen
                                  ? "Hide progress color guide"
                                  : "Show progress color guide"
                              }
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setProgressLegendOpen((open) => !open);
                              }}
                            >
                              <Info
                                className="h-3.5 w-3.5"
                                style={{ color: meta.color }}
                                aria-hidden
                              />
                            </button>
                          </Badge>
                          {/* Mobile: icon-only export button in the same header row */}
                          {((selectedItemName && singleItemData) || aggregatedData) &&
                            viewType && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="sm:hidden h-8 w-8 rounded-lg border-emerald-600/60 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30 shadow-sm"
                                aria-label="Export PPTX"
                                onClick={async () => {
                                  try {
                                    const dataToExport =
                                      selectedItemName && singleItemData
                                        ? singleItemData
                                        : aggregatedData;
                                    const exportName =
                                      selectedItemName &&
                                      selectedItemType === "division"
                                        ? `${selectedItemName} Division`
                                        : selectedItemName &&
                                            selectedItemType === "district"
                                          ? `${selectedItemName} District`
                                          : selectedItemName &&
                                              selectedItemType === "tehsil"
                                            ? `${selectedItemName} Tehsil`
                                            : viewType === "divisions"
                                              ? "All Punjab Divisions"
                                              : viewType === "districts"
                                                ? "All Punjab Districts"
                                                : "All Punjab Tehsils";

                                    if (!dataToExport) {
                                      setShowErrorDialog(true);
                                      return;
                                    }

                                    await exportDashboardToPPTX({
                                      cityName: exportName,
                                      cityData: dataToExport as any,
                                      installationPhases:
                                        installationPhases.map((phase) => ({
                                          key: phase.key,
                                          title: phase.title,
                                          percentage: getProgressValue(
                                            dataToExport[phase.key],
                                          ),
                                        })),
                                    });
                                    setShowSuccessDialog(true);
                                  } catch (error) {
                                    console.error(
                                      "Error exporting to PPTX:",
                                      error,
                                    );
                                    setShowErrorDialog(true);
                                  }
                                }}
                              >
                                <FileDown className="h-4 w-4" />
                              </Button>
                            )}
                        </div>
                      </div>
                      <AnimatePresence initial={false}>
                        {progressLegendOpen ? (
                          <motion.div
                            id="dashboard-progress-color-legend"
                            key="legend"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                              {[
                                { label: "0–25% Low", color: "#ef4444" },
                                { label: "25–50% Moderate", color: "#f59e0b" },
                                { label: "50–75% Good", color: "#3b82f6" },
                                { label: "75–100% High", color: "#22c55e" },
                              ].map((it) => (
                                <div
                                  key={it.label}
                                  className="flex items-center gap-2"
                                >
                                  <span
                                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: it.color }}
                                  />
                                  <span>{it.label}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  );
                })();
              })()}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {((selectedItemName && singleItemData) || aggregatedData) &&
                viewType && (
                  <Button
                    className="hidden sm:inline-flex rounded-xl h-11 bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm font-semibold"
                    onClick={async () => {
                      try {
                        const dataToExport =
                          selectedItemName && singleItemData
                            ? singleItemData
                            : aggregatedData;
                        const exportName =
                          selectedItemName && selectedItemType === "division"
                            ? `${selectedItemName} Division`
                            : selectedItemName &&
                                selectedItemType === "district"
                              ? `${selectedItemName} District`
                              : selectedItemName &&
                                  selectedItemType === "tehsil"
                                ? `${selectedItemName} Tehsil`
                                : viewType === "divisions"
                                  ? "All Punjab Divisions"
                                  : viewType === "districts"
                                    ? "All Punjab Districts"
                                    : "All Punjab Tehsils";

                        if (!dataToExport) {
                          setShowErrorDialog(true);
                          return;
                        }

                        // Pass the full data structure including PhaseProgress objects with timeline
                        await exportDashboardToPPTX({
                          cityName: exportName,
                          cityData: dataToExport as any, // Type assertion needed due to PhaseProgress union type
                          installationPhases: installationPhases.map(
                            (phase) => ({
                              key: phase.key,
                              title: phase.title,
                              percentage: getProgressValue(
                                dataToExport[phase.key],
                              ),
                            }),
                          ),
                        });
                        setShowSuccessDialog(true);
                      } catch (error) {
                        console.error("Error exporting to PPTX:", error);
                        setShowErrorDialog(true);
                      }
                    }}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    <span>Export Operation pptx</span>
                  </Button>
                )}
            </div>
          </div>
        </div>

        {/* Division Selected - Show Districts */}
        {selectedItemName &&
          selectedItemType === "division" &&
          (isLoading ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-32" />
                <div>
                  <Skeleton className="h-7 w-48 mb-2" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="p-6">
                    <Skeleton className="h-6 w-32 mb-3" />
                    <Skeleton className="h-10 w-20 mb-2" />
                    <Skeleton className="h-2 w-full rounded-full" />
                  </Card>
                ))}
              </div>
              {renderSkeletonLoader()}
            </div>
          ) : singleItemData ? (
            (() => {
              // API-driven: filter districts belonging to this division
              const divisionDistrictsData = districtsData.filter(
                (d) => d.divisionId === selectedItemId,
              );

              return (
                <div className="space-y-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 min-w-0">
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-2xl font-bold font-heading break-words">
                        Districts in {selectedItemName} Division
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedItemName} Division
                      </p>
                    </div>

                    {/* Breadcrumb removed (keep header navigation only) */}
                  </div>

                  {/* District Cards */}
                  {divisionDistrictsData.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {divisionDistrictsData.map((dist) => (
                          <HierarchyCard
                            key={dist.id}
                            title={dist.name}
                            overallProgress={dist.overall}
                            color={dist.color}
                            onClick={() => {
                              setParentDivisionId(selectedItemId);
                              setParentDivisionName(selectedItemName);
                              setSelectedItemId(dist.id);
                              setSelectedItemName(dist.name);
                              setSelectedItemType("district");
                            }}
                          />
                        ))}
                      </div>

                      {/* Charts for Division */}
                      {renderAggregatedCharts(
                        selectedItemName + " Division",
                        singleItemData,
                        projectsInSelectedGeography,
                        false,
                      )}
                    </>
                  ) : (
                    <Card className="border-border/50">
                      <CardContent className="p-8 text-center">
                        <p className="text-muted-foreground">
                          No districts found for {selectedItemName} Division.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              );
            })()
          ) : null)}

        {/* District Selected - Show Tehsils */}
        {selectedItemName &&
          selectedItemType === "district" &&
          (isLoading ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-32" />
                <div>
                  <Skeleton className="h-7 w-48 mb-2" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="p-6">
                    <Skeleton className="h-6 w-32 mb-3" />
                    <Skeleton className="h-10 w-20 mb-2" />
                    <Skeleton className="h-2 w-full rounded-full" />
                  </Card>
                ))}
              </div>
              {renderSkeletonLoader()}
            </div>
          ) : singleItemData ? (
            (() => {
              // API-driven: get tehsils for this district by selectedItemId
              const districtTehsilsData = apiTehsils
                .filter((t) => t.district === selectedItemId)
                .map((teh, index) => {
                  const projects = apiProjects.filter(
                    (p) => p.tehsil === teh.id,
                  );
                  const overall = calcProjectsOverall(projects);
                  return {
                    id: teh.id,
                    name: teh.tehsil_name,
                    overall,
                    color: CARD_COLORS[index % CARD_COLORS.length],
                  };
                })
                .sort((a, b) => b.overall - a.overall);

              return (
                <div className="space-y-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 min-w-0">
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-2xl font-bold font-heading break-words">
                        Tehsils in {selectedItemName} District ({parentDivisionName}{" "}
                        Division)
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedItemName} District
                      </p>
                    </div>

                    {/* Breadcrumb removed (keep header navigation only) */}
                  </div>

                  {/* Tehsil Cards */}
                  {districtTehsilsData.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {districtTehsilsData.map((teh) => (
                          <HierarchyCard
                            key={teh.id}
                            title={teh.name}
                            overallProgress={teh.overall}
                            color={teh.color}
                            onClick={() => {
                              setParentDistrictId(selectedItemId);
                              setParentDistrictName(selectedItemName);
                              setSelectedItemId(teh.id);
                              setSelectedItemName(teh.name);
                              setSelectedItemType("tehsil");
                            }}
                          />
                        ))}
                      </div>

                      {/* Charts for District */}
                      {renderAggregatedCharts(
                        selectedItemName + " District",
                        singleItemData,
                        projectsInSelectedGeography,
                        false,
                      )}
                    </>
                  ) : (
                    <Card className="border-border/50">
                      <CardContent className="p-8 text-center">
                        <p className="text-muted-foreground">
                          No tehsils found for {selectedItemName} District.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              );
            })()
          ) : null)}

        {/* Tehsil Selected - Show Detail View */}
        {selectedItemName &&
          selectedItemType === "tehsil" &&
          (isLoading ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-32" />
                <div>
                  <Skeleton className="h-7 w-48 mb-2" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
              {renderSkeletonLoader()}
            </div>
          ) : singleItemData ? (
            (() => {
              // API-driven: use parent tracking state for back navigation
              const tehsilProjects = apiProjects.filter(
                (p) => p.tehsil === selectedItemId,
              );
              const tehsilSlug =
                selectedItemName?.toLowerCase().replace(/\s+/g, "") || "";

              return (
                <div className="space-y-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 min-w-0">
                    <div className="min-w-0">
                      {/* Title removed per request (avoid duplicate tehsil text). */}
                    </div>

                    {/* Breadcrumb removed (keep header navigation only) */}
                  </div>

                  {/* Project Cards from API */}
                  <div className="w-full">
                    <div className="mb-4">
                      
                    </div>

                    {/* dropdown to pick project for KPI/Gantt */}
                    {tehsilProjects.length > 0 && (
                      <div className="mb-4 w-full max-w-md sm:w-64 sm:max-w-none">
                        <Select
                          value={selectedProjectForDetails ? String(selectedProjectForDetails.id) : ""}
                          onValueChange={(val) => {
                            const p = tehsilProjects.find((x) => String(x.id) === val) || null;
                            setSelectedProjectForDetails(p);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose project" />
                          </SelectTrigger>
                          <SelectContent>
                            {tehsilProjects.map((project) => (
                              <SelectItem key={project.id} value={String(project.id)}>
                                {project.project_name || `Project ${project.id}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {tehsilProjects.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {tehsilProjects.map((project, index) => {
                          const progress = Math.round(
                            ganttProgressByProjectId.get(project.id) ?? 0,
                          );
                          return (
                            <HierarchyCard
                              key={project.id}
                              title={
                                project.project_name || `Project ${project.id}`
                              }
                              overallProgress={progress}
                              onClick={() => {
                                // instead of navigating off-dashboard, show details inline
                                setSelectedProjectForDetails((prev) =>
                                  prev?.id === project.id ? null : project,
                                );
                              }}
                              color={CARD_COLORS[index % CARD_COLORS.length]}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <Card className="border-border/50">
                        <CardContent className="p-8 text-center">
                          <p className="text-muted-foreground">
                            No projects found for {selectedItemName} Tehsil.
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {/* details/pseudo-gantt for selected project */}
                    {selectedProjectForDetails && (
                      <MilestoneDetailsPanel
                        milestoneTitle={`${selectedProjectForDetails.project_name} - Project Gantt`}
                        phase={selectedProjectPhase}
                        phaseColor="#3b82f6"
                        flatGanttTasks={selectedProjectGanttTasks as any}
                        ganttProjectId={selectedProjectForDetails.id}
                        onProjectGanttRefresh={refetchSelectedProjectGantt}
                        onClear={() => setSelectedProjectForDetails(null)}
                      />
                    )}
                  </div>
                </div>
              );
            })()
          ) : null)}

        {/* Hierarchy Cards View with Charts */}
        {!selectedItemName &&
          viewType === "divisions" &&
          (isLoading ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <Skeleton className="h-7 w-48 mb-2" />
                  <Skeleton className="h-4 w-80" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="p-6">
                    <Skeleton className="h-6 w-32 mb-3" />
                    <Skeleton className="h-10 w-20 mb-2" />
                    <Skeleton className="h-2 w-full rounded-full" />
                  </Card>
                ))}
              </div>
              {renderSkeletonLoader()}
            </div>
          ) : aggregatedData ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold font-heading mb-1">
                    All Punjab Divisions
                  </h2>
                </div>

                {/* Show More/Less Button */}
                {divisionsData.length > 4 && (
                  <Button
                    variant="outline"
                    onClick={() => setExpandedDivisions(!expandedDivisions)}
                    className="rounded-xl h-9 whitespace-nowrap text-white border-[#101a3c] hover:border-[#101a3c] cursor-pointer"
                    style={{ backgroundColor: "#101a3c" }}
                  >
                    {expandedDivisions ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-2 text-white" />
                        Show Less ({divisionsData.length - 4} hidden)
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2 text-white" />
                        Show More ({divisionsData.length - 4} more)
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Division Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {(expandedDivisions
                  ? divisionsData
                  : divisionsData.slice(0, 4)
                ).map((div) => (
                  <HierarchyCard
                    key={div.id}
                    title={div.name}
                    overallProgress={div.overall}
                    color={div.color}
                    onClick={() => {
                      setSelectedItemId(div.id);
                      setSelectedItemName(div.name);
                      setSelectedItemType("division");
                    }}
                  />
                ))}
              </div>

              {/* Aggregated Charts Section - Same as detail view */}
              {renderAggregatedCharts(
                "All Punjab Divisions",
                aggregatedData,
                topProjectsForAggregateViews.length > 0
                  ? topProjectsForAggregateViews
                  : undefined,
                false,
              )}
            </div>
          ) : null)}

        {!selectedItemName &&
          viewType === "districts" &&
          (isLoading ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <Skeleton className="h-7 w-48 mb-2" />
                  <Skeleton className="h-4 w-80" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="p-6">
                    <Skeleton className="h-6 w-32 mb-3" />
                    <Skeleton className="h-10 w-20 mb-2" />
                    <Skeleton className="h-2 w-full rounded-full" />
                  </Card>
                ))}
              </div>
              {renderSkeletonLoader()}
            </div>
          ) : aggregatedData ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold font-heading mb-1">
                    All Punjab Districts
                  </h2>
                </div>

                {/* Show More/Less Button */}
                {districtsData.length > 4 && (
                  <Button
                    variant="outline"
                    onClick={() => setExpandedDistricts(!expandedDistricts)}
                    className="rounded-xl h-9 whitespace-nowrap text-white border-[#101a3c] hover:border-[#101a3c] cursor-pointer"
                    style={{ backgroundColor: "#101a3c" }}
                  >
                    {expandedDistricts ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-2 text-white" />
                        Show Less ({districtsData.length - 4} hidden)
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2 text-white" />
                        Show More ({districtsData.length - 4} more)
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* District Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {(expandedDistricts
                  ? districtsData
                  : districtsData.slice(0, 4)
                ).map((dist) => (
                  <HierarchyCard
                    key={dist.id}
                    title={dist.name}
                    overallProgress={dist.overall}
                    color={dist.color}
                    onClick={() => {
                      const parentDiv = divisionsData.find(
                        (d) => d.id === dist.divisionId,
                      );
                      setParentDivisionId(dist.divisionId);
                      setParentDivisionName(parentDiv?.name ?? null);
                      setSelectedItemId(dist.id);
                      setSelectedItemName(dist.name);
                      setSelectedItemType("district");
                    }}
                  />
                ))}
              </div>

              {/* Aggregated Charts Section */}
              {renderAggregatedCharts(
                "All Punjab Districts",
                aggregatedData,
                topProjectsForAggregateViews.length > 0
                  ? topProjectsForAggregateViews
                  : undefined,
                false,
              )}
            </div>
          ) : null)}

        {!selectedItemName &&
          viewType === "tehsils" &&
          (isLoading ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <Skeleton className="h-7 w-48 mb-2" />
                  <Skeleton className="h-4 w-80" />
                </div>
              </div>
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Card key={i} className="p-6">
                    <Skeleton className="h-6 w-32 mb-4" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {Array.from({ length: 4 }).map((_, j) => (
                        <Card key={j} className="p-4">
                          <Skeleton className="h-5 w-24 mb-3" />
                          <Skeleton className="h-8 w-16 mb-2" />
                          <Skeleton className="h-2 w-full rounded-full" />
                        </Card>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
              {renderSkeletonLoader()}
            </div>
          ) : aggregatedData ? (
            (() => {
              // Default districts to show: Lahore and Sheikhupura
              const DEFAULT_DISTRICTS = ["Lahore", "Sheikhupura"];

              // Filter districts based on search query first
              const allDistricts = Object.entries(tehsilsDataByDistrict).filter(
                ([districtName]) => {
                  if (!tehsilSearchQuery.trim()) return true;
                  return districtName
                    .toLowerCase()
                    .includes(tehsilSearchQuery.toLowerCase());
                },
              );

              // Filter districts to show: by default only Lahore and Sheikhupura, unless all are expanded
              const filteredDistricts = allDistricts.filter(
                ([districtName]) => {
                  // If search query exists, show all matching districts
                  if (tehsilSearchQuery.trim()) return true;
                  // If all expanded, show all districts
                  if (allTehsilGroupsExpanded) return true;
                  // Otherwise, show only default districts
                  return DEFAULT_DISTRICTS.includes(districtName);
                },
              );

              // Toggle all groups expand/collapse
              const handleToggleAllGroups = () => {
                const newState = !allTehsilGroupsExpanded;
                setAllTehsilGroupsExpanded(newState);

                if (newState) {
                  // Expand All: show all districts and expand them
                  const allExpandedGroups: Record<string, boolean> = {};
                  allDistricts.forEach(([districtName]) => {
                    allExpandedGroups[districtName] = true;
                  });
                  setExpandedTehsilGroups(allExpandedGroups);
                } else {
                  // Collapse All: collapse to only show default districts
                  const defaultState: Record<string, boolean> = {};
                  DEFAULT_DISTRICTS.forEach((districtName) => {
                    if (tehsilsDataByDistrict[districtName]) {
                      defaultState[districtName] = true;
                    }
                  });
                  setExpandedTehsilGroups(defaultState);
                }
              };

              return (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold font-heading mb-1">
                        All Punjab Tehsils
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Tehsils grouped by district, sorted by progress
                      </p>
                    </div>

                    {/* Search and Expand/Collapse Controls */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      {/* Search Input */}
                      <div className="relative flex-1 sm:min-w-[250px]">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Search by district name..."
                          value={tehsilSearchQuery}
                          onChange={(e) => setTehsilSearchQuery(e.target.value)}
                          className="pl-9 h-9 rounded-xl border-border/50 bg-background"
                        />
                      </div>

                      {/* Expand/Collapse All Button */}
                      {filteredDistricts.length > 0 && (
                        <Button
                          variant="outline"
                          onClick={handleToggleAllGroups}
                          className="rounded-xl h-9 whitespace-nowrap text-white border-[#101a3c] hover:border-[#101a3c] cursor-pointer"
                          style={{ backgroundColor: "#101a3c" }}
                        >
                          {allTehsilGroupsExpanded ? (
                            <>
                              <ChevronUp className="h-4 w-4 mr-2 text-white" />
                              Collapse All
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4 mr-2 text-white" />
                              Expand All
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Tehsil Cards Grouped by District */}
                  {filteredDistricts.length === 0 ? (
                    <Card className="border-border/50">
                      <CardContent className="p-8 text-center">
                        <p className="text-muted-foreground">
                          No districts found matching "{tehsilSearchQuery}".
                          Please try a different search term.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-6">
                      {filteredDistricts.map(
                        ([districtName, tehsils]: [
                          string,
                          Array<{
                            id: number;
                            name: string;
                            districtId: number;
                            overall: number;
                            data: any;
                            color: string;
                          }>,
                        ]) => {
                          const isExpanded =
                            expandedTehsilGroups[districtName] ?? false;
                          const visibleTehsils = isExpanded
                            ? tehsils
                            : tehsils.slice(0, 4);
                          const hasMore = tehsils.length > 4;

                          return (
                            <div key={districtName} className="space-y-4">
                              {/* District Header */}
                              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                                <div>
                                  <h3 className="text-lg font-bold font-heading">
                                    {districtName} District
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    {tehsils.length} tehsil
                                    {tehsils.length !== 1 ? "s" : ""} • Max
                                    Progress:{" "}
                                    {Math.max(...tehsils.map((t) => t.overall))}
                                    %
                                  </p>
                                </div>
                              </div>

                              {/* Tehsil Cards for this District */}
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {visibleTehsils.map((teh) => (
                                  <HierarchyCard
                                    key={teh.id}
                                    title={teh.name}
                                    overallProgress={teh.overall}
                                    color={teh.color}
                                    onClick={() => {
                                      const parentDist = districtsData.find(
                                        (d) => d.id === teh.districtId,
                                      );
                                      const parentDiv = divisionsData.find(
                                        (d) => d.id === parentDist?.divisionId,
                                      );
                                      setParentDistrictId(teh.districtId);
                                      setParentDistrictName(districtName);
                                      setParentDivisionId(
                                        parentDist?.divisionId ?? null,
                                      );
                                      setParentDivisionName(
                                        parentDiv?.name ?? null,
                                      );
                                      setSelectedItemId(teh.id);
                                      setSelectedItemName(teh.name);
                                      setSelectedItemType("tehsil");
                                    }}
                                  />
                                ))}
                              </div>

                              {/* Expand/Collapse Button for this District */}
                              {hasMore && (
                                <div className="flex justify-center">
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setExpandedTehsilGroups((prev) => {
                                        const newState = !isExpanded;
                                        // Update allTehsilGroupsExpanded based on whether all groups are expanded
                                        const updated = {
                                          ...prev,
                                          [districtName]: newState,
                                        };
                                        const allExpanded =
                                          filteredDistricts.every(
                                            ([name]) => updated[name] ?? false,
                                          );
                                        setAllTehsilGroupsExpanded(allExpanded);
                                        return updated;
                                      });
                                    }}
                                    className="rounded-xl text-white border-[#101a3c] hover:border-[#101a3c] cursor-pointer"
                                    style={{ backgroundColor: "#101a3c" }}
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronUp className="h-4 w-4 mr-2 text-white" />
                                        Show Less ({tehsils.length - 4} hidden)
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="h-4 w-4 mr-2 text-white" />
                                        Show More ({tehsils.length - 4} more)
                                      </>
                                    )}
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        },
                      )}
                    </div>
                  )}

                  {/* Aggregated Charts Section */}
                  {renderAggregatedCharts(
                    "All Punjab Tehsils",
                    aggregatedData,
                    topProjectsForAggregateViews.length > 0
                      ? topProjectsForAggregateViews
                      : undefined,
                    false,
                  )}
                </div>
              );
            })()
          ) : null)}

        {!selectedItemName &&
          viewType === "projects" &&
          (isLoading ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <Skeleton className="h-7 w-48 mb-2" />
                  <Skeleton className="h-4 w-80" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="p-6">
                    <Skeleton className="h-6 w-32 mb-3" />
                    <Skeleton className="h-10 w-20 mb-2" />
                    <Skeleton className="h-2 w-full rounded-full" />
                  </Card>
                ))}
              </div>
              {renderSkeletonLoader()}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold font-heading mb-1">
                    All Projects
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Select a project to view its Gantt chart and details
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {apiProjects.map((project, index) => {
                  const progress = Math.round(
                    ganttProgressByProjectId.get(project.id) ?? 0,
                  );
                  return (
                    <HierarchyCard
                      key={project.id}
                      title={project.project_name || `Project ${project.id}`}
                      overallProgress={progress}
                      onClick={() =>
                        setSelectedProjectForDetails((prev) =>
                          prev?.id === project.id ? null : project,
                        )
                      }
                      color={CARD_COLORS[index % CARD_COLORS.length]}
                    />
                  );
                })}
              </div>

              {selectedProjectForDetails && (
                <MilestoneDetailsPanel
                  milestoneTitle={`${selectedProjectForDetails.project_name} - Project Gantt`}
                  phase={selectedProjectPhase}
                  phaseColor="#3b82f6"
                  flatGanttTasks={selectedProjectGanttTasks as any}
                  ganttProjectId={selectedProjectForDetails.id}
                  onProjectGanttRefresh={refetchSelectedProjectGantt}
                  onClear={() => setSelectedProjectForDetails(null)}
                />
              )}
            </div>
          ))}
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex flex-col items-center gap-4 mb-2">
              <img
                src="/Assets/psca logo.png"
                alt="PSCA Logo"
                className="h-16 w-16 object-contain"
              />
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                <DialogTitle className="text-xl font-bold">
                  Export Successful!
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-center pt-2">
              PowerPoint presentation exported successfully!
              <br />
              <br />
              The PPTX file includes all KPIs with proper icons and all charts
              based on your current filter selection.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button
              onClick={() => setShowSuccessDialog(false)}
              className="w-full sm:w-auto"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex flex-col items-center gap-4 mb-2">
              <img
                src="/Assets/psca logo.png"
                alt="PSCA Logo"
                className="h-16 w-16 object-contain"
              />
              <DialogTitle className="text-xl font-bold">
                Export Error
              </DialogTitle>
            </div>
            <DialogDescription className="text-center pt-2">
              {!viewType
                ? "Please select a view type (All Divisions, All Districts, or All Tehsils) to export the presentation."
                : "Error exporting presentation. Please try again."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button
              onClick={() => setShowErrorDialog(false)}
              className="w-full sm:w-auto"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
