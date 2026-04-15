import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MoreVertical,
  Plus,
  Upload,
  FileText,
  FolderKanban,
  ListChecks,
  CornerDownRight,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { updateTaskActual, createProgressImage, addDelayLog, listStakeholders } from "@/api";
import type { Stakeholder } from "@/api/types";

type FlatGanttRow = {
  id: string;
  label: string;
  /** Duration from nested gantt API (usually in days). */
  duration?: number;
  /** Human friendly duration from nested gantt API (e.g. "60 days"). */
  duration_display?: string;
  start: string | null;
  end: string | null;
  progress: number;
  parent?: string;
  order?: number;
  db_id?: number;
  /** From nested gantt `activity_id` (external schedule id). */
  activity_id?: string;

  // ✅ ADD THESE
  actual_start?: string | null;
  actual_end?: string | null;
  has_delay?: boolean;
  delay_info?: unknown;
};

/**
 * Delay log API expects the backend ProjectActivity `id` (nested gantt `id`).
 * We store that as `db_id` on each row.
 */
function parseDelayLogActivityId(row: FlatGanttRow): number | null {
  const n = row.db_id;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseISODateParts(s: string | null): { y: number; m: number; d: number } | null {
  if (!s) return null;
  // Expect "YYYY-MM-DD"
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]); // 1..12
  const d = Number(m[3]); // 1..31
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

function parseISOToLocalMidnight(s: string | null): Date | null {
  const p = parseISODateParts(s);
  if (!p) return null;
  // Local midnight (avoids timezone shifting that happens with new Date("YYYY-MM-DD"))
  return new Date(p.y, p.m - 1, p.d, 0, 0, 0, 0);
}

