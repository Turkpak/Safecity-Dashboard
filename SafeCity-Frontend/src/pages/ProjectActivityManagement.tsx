// ProjectActivityManagement.tsx
import { Layout } from "@/components/layout/Layout";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { listProjects, getProjectGanttData, updateProjectActivity } from "@/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GanttTask {
  id: string;
  activity_id?: string;
  label: string;
  start: string | null;
  end: string | null;
  progress: number;
  parent?: string;
}

export default function ProjectActivityManagement() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);
  const [loadingGantt, setLoadingGantt] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [updates, setUpdates] = useState<Record<string, { start: string | null; end: string | null }>>({});
  const [editingTask, setEditingTask] = useState<{ id: string; start: string | null; end: string | null } | null>(null);
  const [selectedDelayLog, setSelectedDelayLog] = useState<string[] | null>(null);

  const parseDate = (d: string | null) => (d ? new Date(d) : null);

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  // Fetch Gantt tasks whenever project changes
  useEffect(() => {
    const fetchGantt = async () => {
      if (!selectedProjectId) {
        setGanttTasks([]);
        return;
      }
      setLoadingGantt(true);
      try {
        const tasks = await getProjectGanttData(selectedProjectId);
        setGanttTasks(tasks);
      } catch (err) {
        console.error(err);
        setGanttTasks([]);
      } finally {
        setLoadingGantt(false);
      }
    };
    fetchGantt();
  }, [selectedProjectId]);

  const filteredTasks = ganttTasks.filter(
    (t) =>
      t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(t.id).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const childMap = useMemo(() => {
    const map: Record<string, GanttTask[]> = {};
    filteredTasks.forEach((task) => {
      if (task.parent) {
        if (!map[task.parent]) map[task.parent] = [];
        map[task.parent].push(task);
      }
    });
    Object.keys(map).forEach((k) => map[k].sort((a, b) => (a.start || "").localeCompare(b.start || "")));
    return map;
  }, [filteredTasks]);

  // --------------- NEW: propagate updates to parents ----------------
  const updatedTaskIds = useMemo(() => {
    const updatedSet = new Set(Object.keys(updates));

    const parentMap: Record<string, string | undefined> = {};
    ganttTasks.forEach(t => { if (t.parent) parentMap[t.id] = t.parent; });

    let changed = true;
    while (changed) {
      changed = false;
      for (const task of ganttTasks) {
        if (task.parent && updatedSet.has(task.id) && !updatedSet.has(task.parent)) {
          updatedSet.add(task.parent);
          changed = true;
        }
      }
    }

    return updatedSet;
  }, [updates, ganttTasks]);
  // ------------------------------------------------------------------

  interface DisplayTask extends GanttTask {
    isUpdated?: boolean;
    indent?: number;
  }

  const displayTasks: DisplayTask[] = [];

  const addChildren = (parentId: string, indent: number) => {
    if (!childMap[parentId]) return;
    childMap[parentId].forEach((child) => {
      const upd = updates[child.id];
      const isUpdated = updatedTaskIds.has(child.id);
      const childToPush: DisplayTask = {
        ...child,
        start: upd?.start || child.start,
        end: upd?.end || child.end,
        isUpdated,
        indent,
      };
      displayTasks.push(childToPush);

      if (expandedTasks.has(child.id)) addChildren(child.id, indent + 1);
    });
  };

  filteredTasks.forEach((t) => {
    if (t.parent) return;

    const upd = updates[t.id];
    const isUpdated = updatedTaskIds.has(t.id);

    const taskToPush: DisplayTask = {
      ...t,
      start: upd?.start || t.start,
      end: upd?.end || t.end,
      isUpdated,
    };

    displayTasks.push(taskToPush);

    if (expandedTasks.has(t.id)) addChildren(t.id, 1);
  });

  // ----------------- Gantt calculations -----------------
  const dateRange = (() => {
    if (!ganttTasks.length) return { start: new Date(), end: new Date() };
    const dates = ganttTasks
      .flatMap((t) => [t.start ? new Date(t.start) : null, t.end ? new Date(t.end) : null])
      .filter((d): d is Date => d !== null);
    return {
      start: new Date(Math.min(...dates.map((d) => d.getTime()))),
      end: new Date(Math.max(...dates.map((d) => d.getTime()))),
    };
  })();

  const totalDays = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const getTaskPosition = (start: string | null) => {
    const startDate = parseDate(start);
    if (!startDate) return 0;
    return ((startDate.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;
  };

  const getTaskWidth = (start: string | null, end: string | null) => {
    const startDate = parseDate(start);
    const endDate = parseDate(end);
    if (!startDate || !endDate) return 2;
    const days = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) + 1;
    return (days / totalDays) * 100;
  };

  const monthsArray = useMemo(() => {
    const months = [];
    const current = new Date(dateRange.start);
    current.setDate(1);
    while (current <= dateRange.end) {
      months.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  }, [dateRange]);

  // ----------------- Render -----------------
  return (
    <Layout title="Project Activities">
      <div className="flex flex-col gap-8 max-w-[1400px] mx-auto pb-20">
        {/* Project Selector */}
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Select Project
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="project-select" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Project <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedProjectId ? String(selectedProjectId) : ""}
                  onValueChange={(v) => setSelectedProjectId(v ? Number(v) : null)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Choose project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.project_name || `#${p.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative w-full sm:w-72 mt-4 md:mt-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter activities..."
                  className="pl-10 h-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gantt Chart */}
        {selectedProjectId && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Project Timeline (Gantt Chart)</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingGantt ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No schedule activities found for this project.</div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-max">
                    {/* Header */}
                    <div className="mb-4 flex items-start">
                      <div className="w-48 flex-shrink-0 flex items-center"><span className="text-xs font-semibold">Activity</span></div>
                      <div className="w-20 flex-shrink-0 flex items-center justify-center"><span className="text-xs font-semibold">Action</span></div>
                      <div className="flex-1 grid grid-flow-col auto-cols-[120px] text-xs text-center">
                        {monthsArray.map((d, i) => (
                          <div key={i} className="border-l py-1 font-medium">
                            {d.toLocaleDateString("en-US", { month: "short" })}
                            <div className="text-[10px] text-muted-foreground">{d.getFullYear()}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tasks */}
                    <div className="space-y-4">
                      {displayTasks.slice(0, 150).map((task, index) => {
                        const isUpdated = !!task.isUpdated;
                        const left = getTaskPosition(task.start);
                        const width = getTaskWidth(task.start, task.end);
                        const actualWidth = width;
                        const delayLog =
                          task.end && task.progress < 1 && new Date(task.end) < new Date()
                            ? [`Task delayed by ${Math.ceil((new Date().getTime() - new Date(task.end).getTime())/(1000*60*60*24))} days`]
                            : [];

                        return (
                          <div key={`${task.id}-${index}-${isUpdated ? 'u' : 'p'}`} className="flex items-center gap-2">
                            {/* Activity Name + Expand */}
                            <div className="w-48 flex-shrink-0 flex items-center gap-1" style={{ paddingLeft: `${(task.indent || 0) * 16}px` }}>
                              {!isUpdated && childMap[task.id] && childMap[task.id].length > 0 && (
                                <button
                                  onClick={() => {
                                    const copy = new Set(expandedTasks);
                                    copy.has(task.id) ? copy.delete(task.id) : copy.add(task.id);
                                    setExpandedTasks(copy);
                                  }}
                                  className="text-xs"
                                >
                                  {expandedTasks.has(task.id) ? '▾' : '▸'}
                                </button>
                              )}
                              <div className={`text-xs font-semibold truncate ${isUpdated ? 'italic text-muted-foreground' : ''}`}>
                                {task.label}{task.activity_id ? ` (${task.activity_id})` : ''}
                              </div>
                            </div>

                            {/* Action */}
                            {!isUpdated && (
                              <div className="w-20 flex-shrink-0">
                                <button
                                  className="text-xs underline text-primary"
                                  onClick={() => setEditingTask({ id: task.id, start: task.start, end: task.end })}
                                >
                                  Action
                                </button>
                              </div>
                            )}

                            {/* Timeline */}
                            <div className="flex-1 relative h-12 bg-muted/30 rounded-md border border-muted">
                              <div className="absolute h-4 bg-red-400 rounded" style={{ top: "4px", left: `${left}%`, width: `${width}%` }}
  />
                              {isUpdated && (
                                <div className="absolute h-4 bg-green-500 rounded" style={{ top: "10px", left: `${left}%`, width: `${width}%` }}    />
                              )}
                              {delayLog.length > 0 && (
                                <div
                                  className="absolute h-full bg-red-900 opacity-50 cursor-pointer z-10"
                                  style={{ left: `${left + actualWidth}%`, width: `${width - actualWidth}%` }}
                                  onClick={() => setSelectedDelayLog(delayLog)}
                                />
                              )}
                            </div>

                            {/* Dates */}
                            <div className="w-32 flex-shrink-0 text-xs text-muted-foreground">
                              <div>{task.start ? new Date(task.start).toLocaleDateString() : "—"}</div>
                              <div>{task.end ? new Date(task.end).toLocaleDateString() : "—"}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div className="mt-6 flex flex-wrap gap-6 text-xs">
                      <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-red-400" />Planned</div>
                      <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-green-500" />Updated</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Delay Modal */}
        {selectedDelayLog && (
          <Dialog open={true} onOpenChange={() => setSelectedDelayLog(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delay Log</DialogTitle>
              </DialogHeader>
              <ul className="list-disc pl-6">
                {selectedDelayLog.map((log, i) => <li key={i}>{log}</li>)}
              </ul>
            </DialogContent>
          </Dialog>
        )}

        {/* Edit Task Modal */}
        {editingTask && (
          <Dialog open={true} onOpenChange={() => setEditingTask(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Update Activity Dates</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-col">
                  <Label htmlFor="edit-start">Start Date</Label>
                  <Input
                    id="edit-start"
                    type="date"
                    value={editingTask.start || ""}
                    onChange={(e) =>
                      setEditingTask((prev) => prev ? { ...prev, start: e.target.value || null } : prev)
                    }
                  />
                </div>
                <div className="flex flex-col">
                  <Label htmlFor="edit-end">End Date</Label>
                  <Input
                    id="edit-end"
                    type="date"
                    value={editingTask.end || ""}
                    onChange={(e) =>
                      setEditingTask((prev) => prev ? { ...prev, end: e.target.value || null } : prev)
                    }
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => setEditingTask(null)}>Cancel</button>
                  <button
                    className="px-4 py-2 bg-primary text-white rounded"
                    onClick={async () => {
                      if (!editingTask) return;
                      try {
                        await updateProjectActivity(Number(editingTask.id), {
                          start_date: editingTask.start,
                          end_date: editingTask.end,
                        });
                        setUpdates((prev) => ({
                          ...prev,
                          [editingTask.id]: { start: editingTask.start, end: editingTask.end },
                        }));
                      } catch (e) {
                        console.error(e);
                        alert("Failed to update activity. Try again.");
                      } finally {
                        setEditingTask(null);
                      }
                    }}
                  >
                    Update
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </Layout>
  );
}