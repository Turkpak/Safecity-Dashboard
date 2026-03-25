import React, { useMemo, useState } from "react";

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

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1200px]">
        {/* Header */}
        <div className="flex border-b mb-4">
          <div className="w-80 font-semibold text-sm">Activity</div>
          <div className="flex-1 grid grid-flow-col auto-cols-[120px] text-xs text-center">
            {monthsArray.map((d, i) => (
              <div key={i} className="border-l py-2 font-medium">
                {d.toLocaleDateString("en-US", { month: "short" })}
                <div className="text-[10px] text-muted-foreground">{d.getFullYear()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="space-y-2">
          {displayRows.map((t) => {
            const left = getTaskLeftPct(t.start);
            const width = getTaskWidthPct(t.start, t.end);
            const actualWidth = width * (clamp(t.progress ?? 0, 0, 100) / 100);

            return (
              <div key={t.id} className="flex items-center gap-2">
                <div
                  className="w-80 text-xs font-medium truncate flex items-center gap-2"
                  style={{ paddingLeft: `${t.depth * 14}px` }}
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
                  <span className="truncate">{t.label}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{Math.round(t.progress ?? 0)}%</span>
                </div>

                <div className="flex-1 relative h-8 rounded overflow-visible bg-muted/20 border border-border/40">
                  {/* Planned bar */}
                  <div
                    className="absolute h-4 bg-blue-400/70 rounded top-1"
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`Planned: ${t.start ?? "—"} → ${t.end ?? "—"}`}
                  />
                  {/* Actual/progress bar */}
                  <div
                    className="absolute h-2 bg-blue-700 rounded top-4"
                    style={{ left: `${left}%`, width: `${actualWidth}%` }}
                    title={`Progress: ${Math.round(t.progress ?? 0)}%`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

