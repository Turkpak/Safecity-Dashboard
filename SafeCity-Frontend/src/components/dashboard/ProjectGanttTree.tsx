import React, { useMemo, useState } from "react";
import { MoreVertical, Plus, Upload, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type FlatGanttRow = {
  id: string;
  label: string;
  start: string | null;
  end: string | null;
  progress: number; // 0..100
  parent?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
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

export function ProjectGanttTree({ tasks }: { tasks: FlatGanttRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

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
    // Stable sort within siblings by start date then label
    for (const entry of Array.from(childrenByParent.entries())) {
      const k = entry[0];
      const list = entry[1];
      list.sort((a: FlatGanttRow, b: FlatGanttRow) => {
        const as = a.start ?? "";
        const bs = b.start ?? "";
        if (as !== bs) return as.localeCompare(bs);
        return (a.label ?? "").localeCompare(b.label ?? "");
      });
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

  const getTaskLeftPct = (start: string | null) => {
    const s = parseDate(start);
    if (!s) return 0;
    const days = (s.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
    return (days / totalDays) * 100;
  };

  const getTaskWidthPct = (start: string | null, end: string | null) => {
    const s = parseDate(start);
    const e = parseDate(end);
    if (!s || !e) return 1;
    const days = (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24) + 1;
    return (days / totalDays) * 100;
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
          <div className="flex-1 grid grid-flow-col auto-cols-[120px] text-xs text-center">
            {monthsArray.map((d, i) => (
              <div key={i} className="border-l py-2 font-medium">
                {d.toLocaleDateString("en-US", { month: "short" })}
                <div className="text-[10px] text-muted-foreground">{d.getFullYear()}</div>
              </div>
            ))}
          </div>
          <div className="w-20 font-semibold text-sm bg-muted/40 border-l border-border/60 px-3 py-2 text-center">
            Options
          </div>
        </div>

        {/* Rows */}
        <div className="space-y-2">
          {displayRows.map((t) => {
            const left = getTaskLeftPct(t.start);
            const width = getTaskWidthPct(t.start, t.end);
            const actualWidth = width * (clamp(t.progress ?? 0, 0, 100) / 100);
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

            return (
              <div key={t.id} className="flex items-stretch gap-0 rounded-lg border border-border/60 bg-card/50">
                <div
                  className="w-80 min-w-[20rem] border-r border-border/60 px-3 py-2 truncate flex items-center gap-2"
                  style={{ paddingLeft: `${12 + t.depth * 18}px` }}
                  title={t.label}
                >
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
                      <span className="truncate block">{t.label}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Weight {w.toFixed(0)}%{" "}
                      <span className="text-red-600 font-semibold">• Behind</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 relative h-12 overflow-visible bg-background/30">
                  {/* Planned bar (top row) */}
                  <div
                    className="absolute h-4 rounded-md top-2 bg-sky-600"
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`Planned: ${t.start ?? "—"} → ${t.end ?? "—"}`}
                  >
                    <span className="absolute left-2 top-0.5 text-[10px] font-semibold text-white/90 select-none">
                      P:{Math.round(clamp(t.progress ?? 0, 0, 100))}%
                    </span>
                  </div>
                  {/* Actual/progress bar (bottom row) */}
                  <div
                    className="absolute h-4 rounded-md top-7 bg-sky-300"
                    style={{ left: `${left}%`, width: `${actualWidth}%` }}
                    title={`Actual: ${Math.round(t.progress ?? 0)}%`}
                  >
                    <span className="absolute left-2 top-0.5 text-[10px] font-semibold text-slate-900/70 select-none">
                      A:{Math.round(clamp(t.progress ?? 0, 0, 100))}%
                    </span>
                  </div>
                </div>

                <div className="w-20 border-l border-border/60 flex items-center justify-center">
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
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add delay log
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Upload className="h-4 w-4 mr-2" />
                        Add picture
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <FileText className="h-4 w-4 mr-2" />
                        Add documents
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add progress
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

