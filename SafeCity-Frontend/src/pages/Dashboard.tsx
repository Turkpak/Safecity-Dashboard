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
} from "recharts";
import { useWindowSize } from "@/hooks/use-window-size";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { getProjectGanttData, listDivisions, listDistricts, listTehsils } from "@/api";
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
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Search,
  DollarSign,
  FolderKanban,
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
import { useState, useMemo, useEffect } from "react";
import { useTheme } from "@/hooks/use-theme";
import { CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listProjects, getProjectById } from "@/api/project";

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

function buildPhaseFromProjectGantt(tasks: ProjectGanttTask[]): { actual: number; planned: number; subProjects: SubProject[]; timeline: { month: string; actual: number; planned: number }[] } {
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
    parentId: string;
  };

  // 1) Filter out null-date rows (exclude from chart entirely)
  const datedRows: Row[] = [];
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (!t) continue;
    if (!t.start || !t.end) continue;
    if (!t.parent) continue; // must have a parent_id to group; no-parent rows aren't shown in chart
    datedRows.push({
      id: String(t.id),
      name: t.label,
      progress: clamp01(Number(t.progress ?? 0)),
      plannedProgress: planned,
      start: t.start,
      end: t.end,
      parentId: String(t.parent),
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

  // 2) Group by parent_id
  const groupMap = new Map<string, Row[]>();
  for (let i = 0; i < datedRows.length; i++) {
    const r = datedRows[i];
    const list = groupMap.get(r.parentId);
    if (list) list.push(r);
    else groupMap.set(r.parentId, [r]);
  }

  type Group = { header: Row; children: Row[] };
  const groups: Group[] = [];

  for (const [parentId, rows] of Array.from(groupMap.entries())) {
    // Prefer using the “real parent” row when it exists as a dated activity with id=parentId.
    const realParent = datedById.get(parentId);
    if (realParent) {
      const children = rows.filter((r) => r.id !== realParent.id);
      groups.push({ header: realParent, children });
      continue;
    }

    // Otherwise: pick first dated row in API order as header; remaining are children.
    const header = rows[0];
    const children = rows.slice(1);
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

  const rootWeight = groups.length > 0 ? 1 / groups.length : 0;

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

    const parentProgress =
      milestones.length > 0
        ? clamp01(milestones.reduce((sum, m: any) => sum + (Number(m.progress) || 0), 0) / milestones.length)
        : g.header.progress;

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
      actualProgress: parentProgress,
      plannedProgress: planned,
      weight: rootWeight,
      startDate,
      finishDate,
      milestones: milestones as any,
    };
  });

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
  return typeof progress === "number" ? progress : progress.actual;
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
  // Generate planned progress (typically 5-10% higher initially, then converges)
  const plannedProgress = Math.min(
    100,
    currentValue + (100 - currentValue) * 0.15,
  );

  // Generate timeline if not provided
  const timeline =
    timelineData?.map((point) => {
      const actual = (point[phaseKey] as number) || 0;
      const planned = Math.min(100, actual + (100 - actual) * 0.15);
      return {
        month: point.month as string,
        actual,
        planned,
      };
    }) || [];

  return {
    actual: currentValue,
    planned: plannedProgress,
    subProjects: generateSubProjects(
      phaseKey,
      currentValue,
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
  if (projects.length === 0) return 0;
  let totalBudget = 0;
  let totalUtilized = 0;
  for (const p of projects) {
    totalBudget += parseFloat(p.total_budget_allocated ?? "0") || 0;
    totalUtilized += parseFloat(p.budget_utilized ?? "0") || 0;
  }
  if (totalBudget === 0) return 0;
  return Math.round((totalUtilized / totalBudget) * 100);
};

/** Build CityInstallationData from an overall financial progress number */
const generateCityDataFromOverall = (
  overall: number,
  division?: string,
  district?: string,
  tehsil?: string,
): CityInstallationData => {
  const surveys = Math.min(100, Math.round(overall * 1.25));
  const foundations = Math.min(100, Math.round(overall * 1.15));
  const cabinet = Math.min(100, Math.round(overall * 1.05));
  const cable = Math.min(100, Math.round(overall * 0.95));
  const controlRoom = Math.min(100, Math.round(overall * 0.8));
  const ppic3 = Math.min(100, Math.round(overall * 0.65));
  const timeline = [
    {
      month: "Jan",
      surveys: Math.max(0, surveys - 50),
      foundations: Math.max(0, foundations - 75),
      cabinet: Math.max(0, cabinet - 73),
      cable: Math.max(0, cable - 70),
      controlRoom: Math.max(0, controlRoom - 60),
      ppic3: Math.max(0, ppic3 - 55),
      overall: Math.max(0, overall - 60),
    },
    {
      month: "Feb",
      surveys: Math.max(0, surveys - 30),
      foundations: Math.max(0, foundations - 50),
      cabinet: Math.max(0, cabinet - 55),
      cable: Math.max(0, cable - 50),
      controlRoom: Math.max(0, controlRoom - 45),
      ppic3: Math.max(0, ppic3 - 40),
      overall: Math.max(0, overall - 40),
    },
    {
      month: "Mar",
      surveys: Math.max(0, surveys - 15),
      foundations: Math.max(0, foundations - 30),
      cabinet: Math.max(0, cabinet - 35),
      cable: Math.max(0, cable - 30),
      controlRoom: Math.max(0, controlRoom - 25),
      ppic3: Math.max(0, ppic3 - 20),
      overall: Math.max(0, overall - 20),
    },
    {
      month: "Apr",
      surveys: Math.max(0, surveys - 8),
      foundations: Math.max(0, foundations - 15),
      cabinet: Math.max(0, cabinet - 20),
      cable: Math.max(0, cable - 15),
      controlRoom: Math.max(0, controlRoom - 12),
      ppic3: Math.max(0, ppic3 - 10),
      overall: Math.max(0, overall - 10),
    },
    {
      month: "May",
      surveys: Math.max(0, surveys - 3),
      foundations: Math.max(0, foundations - 8),
      cabinet: Math.max(0, cabinet - 10),
      cable: Math.max(0, cable - 8),
      controlRoom: Math.max(0, controlRoom - 5),
      ppic3: Math.max(0, ppic3 - 3),
      overall: Math.max(0, overall - 3),
    },
    {
      month: "Jun",
      surveys,
      foundations,
      cabinet,
      cable,
      controlRoom,
      ppic3,
      overall,
    },
  ];
  return {
    surveys: convertToPhaseProgress(
      surveys,
      "surveys",
      timeline,
      division,
      district,
      tehsil,
    ),
    foundations: convertToPhaseProgress(
      foundations,
      "foundations",
      timeline,
      division,
      district,
      tehsil,
    ),
    cabinet: convertToPhaseProgress(
      cabinet,
      "cabinet",
      timeline,
      division,
      district,
      tehsil,
    ),
    cable: convertToPhaseProgress(
      cable,
      "cable",
      timeline,
      division,
      district,
      tehsil,
    ),
    controlRoom: convertToPhaseProgress(
      controlRoom,
      "controlRoom",
      timeline,
      division,
      district,
      tehsil,
    ),
    ppic3: convertToPhaseProgress(
      ppic3,
      "ppic3",
      timeline,
      division,
      district,
      tehsil,
    ),
    overall,
    timeline,
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
    () => buildPhaseFromProjectGantt(selectedProjectGanttTasks),
    [selectedProjectGanttTasks],
  );

  const { theme, toggleTheme } = useTheme();
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

  // Check for tehsil parameter in URL (from ProjectDetail back navigation)
  useEffect(() => {
    if (apiTehsils.length === 0) return;
    const urlParams = new URLSearchParams(window.location.search);
    const tehsilParam = urlParams.get("tehsil");
    if (tehsilParam) {
      const tehsilName = decodeURIComponent(tehsilParam);
      const found = apiTehsils.find(
        (t) => t.tehsil_name.toLowerCase() === tehsilName.toLowerCase(),
      );
      if (found) {
        setSelectedItemName(found.tehsil_name);
        setSelectedItemType("tehsil");
        setSelectedItemId(found.id);
        setParentDistrictId(found.district);
        setParentDistrictName(found.district_name);
        setParentDivisionId(found.division);
        setParentDivisionName(found.division_name);
        window.history.replaceState({}, "", "/");
      }
    }
  }, [apiTehsils]);

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

  // Helper: calculate overall financial progress from a set of projects
  const calcProjectsOverall = (projects: Project[]): number => {
    const valid = projects.filter(
      (p) =>
        p.total_budget_allocated && parseFloat(p.total_budget_allocated) > 0,
    );
    if (valid.length === 0) return 0;
    const totalBudget = valid.reduce(
      (sum, p) => sum + parseFloat(p.total_budget_allocated!),
      0,
    );
    const totalUtilized = valid.reduce(
      (sum, p) => sum + parseFloat(p.budget_utilized ?? "0"),
      0,
    );
    return Math.min(100, Math.round((totalUtilized / totalBudget) * 100));
  };

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

  // Context theme: follow the currently visible/selected area overall %
  const contextOverall = useMemo(() => {
    if (selectedItemName && singleItemData) return singleItemData.overall ?? 0;
    return aggregatedData?.overall ?? 0;
  }, [selectedItemName, singleItemData, aggregatedData]);

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

  // Render aggregated charts function
  const renderAggregatedCharts = (
    title: string,
    data: CityInstallationData,
    projectsInGeography?: Project[],
  ) => {
    const isAggregatedView = title.startsWith("All Punjab");
    const useProjectCards =
      Array.isArray(projectsInGeography) && projectsInGeography.length > 0;

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

    // Calculate financial/budget metrics (different from installation progress)
    // Financial metrics are calculated based on overall progress with budget considerations
    const overallProgress = data.overall || 0;
    // Budget allocated is typically higher than progress (includes buffer)
    const financialPlanned = Math.min(
      100,
      overallProgress + 8 + Math.abs(overallProgress - 70) * 0.1,
    );
    // Budget spent is typically slightly lower than allocated
    const financialActual = Math.max(
      0,
      overallProgress - 3 - Math.abs(overallProgress - 70) * 0.05,
    );
    const financialVariance = financialActual - financialPlanned;
    const absFinancialVariance = Math.abs(financialVariance);

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
        {/* Installation Phase Cards */}
        <div className="w-full">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold font-heading mb-1">
                Best Performing Projects
              </h2>
              <p className="text-sm text-muted-foreground">
                Progress breakdown for {title}
              </p>
            </div>
            {(selectedMilestoneKey || isSelectedProjectInThisScope) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedMilestoneKey(null);
                  if (useProjectCards) setSelectedProjectForDetails(null);
                }}
                className="h-9 px-4 rounded-xl border border-border/60 bg-background hover:bg-muted/40 text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0"
              >
                Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {useProjectCards
              ? projectsInGeography!.map((project, index) => {
                  const total = parseFloat(
                    project.total_budget_allocated || "0",
                  ) || 0;
                  const utilized =
                    parseFloat(project.budget_utilized || "0") || 0;
                  const percentage =
                    total > 0 ? Math.round((utilized / total) * 100) : 0;
                  const displayName =
                    project.project_name || `Project ${project.id}`;
                  return (
                    <InstallationCard
                      key={`${title}-project-${project.id}`}
                      title={displayName}
                      percentage={percentage}
                      icon={FolderKanban}
                      color={PROJECT_CARD_COLORS[index % PROJECT_CARD_COLORS.length]}
                      actualProgress={percentage}
                      plannedProgress={100}
                      selected={selectedProjectForDetails?.id === project.id}
                      onClick={() => {
                        setSelectedMilestoneKey(null);
                        setSelectedProjectForDetails((prev) =>
                          prev?.id === project.id ? null : project,
                        );
                      }}
                    />
                  );
                })
              : installationPhases.map((phase) => {
                  const progress = data[phase.key];
                  const progressValue = getProgressValue(progress);
                  const hasDetails = hasDetailedProgress(progress);

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

          {/* Selected project details (Gantt / WBS / S-curves) for Division/District views */}
          {isSelectedProjectInThisScope && (
            <div className="mt-6">
              <MilestoneDetailsPanel
                milestoneTitle={`${selectedProjectForDetails!.project_name || `Project ${selectedProjectForDetails!.id}`} - Project Gantt`}
                phase={selectedProjectPhase}
                phaseColor="#3b82f6"
                onClear={() => setSelectedProjectForDetails(null)}
              />
            </div>
          )}
        </div>

        {/* Financial Progress Pie Charts (hide when a milestone KPI is selected) */}
        {!selectedMilestoneKey && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Financial Progress Donut Chart */}
            <Card className="overflow-hidden border border-border/80 bg-card shadow-lg shadow-primary/5 transition-shadow hover:shadow-xl hover:shadow-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-heading">
                  Financial Progress Overview
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Planned vs actual and variance
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div
                  className="relative w-full"
                  style={{
                    height: isMobile ? "260px" : isTablet ? "300px" : "360px",
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart
                      margin={{ top: 8, right: 8, bottom: 48, left: 8 }}
                    >
                      <defs>
                        <linearGradient
                          id="financial-planned"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="1"
                        >
                          <stop offset="0%" stopColor="#4f46e5" />
                          <stop offset="100%" stopColor="#6366f1" />
                        </linearGradient>
                        <linearGradient
                          id="financial-actual"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <stop offset="0%" stopColor="#0d9488" />
                          <stop offset="100%" stopColor="#14b8a6" />
                        </linearGradient>
                        <linearGradient
                          id="financial-variance"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <stop
                            offset="0%"
                            stopColor={
                              financialVariance < 0 ? "#d97706" : "#dc2626"
                            }
                          />
                          <stop
                            offset="100%"
                            stopColor={
                              financialVariance < 0 ? "#f59e0b" : "#ef4444"
                            }
                          />
                        </linearGradient>
                      </defs>
                      <Pie
                        data={[
                          {
                            name: "Planned",
                            value: normalizedFinancialPlanned,
                            originalValue: financialPlanned,
                            fill: "url(#financial-planned)",
                          },
                          {
                            name: "Actual",
                            value: normalizedFinancialActual,
                            originalValue: financialActual,
                            fill: "url(#financial-actual)",
                          },
                          {
                            name: "Variance",
                            value: normalizedFinancialVariance,
                            originalValue: absFinancialVariance,
                            fill: "url(#financial-variance)",
                          },
                        ]}
                        cx="50%"
                        cy="45%"
                        innerRadius={isMobile ? 52 : isTablet ? 64 : 80}
                        outerRadius={isMobile ? 82 : isTablet ? 100 : 120}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="rgba(255,255,255,0.9)"
                        strokeWidth={2}
                        isAnimationActive
                        animationDuration={800}
                        animationBegin={0}
                      >
                        {[
                          { fill: "url(#financial-planned)" },
                          { fill: "url(#financial-actual)" },
                          { fill: "url(#financial-variance)" },
                        ].map((entry, index) => (
                          <Cell
                            key={`cell-f-${index}`}
                            fill={entry.fill}
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
                          paddingTop: 16,
                          fontSize: isMobile ? "11px" : "12px",
                        }}
                        iconType="circle"
                        iconSize={10}
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
                  {/* Center label - centered in chart area */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl sm:text-3xl font-bold font-heading tabular-nums text-foreground">
                      {financialActual.toFixed(1)}%
                    </span>
                    <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Actual
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Overall Progress Donut Chart */}
            <Card className="overflow-hidden border border-border/80 bg-card shadow-lg shadow-primary/5 transition-shadow hover:shadow-xl hover:shadow-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-heading">
                  Overall Progress
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Planned vs actual and variance
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div
                  className="relative w-full"
                  style={{
                    height: isMobile ? "260px" : isTablet ? "300px" : "360px",
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart
                      margin={{ top: 8, right: 8, bottom: 48, left: 8 }}
                    >
                      <defs>
                        <linearGradient
                          id="overall-planned"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="1"
                        >
                          <stop offset="0%" stopColor="#4f46e5" />
                          <stop offset="100%" stopColor="#6366f1" />
                        </linearGradient>
                        <linearGradient
                          id="overall-actual"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <stop offset="0%" stopColor="#0d9488" />
                          <stop offset="100%" stopColor="#14b8a6" />
                        </linearGradient>
                        <linearGradient
                          id="overall-variance"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <stop
                            offset="0%"
                            stopColor={variance < 0 ? "#d97706" : "#dc2626"}
                          />
                          <stop
                            offset="100%"
                            stopColor={variance < 0 ? "#f59e0b" : "#ef4444"}
                          />
                        </linearGradient>
                      </defs>
                      <Pie
                        data={[
                          {
                            name: "Planned",
                            value: normalizedPlanned,
                            originalValue: avgPlanned,
                            fill: "url(#overall-planned)",
                          },
                          {
                            name: "Actual",
                            value: normalizedActual,
                            originalValue: avgActual,
                            fill: "url(#overall-actual)",
                          },
                          {
                            name: "Variance",
                            value: normalizedVariance,
                            originalValue: absVariance,
                            fill: "url(#overall-variance)",
                          },
                        ]}
                        cx="50%"
                        cy="45%"
                        innerRadius={isMobile ? 52 : isTablet ? 64 : 80}
                        outerRadius={isMobile ? 82 : isTablet ? 100 : 120}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="rgba(255,255,255,0.9)"
                        strokeWidth={2}
                        isAnimationActive
                        animationDuration={800}
                        animationBegin={0}
                      >
                        {[
                          { fill: "url(#overall-planned)" },
                          { fill: "url(#overall-actual)" },
                          { fill: "url(#overall-variance)" },
                        ].map((entry, index) => (
                          <Cell
                            key={`cell-o-${index}`}
                            fill={entry.fill}
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
                          paddingTop: 16,
                          fontSize: isMobile ? "11px" : "12px",
                        }}
                        iconType="circle"
                        iconSize={10}
                        formatter={(value) => {
                          let itemValue = 0;
                          if (value === "Planned") itemValue = avgPlanned;
                          else if (value === "Actual") itemValue = avgActual;
                          else if (value === "Variance")
                            itemValue = absVariance;
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
                  {/* Center label - centered in chart area */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl sm:text-3xl font-bold font-heading tabular-nums text-foreground">
                      {avgActual.toFixed(1)}%
                    </span>
                    <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Actual
                    </span>
                  </div>
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
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold font-heading mb-1">
                    {progressType === "financial"
                      ? `${selectedPhaseMeta.title} - Financial Progress`
                      : `${selectedPhaseMeta.title} - Milestone KPIs`}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {progressType === "financial"
                      ? "Financial progress charts and analysis"
                      : "Gantt chart, WBS breakdown, and S-curves"}
                  </p>
                </div>
                {/* Progress Type Toggle - Right side */}
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-primary/20 bg-background shadow-sm hover:border-primary/40 transition-colors flex-shrink-0">
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

        {/* Charts Grid (drilldown only; hide in All Divisions/Districts/Tehsils views) */}
        {!selectedMilestoneKey && !isAggregatedView && (
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
                  data={installationPhases.map((phase) => ({
                    phase: phase.title,
                    percentage: getProgressValue(data[phase.key]),
                  }))}
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
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border shadow-lg"
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
            className={`relative transition-all duration-300 ${
              isFilterBarExpanded
                ? "border-b border-border/30 pb-3 px-3 sm:px-6 pt-3 sm:pt-4"
                : "pb-2 px-3 sm:px-4 pt-2 sm:pt-3"
            }`}
          >
            <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap flex-1 min-w-0">
                {/* Filters Label / Toggle */}
                <div
                  className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter
                    className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary transition-transform duration-300 ${showFilters ? "rotate-180" : ""}`}
                  />
                  <span className="text-xs sm:text-sm font-semibold text-foreground">
                    View:
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
                      className="overflow-hidden flex items-center min-w-0"
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
                        className="flex items-center gap-2 sm:gap-4 md:gap-6 whitespace-nowrap pl-1 sm:pl-2 flex-wrap"
                      >
                        <div className="flex items-center space-x-1.5 sm:space-x-2">
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
                        <div className="flex items-center space-x-1.5 sm:space-x-2">
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
                        <div className="flex items-center space-x-1.5 sm:space-x-2">
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
                        <div className="flex items-center space-x-1.5 sm:space-x-2">
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
          </div>

          {/* Header Content Section - Collapsible */}
          <div
            className={`relative flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 ease-in-out overflow-hidden ${
              isFilterBarExpanded
                ? "max-h-[500px] opacity-100 p-4 md:p-6"
                : "max-h-0 opacity-0 p-0"
            }`}
          >
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <h1 className="text-xl sm:text-3xl md:text-4xl font-bold font-heading bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {selectedItemName && selectedItemType === "division"
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
                                : "PSCA Progress Dashboard"}
                  </h1>
                </div>
              </div>
              {isLoading ? (
                <div className="flex items-center gap-3">
                  <Skeleton className="h-7 w-32 rounded-full" />
                </div>
              ) : (selectedItemName && singleItemData) || aggregatedData ? (
                (() => {
                  const overall =
                    selectedItemName && singleItemData
                      ? singleItemData.overall
                      : aggregatedData?.overall || 0;
                  const meta = getProgressRangeMeta(overall);

                  // Map color to Tailwind classes
                  const getBadgeClasses = (color: string) => {
                    if (color === "#ef4444") {
                      // red - Low
                      return "px-4 py-1.5 text-sm font-semibold bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors";
                    } else if (color === "#f59e0b") {
                      // orange/amber - Moderate
                      return "px-4 py-1.5 text-sm font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors";
                    } else if (color === "#3b82f6") {
                      // blue - Good
                      return "px-4 py-1.5 text-sm font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors";
                    } else if (color === "#22c55e" || color === "#10b981") {
                      // green/emerald - High/Fully Completed
                      return "px-4 py-1.5 text-sm font-semibold bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors";
                    }
                    return "px-4 py-1.5 text-sm font-semibold bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors";
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
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <Badge className={getBadgeClasses(meta.color)}>
                          <TrendingUp className={getIconClasses(meta.color)} />
                          Overall: {overall}%
                        </Badge>
                      </div>
                      {/* Legend for progress ranges */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
                              className="inline-block h-2.5 w-2.5 rounded-sm"
                              style={{ backgroundColor: it.color }}
                            />
                            <span>{it.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()
              ) : null}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {((selectedItemName && singleItemData) || aggregatedData) &&
                viewType && (
                  <Button
                    className="rounded-xl h-11 bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm font-semibold"
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
                    <FileDown className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">
                      Export Operation pptx
                    </span>
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
                  {/* Back Button */}
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedItemName(null);
                        setSelectedItemType(null);
                        setSelectedItemId(null);
                      }}
                      className="rounded-xl cursor-pointer"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to All Divisions
                    </Button>
                    <div>
                      <h2 className="text-lg sm:text-2xl font-bold font-heading">
                        Districts in {selectedItemName} Division
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedItemName} Division
                      </p>
                    </div>
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
                  {/* Back Button */}
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Go back to parent division view
                        setSelectedItemId(parentDivisionId);
                        setSelectedItemName(parentDivisionName);
                        setSelectedItemType("division");
                      }}
                      className="rounded-xl cursor-pointer"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to {parentDivisionName} Division
                    </Button>
                    <div>
                      <h2 className="text-lg sm:text-2xl font-bold font-heading">
                        Tehsils in {selectedItemName} District (
                        {parentDivisionName} Division)
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedItemName} District
                      </p>
                    </div>
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
                  {/* Back Button */}
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Go back to parent district view
                        setSelectedItemId(parentDistrictId);
                        setSelectedItemName(parentDistrictName);
                        setSelectedItemType("district");
                      }}
                      className="rounded-xl cursor-pointer"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to {parentDistrictName} District
                    </Button>
                    <div>
                      <h2 className="text-lg sm:text-2xl font-bold font-heading">
                        Ongoing projects in {selectedItemName} Tehsil
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedItemName} Tehsil
                      </p>
                    </div>
                  </div>

                  {/* Project Cards from API */}
                  <div className="w-full">
                    <div className="mb-4">
                      <h3 className="text-xl font-bold font-heading mb-1">
                        Projects
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Select a project to view details
                      </p>
                    </div>

                    {/* dropdown to pick project for KPI/Gantt */}
                    {tehsilProjects.length > 0 && (
                      <div className="mb-4 w-64">
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
                          const budget = parseFloat(
                            project.total_budget_allocated ?? "0",
                          );
                          const utilized = parseFloat(
                            project.budget_utilized ?? "0",
                          );
                          const progress =
                            budget > 0
                              ? Math.min(
                                  100,
                                  Math.round((utilized / budget) * 100),
                                )
                              : 0;
                          return (
                            <HierarchyCard
                              key={project.id}
                              title={
                                project.project_name || `Project ${project.id}`
                              }
                              overallProgress={progress}
                              onClick={() => {
                                // instead of navigating off-dashboard, show details inline
                                setSelectedProjectForDetails(project);
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
              {renderAggregatedCharts("All Punjab Divisions", aggregatedData)}
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
              {renderAggregatedCharts("All Punjab Districts", aggregatedData)}
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
                  {renderAggregatedCharts("All Punjab Tehsils", aggregatedData)}
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
                  const budget = parseFloat(project.total_budget_allocated ?? "0");
                  const utilized = parseFloat(project.budget_utilized ?? "0");
                  const progress = budget > 0 ? Math.min(100, Math.round((utilized / budget) * 100)) : 0;
                  return (
                    <HierarchyCard
                      key={project.id}
                      title={project.project_name || `Project ${project.id}`}
                      overallProgress={progress}
                      onClick={() => setSelectedProjectForDetails(project)}
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
