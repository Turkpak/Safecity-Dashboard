import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { PlannedVsActualChart } from "@/components/dashboard/PlannedVsActualChart";
import type { SubProject } from "@/components/dashboard/SubProjectCard";
import { useWindowSize } from "@/hooks/use-window-size";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, X, Plus, Trash2, Edit2, Calendar, AlertTriangle, Clock, Image as ImageIcon, XCircle, MoreVertical, Upload, FileText, Download, Tag, User, Building2, CalendarRange } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProjectGanttTree } from "@/components/dashboard/ProjectGanttTree";
import { listDelayLogs, updateDelayLog } from "@/api/delayLog";
import { listProgressImages, updateProgressImage } from "@/api/progressImage";
import { createProjectDocument, listProjectDocuments, updateProjectDocument } from "@/api/projectDocument";
import { mediaUrl } from "@/api/config";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";


import {
  type MilestonePhaseProgress,
  type DelayLog,
  type ApiDelayLog,
  type ApiProgressImage,
  type ApiProjectDocument,
  clamp,
  buildGanttTasks,
  GanttMini,
} from "@/features/milestones/milestonePanelParts";
export function MilestoneDetailsPanel({
  milestoneTitle,
  phase,
  phaseColor,
  onClear,
  showAllTabs = false,
  flatGanttTasks,
  ganttProjectId,
  onProjectGanttRefresh,
}: {
  milestoneTitle: string;
  phase: MilestonePhaseProgress;
  phaseColor: string;
  onClear?: () => void;
  showAllTabs?: boolean;
  /** Optional: API-driven project gantt rows (id/label/start/end/progress/parent). */
  flatGanttTasks?: Array<{
    id: string;
    label: string;
    start: string | null;
    end: string | null;
    progress: number;
    parent?: string;
    actual_start?: string | null;
    actual_end?: string | null;
    db_id?: number;
    activity_id?: string;
    order?: number;
    has_delay?: boolean;
    delay_info?: unknown;
  }>;
  /** Numeric project id for delay-log API and gantt refetch (with flatGanttTasks). */
  ganttProjectId?: number;
  /** Refetch nested gantt after saving a delay log. */
  onProjectGanttRefresh?: () => void | Promise<void>;
}) {
  const [tab, setTab] = useState<"gantt" | "wbs" | "photos" | "logs">("gantt");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Dialogs opened from Gantt activity options (three dots)
  const [addPhotoDialogOpen, setAddPhotoDialogOpen] = useState(false);
  const [addDocumentDialogOpen, setAddDocumentDialogOpen] = useState(false);
  const [selectedTaskForMedia, setSelectedTaskForMedia] = useState<{
    taskId: string;
    taskName: string;
    /** Backend ProjectActivity PK when attaching documents from API Gantt. */
    activityDbId?: number;
  } | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentUploading, setDocumentUploading] = useState(false);
  const [photoDialogForm, setPhotoDialogForm] = useState<{ file: File; objectUrl: string; date: string; caption: string } | null>(null);
  const photoDialogInputRef = React.useRef<HTMLInputElement>(null);
  const docDialogInputRef = React.useRef<HTMLInputElement>(null);

  const [updateImageOpen, setUpdateImageOpen] = useState(false);
  const [updatingImage, setUpdatingImage] = useState(false);
  const [updateImageForm, setUpdateImageForm] = useState<{
    id: number;
    project: number;
    activity: number;
    image_date: string;
    caption: string;
    currentImageUrl: string;
    newImageFile: File | null;
    previewUrl: string | null;
  } | null>(null);

  const closeUpdateImageDialog = () => {
    if (updateImageForm?.previewUrl) URL.revokeObjectURL(updateImageForm.previewUrl);
    setUpdateImageForm(null);
    setUpdateImageOpen(false);
    setUpdatingImage(false);
  };

  const [updateDelayOpen, setUpdateDelayOpen] = useState(false);
  const [updatingDelay, setUpdatingDelay] = useState(false);
  const [updateDelayForm, setUpdateDelayForm] = useState<{
    id: number;
    project: number;
    activity: number;
    delay_start_date: string;
    delay_end_date: string;
    category: string;
    issue: string;
    recommended_action: string;
  } | null>(null);
  const closeUpdateDelayDialog = () => {
    setUpdateDelayForm(null);
    setUpdateDelayOpen(false);
    setUpdatingDelay(false);
  };

  const [updateDocOpen, setUpdateDocOpen] = useState(false);
  const [updatingDoc, setUpdatingDoc] = useState(false);
  const [updateDocForm, setUpdateDocForm] = useState<{
    id: number;
    project: number;
    activity: number | null;
    title: string;
    currentUrl: string;
    newFile: File | null;
  } | null>(null);
  const closeUpdateDocDialog = () => {
    setUpdateDocForm(null);
    setUpdateDocOpen(false);
    setUpdatingDoc(false);
  };

  // State for editing delay log from table
  const [editingLogFromTable, setEditingLogFromTable] = useState<DelayLog | undefined>(undefined);
  const [showEditForm, setShowEditForm] = useState(false);
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;

  const subProjects = phase.subProjects ?? [];
  const timeline = phase.timeline ?? [];
  const months = useMemo(() => timeline.map((t) => t.month), [timeline]);

  // Delay Logs feature removed (was hardcoded); do not adjust progress.
  const delayLogs: DelayLog[] = [];
  const adjustedSubProjects = subProjects;

  const { data: apiDelayLogsData, isFetching: apiDelayLogsLoading } = useQuery({
    queryKey: ["delay-logs", ganttProjectId],
    queryFn: async () => {
      if (ganttProjectId == null) return { count: 0, data: [] as ApiDelayLog[] };
      return await listDelayLogs({ project: ganttProjectId });
    },
    enabled: ganttProjectId != null,
    staleTime: 30 * 1000,
  });
  const apiDelayLogs = (apiDelayLogsData?.data ?? []) as ApiDelayLog[];

  const { data: apiProgressImagesData, isFetching: apiProgressImagesLoading } = useQuery({
    queryKey: ["progress-images", ganttProjectId],
    queryFn: async () => {
      if (ganttProjectId == null) return [] as ApiProgressImage[];
      return await listProgressImages({ project: ganttProjectId });
    },
    enabled: ganttProjectId != null,
    staleTime: 30 * 1000,
  });
  const apiProgressImages = (apiProgressImagesData ?? []) as ApiProgressImage[];

  const { data: apiProjectDocumentsData, isFetching: apiProjectDocumentsLoading } = useQuery({
    queryKey: ["project-documents", ganttProjectId],
    queryFn: async () => {
      if (ganttProjectId == null) return [] as ApiProjectDocument[];
      return await listProjectDocuments({ project: ganttProjectId });
    },
    enabled: ganttProjectId != null,
    staleTime: 30 * 1000,
  });
  const apiProjectDocuments = (apiProjectDocumentsData ?? []) as ApiProjectDocument[];

  const activityLabelByDbId = useMemo(() => {
    const m = new Map<number, string>();
    for (const row of flatGanttTasks ?? []) {
      if (typeof row.db_id === "number" && Number.isFinite(row.db_id)) {
        m.set(row.db_id, row.label || `Activity #${row.db_id}`);
      }
    }
    return m;
  }, [flatGanttTasks]);

  const DELAY_LOGS_PAGE_SIZE = 3;
  const [delayLogsPage, setDelayLogsPage] = useState(0);
  const delayLogsTotalPages = Math.max(1, Math.ceil(apiDelayLogs.length / DELAY_LOGS_PAGE_SIZE));
  useEffect(() => {
    setDelayLogsPage(0);
  }, [ganttProjectId, apiDelayLogs.length]);
  const pagedDelayLogs = useMemo(() => {
    const start = delayLogsPage * DELAY_LOGS_PAGE_SIZE;
    return apiDelayLogs.slice(start, start + DELAY_LOGS_PAGE_SIZE);
  }, [apiDelayLogs, delayLogsPage]);

  // Calculate overall project progress considering delays
  const overallProgress = useMemo(() => {
    if (adjustedSubProjects.length === 0) return { actual: 0, planned: 0, impact: 0 };

    // Weighted average of all sub-projects
    const totalWeight = adjustedSubProjects.reduce((sum, sp) => sum + sp.weight, 0);
    if (totalWeight === 0) return { actual: 0, planned: 0, impact: 0 };

    const weightedActual = adjustedSubProjects.reduce((sum, sp) =>
      sum + (sp.actualProgress * sp.weight), 0) / totalWeight;
    const weightedPlanned = adjustedSubProjects.reduce((sum, sp) =>
      sum + (sp.plannedProgress * sp.weight), 0) / totalWeight;
    return {
      actual: Math.round(weightedActual),
      planned: Math.round(weightedPlanned),
      impact: 0,
    };
  }, [adjustedSubProjects]);

  const ganttTasks = useMemo(() => buildGanttTasks(adjustedSubProjects, months), [adjustedSubProjects, months]);

  const handleAddDelayLog = (_log: DelayLog) => {};
  const handleDeleteDelayLog = (_logId: string) => {};

  const openAddPhotoFromGantt = (taskId: string, taskName: string) => {
    setSelectedTaskForMedia({ taskId, taskName });
    setPhotoDialogForm(null);
    setAddPhotoDialogOpen(true);
  };
  const openAddDocumentFromGantt = (taskId: string, taskName: string, activityDbId: number) => {
    if (!Number.isFinite(activityDbId)) {
      toast({
        title: "Cannot attach document",
        description: "Missing activity id. Open the project from the schedule and try again.",
        variant: "destructive",
      });
      return;
    }
    setSelectedTaskForMedia({ taskId, taskName, activityDbId });
    setDocumentTitle("");
    setAddDocumentDialogOpen(true);
  };
  const closePhotoDialog = () => {
    if (photoDialogForm) URL.revokeObjectURL(photoDialogForm.objectUrl);
    setPhotoDialogForm(null);
    setAddPhotoDialogOpen(false);
    setSelectedTaskForMedia(null);
  };
  const closeDocumentDialog = () => {
    setAddDocumentDialogOpen(false);
    setSelectedTaskForMedia(null);
    setDocumentTitle("");
    setDocumentUploading(false);
  };

  const wbsPieData = useMemo(
    () =>
      subProjects.map((s) => ({
        name: s.name,
        value: Math.max(0, s.weight),
      })),
    [subProjects]
  );

  // If there is no WBS/timeline, render nothing (avoid showing an empty banner on pages).
  if (subProjects.length === 0 || timeline.length === 0) return null;

  return (
    <Card className="border-2 border-primary/10">
      <CardHeader>
        <div>
          <CardTitle className={isMobile ? 'text-base' : ''}>{milestoneTitle} — Milestone KPIs</CardTitle>

        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAllTabs ? (
          <>
            {/* Show all charts side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gantt Chart */}
              <div className="lg:col-span-1">
                <h3 className={`${isMobile ? 'text-sm' : 'text-base'} font-bold mb-3`}>Gantt Chart</h3>
                <GanttMini
                  tasks={ganttTasks}
                  months={months}
                  baseColor={phaseColor}
                  subProjects={adjustedSubProjects}
                  delayLogs={delayLogs}
                  onAddDelayLog={handleAddDelayLog}
                  onDeleteDelayLog={handleDeleteDelayLog}
                  onOpenAddPhoto={openAddPhotoFromGantt}
                />
                {/* Overall Progress Summary with Delay Impact - beneath Gantt chart */}
                {/* Delay Logs removed (were hardcoded) */}
              </div>

              {/* WBS Breakdown */}
              <div className="lg:col-span-1">
                <h3 className={`${isMobile ? 'text-sm' : 'text-base'} font-bold mb-3`}>WBS Breakdown</h3>
                <div className="space-y-6">
                  <div>
                    <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold mb-2`}>WBS Weight Distribution</div>
                    <div className={`w-full ${isMobile ? 'h-[280px]' : isTablet ? 'h-[320px]' : 'h-[340px]'}`}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: isMobile ? 18 : 8, right: 0, bottom: 8, left: 0 }}>
                          <Pie
                            data={wbsPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy={isMobile ? "46%" : "50%"}
                            outerRadius={isMobile ? 82 : isTablet ? 90 : 110}
                            labelLine={false}
                            label={false}
                          >
                            {wbsPieData.map((_, idx) => (
                              <Cell
                                key={idx}
                                fill={`hsl(${Math.round((idx / Math.max(1, wbsPieData.length)) * 280)} 75% 55%)`}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, "Weight"]}
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              borderColor: "hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: isMobile ? '10px' : '12px',
                              padding: isMobile ? '4px 6px' : '8px 12px'
                            }}
                          />
                          {!isMobile && (
                            <Legend
                              wrapperStyle={{
                                fontSize: isTablet ? '11px' : '12px'
                              }}
                              iconSize={isTablet ? 11 : 12}
                              layout="horizontal"
                              verticalAlign="top"
                            />
                          )}
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Mobile: render activity names as wrapped rows below the pie (avoid slice labels + avoid clipping) */}
                    {isMobile && (
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-muted-foreground">
                        {wbsPieData.map((it, idx) => (
                          <div key={it.name} className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor: `hsl(${Math.round((idx / Math.max(1, wbsPieData.length)) * 280)} 75% 55%)`,
                              }}
                              aria-hidden
                            />
                            <span className="text-foreground/90">
                              {it.name}
                            </span>
                            <span className="tabular-nums">
                              {(it.value * 100).toFixed(0)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold mb-2`}>WBS Subprocess KPIs</div>
                    <div className="space-y-2">
                      {adjustedSubProjects.map((s) => {
                        const variance = s.actualProgress - s.plannedProgress;
                        return (
                          <div key={s.id} className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center justify-between'} rounded-lg border border-border/50 ${isMobile ? 'p-2' : 'p-3'} bg-card/50`}>
                            <div className="min-w-0 flex-1">
                              <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold truncate`}>{s.name}</div>
                              <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>Weight {(s.weight * 100).toFixed(0)}%</div>
                            </div>
                            <div className={`${isMobile ? 'text-left' : 'text-right'}`}>
                              <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>Actual / Planned</div>
                              <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold tabular-nums`}>
                                {s.actualProgress.toFixed(1)}% / {s.plannedProgress.toFixed(1)}%
                              </div>
                              <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-semibold ${variance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {variance >= 0 ? "+" : ""}
                                {variance.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className={`w-full ${isMobile ? 'flex items-center gap-1 overflow-x-auto whitespace-nowrap p-1' : 'flex flex-wrap justify-start gap-1'}`}>
              <TabsTrigger value="gantt" className={isMobile ? 'text-xs shrink-0 px-3' : ''}>Gantt</TabsTrigger>
              <TabsTrigger value="wbs" className={isMobile ? 'text-xs shrink-0 px-3' : ''}>WBS Breakdown</TabsTrigger>
              <TabsTrigger value="photos" className={isMobile ? 'text-xs shrink-0 px-3' : ''}>Photos & Docs</TabsTrigger>
              <TabsTrigger value="logs" className={isMobile ? 'text-xs shrink-0 px-3' : ''}>
                Delay Logs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="gantt" className="mt-4">
              {flatGanttTasks && flatGanttTasks.length > 0 ? (
                <ProjectGanttTree
                  tasks={flatGanttTasks as any}
                  projectName={milestoneTitle}
                  projectId={ganttProjectId}
                  onOpenAddDocument={openAddDocumentFromGantt}
                  onDelayLogSaved={onProjectGanttRefresh}
                  onProgressSaved={onProjectGanttRefresh}
                />
              ) : (
                <>
                  <GanttMini
                    tasks={ganttTasks}
                    months={months}
                    baseColor={phaseColor}
                    subProjects={adjustedSubProjects}
                    delayLogs={delayLogs}
                    onAddDelayLog={handleAddDelayLog}
                    onDeleteDelayLog={handleDeleteDelayLog}
                    onOpenAddPhoto={openAddPhotoFromGantt}
                  />
                  {/* Delay Logs removed (were hardcoded) */}
                </>
              )}
            </TabsContent>

            <TabsContent value="wbs" className="mt-4">
              <div className="space-y-6">
                <div>
                  <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold mb-2`}>WBS Weight Distribution</div>
                  <div className={`w-full ${isMobile ? 'h-[280px]' : isTablet ? 'h-[320px]' : 'h-[340px]'}`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: isMobile ? 18 : 8, right: 0, bottom: 8, left: 0 }}>
                        <Pie
                          data={wbsPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy={isMobile ? "46%" : "50%"}
                          outerRadius={isMobile ? 82 : isTablet ? 90 : 110}
                          labelLine={false}
                          label={false}
                        >
                          {wbsPieData.map((_, idx) => (
                            <Cell
                              key={idx}
                              fill={`hsl(${Math.round((idx / Math.max(1, wbsPieData.length)) * 280)} 75% 55%)`}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, "Weight"]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: isMobile ? '10px' : '12px',
                            padding: isMobile ? '4px 6px' : '8px 12px'
                          }}
                        />
                        {!isMobile && (
                          <Legend
                            wrapperStyle={{
                              fontSize: isTablet ? '11px' : '12px'
                            }}
                            iconSize={isTablet ? 11 : 12}
                            layout="horizontal"
                            verticalAlign="top"
                          />
                        )}
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Mobile: render activity names as wrapped rows below the pie (avoid slice labels + avoid clipping) */}
                  {isMobile && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-muted-foreground">
                      {wbsPieData.map((it, idx) => (
                        <div key={it.name} className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor: `hsl(${Math.round((idx / Math.max(1, wbsPieData.length)) * 280)} 75% 55%)`,
                            }}
                            aria-hidden
                          />
                          <span className="text-foreground/90">
                            {it.name}
                          </span>
                          <span className="tabular-nums">
                            {(it.value * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold mb-2`}>WBS Subprocess KPIs</div>
                  <div className="space-y-2">
                    {subProjects.map((s) => {
                      const variance = s.actualProgress - s.plannedProgress;
                      return (
                        <div key={s.id} className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center justify-between'} rounded-lg border border-border/50 ${isMobile ? 'p-2' : 'p-3'} bg-card/50`}>
                          <div className="min-w-0 flex-1">
                            <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold truncate`}>{s.name}</div>
                            <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>Weight {(s.weight * 100).toFixed(0)}%</div>
                          </div>
                          <div className={`${isMobile ? 'text-left' : 'text-right'}`}>
                            <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>Actual / Planned</div>
                            <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold tabular-nums`}>
                              {s.actualProgress.toFixed(1)}% / {s.plannedProgress.toFixed(1)}%
                            </div>
                            <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-semibold ${variance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {variance >= 0 ? "+" : ""}
                              {variance.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="photos" className="mt-4 space-y-6">
              {/* Progress Photos — display only; upload via Gantt activity options (⋮) */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Progress Photos</h3>
                {apiProgressImagesLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Skeleton className="h-56 w-full" />
                    <Skeleton className="h-56 w-full" />
                    <Skeleton className="h-56 w-full" />
                  </div>
                ) : apiProgressImages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No photos yet. Use the options menu (⋮) on an activity in the Gantt chart to add a photo.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[...apiProgressImages]
                      .sort((a, b) => String(b.uploaded_at).localeCompare(String(a.uploaded_at)))
                      .map((item) => {
                        const src = item.image?.startsWith("http") ? item.image : mediaUrl(item.image || "");
                        const uploaded = new Date(item.uploaded_at);
                        const uploadedLabel = Number.isFinite(uploaded.getTime())
                          ? uploaded.toLocaleString()
                          : String(item.uploaded_at);
                        return (
                          <Card key={item.id} className="overflow-hidden border border-border/60">
                            <div className="h-40 sm:h-44 relative bg-muted">
                              <img
                                src={src}
                                alt={item.caption || item.image_date}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              <div className="absolute top-1 right-1 flex gap-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="secondary"
                                  className="h-7 w-7"
                                  onClick={() => window.open(src, "_blank")}
                                  title="Open"
                                >
                                  <ImageIcon className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="secondary"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    const a = document.createElement("a");
                                    a.href = src;
                                    a.download = `progress-${item.image_date || item.id}.png`;
                                    a.click();
                                  }}
                                  title="Download"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            <CardContent className="p-3 space-y-2">
                              <div className="text-sm font-semibold leading-snug line-clamp-2" title={item.caption ?? ""}>
                                {item.caption || "—"}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="default"
                                  className="h-7 px-2.5 text-[11px] rounded-full bg-blue-600 text-white hover:bg-blue-600/90"
                                >
                                  {item.image_date}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 text-[11px] rounded-full border-sky-200 text-sky-700 hover:text-sky-800"
                                >
                                  Activity #{item.activity}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 text-[11px] rounded-full border-emerald-200 text-emerald-700 hover:text-emerald-800"
                                  title="Update this image"
                                  onClick={() => {
                                    const currentSrc = item.image?.startsWith("http") ? item.image : mediaUrl(item.image || "");
                                    setUpdateImageForm({
                                      id: item.id,
                                      project: item.project,
                                      activity: item.activity,
                                      image_date: item.image_date,
                                      caption: item.caption ?? "",
                                      currentImageUrl: currentSrc,
                                      newImageFile: null,
                                      previewUrl: null,
                                    });
                                    setUpdateImageOpen(true);
                                  }}
                                >
                                  Update
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Documents — GET list-project-document (by project; each row shows activity id / Gantt label) */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Documents</h3>
                {apiProjectDocumentsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : apiProjectDocuments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No documents yet. Use the options menu (⋮) on an activity in the Gantt chart to upload a file.
                  </p>
                ) : (
                  <div className="rounded-lg border border-border/60 divide-y divide-border/60">
                    {[...apiProjectDocuments]
                      .sort((a, b) => String(b.uploaded_at ?? "").localeCompare(String(a.uploaded_at ?? "")))
                      .map((item) => {
                        const aid = item.activity;
                        const activityLabel =
                          aid != null && activityLabelByDbId.has(aid)
                            ? activityLabelByDbId.get(aid)!
                            : aid != null
                              ? `Activity #${aid}`
                              : "—";
                        const href =
                          item.file_url && String(item.file_url).startsWith("http")
                            ? item.file_url
                            : item.file
                              ? mediaUrl(item.file)
                              : "";
                        return (
                          <div key={item.id} className="flex flex-col gap-1 px-3 py-2.5 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <div className="flex items-start gap-2 min-w-0">
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate" title={item.title ?? undefined}>
                                  {item.title || "—"}
                                </div>
                                <div className="text-[11px] text-muted-foreground truncate">
                                  {activityLabel}
                                  {item.uploaded_at
                                    ? ` · ${new Date(item.uploaded_at).toLocaleString()}`
                                    : ""}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 pl-6 sm:pl-0">
                              {href ? (
                                <Button type="button" size="sm" variant="ghost" className="h-8 gap-1" asChild>
                                  <a href={href} target="_blank" rel="noreferrer">
                                    <Download className="h-3.5 w-3.5" /> Open
                                  </a>
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => {
                                  setUpdateDocForm({
                                    id: item.id,
                                    project: item.project,
                                    activity: item.activity ?? null,
                                    title: item.title ?? "",
                                    currentUrl: href,
                                    newFile: null,
                                  });
                                  setUpdateDocOpen(true);
                                }}
                              >
                                Update
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="logs" className="mt-4">
              {apiDelayLogsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-56" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : apiDelayLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border border-border rounded-lg">
                  <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">No delay logs recorded yet</p>
                  <p className="text-xs mt-1">Delay logs will appear here when you log delays in the Gantt chart.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-muted-foreground">
                      {apiDelayLogs.length} delay log{apiDelayLogs.length !== 1 ? "s" : ""} recorded
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => setDelayLogsPage((p) => Math.max(0, p - 1))}
                        disabled={delayLogsPage <= 0}
                      >
                        Prev
                      </Button>
                      <div className="text-xs text-muted-foreground tabular-nums min-w-[84px] text-center">
                        Page {delayLogsPage + 1} / {delayLogsTotalPages}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => setDelayLogsPage((p) => Math.min(delayLogsTotalPages - 1, p + 1))}
                        disabled={delayLogsPage >= delayLogsTotalPages - 1}
                      >
                        Next
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                    {pagedDelayLogs.map((log) => {
                      const created = new Date(log.created_at);
                      const createdLabel = Number.isFinite(created.getTime())
                        ? created.toLocaleString()
                        : String(log.created_at);
                      const actionByLabel = log.action_by_info
                        ? `${log.action_by_info.stakeholder_title} (${log.action_by_info.stakeholder_type})`
                        : log.action_by != null
                          ? `#${log.action_by}`
                          : "—";
                      const severity: "low" | "medium" | "high" =
                        log.delay_days >= 10 ? "high" : log.delay_days >= 5 ? "medium" : "low";
                      const severityStyles =
                        severity === "high"
                          ? {
                              accent: "bg-rose-600",
                              badge: "bg-rose-600 hover:bg-rose-600 text-white",
                              icon: "text-rose-600",
                            }
                          : severity === "medium"
                            ? {
                                accent: "bg-amber-500",
                                badge: "bg-amber-500 hover:bg-amber-500 text-white",
                                icon: "text-amber-600",
                              }
                            : {
                                accent: "bg-slate-400",
                                badge: "bg-slate-700 hover:bg-slate-700 text-white",
                                icon: "text-slate-600",
                              };

                      return (
                        <Card
                          key={log.id}
                          className="overflow-hidden border border-border/60 bg-card shadow-sm hover:shadow-md transition-shadow"
                        >
                          <CardContent className="p-0">
                            <div className="flex">
                              <div className={`w-1.5 ${severityStyles.accent}`} aria-hidden />
                              <div className="flex-1">
                                <div className="p-4 border-b border-border/60 bg-muted/15">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <AlertTriangle className={`h-4 w-4 ${severityStyles.icon} shrink-0`} aria-hidden />
                                        <div className="text-sm font-semibold truncate" title={`Activity #${log.activity}`}>
                                          Activity #{log.activity}
                                        </div>
                                      </div>
                                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                        <Calendar className="h-3.5 w-3.5" aria-hidden />
                                        {createdLabel}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-8"
                                        onClick={() => {
                                          setUpdateDelayForm({
                                            id: log.id,
                                            project: log.project,
                                            activity: log.activity,
                                            delay_start_date: log.delay_start_date,
                                            delay_end_date: log.delay_end_date,
                                            category: log.category ?? "",
                                            issue: log.issue ?? "",
                                            recommended_action: log.recommended_action ?? "",
                                          });
                                          setUpdateDelayOpen(true);
                                        }}
                                      >
                                        Update
                                      </Button>
                                      <Badge className={`shrink-0 ${severityStyles.badge}`}>
                                        {log.delay_days} day{log.delay_days !== 1 ? "s" : ""} delay
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="p-4 space-y-3">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-lg border border-border/60 bg-background p-2">
                                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase">
                                    <CalendarRange className="h-3.5 w-3.5" aria-hidden />
                                    Start
                                  </div>
                                  <div className="text-xs font-medium mt-0.5">{log.delay_start_date}</div>
                                </div>
                                <div className="rounded-lg border border-border/60 bg-background p-2">
                                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase">
                                    <CalendarRange className="h-3.5 w-3.5" aria-hidden />
                                    End
                                  </div>
                                  <div className="text-xs font-medium mt-0.5">{log.delay_end_date}</div>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2 text-xs">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1">
                                  <Tag className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                                  <span className="text-muted-foreground">Category</span>
                                  <span className="font-semibold text-foreground">{log.category ?? "—"}</span>
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1">
                                  <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                                  <span className="text-muted-foreground">Originator</span>
                                  <span className="font-semibold text-foreground">{log.originator ?? "—"}</span>
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1">
                                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                                  <span className="text-muted-foreground">Action by</span>
                                  <span className="font-semibold text-foreground">{actionByLabel}</span>
                                </span>
                              </div>

                              <div className="grid gap-2">
                                <div className="rounded-lg border border-border/60 bg-background p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="text-[10px] font-semibold text-muted-foreground uppercase">Issue</div>
                                  </div>
                                  <div className="text-xs text-foreground/90 whitespace-pre-wrap mt-1 leading-relaxed">
                                    {log.issue ?? "—"}
                                  </div>
                                </div>
                                <div className="rounded-lg border border-border/60 bg-background p-3">
                                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">Recommended action</div>
                                  <div className="text-xs text-foreground/90 whitespace-pre-wrap mt-1 leading-relaxed">
                                    {log.recommended_action ?? "—"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>

      {/* Add Photo dialog (opened from Gantt activity options) */}
      <Dialog open={addPhotoDialogOpen} onOpenChange={(open) => { if (!open) closePhotoDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Photo</DialogTitle>
            <DialogDescription>
              {selectedTaskForMedia ? `Add a progress photo for: ${selectedTaskForMedia.taskName}` : "Add a progress photo. Set the progress date for the timeline."}
            </DialogDescription>
          </DialogHeader>
          <input
            ref={photoDialogInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setPhotoDialogForm({ file, objectUrl: URL.createObjectURL(file), date: new Date().toISOString().slice(0, 10), caption: "" });
              e.target.value = "";
            }}
          />
          {photoDialogForm ? (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-muted border">
                  <img src={photoDialogForm.objectUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <Label className="text-xs">Progress date (timeline)</Label>
                    <Input
                      type="date"
                      value={photoDialogForm.date}
                      onChange={(e) => setPhotoDialogForm((p) => (p ? { ...p, date: e.target.value } : null))}
                      className="mt-1 h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Caption (optional)</Label>
                    <Input
                      placeholder="e.g. Site visit"
                      value={photoDialogForm.caption}
                      onChange={(e) => setPhotoDialogForm((p) => (p ? { ...p, caption: e.target.value } : null))}
                      className="mt-1 h-9"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={closePhotoDialog}>Cancel</Button>
                <Button type="button" onClick={closePhotoDialog}>Close</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="py-4">
              <Button type="button" variant="outline" className="w-full gap-2" onClick={() => photoDialogInputRef.current?.click()}>
                <Upload className="h-4 w-4" /> Choose image
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Documents dialog (opened from Gantt activity options) — POST create-project-document */}
      <Dialog open={addDocumentDialogOpen} onOpenChange={(open) => { if (!open) closeDocumentDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add document</DialogTitle>
            <DialogDescription>
              {selectedTaskForMedia
                ? `Attach a file to: ${selectedTaskForMedia.taskName}`
                : "Upload a project document."}
            </DialogDescription>
          </DialogHeader>
          <input
            ref={docDialogInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xlsx"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const aid = selectedTaskForMedia?.activityDbId;
              if (ganttProjectId == null || aid == null || !Number.isFinite(aid)) {
                toast({
                  title: "Cannot upload",
                  description: "Missing project or activity context.",
                  variant: "destructive",
                });
                return;
              }
              const title =
                documentTitle.trim() ||
                (file.name.includes(".") ? file.name.replace(/\.[^.]+$/, "") : file.name) ||
                file.name;
              try {
                setDocumentUploading(true);
                await createProjectDocument({
                  project: ganttProjectId,
                  activity: aid,
                  file,
                  title,
                });
                toast({ title: "Document uploaded", description: "The file was saved for this activity." });
                await queryClient.invalidateQueries({ queryKey: ["project-documents", ganttProjectId] });
                await onProjectGanttRefresh?.();
                closeDocumentDialog();
              } catch (err) {
                toast({
                  title: "Upload failed",
                  description: err instanceof Error ? err.message : "Please try again.",
                  variant: "destructive",
                });
              } finally {
                setDocumentUploading(false);
              }
            }}
          />
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                placeholder="e.g. Site handover checklist"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                disabled={documentUploading}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              disabled={documentUploading}
              onClick={() => docDialogInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" /> {documentUploading ? "Uploading…" : "Choose file & upload"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Allowed types: PDF, Word (.doc/.docx), Excel (.xlsx). The server saves the file against this activity.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Update Progress Image dialog (from Photos & Docs grid) */}
      <Dialog open={updateImageOpen} onOpenChange={(open) => { if (!open) closeUpdateImageDialog(); }}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl font-bold">Update Progress Image</DialogTitle>
            <DialogDescription className="text-sm">
              Update caption/date/activity or replace the image file.
            </DialogDescription>
          </DialogHeader>

          {updateImageForm ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label>Project</Label>
                  <Input value={String(updateImageForm.project)} readOnly />
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <Label>Activity</Label>
                  <Input
                    type="number"
                    value={String(updateImageForm.activity)}
                    onChange={(e) =>
                      setUpdateImageForm((p) => (p ? { ...p, activity: Number(e.target.value || 0) } : p))
                    }
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <Label>Image date</Label>
                  <Input
                    type="date"
                    value={updateImageForm.image_date}
                    onChange={(e) => setUpdateImageForm((p) => (p ? { ...p, image_date: e.target.value } : p))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>Image</Label>
                  {updateImageForm.newImageFile ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => {
                        setUpdateImageForm((p) => {
                          if (!p) return p;
                          if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
                          return { ...p, newImageFile: null, previewUrl: null };
                        });
                      }}
                    >
                      Remove selected
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Optional: replace file</span>
                  )}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-border/60 overflow-hidden bg-muted/30">
                    <div className="px-4 py-2 text-xs font-semibold text-muted-foreground border-b border-border/50 bg-background/50 flex items-center justify-between">
                      <span>{updateImageForm.newImageFile ? "New preview" : "Current image"}</span>
                      <span className="text-[11px] font-normal">ID #{updateImageForm.id}</span>
                    </div>
                    <div className="p-3">
                      <div className="rounded-lg overflow-hidden bg-muted">
                        <img
                          src={updateImageForm.previewUrl || updateImageForm.currentImageUrl}
                          alt="Preview"
                          className="w-full h-56 object-cover"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <input
                      id="update-progress-image-file"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setUpdateImageForm((p) => {
                          if (!p) return p;
                          if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
                          return {
                            ...p,
                            newImageFile: file,
                            previewUrl: file ? URL.createObjectURL(file) : null,
                          };
                        });
                        e.target.value = "";
                      }}
                    />

                    <div
                      className={`rounded-xl border-2 border-dashed p-5 transition-colors ${
                        updateImageForm.newImageFile
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/25 hover:border-primary/60 bg-muted/10 cursor-pointer"
                      }`}
                      role="button"
                      tabIndex={0}
                      onClick={() => document.getElementById("update-progress-image-file")?.click()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          document.getElementById("update-progress-image-file")?.click();
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="shrink-0 rounded-lg bg-background p-2 border border-border/60">
                          <Upload className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">
                            {updateImageForm.newImageFile ? "Selected file" : "Click to choose a new image"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {updateImageForm.newImageFile ? updateImageForm.newImageFile.name : "PNG, JPG, JPEG"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <Button type="button" variant="outline" size="sm" className="h-9 w-full">
                          {updateImageForm.newImageFile ? "Change file" : "Choose file"}
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/60 p-4 bg-background/40">
                      <Label>Caption</Label>
                      <Textarea
                        className="mt-2"
                        value={updateImageForm.caption}
                        onChange={(e) => setUpdateImageForm((p) => (p ? { ...p, caption: e.target.value } : p))}
                        rows={4}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeUpdateImageDialog} disabled={updatingImage}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={updatingImage || !updateImageForm.image_date || !updateImageForm.project || !updateImageForm.activity}
                  onClick={async () => {
                    if (!updateImageForm) return;
                    try {
                      setUpdatingImage(true);
                      await updateProgressImage(updateImageForm.id, {
                        project: updateImageForm.project,
                        activity: updateImageForm.activity,
                        image_date: updateImageForm.image_date,
                        caption: updateImageForm.caption,
                        image: updateImageForm.newImageFile,
                      });
                      await queryClient.invalidateQueries({ queryKey: ["progress-images", ganttProjectId] });
                      await onProjectGanttRefresh?.(); 
                      closeUpdateImageDialog();
                    } finally {
                      setUpdatingImage(false);
                    }
                  }}
                >
                  {updatingImage ? "Updating..." : "Update"}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Update Delay Log dialog (from Delay Logs cards) */}
      <Dialog open={updateDelayOpen} onOpenChange={(open) => { if (!open) closeUpdateDelayDialog(); }}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl font-bold">Update Delay Log</DialogTitle>
            <DialogDescription className="text-sm">
              Update the delay details for this activity.
            </DialogDescription>
          </DialogHeader>

          {updateDelayForm ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Project</Label>
                  <Input value={String(updateDelayForm.project)} readOnly />
                </div>
                <div className="space-y-1.5">
                  <Label>Activity</Label>
                  <Input value={String(updateDelayForm.activity)} readOnly />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Input
                    value={updateDelayForm.category}
                    onChange={(e) => setUpdateDelayForm((p) => (p ? { ...p, category: e.target.value } : p))}
                    placeholder="e.g. Utility shifting"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Delay start date</Label>
                  <Input
                    type="date"
                    value={updateDelayForm.delay_start_date}
                    onChange={(e) => setUpdateDelayForm((p) => (p ? { ...p, delay_start_date: e.target.value } : p))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Delay end date</Label>
                  <Input
                    type="date"
                    value={updateDelayForm.delay_end_date}
                    onChange={(e) => setUpdateDelayForm((p) => (p ? { ...p, delay_end_date: e.target.value } : p))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Issue</Label>
                  <Textarea
                    value={updateDelayForm.issue}
                    onChange={(e) => setUpdateDelayForm((p) => (p ? { ...p, issue: e.target.value } : p))}
                    rows={4}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Recommended action</Label>
                  <Textarea
                    value={updateDelayForm.recommended_action}
                    onChange={(e) => setUpdateDelayForm((p) => (p ? { ...p, recommended_action: e.target.value } : p))}
                    rows={4}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeUpdateDelayDialog} disabled={updatingDelay}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={
                    updatingDelay ||
                    !updateDelayForm.delay_start_date ||
                    !updateDelayForm.delay_end_date ||
                    !updateDelayForm.category
                  }
                  onClick={async () => {
                    if (!updateDelayForm) return;
                    try {
                      setUpdatingDelay(true);
                      await updateDelayLog(updateDelayForm.id, {
                        project: updateDelayForm.project,
                        activity: updateDelayForm.activity,
                        delay_start_date: updateDelayForm.delay_start_date,
                        delay_end_date: updateDelayForm.delay_end_date,
                        category: updateDelayForm.category,
                        issue: updateDelayForm.issue,
                        recommended_action: updateDelayForm.recommended_action,
                      });
                      await queryClient.invalidateQueries({ queryKey: ["delay-logs", ganttProjectId] });
                      await onProjectGanttRefresh?.();
                      closeUpdateDelayDialog();
                    } finally {
                      setUpdatingDelay(false);
                    }
                  }}
                >
                  {updatingDelay ? "Updating..." : "Update"}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Update Project Document dialog (from Documents list) */}
      <Dialog open={updateDocOpen} onOpenChange={(open) => { if (!open) closeUpdateDocDialog(); }}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl font-bold">Update Document</DialogTitle>
            <DialogDescription className="text-sm">
              Update the document title or replace the file.
            </DialogDescription>
          </DialogHeader>

          {updateDocForm ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Project</Label>
                  <Input value={String(updateDocForm.project)} readOnly />
                </div>
                <div className="space-y-1.5">
                  <Label>Activity</Label>
                  <Input value={updateDocForm.activity != null ? String(updateDocForm.activity) : "—"} readOnly />
                </div>
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input
                    value={updateDocForm.title}
                    onChange={(e) => setUpdateDocForm((p) => (p ? { ...p, title: e.target.value } : p))}
                    placeholder="e.g. Site Book"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border/60 p-4 bg-background/40 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">File</div>
                  {updateDocForm.currentUrl ? (
                    <Button type="button" size="sm" variant="outline" className="h-8" asChild>
                      <a href={updateDocForm.currentUrl} target="_blank" rel="noreferrer">
                        <Download className="h-3.5 w-3.5 mr-1" /> Open current
                      </a>
                    </Button>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    {(() => {
                      const u = updateDocForm.currentUrl || "";
                      const name = u ? u.split("/").pop() : "";
                      const label = name ? decodeURIComponent(name) : "—";
                      return (
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <span className="shrink-0">Current:</span>
                          <span className="font-medium text-foreground truncate max-w-[520px]" title={label}>
                            {label}
                          </span>
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    {updateDocForm.newFile ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={updatingDoc}
                        onClick={() => setUpdateDocForm((p) => (p ? { ...p, newFile: null } : p))}
                      >
                        Remove selected
                      </Button>
                    ) : null}
                  </div>

                  <input
                    id="update-project-document-file"
                    type="file"
                    accept=".pdf,.doc,.docx,.xlsx"
                    className="hidden"
                    disabled={updatingDoc}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setUpdateDocForm((p) => (p ? { ...p, newFile: file } : p));
                      e.target.value = "";
                    }}
                  />

                  <div
                    className={`rounded-lg border border-dashed p-4 transition-colors ${
                      updateDocForm.newFile
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-primary/60 bg-muted/10 cursor-pointer"
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => document.getElementById("update-project-document-file")?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        document.getElementById("update-project-document-file")?.click();
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">
                          {updateDocForm.newFile ? "New file selected" : "Choose a new file (optional)"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {updateDocForm.newFile ? updateDocForm.newFile.name : "PDF, DOC/DOCX, XLSX"}
                        </div>
                      </div>
                      <Button type="button" variant="outline" size="sm" className="h-9 px-4" disabled={updatingDoc}>
                        {updateDocForm.newFile ? "Change" : "Choose"}
                      </Button>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Allowed: PDF, DOC/DOCX, XLSX
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeUpdateDocDialog} disabled={updatingDoc}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={updatingDoc || !updateDocForm.title.trim()}
                  onClick={async () => {
                    if (!updateDocForm) return;
                    try {
                      setUpdatingDoc(true);
                      await updateProjectDocument(updateDocForm.id, {
                        title: updateDocForm.title.trim(),
                        file: updateDocForm.newFile,
                      });
                      await queryClient.invalidateQueries({ queryKey: ["project-documents", ganttProjectId] });
                      await onProjectGanttRefresh?.(); 
                      closeUpdateDocDialog();
                    } catch (err) {
                      toast({
                        title: "Update failed",
                        description: err instanceof Error ? err.message : "Please try again.",
                        variant: "destructive",
                      });
                    } finally {
                      setUpdatingDoc(false);
                    }
                  }}
                >
                  {updatingDoc ? "Updating..." : "Update"}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}


