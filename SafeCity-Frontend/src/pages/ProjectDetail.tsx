import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CalendarDays, FolderKanban, MapPin, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getProjectById } from "@/api/project";
import { getProjectGanttData } from "@/api/projectActivity";
import { formatProgress } from "@/utils/dashboardPhysicalProgress";
import { ProjectGanttTree } from "@/components/dashboard/ProjectGanttTree";

function numberValue(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

function textValue(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export default function ProjectDetail() {
  const [location, setLocation] = useLocation();
  const pathParts = location.split("/").filter(Boolean);
  const rawProjectId = pathParts[pathParts.length - 1] ?? "";
  const projectId = Number(rawProjectId);
  const hasValidProjectId = Number.isFinite(projectId) && projectId > 0;

  const projectQuery = useQuery({
    queryKey: ["project-detail", projectId],
    queryFn: () => getProjectById(projectId),
    enabled: hasValidProjectId,
  });

  const ganttQuery = useQuery({
    queryKey: ["project-gantt", projectId],
    queryFn: () => getProjectGanttData(projectId),
    enabled: hasValidProjectId,
  });

  const project = projectQuery.data as any;
  const physicalProgress = numberValue(project?.physical_progress ?? project?.progress ?? 0);
  const financialProgress = numberValue(project?.financial_progress ?? project?.percentage_utilization_total ?? 0);
  const tasks = ganttQuery.data ?? [];
  const completedActivities = tasks.filter((task) => numberValue(task.progress) >= 100).length;
  const inProgressActivities = tasks.filter((task) => numberValue(task.progress) > 0 && numberValue(task.progress) < 100).length;
  const notStartedActivities = tasks.filter((task) => numberValue(task.progress) <= 0).length;

  if (!hasValidProjectId) {
    return (
      <Layout title="Project Details">
        <div className="space-y-6">
          <Button variant="outline" onClick={() => setLocation("/")} className="rounded-xl">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              This route does not contain a valid project ID. Project details are loaded from the backend API only; no hardcoded project data is used.
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (projectQuery.isLoading) {
    return (
      <Layout title="Project Details">
        <Card>
          <CardContent className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading project details from backend...
          </CardContent>
        </Card>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout title="Project Not Found">
        <div className="space-y-6">
          <Button variant="outline" onClick={() => setLocation("/")} className="rounded-xl">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Project record was not returned by the backend API.
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Project Details">
      <div className="space-y-6">
        <Button variant="outline" onClick={() => setLocation("/")} className="rounded-xl">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>

        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-2xl font-heading">
                  {textValue(project.project_name, `Project #${projectId}`)}
                </CardTitle>
                <CardDescription className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1"><FolderKanban className="h-4 w-4" /> {textValue(project.project_reference_no, "No reference")}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {textValue(project.division_name ?? project.district_name ?? project.tehsil_name, "Location pending")}</span>
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {textValue(project.project_starting_date, "Start date pending")}</span>
                </CardDescription>
              </div>
              <Badge variant="outline" className="w-fit text-sm capitalize">
                {textValue(project.status, "status pending").replace(/_/g, " ")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Physical progress</p><p className="mt-2 text-3xl font-bold text-primary">{formatProgress(physicalProgress)}%</p><Progress value={physicalProgress} className="mt-3" /></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Financial progress</p><p className="mt-2 text-3xl font-bold text-emerald-600">{formatProgress(financialProgress)}%</p><Progress value={financialProgress} className="mt-3" /></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Activities</p><p className="mt-2 text-3xl font-bold">{tasks.length}</p><p className="mt-1 text-xs text-muted-foreground">Loaded from project Gantt API</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Execution mix</p><p className="mt-2 text-sm text-muted-foreground">Completed {completedActivities} · In progress {inProgressActivities} · Not started {notStartedActivities}</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Project Gantt / WBS</CardTitle>
                <CardDescription>Activity hierarchy loaded from backend Project Gantt API.</CardDescription>
              </CardHeader>
              <CardContent>
                {ganttQuery.isLoading ? (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" /> Loading activities...</div>
                ) : tasks.length > 0 ? (
                  <ProjectGanttTree tasks={tasks as any} projectId={projectId} />
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    No activity/Gantt data is available for this project yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
