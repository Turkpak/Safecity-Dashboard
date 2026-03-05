import { Layout } from "@/components/layout/Layout";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit2, Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  listProjectActivities,
  createProjectActivity,
  updateProjectActivity,
  deleteProjectActivity,
  listProjects,
} from "@/api";
import { ProjectGanttChart } from "@/components/dashboard/GanttChart";
import type {
  ProjectActivity,
  ProjectActivityCreateInput,
  ProjectActivityUpdateInput,
  Project,
} from "@/api/types";

export default function ProjectActivityManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // project selector
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [activityId, setActivityId] = useState("");
  const [activityName, setActivityName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [finishDate, setFinishDate] = useState("");
  const [percentComplete, setPercentComplete] = useState<string>("");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ["projectActivities", selectedProjectId],
    queryFn: () => listProjectActivities(selectedProjectId ?? undefined),
    enabled: selectedProjectId != null,
  });

  const createMutation = useMutation({
    mutationFn: (payload: ProjectActivityCreateInput) => createProjectActivity(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectActivities", selectedProjectId] });
      toast({ title: "Success", description: "Activity created." });
      resetForm();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to create activity", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ProjectActivityUpdateInput }) =>
      updateProjectActivity(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectActivities", selectedProjectId] });
      toast({ title: "Success", description: "Activity updated." });
      resetForm();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to update activity", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProjectActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectActivities", selectedProjectId] });
      toast({ title: "Deleted", description: "Activity removed." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to delete activity", variant: "destructive" });
    },
  });

  const handleEdit = (act: ProjectActivity) => {
    setEditingId(act.id);
    setActivityId(act.activity_id);
    setActivityName(act.activity_name);
    setStartDate(act.start_date ?? "");
    setFinishDate(act.finish_date ?? "");
    setPercentComplete(String(act.percent_complete));
  };

  const resetForm = () => {
    setEditingId(null);
    setActivityId("");
    setActivityName("");
    setStartDate("");
    setFinishDate("");
    setPercentComplete("");
  };

  const handleSubmit = () => {
    if (selectedProjectId == null) {
      toast({ title: "Error", description: "Select a project first", variant: "destructive" });
      return;
    }

    const payload: ProjectActivityCreateInput | ProjectActivityUpdateInput = {
      project: selectedProjectId,
      activity_id: activityId.trim(),
      activity_name: activityName.trim(),
      start_date: startDate || null,
      finish_date: finishDate || null,
      percent_complete: percentComplete ? Number(percentComplete) : undefined,
    };

    if (editingId != null) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload as ProjectActivityCreateInput);
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Delete this activity?")) {
      deleteMutation.mutate(id);
    }
  };

  const filtered = activities.filter((a) =>
    a.activity_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.activity_id.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <Layout title="Project Activities">
      <div className="flex flex-col gap-8 max-w-[1400px] mx-auto pb-20">
        <div>
          <h1 className="text-2xl font-bold text-primary">Project Activities</h1>
          <p className="text-muted-foreground text-sm">
            Manage schedule activities attached to a project.
          </p>
        </div>

        <Card className="border-none shadow-sm overflow-hidden">
          <div className="h-1 bg-secondary w-full" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              {editingId != null ? "Edit Activity" : "New Activity"}
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
              <div className="space-y-2">
                <Label htmlFor="activity-id" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Activity ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="activity-id"
                  value={activityId}
                  onChange={(e) => setActivityId(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="activity-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Activity Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="activity-name"
                  value={activityName}
                  onChange={(e) => setActivityName(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start-date" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Start Date
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="finish-date" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Finish Date
                </Label>
                <Input
                  id="finish-date"
                  type="date"
                  value={finishDate}
                  onChange={(e) => setFinishDate(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="percent-complete" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  % Complete
                </Label>
                <Input
                  id="percent-complete"
                  type="number"
                  min={0}
                  max={100}
                  value={percentComplete}
                  onChange={(e) => setPercentComplete(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-secondary hover:bg-secondary/90 text-white h-10"
              >
                {editingId != null ? "Update" : <><Plus className="h-4 w-4 mr-2" /> Create</>}
              </Button>
              {editingId != null && (
                <Button variant="outline" onClick={resetForm} className="h-10">
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-primary">Activities</h2>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter..."
                className="pl-10 h-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <Card className="border-none shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Activity ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Finish</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activitiesLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        {selectedProjectId ? "No activities" : "Select a project to view activities."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((act, idx) => (
                      <TableRow key={act.id}>
                        <TableCell className="font-medium">{idx + 1}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-sm">{act.id}</TableCell>
                        <TableCell>{act.activity_id}</TableCell>
                        <TableCell>{act.activity_name}</TableCell>
                        <TableCell>{act.start_date}</TableCell>
                        <TableCell>{act.finish_date}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(act)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(act.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        {selectedProjectId && (
          <ProjectGanttChart projectId={selectedProjectId} />
        )}
      </div>
    </Layout>
  );
}
