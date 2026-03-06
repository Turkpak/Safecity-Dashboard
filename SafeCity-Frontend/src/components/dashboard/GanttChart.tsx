import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProjectXerGanttData } from "@/api/projectActivity";
import { listPictorialArchives } from "@/api/pictorialArchive";
import type { PictorialArchive } from "@/api/types";

interface GanttTask {
  id: string;
  label: string;
  start: string | null;
  end: string | null;
  progress: number;
}

interface GanttChartProps {
  projectId: number;
}

function resolveMediaUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function ProjectGanttChart({ projectId }: GanttChartProps) {
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [archives, setArchives] = useState<PictorialArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({ start: null, end: null });

  useEffect(() => {
    const fetchGanttData = async () => {
      try {
        setLoading(true);
        const [fetchedTasks, fetchedArchives] = await Promise.all([
          getProjectXerGanttData(projectId),
          listPictorialArchives(projectId),
        ]);

        const dates: Date[] = [];
        for (const t of fetchedTasks) {
          if (t.start) dates.push(new Date(t.start));
          if (t.end) dates.push(new Date(t.end));
        }
        for (const a of fetchedArchives) {
          if (a.image_date) dates.push(new Date(a.image_date));
        }

        if (dates.length > 0) {
          setDateRange({
            start: new Date(Math.min(...dates.map((d) => d.getTime()))),
            end: new Date(Math.max(...dates.map((d) => d.getTime()))),
          });
        }

        setTasks(fetchedTasks);
        setArchives(Array.isArray(fetchedArchives) ? fetchedArchives : []);
        setError(null);
      } catch (err) {
        console.error("Failed to load Gantt data:", err);
        setError(err instanceof Error ? err.message : "Failed to load XER data");
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchGanttData();
    }
  }, [projectId]);

  if (loading) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Project Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || tasks.length === 0) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Project Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {error ? `Error: ${error}` : "No activities to display"}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalDays =
    dateRange.start && dateRange.end
      ? Math.ceil(
          (dateRange.end.getTime() - dateRange.start.getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1
      : 1;

  const getTaskPosition = (taskStart: string | null) => {
    if (!taskStart || !dateRange.start) return 0;
    const start = new Date(taskStart);
    const daysOffset = Math.floor(
      (start.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, (daysOffset / totalDays) * 100);
  };

  const getDatePosition = (isoDate: string) => {
    if (!isoDate || !dateRange.start) return 0;
    const d = new Date(isoDate);
    const daysOffset = Math.floor(
      (d.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, Math.min(100, (daysOffset / totalDays) * 100));
  };

  const getTaskWidth = (taskStart: string | null, taskEnd: string | null) => {
    if (!taskStart || !taskEnd || !dateRange.start) return 100;
    const start = new Date(taskStart);
    const end = new Date(taskEnd);
    const taskDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
    return Math.max(2, (taskDays / totalDays) * 100);
  };

  const progressColors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-lime-500",
    "bg-green-500",
  ];

  const getProgressColor = (progress: number) => {
    const index = Math.floor(progress * 4);
    return progressColors[Math.min(index, progressColors.length - 1)];
  };

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Project Timeline (Gantt Chart)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Header with month labels */}
            <div className="mb-4 flex items-start">
              <div className="w-48 flex-shrink-0" />
              <div className="flex-1 text-xs text-muted-foreground">
                {dateRange.start &&
                  dateRange.start.toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}{" "}
                →{" "}
                {dateRange.end &&
                  dateRange.end.toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
              </div>
            </div>

            {/* Tasks */}
            <div className="space-y-3">
              {/* Pictorial archive row (daily progress photos) */}
              {archives.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-48 flex-shrink-0">
                    <div className="text-xs font-semibold truncate">Pictorial Archive</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {archives.length} photo{archives.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="flex-1 relative h-10 bg-muted/30 rounded-md border border-muted overflow-hidden">
                    {archives
                      .slice()
                      .sort((a, b) => String(a.image_date).localeCompare(String(b.image_date)))
                      .map((a) => (
                        <a
                          key={a.id}
                          href={resolveMediaUrl(a.image)}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute top-1/2 -translate-y-1/2"
                          style={{ left: `calc(${getDatePosition(a.image_date)}% - 14px)` }}
                          title={`${a.image_date}${a.description ? ` — ${a.description}` : ""}`}
                        >
                          <img
                            src={resolveMediaUrl(a.image)}
                            alt={a.description || `archive-${a.id}`}
                            className="h-7 w-7 rounded border border-primary/30 object-cover shadow-sm hover:shadow-md transition-shadow"
                          />
                        </a>
                      ))}
                  </div>
                  <div className="w-32 flex-shrink-0 text-xs text-muted-foreground">
                    <div>—</div>
                    <div>—</div>
                  </div>
                </div>
              )}

              {tasks.map((task, idx) => (
                <div key={task.id} className="flex items-center gap-2">
                  {/* Task name */}
                  <div className="w-48 flex-shrink-0">
                    <div className="text-xs font-semibold truncate">
                      {task.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {task.id}
                    </div>
                  </div>

                  {/* Timeline bar */}
                  <div className="flex-1 relative h-10 bg-muted/30 rounded-md border border-muted">
                    {/* Progress bar */}
                    <div
                      className={`absolute h-full rounded-md ${getProgressColor(task.progress)} opacity-75 top-0 left-0 flex items-center px-2`}
                      style={{
                        left: `${getTaskPosition(task.start)}%`,
                        width: `${getTaskWidth(task.start, task.end)}%`,
                      }}
                    >
                      <span className="text-white text-xs font-bold">
                        {Math.round(task.progress * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="w-32 flex-shrink-0 text-xs text-muted-foreground">
                    <div>
                      {task.start
                        ? new Date(task.start).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </div>
                    <div>
                      {task.end
                        ? new Date(task.end).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-6 flex gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded" />
                <span>0-20%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded" />
                <span>20-40%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-500 rounded" />
                <span>40-60%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-lime-500 rounded" />
                <span>60-80%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded" />
                <span>80-100%</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
