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
import { listProjects, getProjectGanttData } from "@/api";
import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface GanttTask {
  id: string;
  label: string;
  start: string | null;
  end: string | null;
  progress: number;
}

export default function ProjectActivityManagement() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);
  const [loadingGantt, setLoadingGantt] = useState(false);
  const parseDate = (d: string | null) => (d ? new Date(d.replace(" ", "T")) : null);
  const [selectedDelayLog, setSelectedDelayLog] = useState<string[] | null>(null);
  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  // Fetch Gantt tasks whenever project changes
useEffect(() => {
  const fetchGantt = async () => {
    console.log("Fetching Gantt for projectId:", selectedProjectId);
    if (!selectedProjectId) {
      setGanttTasks([]);
      return;
    }
    setLoadingGantt(true);
    try {
      const tasks = await getProjectGanttData(selectedProjectId);
      console.log("Fetched tasks:", tasks);
      const tasksWithProgress = tasks.map((t: any) => ({
        ...t,
        progress: t.progress ?? Math.random() * 0.8
      }));

      setGanttTasks(tasksWithProgress);
    } catch (err) {
      console.error("Error fetching Gantt tasks:", err);
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
  <div className="w-48 flex-shrink-0" />

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
                      {filteredTasks.slice(0,150).map((task) => {
  const plannedLeft = getTaskPosition(task.start);
  const plannedWidth = getTaskWidth(task.start, task.end);
  const actualWidth = plannedWidth * task.progress;

  // Calculate delay log
  const today = new Date();
  const endDate = task.end ? new Date(task.end) : null;
  const delayLog =
    endDate && task.progress < 1 && endDate < today
      ? [`Task delayed by ${Math.ceil((today.getTime() - endDate.getTime()) / (1000*60*60*24))} days`]
      : [];

  return (
    <div key={task.id} className="flex items-center gap-2">
      {/* Activity Name */}
      <div className="w-48 flex-shrink-0">
        <div className="text-xs font-semibold truncate">{task.label}</div>
        <div className="text-xs text-muted-foreground">{task.id}</div>
      </div>

      {/* Timeline */}
      <div className="flex-1 relative h-12 bg-muted/30 rounded-md border border-muted">
        {/* Planned Bar */}
        <div
          className="absolute h-4 bg-red-400 rounded top-1"
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
    </div>
  );
})}

                    </div>

                    {/* Legend */}
                    <div className="mt-6 flex gap-4 text-xs">
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
    </Layout>
  );
}