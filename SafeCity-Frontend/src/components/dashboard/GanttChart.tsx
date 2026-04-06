// ProjectGanttChart.tsx
import { useEffect, useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listProjects, getProjectGanttData } from "@/api";
import { ProjectGanttTree } from "@/components/dashboard/ProjectGanttTree";

interface GanttTask {
  id: string;
  label: string;
  start: string | null;
  end: string | null;
  progress: number; // 0-100
  parent?: string;
}

interface ProjectGanttChartProps {
  projectId?: number;          // optional so wrapper can supply a selector
  searchQuery?: string;
}

export function ProjectGanttChart({ projectId: propProjectId, searchQuery = "" }: ProjectGanttChartProps) {
  // allow internal selection when no projectId is passed
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    propProjectId != null ? propProjectId : null
  );
  const [searchQueryLocal, setSearchQueryLocal] = useState(searchQuery);

  // fetch list of projects only when we need a selector
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
    enabled: propProjectId == null,
  });

  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDelayLog, setSelectedDelayLog] = useState<string[] | null>(null);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({ start: new Date(), end: new Date() });

  const loadGantt = useCallback(async () => {
    if (!selectedProjectId) {
      setTasks([]);
      return;
    }
    try {
      setLoading(true);
      const fetchedTasks = await getProjectGanttData(selectedProjectId);
      // Backend now provides real progress in 0..100 and proper dates (including rollups for WBS nodes).
      const normalized = (fetchedTasks || []).map((t: any) => ({
        ...t,
        progress:
          typeof t?.progress === "number" && Number.isFinite(t.progress)
            ? Math.max(0, Math.min(100, t.progress))
            : 0,
      }));

      setTasks(normalized);

      const starts = normalized.map((t) => t.start && new Date(t.start)).filter(Boolean) as Date[];
      const ends = normalized.map((t) => t.end && new Date(t.end)).filter(Boolean) as Date[];
      if (starts.length && ends.length) {
        setDateRange({
          start: new Date(Math.min(...starts.map((d) => d.getTime()))),
          end: new Date(Math.max(...ends.map((d) => d.getTime()))),
        });
      }

      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load Gantt data");
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadGantt();
  }, [loadGantt]);

  const totalDays = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000*60*60*24)) + 1;

  const getTaskPosition = (start: string | null) => {
    if (!start) return 0;
    const startDate = new Date(start);
    return ((startDate.getTime() - dateRange.start.getTime()) / (1000*60*60*24) / totalDays) * 100;
  };

  const getTaskWidth = (start: string | null, end: string | null) => {
    if (!start || !end) return 2;
    const startDate = new Date(start);
    const endDate = new Date(end);
    return ((endDate.getTime() - startDate.getTime()) / (1000*60*60*24) + 1) / totalDays * 100;
  };

  const progressColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-lime-500", "bg-green-500"];
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

  const filteredTasks = tasks.filter(
    (t) =>
      t.label.toLowerCase().includes(searchQueryLocal.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQueryLocal.toLowerCase())
  );

  // if we are in selector mode and no project chosen yet, prompt user
  if (!propProjectId && !selectedProjectId) {
    return <div className="py-8 text-center text-muted-foreground">Please select a project above to view the Gantt chart.</div>;
  }

  if (loading) return <div>Loading...</div>;
  if (error || filteredTasks.length === 0) return <div>No tasks found.</div>;

  return (
    <>
      {/* selector UI only when propProjectId wasn't provided */}
      {!propProjectId && (
        <Card className="border-none shadow-sm overflow-hidden mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Select Project
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  value={searchQueryLocal}
                  onChange={(e) => setSearchQueryLocal(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Project Timeline (Gantt Chart)</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectGanttTree
            tasks={filteredTasks as any}
            projectId={selectedProjectId ?? undefined}
            projectName={
              selectedProjectId != null
                ? projects.find((p) => p.id === selectedProjectId)?.project_name ?? `#${selectedProjectId}`
                : undefined
            }
            onDelayLogSaved={loadGantt}
          />
        </CardContent>
      </Card>
    </>
  );
}