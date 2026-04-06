import React, { useMemo, useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { updateTaskActual, createPictorialArchive, addDelayLog } from "@/api";

type FlatGanttRow = {
  id: string;
  label: string;
  start: string | null;
  end: string | null;
  progress: number;
  parent?: string;
  order?: number;
  db_id?: number;
  /** From nested gantt `activity_id` — this is what `POST add-delay-log/` expects as `activity`. */
  activity_id?: string;

  // ✅ ADD THESE
  actual_start?: string | null;
  actual_end?: string | null;
  has_delay?: boolean;
  delay_info?: unknown;
};

/** Delay log API uses nested gantt `activity_id` (numeric string), not the row's internal `id` (`db_id`). */
function parseDelayLogActivityId(row: FlatGanttRow): number | null {
  const raw = row.activity_id;
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(String(raw).trim());
  return Number.isFinite(n) ? n : null;
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
  readOnly = false,
}: {
  tasks: FlatGanttRow[];
  projectName?: string;
  projectId?: number;
  onOpenAddDocument?: (taskId: string, taskName: string) => void;
  /** Called after a delay log is saved so the parent can refetch `project-gantt-nested` (updates `has_delay`). */
  onDelayLogSaved?: () => void | Promise<void>;
  readOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const { toast } = useToast();
  const { user } = useAuth();

  const [progressOpen, setProgressOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<FlatGanttRow | null>(null);
  const [progressValue, setProgressValue] = useState<number>(0);
  const [progressDate, setProgressDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [progressImages, setProgressImages] = useState<File[]>([]);
  const [savingProgress, setSavingProgress] = useState(false);

  const [delayOpen, setDelayOpen] = useState(false);
  const [delayRow, setDelayRow] = useState<FlatGanttRow | null>(null);
  const [delayStartDate, setDelayStartDate] = useState<string>("");
  const [delayEndDate, setDelayEndDate] = useState<string>("");
  const [delayCategory, setDelayCategory] = useState<string>("");
  const [delayCategoryOpen, setDelayCategoryOpen] = useState(false);
  const [delayCategoryQuery, setDelayCategoryQuery] = useState("");
  const [delayOriginator, setDelayOriginator] = useState<string>("");
  const [delayIssue, setDelayIssue] = useState<string>("");
  const [delayRecommendedAction, setDelayRecommendedAction] = useState<string>("");
  const [delayActionBy, setDelayActionBy] = useState<string>("");
  const [savingDelay, setSavingDelay] = useState(false);

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

  // Frontend-only derived weight: share of overall schedule duration (rough, but gives the UI a meaningful number).
  const overallMs = Math.max(1, dateRange.end.getTime() - dateRange.start.getTime());

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1200px]">
        {/* Header */}
        <div className="flex border-b mb-3">
          <div className="w-80 font-semibold text-sm bg-muted/40 border-r border-border/60 px-3 py-2">
            WBS Subprocess
          </div>
          <div className="flex-1 overflow-hidden">
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
            const s = parseDate(t.start);
            const e = parseDate(t.end);
            const w =
              s && e
                ? Math.max(0, Math.min(100, ((e.getTime() - s.getTime()) / overallMs) * 100))
                : 0;
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
                  className="w-80 min-w-[20rem] border-r border-border/60 px-3 py-2 truncate flex items-center gap-2"
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
                        <span className="truncate block">{t.label}</span>
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
                      Weight {w.toFixed(0)}%{" "}
                      <span className="text-red-600 font-semibold">• Behind</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden bg-background/30">
                  <div className="relative h-12 overflow-visible" style={{ width: timelineWidthPx }}>
                    {/* Planned bar (top row) */}
                    <div
                      className="absolute h-4 rounded-md top-2 bg-sky-600"
                      style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
                      title={`Planned: ${t.start ?? "—"} → ${t.end ?? "—"}`}
                    >
                      <span className="absolute left-2 top-0.5 text-[10px] font-semibold text-white/90 select-none">
                        P:{Math.round(clamp(t.progress ?? 0, 0, 100))}%
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
                              setDelayCategoryOpen(false);
                              setDelayCategoryQuery("");
                              const role = user?.role ?? user?.stakeholder_type ?? "";
                              setDelayOriginator(role ? String(role) : "—");
                              setDelayActionBy(role ? String(role) : "");
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
                              if (onOpenAddDocument) {
                                onOpenAddDocument(t.id, t.label);
                                return;
                              }
                              toast({
                                title: "Documents not available here",
                                description:
                                  "Open the Photos & Docs tab to add documents for this project.",
                              });
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
            if (!open) {
              setDelayRow(null);
              setDelayStartDate("");
              setDelayEndDate("");
              setDelayCategory("");
              setDelayCategoryOpen(false);
              setDelayCategoryQuery("");
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
                <Popover open={delayCategoryOpen} onOpenChange={setDelayCategoryOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={delayCategoryOpen}
                      className="w-full justify-between font-normal h-10 px-3 text-sm"
                    >
                      <span className="truncate">{delayCategory ? delayCategory : "Select category"}</span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command
                      filter={(value, search) => {
                        const q = (search || "").toLowerCase();
                        if (!q) return 1;
                        return (value || "").toLowerCase().includes(q) ? 1 : 0;
                      }}
                    >
                      <CommandInput
                        placeholder="Type category…"
                        value={delayCategoryQuery}
                        onValueChange={setDelayCategoryQuery}
                      />
                      <CommandList>
                        <CommandEmpty>
                          <div className="p-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full justify-center"
                              disabled={!delayCategoryQuery.trim()}
                              onClick={() => {
                                const v = delayCategoryQuery.trim();
                                if (!v) return;
                                setDelayCategory(v);
                                setDelayCategoryOpen(false);
                              }}
                            >
                              Use “{delayCategoryQuery.trim() || "…"}”
                            </Button>
                          </div>
                        </CommandEmpty>
                        <CommandGroup />
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label>Action by</Label>
                <Select value={delayActionBy} onValueChange={setDelayActionBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(
                      new Set(
                        [user?.role, user?.stakeholder_type, "super_admin", "contractor", "consultant"]
                          .filter(Boolean)
                          .map((v) => String(v))
                      )
                    ).map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                !delayActionBy
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
                    description: "Missing activity_id from Gantt API. Please refresh and try again.",
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
                    action_by: delayActionBy,
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
                  }}
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

                    // ✅ only send if not already set
                    actual_start:
                      progressValue > 0 && !activeRow.actual_start
                        ? progressDate
                        : undefined,

                    // ✅ only when completed
                    actual_end:
                      progressValue === 100
                        ? progressDate
                        : undefined,
                  });

                  if (progressImages.length > 0 && projectId != null) {
                    for (const img of progressImages) {
                      await createPictorialArchive({
                        project: projectId,
                        image: img,
                        image_date: progressDate || new Date().toISOString().slice(0, 10),
                        description: `Progress update • Activity: ${activeRow.label} • ${Math.round(progressValue)}%`,
                      });
                    }
                  }

                  toast({
                    title: "Progress saved",
                    description: progressImages.length > 0
                      ? projectId != null
                        ? "Progress updated and picture(s) attached."
                        : "Progress updated (picture not saved: missing project context)."
                      : "Progress updated successfully.",
                  });
                  setProgressOpen(false);
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
