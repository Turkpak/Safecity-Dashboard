// ProjectActivityManagement.tsx
import { Layout } from "@/components/layout/Layout";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { listProjects, getProjectGanttData, updateProjectActivity } from "@/api";
import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface GanttTask {
  id: string;             // database PK used for updates
  activity_id?: string;   // original identifier from XER or source, optional
  label: string;
  start: string | null;
  end: string | null;
  progress: number;
  parent?: string; // optional, used for sub-activities if provided by backend
}

export default function ProjectActivityManagement() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);
  const [loadingGantt, setLoadingGantt] = useState(false);
  const parseDate = (d: string | null) => (d ? new Date(d) : null);
  const [selectedDelayLog, setSelectedDelayLog] = useState<string[] | null>(null);

  // track which rows are expanded (showing details/sub-activities)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // storing user updates locally so we can render them separately
  const [updates, setUpdates] = useState<Record<string, { start: string | null; end: string | null }>>({});

  // currently editing task (for modal)
  const [editingTask, setEditingTask] = useState<{
    id: string;
    start: string | null;
    end: string | null;
  } | null>(null);
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

// optionally build a child map for hierarchical tasks
const childMap = useMemo(() => {
  const m: Record<string, GanttTask[]> = {};
  filteredTasks.forEach((t) => {
    if (t.parent) {
      m[t.parent] = m[t.parent] || [];
      m[t.parent].push(t);
    }
  });
  return m;
}, [filteredTasks]);

// mix in updated versions: for each original task, if we have an update and
// the dates differ, create a second entry flagged with `isUpdated`
interface DisplayTask extends GanttTask {
  isUpdated?: boolean;
  indent?: number; // for rendering children
}

const displayTasks: DisplayTask[] = [];
filteredTasks.forEach((t) => {
  if (t.parent) return; // skip, children will be inserted under parent
  displayTasks.push(t);
  const upd = updates[t.id];
  if (upd && (upd.start !== t.start || upd.end !== t.end)) {
    displayTasks.push({ ...t, start: upd.start, end: upd.end, isUpdated: true });
  }
  if (expandedTasks.has(t.id) && childMap[t.id]) {
    childMap[t.id].forEach((child) => {
      displayTasks.push({ ...child, indent: 1 });
      const upd2 = updates[child.id];
      if (upd2 && (upd2.start !== child.start || upd2.end !== child.end)) {
        displayTasks.push({ ...child, start: upd2.start, end: upd2.end, isUpdated: true, indent: 1 });
      }
    });
  }
});

  // Gantt helpers
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
  const offset = (startDate.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
  return (offset / totalDays) * 100;
};