function buildMonthsArray(rangeStart: Date, rangeEnd: Date) {
  const months: Date[] = [];
  const cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  const end = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
  while (cur <= end) {
    months.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

export function ProjectGanttTree({
  tasks,
  projectName,
  projectId,
  onOpenAddDocument,
  onDelayLogSaved,
  onProgressSaved,
  readOnly = false,
}: {
  tasks: FlatGanttRow[];
  projectName?: string;
  projectId?: number;
  /** `activityDbId` is the backend ProjectActivity PK (`db_id` from nested gantt), same as delay log `activity`. */
  onOpenAddDocument?: (taskId: string, taskName: string, activityDbId: number) => void;
  /** Called after a delay log is saved so the parent can refetch `project-gantt-nested` (updates `has_delay`). */
  onDelayLogSaved?: () => void | Promise<void>;
  /** Called after progress is saved so the parent can refetch gantt (updates `progress`/actual dates). */
  onProgressSaved?: () => void | Promise<void>;
  readOnly?: boolean;
}) {
  const expandedStorageKey = useMemo(() => `safecity:ganttExpanded:${projectId ?? "unknown"}`, [projectId]);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem(`safecity:ganttExpanded:${projectId ?? "unknown"}`);
      const ids = raw ? (JSON.parse(raw) as unknown) : null;
      if (Array.isArray(ids)) return new Set(ids.map(String));
    } catch {
      // ignore
    }
    return new Set();
  });
  const { toast } = useToast();
  const { user } = useAuth();

  // Restore expanded state when project changes (tab switching can remount the component).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(expandedStorageKey);
      const ids = raw ? (JSON.parse(raw) as unknown) : null;
      if (Array.isArray(ids)) {
        setExpanded(new Set(ids.map(String)));
        return;
      }
    } catch {
      // ignore
    }
    setExpanded(new Set());
  }, [expandedStorageKey]);

  // Persist expanded state so switching tabs doesn't collapse WBS.
  useEffect(() => {
    try {
      sessionStorage.setItem(expandedStorageKey, JSON.stringify(Array.from(expanded)));
    } catch {
      // ignore
    }
  }, [expanded, expandedStorageKey]);

  const [progressOpen, setProgressOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<FlatGanttRow | null>(null);
  const [progressValue, setProgressValue] = useState<number>(0);
  const [progressDate, setProgressDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [progressImages, setProgressImages] = useState<File[]>([]);
  const [progressCaption, setProgressCaption] = useState<string>("");
  const [uploadingProgressImages, setUploadingProgressImages] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);

  const [delayOpen, setDelayOpen] = useState(false);
  const [delayRow, setDelayRow] = useState<FlatGanttRow | null>(null);
  const [delayStartDate, setDelayStartDate] = useState<string>("");
  const [delayEndDate, setDelayEndDate] = useState<string>("");
  const [delayCategory, setDelayCategory] = useState<string>("");
  const [delayOriginator, setDelayOriginator] = useState<string>("");
  const [delayIssue, setDelayIssue] = useState<string>("");
  const [delayRecommendedAction, setDelayRecommendedAction] = useState<string>("");
  // Stakeholder id (as string for Select component)
  const [delayActionBy, setDelayActionBy] = useState<string>("");
  const [savingDelay, setSavingDelay] = useState(false);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [stakeholdersLoaded, setStakeholdersLoaded] = useState(false);
  const [stakeholdersLoading, setStakeholdersLoading] = useState(false);

  const loadStakeholders = async (): Promise<void> => {
    if (stakeholdersLoading) return;
    try {
      setStakeholdersLoading(true);
      const list = await listStakeholders();
      setStakeholders(Array.isArray(list) ? list : []);
      setStakeholdersLoaded(true);
    } catch (err) {
      setStakeholders([]);
      setStakeholdersLoaded(false); // allow retry on next open
      toast({
        title: "Failed to load stakeholders",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setStakeholdersLoading(false);
    }
  };

  const delayDays = useMemo(() => {
    if (!delayStartDate || !delayEndDate) return 0;
    const s = new Date(delayStartDate);
    const e = new Date(delayEndDate);
    const ms = e.getTime() - s.getTime();
    if (!Number.isFinite(ms)) return 0;
    // inclusive day difference (min 0)
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [delayStartDate, delayEndDate]);

  const normalized = useMemo(() => {
    return (tasks || []).map((t) => ({
      ...t,
      id: String(t.id),
      parent: t.parent ? String(t.parent) : undefined,
      progress:
        typeof t.progress === "number" && Number.isFinite(t.progress)
          ? clamp(t.progress, 0, 100)
          : 0,
    }));
  }, [tasks]);

  const { byId, childrenByParent, roots } = useMemo(() => {
    const byId = new Map<string, FlatGanttRow>();
    const childrenByParent = new Map<string | undefined, FlatGanttRow[]>();
    for (const t of normalized) {
      byId.set(String(t.id), t);
      const pid = t.parent ? String(t.parent) : undefined;
      const list = childrenByParent.get(pid) ?? [];
      list.push(t);
      childrenByParent.set(pid, list);
    }
    // IMPORTANT: preserve API/XER ordering exactly.
    // If an explicit `order` is provided, use it; otherwise keep insertion order.
    for (const [k, list] of Array.from(childrenByParent.entries())) {
      const hasOrder = list.some((x) => typeof x.order === "number" && Number.isFinite(x.order as number));
      if (hasOrder) {
        list.sort((a, b) => (Number(a.order ?? 0) - Number(b.order ?? 0)));
      }
      childrenByParent.set(k, list);
    }
    const roots = childrenByParent.get(undefined) ?? [];
    return { byId, childrenByParent, roots };
  }, [normalized]);

  const dateRange = useMemo(() => {
    const dates: Date[] = [];
    for (const t of normalized) {
      const s = parseDate(t.start);
      const e = parseDate(t.end);
      if (s) dates.push(s);
      if (e) dates.push(e);
    }
    if (!dates.length) {
      const now = new Date();
      return { start: now, end: now };
    }
    return {
      start: new Date(Math.min(...dates.map((d) => d.getTime()))),
      end: new Date(Math.max(...dates.map((d) => d.getTime()))),
    };
  }, [normalized]);

  const totalDays = useMemo(() => {
    const ms = dateRange.end.getTime() - dateRange.start.getTime();
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1);
  }, [dateRange]);

  const monthsArray = useMemo(() => buildMonthsArray(dateRange.start, dateRange.end), [dateRange]);

  // Month columns are fixed width (120px). Use pixel positioning to avoid drift.
  const MONTH_COL_PX = 120;
  const timelineWidthPx = useMemo(() => Math.max(1, monthsArray.length) * MONTH_COL_PX, [monthsArray.length]);
  const tableMinWidthPx = useMemo(() => {
    const wbsCol = 520; // wide enough to show full project names
    const durationCol = 112; // w-28
    const startCol = 144; // w-36
    const endCol = 144; // w-36
    const optionsCol = readOnly ? 0 : 80; // w-20
    return wbsCol + durationCol + startCol + endCol + timelineWidthPx + optionsCol;
  }, [timelineWidthPx, readOnly]);

  const monthScalePx = useMemo(() => {
    const startMonth = new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), 1);
    const startKey = startMonth.getFullYear() * 12 + startMonth.getMonth(); // month index

    const daysInMonth = (y: number, m1: number) => new Date(y, m1, 0).getDate(); // m1: 1..12

    const posPx = (iso: string | null, edge: "start" | "end"): number => {
      const p = parseISODateParts(iso);
      if (!p) return 0;
      const key = p.y * 12 + (p.m - 1);
      const idx = key - startKey; // 0..months-1
      const dim = daysInMonth(p.y, p.m);
      const frac = edge === "start" ? (p.d - 1) / dim : p.d / dim;
      const raw = (idx + frac) * MONTH_COL_PX;
      // clamp inside timeline
      return Math.max(0, Math.min(timelineWidthPx, raw));
    };

    return { posPx };
  }, [dateRange.start, timelineWidthPx]);

  const getTaskLeftPx = (start: string | null) => monthScalePx.posPx(start, "start");
  const getTaskRightPx = (end: string | null) => monthScalePx.posPx(end, "end");
  const getTaskWidthPx = (start: string | null, end: string | null) => {
    const l = getTaskLeftPx(start);
    const r = getTaskRightPx(end);
    // keep visible even for same-day tasks
    return Math.max(6, r - l);
  };

  type DisplayRow = FlatGanttRow & { depth: number; hasChildren: boolean };
  const displayRows = useMemo(() => {
    const out: DisplayRow[] = [];
    const visit = (node: FlatGanttRow, depth: number) => {
      const kids = childrenByParent.get(node.id) ?? [];
      const hasChildren = kids.length > 0;
      out.push({ ...(node as any), depth, hasChildren });
      if (hasChildren && expanded.has(node.id)) {
        for (const k of kids) visit(k, depth + 1);
      }
    };
    for (const r of roots) visit(r, 0);
    return out;
  }, [roots, childrenByParent, expanded]);

  if (!normalized.length) {
    return <div className="py-6 text-center text-muted-foreground">No schedule tasks found for this project.</div>;
  }

  const selectedActionByStakeholder = useMemo(() => {
    const idNum = Number(delayActionBy);
    if (!Number.isFinite(idNum)) return null;
    return stakeholders.find((s) => s.id === idNum) ?? null;
  }, [delayActionBy, stakeholders]);

  const todayT = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t.getTime();
  }, []);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={scrollRef}
      className="overflow-x-auto focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-lg"
      tabIndex={0}
      role="region"
      aria-label="Gantt chart timeline (use left/right arrow keys to scroll)"
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const el = scrollRef.current;
        if (!el) return;
        e.preventDefault();
        const base = 120; // ~1 month column
        const step = (e.shiftKey ? base * 4 : base) * (e.key === "ArrowRight" ? 1 : -1);
        el.scrollBy({ left: step, behavior: "smooth" });
      }}
    >
      <div style={{ minWidth: Math.max(1200, tableMinWidthPx) }}>
        {/* Header */}
        <div className="flex border-b mb-3">
          <div className="w-[280px] sm:w-[520px] font-semibold text-sm bg-muted/40 border-r border-border/60 px-3 py-2">
            WBS Subprocess
          </div>
          <div className="w-28 font-semibold text-sm bg-muted/40 border-r border-border/60 px-3 py-2 text-center">
            Duration
          </div>
          <div className="w-36 font-semibold text-sm bg-muted/40 border-r border-border/60 px-3 py-2 text-center">
            Start_Date
          </div>
          <div className="w-36 font-semibold text-sm bg-muted/40 border-r border-border/60 px-3 py-2 text-center">
            End_Date
          </div>
          <div className="shrink-0">
            <div className="grid grid-flow-col auto-cols-[120px] text-xs text-center" style={{ width: timelineWidthPx }}>
              {monthsArray.map((d, i) => (
                <div key={i} className="border-l py-2 font-medium">
                  {d.toLocaleDateString("en-US", { month: "short" })}
                  <div className="text-[10px] text-muted-foreground">{d.getFullYear()}</div>
                </div>
              ))}
            </div>
          </div>
          {!readOnly && (
            <div className="w-20 font-semibold text-sm bg-muted/40 border-l border-border/60 px-3 py-2 text-center">
              Options
            </div>
          )}
        </div>

        {/* Rows */}
        <div className="space-y-2">
          {displayRows.map((t) => {
            const leftPx = getTaskLeftPx(t.start);
            const widthPx = getTaskWidthPx(t.start, t.end);
            const actualWidthPx = widthPx * (clamp(t.progress ?? 0, 0, 100) / 100);
            const depthFont =
              t.depth === 0
                ? "text-sm font-bold"
                : t.depth === 1
                  ? "text-xs font-semibold"
                  : "text-xs font-medium";

            const levelMeta =
              t.depth === 0
                ? {
                    Icon: FolderKanban,
                    iconWrap: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
                  }
                : t.depth === 1
                  ? {
                      Icon: ListChecks,
                      iconWrap: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                    }
                  : {
                      Icon: CornerDownRight,
                      iconWrap: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                    };

            return (
              <div key={t.id} className="flex items-stretch gap-0 rounded-lg border border-border/60 bg-card/50">
                <div
                  className="w-[280px] min-w-[280px] sm:w-[520px] sm:min-w-[520px] border-r border-border/60 px-3 py-2 flex items-start gap-2"
                  style={{ paddingLeft: `${12 + t.depth * 18}px` }}
                  title={t.label}
                >
                  <div
                    className={`h-7 w-7 rounded-lg flex items-center justify-center border ${levelMeta.iconWrap}`}
                    title={t.depth === 0 ? "Project" : t.depth === 1 ? "Task" : "Subtask"}
                  >
                    <levelMeta.Icon className="h-4 w-4" />
                  </div>
                  {t.hasChildren ? (
                    <button
                      type="button"
                      onClick={() => {
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          next.has(t.id) ? next.delete(t.id) : next.add(t.id);
                          return next;
                        });
                      }}
                      className="h-5 w-5 flex items-center justify-center rounded border border-border/60 bg-background hover:bg-muted/60"
                      aria-label={expanded.has(t.id) ? "Collapse" : "Expand"}
                    >
                      {expanded.has(t.id) ? "▾" : "▸"}
                    </button>
                  ) : (
                    <span className="inline-block w-5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className={depthFont}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="whitespace-normal break-words leading-snug">{t.label}</span>
                        {t.has_delay ? (
                          <span
                            className="inline-flex items-center gap-0.5 shrink-0 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200"
                            title="A delay log exists for this activity"
                          >
                            <AlertTriangle className="h-3 w-3" aria-hidden />
                            Delay
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {(() => {
                        const prog = typeof t.progress === "number" && Number.isFinite(t.progress) ? t.progress : 0;
                        const completed = prog >= 100 || !!t.actual_end;
                        const started = prog > 0 || !!t.actual_start;
                        const startT = parseISOToLocalMidnight(t.start)?.getTime() ?? null;
                        const endT = parseISOToLocalMidnight(t.end)?.getTime() ?? null;

                        let label: "Pending" | "In Progress" | "Behind" | "Completed" = "Pending";
                        let cls = "text-muted-foreground font-semibold";

                        if (completed) {
                          label = "Completed";
                          cls = "text-emerald-600 font-semibold";
                        } else if (endT != null && endT < todayT) {
                          label = "Behind";
                          cls = "text-red-600 font-semibold";
                        } else if (started) {
                          label = "In Progress";
                          cls = "text-blue-600 font-semibold";
                        } else if (startT != null && startT > todayT) {
                          label = "Pending";
                          cls = "text-amber-600 font-semibold";
                        }

                        return <span className={cls}>• {label}</span>;
                      })()}
                    </div>
                  </div>
                </div>

                <div
                  className="w-28 border-r border-border/60 px-3 py-2 flex items-center justify-center text-xs tabular-nums text-muted-foreground"
                  title={t.duration_display ?? (typeof t.duration === "number" ? `${t.duration}` : "—")}
                >
                  {t.duration_display ?? (typeof t.duration === "number" ? t.duration : "—")}
                </div>

                <div
                  className="w-36 border-r border-border/60 px-3 py-2 flex items-center justify-center text-xs tabular-nums text-muted-foreground"
                  title={t.start ?? "—"}
                >
                  {t.start ?? "—"}
                </div>

                <div
                  className="w-36 border-r border-border/60 px-3 py-2 flex items-center justify-center text-xs tabular-nums text-muted-foreground"
                  title={t.end ?? "—"}
                >
                  {t.end ?? "—"}
                </div>

                <div className="shrink-0 bg-background/30" style={{ width: timelineWidthPx }}>
                  <div className="relative min-h-12 overflow-visible">
                    {/* Planned bar (top row) */}
                    <div
                      className="absolute h-4 rounded-md top-2 bg-emerald-600"
                      style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
                      title={`Planned: ${t.start ?? "—"} → ${t.end ?? "—"}`}
                    >
                      <span className="absolute left-2 top-0.5 text-[10px] font-semibold text-white/90 select-none">
                        Planned
                      </span>
                    </div>
                    {/* Actual/progress bar (bottom row) */}
                    <div
                      className="absolute h-4 rounded-md top-7 bg-sky-300"
                      style={{ left: `${leftPx}px`, width: `${actualWidthPx}px` }}
                      title={`Actual: ${Math.round(t.progress ?? 0)}%`}
                    >
                      <span className="absolute left-2 top-0.5 text-[10px] font-semibold text-slate-900/70 select-none">
                        A:{Math.round(clamp(t.progress ?? 0, 0, 100))}%
                      </span>
                    </div>
                  </div>
                </div>

                {!readOnly && (
                  <div className="w-20 border-l border-border/60 flex items-center justify-center">
                    {/* Show options only for leaf subtasks (not parent WBS rows). */}
                    {!t.hasChildren && t.depth >= 2 ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="h-9 w-9 rounded-lg border border-border/60 bg-background hover:bg-muted/60 flex items-center justify-center"
                            aria-label="Options"
                          >
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              setDelayRow(t);
                              setDelayStartDate(t.start ?? "");
                              setDelayEndDate(t.end ?? t.start ?? "");
                              setDelayCategory("");
                              const role = user?.role ?? user?.stakeholder_type ?? "";
                              setDelayOriginator(role ? String(role) : "—");
                              // Default "Action by" to the logged-in user's stakeholder id if available.
                              const sid = (user as any)?.stakeholder_id;
                              setDelayActionBy(sid != null ? String(sid) : "");
                              setDelayIssue("");
                              setDelayRecommendedAction("");
                              setDelayOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Delay
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              if (!onOpenAddDocument) {
                                toast({
                                  title: "Documents not available here",
                                  description:
                                    "Open the Photos & Docs tab to add documents for this project.",
                                });
                                return;
                              }
                              if (!t.db_id || !Number.isFinite(t.db_id)) {
                                toast({
                                  title: "Cannot attach document",
                                  description:
                                    "Missing activity id from API. Please refresh and try again.",
                                  variant: "destructive",
                                });
                                return;
                              }
                              onOpenAddDocument(t.id, t.label, t.db_id);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Add documents
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              setActiveRow(t);
                              setProgressValue(
                                typeof t.progress === "number" && Number.isFinite(t.progress)
                                  ? t.progress
                                  : 0,
                              );
                              setProgressDate(new Date().toISOString().slice(0, 10));
                              setProgressImages([]);
                              setProgressOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add progress
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="inline-block h-9 w-9" aria-hidden />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!readOnly && (
        <Dialog
          open={delayOpen}
          onOpenChange={(open) => {
            setDelayOpen(open);
            if (open && !stakeholdersLoaded) {
              void loadStakeholders();
            }
            if (!open) {
              setDelayRow(null);
              setDelayStartDate("");
              setDelayEndDate("");
              setDelayCategory("");
              setDelayOriginator("");
              setDelayIssue("");
              setDelayRecommendedAction("");
              setDelayActionBy("");
              setSavingDelay(false);
            }
          }}
        >
          <DialogContent className="w-[95vw] max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Delay</DialogTitle>
            </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Input value={projectName ?? (projectId != null ? `Project #${projectId}` : "—")} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label>Activity</Label>
                <Input value={delayRow?.label ?? ""} readOnly />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Delay Start date</Label>
                <Input type="date" value={delayStartDate} onChange={(e) => setDelayStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Delay End date</Label>
                <Input type="date" value={delayEndDate} onChange={(e) => setDelayEndDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Delay (days)</Label>
                <Input value={String(delayDays)} readOnly />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Originator</Label>
                <Input value={delayOriginator} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input
                  value={delayCategory}
                  onChange={(e) => setDelayCategory(e.target.value)}
                  placeholder="Type category…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Action by</Label>
                {stakeholders.length > 0 ? (
                  <Select value={delayActionBy} onValueChange={setDelayActionBy}>
                    <SelectTrigger>
                      <SelectValue placeholder={stakeholdersLoading ? "Loading..." : "Select stakeholder"} />
                    </SelectTrigger>
                    <SelectContent>
                      {stakeholders.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.stakeholder_title} ({s.stakeholder_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-2">
                    <Input
                      value={delayActionBy}
                      onChange={(e) => setDelayActionBy(e.target.value)}
                      placeholder={stakeholdersLoading ? "Loading stakeholders..." : "Enter stakeholder id (e.g. 1)"}
                      inputMode="numeric"
                    />
                    {!stakeholdersLoading && (
                      <Button type="button" variant="outline" size="sm" onClick={() => void loadStakeholders()}>
                        Retry load stakeholders
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Stakeholder type</Label>
                <Input value={selectedActionByStakeholder?.stakeholder_type ?? ""} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label>Stakeholder title</Label>
                <Input value={selectedActionByStakeholder?.stakeholder_title ?? ""} readOnly />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Issue</Label>
                <Textarea
                  value={delayIssue}
                  onChange={(e) => setDelayIssue(e.target.value)}
                  placeholder="Describe the issue due to which the delay occurred..."
                  className="min-h-[110px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Recommended action</Label>
                <Textarea
                  value={delayRecommendedAction}
                  onChange={(e) => setDelayRecommendedAction(e.target.value)}
                  placeholder="Recommended action to address the delay..."
                  className="min-h-[110px]"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDelayOpen(false)} disabled={savingDelay}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                savingDelay ||
                !delayRow ||
                projectId == null ||
                parseDelayLogActivityId(delayRow) == null ||
                !delayStartDate ||
                !delayEndDate ||
                !delayOriginator ||
                !delayCategory ||
                !delayIssue.trim() ||
                !delayRecommendedAction.trim() ||
                !Number.isFinite(Number(delayActionBy))
              }
              onClick={async () => {
                if (!delayRow) return;
                if (projectId == null) {
                  toast({
                    title: "Cannot save delay log",
                    description: "Missing project id. Please refresh and try again.",
                    variant: "destructive",
                  });
                  return;
                }
                const delayActivityId = parseDelayLogActivityId(delayRow);
                if (delayActivityId == null) {
                  toast({
                    title: "Cannot save delay log",
                    description: "Missing activity id from API. Please refresh and try again.",
                    variant: "destructive",
                  });
                  return;
                }
                const actionById = Number(delayActionBy);
                if (!Number.isFinite(actionById)) {
                  toast({
                    title: "Cannot save delay log",
                    description: "Please select Action by stakeholder.",
                    variant: "destructive",
                  });
                  return;
                }
                try {
                  setSavingDelay(true);
                  await addDelayLog({
                    project: projectId,
                    activity: delayActivityId,
                    delay_start_date: delayStartDate,
                    delay_end_date: delayEndDate,
                    category: delayCategory.trim(),
                    action_by: actionById,
                    issue: delayIssue.trim(),
                    recommended_action: delayRecommendedAction.trim(),
                  });
                  toast({
                    title: "Delay log saved",
                    description: `Delay ${delayDays} day(s) • ${delayCategory} • "${delayRow.label}".`,
                  });
                  setDelayOpen(false);
                  await onDelayLogSaved?.();
                } catch (err) {
                  toast({
                    title: "Failed to save delay log",
                    description: err instanceof Error ? err.message : "Please try again.",
                    variant: "destructive",
                  });
                } finally {
                  setSavingDelay(false);
                }
              }}
            >
              {savingDelay ? "Saving..." : "Save delay log"}
            </Button>
          </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {!readOnly && (
        <Dialog
          open={progressOpen}
          onOpenChange={(open) => {
            setProgressOpen(open);
            if (!open) {
              setActiveRow(null);
              setProgressImages([]);
              setProgressCaption("");
              setUploadingProgressImages(false);
              setSavingProgress(false);
            }
          }}
        >
          <DialogContent className="w-[95vw] max-w-xl">
            <DialogHeader>
              <DialogTitle>Add Progress</DialogTitle>
            </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Input value={projectName ?? (projectId != null ? `Project #${projectId}` : "—")} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label>Activity</Label>
                <Input value={activeRow?.label ?? ""} readOnly />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Progress</Label>
                <span className="text-sm font-semibold tabular-nums">{Math.round(progressValue)}%</span>
              </div>
              <Slider
                value={[progressValue]}
                min={0}
                max={100}
                step={1}
                onValueChange={(v) => setProgressValue(v?.[0] ?? 0)}
              />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                {[0, 20, 40, 60, 80, 100].map((m) => (
                  <span key={m}>{m}%</span>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label> Start date</Label>
                <Input type="date" value={activeRow?.start ?? ""} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label> End date</Label>
                <Input type="date" value={activeRow?.end ?? ""} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label>Progress date</Label>
                <Input type="date" value={progressDate} onChange={(e) => setProgressDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Picture (optional)</Label>
              <div
                className={`relative border-2 border-dashed rounded-lg p-5 flex items-center justify-between gap-4 transition-all ${
                  progressImages.length > 0
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/20 hover:border-primary/50 cursor-pointer"
                }`}
                onClick={() => document.getElementById("gantt-progress-image-input")?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    document.getElementById("gantt-progress-image-input")?.click();
                  }
                }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {progressImages.length > 0
                      ? `${progressImages.length} file(s) selected`
                      : "Click to upload progress picture(s)"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {progressImages.length > 0
                      ? progressImages.map((f) => f.name).join(", ")
                      : "PNG, JPG, JPEG"}
                  </p>
                  {uploadingProgressImages ? (
                    <p className="text-xs text-muted-foreground mt-1">Uploading…</p>
                  ) : null}
                </div>

                {progressImages.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProgressImages([]);
                    }}
                  >
                    Remove
                  </Button>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={(e) => e.preventDefault()}>
                    Choose file
                  </Button>
                )}

                <Input
                  id="gantt-progress-image-input"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    setProgressImages(files);
                    e.target.value = "";
                    if (!files.length) return;
                    if (!activeRow?.db_id || !Number.isFinite(activeRow.db_id)) {
                      toast({
                        title: "Cannot upload image",
                        description: "Missing activity id. Please refresh and try again.",
                        variant: "destructive",
                      });
                      return;
                    }
                    if (projectId == null) {
                      toast({
                        title: "Cannot upload image",
                        description: "Missing project id. Please reopen this project and try again.",
                        variant: "destructive",
                      });
                      return;
                    }

                    const imageDate = progressDate || new Date().toISOString().slice(0, 10);
                    const fallbackCaption = `Progress update • Activity: ${activeRow.label} • ${Math.round(progressValue)}%`;
                    const caption = (progressCaption || fallbackCaption).trim();

                    (async () => {
                      try {
                        setUploadingProgressImages(true);
                        for (const img of files) {
                          await createProgressImage({
                            project: projectId,
                            activity: activeRow.db_id!,
                            image: img,
                            image_date: imageDate,
                            caption,
                          });
                        }
                        toast({
                          title: "Image uploaded",
                          description: files.length === 1 ? "Progress image uploaded successfully." : `${files.length} images uploaded successfully.`,
                        });
                      } catch (err) {
                        toast({
                          title: "Failed to upload image",
                          description: err instanceof Error ? err.message : "Please try again.",
                          variant: "destructive",
                        });
                      } finally {
                        setUploadingProgressImages(false);
                      }
                    })();
                  }}
                />
              </div>
              <div className="mt-2 space-y-1.5">
                <Label>Caption (optional)</Label>
                <Input
                  placeholder="e.g., Site survey completed"
                  value={progressCaption}
                  onChange={(e) => setProgressCaption(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setProgressOpen(false)} disabled={savingProgress}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={savingProgress || !activeRow}
              onClick={async () => {
                if (!activeRow) return;
                if (!activeRow.db_id || !Number.isFinite(activeRow.db_id)) {
                  toast({
                    title: "Cannot update this activity",
                    description: "Missing activity id from API. Please refresh and try again.",
                    variant: "destructive",
                  });
                  return;
                }
                try {
                  setSavingProgress(true);
                  await updateTaskActual(activeRow.db_id, {
                    progress: Math.max(0, Math.min(100, Number(progressValue))),

                    actual_start:
                      progressValue > 0 && !activeRow.actual_start
                        ? progressDate
                        : undefined,

                    actual_end:
                      progressValue === 100
                        ? (progressDate || new Date().toISOString().slice(0,10))
                        : undefined,

                    // ✅ ADD THIS
                    progress_date: progressDate,
                  });

                  toast({
                    title: "Progress saved",
                    description:
                      progressImages.length > 0 ? "Progress updated. (Images upload when you select them.)" : "Progress updated successfully.",
                  });
                  setProgressOpen(false);
                  await onProgressSaved?.();
                } catch (err) {
                  toast({
                    title: "Failed to save progress",
                    description: err instanceof Error ? err.message : "Please try again.",
                    variant: "destructive",
                  });
                } finally {
                  setSavingProgress(false);
                }
              }}
            >
              {savingProgress ? "Saving..." : "Save progress"}
            </Button>
          </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
