// ProjectGanttChart.tsx
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getProjectGanttData } from "@/api";

interface GanttTask {
  id: string;
  label: string;
  start: string | null;
  end: string | null;
  progress: number; // 0-1
  delayLog?: string[];
}

interface ProjectGanttChartProps {
  projectId: number;
  searchQuery?: string;
}

export function ProjectGanttChart({ projectId, searchQuery = "" }: ProjectGanttChartProps) {
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDelayLog, setSelectedDelayLog] = useState<string[] | null>(null);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({ start: new Date(), end: new Date() });

  useEffect(() => {
    const fetchGantt = async () => {
      try {
        setLoading(true);
        const fetchedTasks = await getProjectGanttData(projectId);

        const today = new Date();
        const tasksWithDelay = fetchedTasks.map((t: any) => {
          const endDate = t.end ? new Date(t.end) : null;
          const isDelayed = endDate && t.progress < 1 && endDate < today;
          return {
            ...t,
            progress: t.progress ?? Math.random() * 0.8,
            delayLog: isDelayed ? [`Task delayed by ${Math.ceil((today.getTime() - endDate.getTime()) / (1000*60*60*24))} days`] : [],
          };
        });

        setTasks(tasksWithDelay);

        const starts = tasksWithDelay.map((t) => t.start && new Date(t.start)).filter(Boolean) as Date[];
        const ends = tasksWithDelay.map((t) => t.end && new Date(t.end)).filter(Boolean) as Date[];
        setDateRange({ start: new Date(Math.min(...starts.map((d) => d.getTime()))), end: new Date(Math.max(...ends.map((d) => d.getTime()))) });

        setError(null);
      } catch (err) {
        console.error(err);
        setError("Failed to load Gantt data");
      } finally {
        setLoading(false);
      }
    };

    fetchGantt();
  }, [projectId]);

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
      t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div>Loading...</div>;
  if (error || filteredTasks.length === 0) return <div>No tasks found.</div>;

  return (
    <>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Project Timeline (Gantt Chart)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="min-w-[1200px]">
            {/* Header */}
            <div className="flex border-b mb-4">
              <div className="w-56 font-semibold text-sm">Activity</div>
              <div className="flex-1 grid grid-flow-col auto-cols-[120px] text-xs text-center">
                {monthsArray.map((d, i) => (
                  <div key={i} className="border-l py-2 font-medium">
                    {d.toLocaleDateString("en-US", { month: "short" })}
                    <div className="text-[10px] text-muted-foreground">{d.getFullYear()}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tasks */}
            <div className="space-y-2">
              {filteredTasks.map((task) => {
                const left = getTaskPosition(task.start);
                const width = getTaskWidth(task.start, task.end);
                const actualWidth = width * task.progress;
                return (
                  <div key={task.id} className="flex items-center gap-2">
                    <div className="w-56 text-xs font-medium truncate">{task.label}</div>
                    <div className="flex-1 relative h-8 rounded overflow-visible bg-transparent">
                      <div className="absolute h-4 bg-red-400 rounded top-1" style={{ left: `${left}%`, width: `${width}%` }} />
                      <div className="absolute h-2 bg-red-700 rounded top-4" style={{ left: `${left}%`, width: `${actualWidth}%` }} />
                      {task.delayLog && task.delayLog.length > 0 && (
                        <div
                          className="absolute h-full bg-red-900 opacity-70 cursor-pointer"
                          style={{ left: `${left + actualWidth}%`, width: `${width - actualWidth}%` }}
                          onClick={() => setSelectedDelayLog(task.delayLog)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

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
    </>
  );
}