const getTaskWidth = (start: string | null, end: string | null) => {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) return 2; // give at least some width
  const days = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) + 1;
  return (days / totalDays) * 100;
};
  const progressColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-lime-500", "bg-green-500"];
  const getProgressColor = (progress: number) => progressColors[Math.min(Math.floor(progress * 4), 4)];

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
  return (
    <Layout title="Project Activities">
      <div className="flex flex-col gap-8 max-w-[1400px] mx-auto pb-20">
        <div>
          <h1 className="text-2xl font-bold text-primary">Project Activities</h1>
          <p className="text-muted-foreground text-sm">
            View schedule activities imported from the XER file.
          </p>
        </div>

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
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No schedule activities found for this project.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-max">
                    {/* Header */}
                    <div className="mb-4 flex items-start">
  <div className="w-48 flex-shrink-0 flex items-center">
    <span className="text-xs font-semibold">Activity</span>
  </div>
  <div className="w-20 flex-shrink-0 flex items-center justify-center">
    <span className="text-xs font-semibold">Action</span>
  </div>

  <div className="flex-1 grid grid-flow-col auto-cols-[120px] text-xs text-center">

    {monthsArray.map((d, i) => (
      <div key={i} className="border-l py-1 font-medium">
        {d.toLocaleDateString("en-US", { month: "short" })}
        <div className="text-[10px] text-muted-foreground">
          {d.getFullYear()}
        </div>
      </div>
    ))}

  </div>

</div>

                    {/* Tasks */}
                    <div className="space-y-4">
                      {displayTasks.slice(0,150).map((task, index) => {
                        const rows: JSX.Element[] = [];
                        const plannedLeft = getTaskPosition(task.start);
                        const plannedWidth = getTaskWidth(task.start, task.end);
                        const actualWidth = plannedWidth * task.progress;

                        const today = new Date();
                        const endDate = task.end ? new Date(task.end) : null;
                        const delayLog =
                          endDate && task.progress < 1 && endDate < today
                            ? [`Task delayed by ${Math.ceil((today.getTime() - endDate.getTime()) / (1000*60*60*24))} days`]
                            : [];

                        const isUpdated = !!(task as any).isUpdated;

                        rows.push(
                          <div
                            key={`${task.id}-${index}-${isUpdated ? 'u' : 'p'}`}
                            className="flex items-center gap-2"
                          >
                            {/* Activity Name + expand arrow only on first (planned) record */}
                            <div className={`w-48 flex-shrink-0 flex items-center gap-1 ${task.indent ? 'pl-4' : ''}`}>
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

                            {/* spacer for action column */}
                            <div className="w-20 flex-shrink-0" />

                            {/* Timeline */}
                            <div className="flex-1 relative h-12 bg-muted/30 rounded-md border border-muted">
                              {/* Planned Bar */}
                              <div
                                className={`absolute h-4 ${isUpdated ? 'bg-blue-400' : 'bg-red-400'} rounded top-1`}
                                style={{ left: `${plannedLeft}%`, width: `${plannedWidth}%` }}
                              />

                              {/* Actual Progress Bar */}
                              <div
                                className="absolute h-4 bg-red-700 rounded top-6 flex items-center px-2 cursor-pointer"
                                style={{ left: `${plannedLeft}%`, width: `${actualWidth}%` }}
                                onClick={() => delayLog.length && setSelectedDelayLog(delayLog)}
                              >
                                <span className="text-white text-[10px] font-bold">{Math.round(task.progress * 100)}%</span>
                              </div>

                              {/* Delay Overlay (optional) */}
                              {delayLog.length > 0 && (
                                <div
                                  className="absolute h-full bg-red-900 opacity-50 cursor-pointer z-10"
                                  style={{ left: `${plannedLeft + actualWidth}%`, width: `${plannedWidth - actualWidth}%` }}
                                  onClick={() => setSelectedDelayLog(delayLog)}
                                />
                              )}
                            </div>

                            {/* Dates */}
                            <div className="w-32 flex-shrink-0 text-xs text-muted-foreground">
                              <div>{task.start ? new Date(task.start).toLocaleDateString() : "—"}</div>
                              <div>{task.end ? new Date(task.end).toLocaleDateString() : "—"}</div>
                            </div>

                            {/* Action button only on planned row */}
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
                          </div>
                        );


                        return rows;
                      })}

                    </div>

                    {/* Legend */}
                    <div className="mt-6 flex flex-wrap gap-6 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-red-400" />
                        <span>Planned</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-blue-400" />
                        <span>Updated</span>
                      </div>
                      {["0-20%", "20-40%", "40-60%", "60-80%", "80-100%"].map((label, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded ${progressColors[i]}`} />
                          <span>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      {/* Delay Modal */}
      {selectedDelayLog && (
        <Dialog open={true} onOpenChange={() => setSelectedDelayLog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delay Log</DialogTitle>
            </DialogHeader>
            <ul className="list-disc pl-6">
              {selectedDelayLog.map((log, i) => (
                <li key={i}>{log}</li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit activity modal */}
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
                    setEditingTask((prev) => prev && { ...prev, start: e.target.value || null })
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
                    setEditingTask((prev) => prev && { ...prev, end: e.target.value || null })
                  }
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 bg-gray-200 rounded"
                  onClick={() => setEditingTask(null)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-primary text-white rounded"
                  onClick={async () => {
                    if (!editingTask) return;
                    try {
                      await updateProjectActivity(Number(editingTask.id), {
                        start_date: editingTask.start,
                        end_date: editingTask.end,
                      });
                      // store local update so original values remain
                      setUpdates((u) => ({
                        ...u,
                        [editingTask.id]: {
                          start: editingTask.start,
                          end: editingTask.end,
                        },
                      }));
                    } catch (e) {
                      console.error("update failed", e);
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
    </Layout>
  );
}