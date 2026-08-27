import { Layout } from "@/components/layout/Layout";
import { CityMap } from "@/components/dashboard/CityMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import {
  listProjects,
  listDivisions,
  listDistricts,
  listTehsils,
  getProjectById,
  getProjectGanttData,
  // getProjectGanttAll,
  getProjectStatusSummary,  
} from "@/api";
import { FolderKanban, Loader2, AlertTriangle, CalendarCheck, Filter } from "lucide-react";
import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { Division, District, Tehsil, Project } from "@/api/types";
import { cn } from "@/lib/utils";
import { ProjectGanttTree } from "@/components/dashboard/ProjectGanttTree";
import { Skeleton } from "@/components/ui/skeleton";
import { useRef } from "react";

/** Card config: id, label, icon, and Tailwind classes for bg + left border (situation-based colors) */
const PROJECT_STAT_CARDS = [
  { id: "total", label: "Total No of Projects", icon: FolderKanban, bgClass: "bg-primary", borderClass: "border-l-primary", iconOpacity: "opacity-90" },
  { id: "in_progress", label: "Projects in Progress", icon: Loader2, bgClass: "bg-blue-600", borderClass: "border-l-blue-400", iconOpacity: "opacity-80" },
  { id: "in_delay", label: "Projects in Delay", icon: AlertTriangle, bgClass: "bg-rose-600", borderClass: "border-l-rose-400", iconOpacity: "opacity-90" },
  { id: "pending", label: "Pending Projects", icon: CalendarCheck, bgClass: "bg-amber-600", borderClass: "border-l-amber-400", iconOpacity: "opacity-80" },
] as const;

export type LayerType = "cameras" | "incidents" | "patrols" | "construction" | "stations" | "traffic" | "hotspots";

/** Normalize project geom for Leaflet: accept geometry or Feature/FeatureCollection */
function normalizeProjectGeom(geom: unknown): object | null {
  if (geom == null) return null;
  const g = geom as Record<string, unknown>;
  if (g.type === "FeatureCollection" && Array.isArray(g.features)) return geom as object;
  if (g.type === "Feature" && g.geometry) return geom as object;
  if (g.type === "Polygon" || g.type === "MultiPolygon" || g.type === "Point" || g.type === "LineString")
    return { type: "Feature", geometry: g, properties: {} } as object;
  return null;
}

type ProjectStatus = "pending" | "in_progress" | "in_delay";

// function walkNestedTasks(
//   tasks: Array<{ subtasks?: any[]; has_delay?: boolean; progress?: number; progress_status?: string | null }> | undefined,
//   visit: (t: { has_delay?: boolean; progress?: number; progress_status?: string | null }) => void,
// ): void {
//   if (!Array.isArray(tasks) || tasks.length === 0) return;
//   for (const t of tasks) {
//     visit(t);
//     if (Array.isArray((t as any).subtasks) && (t as any).subtasks.length > 0) {
//       walkNestedTasks((t as any).subtasks, visit);
//     }
//   }
// }

// function deriveProjectStatusFromNestedGantt(
//   tasks: Array<{ subtasks?: any[]; has_delay?: boolean; progress?: number; progress_status?: string | null }> | undefined,
// ): ProjectStatus {
//   // Priority:
//   // 1) delayed if any node has_delay === true
//   // 2) in_progress if any node progress > 0
//   // 3) pending if ALL nodes progress_status === "Not Started" (or tasks empty)
//   if (!Array.isArray(tasks) || tasks.length === 0) return "pending";

//   let anyDelay = false;
//   let anyProgress = false;
//   let allNotStarted = true;

//   walkNestedTasks(tasks, (t) => {
//     if (t?.has_delay === true) anyDelay = true;
//     const p = Number((t as any)?.progress ?? 0);
//     if (Number.isFinite(p) && p > 0) anyProgress = true;

//     const ps = String((t as any)?.progress_status ?? "").trim();
//     if (ps !== "Not Started") allNotStarted = false;
//   });

//   if (anyDelay) return "in_delay";
//   if (anyProgress) return "in_progress";
//   if (allNotStarted) return "pending";
//   return "pending";
// }

function geometryBboxCenter(geometry: any): [number, number] | null {
  // Returns [lat, lng] (Leaflet order)
  const coords = geometry?.coordinates;
  if (!coords) return null;
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  const walk = (v: any) => {
    if (!v) return;
    // coordinate pair [lng, lat]
    if (Array.isArray(v) && v.length === 2 && typeof v[0] === "number" && typeof v[1] === "number") {
      const lng = v[0];
      const lat = v[1];
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        minLng = Math.min(minLng, lng);
        minLat = Math.min(minLat, lat);
        maxLng = Math.max(maxLng, lng);
        maxLat = Math.max(maxLat, lat);
      }
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) walk(x);
    }
  };
  walk(coords);

  if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) {
    return null;
  }
  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;
  return [centerLat, centerLng];
}

/** Build a GeoJSON FeatureCollection from all projects that have geom (for map layer by division/district/tehsil) */
function buildProjectsFeatureCollection(
  projects: Project[],
  statusByProjectId?: Map<number, ProjectStatus>,
): { type: "FeatureCollection"; features: Array<{ type: "Feature"; geometry: unknown; properties?: Record<string, unknown> }> } | null {
  const features: Array<{ type: "Feature"; geometry: unknown; properties?: Record<string, unknown> }> = [];
  for (const p of projects) {
    const normalized = normalizeProjectGeom(p.geom);
    if (!normalized) continue;
    const n = normalized as { type: string; features?: Array<{ type: string; geometry?: unknown; properties?: Record<string, unknown> }>; geometry?: unknown; properties?: Record<string, unknown> };
    const baseProps = {
      id: p.id,
      project_name: p.project_name ?? `Project #${p.id}`,
      status: statusByProjectId?.get(p.id) ?? "pending",
    };
    let markerAdded = false;
    if (n.type === "FeatureCollection" && Array.isArray(n.features)) {
      for (const f of n.features) {
        if (!f.geometry) continue;
        const center = geometryBboxCenter(f.geometry);
        features.push({
          type: "Feature",
          geometry: f.geometry,
          properties: {
            ...(f.properties || {}),
            ...baseProps,
            __center: center ?? undefined,
            __marker: !markerAdded,
          },
        });
        markerAdded = true;
      }
    } else if (n.type === "Feature" && n.geometry) {
      const center = geometryBboxCenter(n.geometry);
      features.push({
        type: "Feature",
        geometry: n.geometry,
        properties: { ...(n.properties || {}), ...baseProps, __center: center ?? undefined, __marker: true },
      });
    }
  }
  if (features.length === 0) return null;
  return { type: "FeatureCollection", features };
}

export default function GISLayers() {
  const [selectedCity, setSelectedCity] = useState("lahore");
  const [showLegend, setShowLegend] = useState(true);
  const [mapRef, setMapRef] = useState<any>(null);
  const ganttSectionRef = useRef<HTMLDivElement | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>("all");
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>("all");
  const [selectedTehsilId, setSelectedTehsilId] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

  const handleDivisionChange = (value: string) => {
    setSelectedDivisionId(value);
    setSelectedDistrictId("all");
    setSelectedTehsilId("all");
    setSelectedProjectId("all");
  };

  const handleDistrictChange = (value: string) => {
    setSelectedDistrictId(value);
    setSelectedTehsilId("all");
    setSelectedProjectId("all");
  };

  const handleTehsilChange = (value: string) => {
    setSelectedTehsilId(value);
    setSelectedProjectId("all");
  };

  const divisionNumeric =
    selectedDivisionId !== "all" ? Number(selectedDivisionId) : null;
  const districtNumeric =
    selectedDistrictId !== "all" ? Number(selectedDistrictId) : null;
  const selectedProjectNumericId =
    selectedProjectId !== "all" ? Number(selectedProjectId) : null;

  const { data: divisions = [], isLoading: divisionsLoading } = useQuery<Division[]>({
    queryKey: ["gis", "divisions"],
    queryFn: () => listDivisions(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: districts = [], isFetching: districtsLoading } = useQuery<District[]>({
    queryKey: ["gis", "districts", divisionNumeric],
    queryFn: () => listDistricts(divisionNumeric!),
    enabled: divisionNumeric != null && Number.isFinite(divisionNumeric),
    staleTime: 5 * 60 * 1000,
  });

  const { data: tehsils = [], isFetching: tehsilsLoading } = useQuery<Tehsil[]>({
    queryKey: ["gis", "tehsils", districtNumeric],
    queryFn: () => listTehsils(districtNumeric!),
    enabled: districtNumeric != null && Number.isFinite(districtNumeric),
    staleTime: 5 * 60 * 1000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  const projectLookupById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const projectsByDivisionId = useMemo(() => {
    const map = new Map<number, Project[]>();
    for (const project of projects) {
      const divisionId = Number(project.division ?? 0);
      if (!divisionId) continue;
      const list = map.get(divisionId) ?? [];
      list.push(project);
      map.set(divisionId, list);
    }
    return map;
  }, [projects]);

  const projectsByDistrictId = useMemo(() => {
    const map = new Map<number, Project[]>();
    for (const project of projects) {
      const districtId = Number(project.district ?? 0);
      if (!districtId) continue;
      const list = map.get(districtId) ?? [];
      list.push(project);
      map.set(districtId, list);
    }
    return map;
  }, [projects]);

  const projectsByTehsilId = useMemo(() => {
    const map = new Map<number, Project[]>();
    for (const project of projects) {
      const tehsilId = Number(project.tehsil ?? 0);
      if (!tehsilId) continue;
      const list = map.get(tehsilId) ?? [];
      list.push(project);
      map.set(tehsilId, list);
    }
    return map;
  }, [projects]);

  // NEW: fetch nested gantt for ALL projects in one request; used to derive
  // delay/pending/in-progress status for map boundaries + cards.
  // const { data: allProjectSchedules = [], isFetching: allGanttLoading } = useQuery({
  //   queryKey: ["gis", "project-gantt-all"],
  //   queryFn: getProjectGanttAll,
  //   staleTime: 30 * 1000,
  // });

  const { data: statusByProjectId = {}, isFetching: allGanttLoading } = useQuery({
    queryKey: ["gis", "project-status-summary"],
    queryFn: getProjectStatusSummary,
    staleTime: 30 * 1000,
  });

  // When a project is selected, fetch that specific project via /api/list-project/?id=...
  // (same behavior as Finance page).
  const { data: selectedProjectDetails, isFetching: selectedProjectLoading } =
    useQuery<Project | null>({
      queryKey: ["gis", "project-by-id", selectedProjectNumericId],
      queryFn: async () => {
        if (selectedProjectNumericId == null) return null;
        return await getProjectById(selectedProjectNumericId);
      },
      enabled:
        selectedProjectNumericId != null &&
        Number.isFinite(selectedProjectNumericId),
      staleTime: 30 * 1000,
    });

  // When a project is selected, fetch nested gantt tasks for that project id.
  const { data: selectedProjectGanttTasks = [], isFetching: ganttLoading } =
    useQuery({
      queryKey: ["gis", "project-gantt", selectedProjectNumericId],
      queryFn: async () => {
        if (selectedProjectNumericId == null) return [];
        const tasks = await getProjectGanttData(selectedProjectNumericId);
        return Array.isArray(tasks) ? tasks : [];
      },
      enabled:
        selectedProjectNumericId != null &&
        Number.isFinite(selectedProjectNumericId),
      staleTime: 30 * 1000,
    });

  const filteredProjects = useMemo((): Project[] => {
    let list: Project[] = projects;

    if (divisionNumeric != null && Number.isFinite(divisionNumeric)) {
      list = projectsByDivisionId.get(divisionNumeric) ?? [];
    }

    if (districtNumeric != null && Number.isFinite(districtNumeric)) {
      const districtSet = new Set((projectsByDistrictId.get(districtNumeric) ?? []).map((p) => p.id));
      list = list.filter((project) => districtSet.has(project.id));
    }

    const tehsilNumeric = selectedTehsilId !== "all" ? Number(selectedTehsilId) : null;
    if (tehsilNumeric != null && Number.isFinite(tehsilNumeric)) {
      const tehsilSet = new Set((projectsByTehsilId.get(tehsilNumeric) ?? []).map((p) => p.id));
      list = list.filter((project) => tehsilSet.has(project.id));
    }

    return list;
  }, [projects, divisionNumeric, districtNumeric, selectedTehsilId, projectsByDivisionId, projectsByDistrictId, projectsByTehsilId]);

  // const projectStatusById = useMemo(() => {
  //   const statusByProjectId = new Map<number, ProjectStatus>();
  //   for (const s of allProjectSchedules as any[]) {
  //     const idNum = Number(s?._id);
  //     if (!Number.isFinite(idNum)) continue;
  //     const status = deriveProjectStatusFromNestedGantt(s?.tasks);
  //     statusByProjectId.set(idNum, status);
  //   }

  //   const map = new Map<number, ProjectStatus>();
  //   for (const p of filteredProjects) {
  //     const status: ProjectStatus = statusByProjectId.get(p.id) ?? "pending";
  //     map.set(p.id, status);
  //   }
  //   return map;
  // }, [filteredProjects, allProjectSchedules]);

  const projectStatusById = useMemo(() => {
    const map = new Map<number, ProjectStatus>();
    for (const p of filteredProjects) {
      const status = (statusByProjectId[String(p.id)] as ProjectStatus) ?? "pending";
      map.set(p.id, status);
    }
    return map;
  }, [filteredProjects, statusByProjectId]);

  /**
   * Project status counts (no hardcoding) — SINGLE approach:
   * - pending: no activity started (percent_complete == 0 and/or no start_date)
   * - in_delay: project has any nested gantt task with has_delay === true
   * - in_progress: started but not delayed
   *
   * NOTE: `listProjects()` normalizes activities so `percent_complete` + `finish_date`
   * are always present (even if backend sends `progress`/`end_date`).
   */
  const projectCounts = useMemo(() => {
    let pending = 0;
    let in_progress = 0;
    let in_delay = 0;

    for (const p of filteredProjects) {
      const status = projectStatusById.get(p.id) ?? "pending";
      if (status === "in_delay") in_delay += 1;
      else if (status === "in_progress") in_progress += 1;
      else pending += 1;
    }

    return {
      total: filteredProjects.length,
      pending,
      in_progress,
      in_delay,
    } as const;
  }, [filteredProjects, projectStatusById]);

  const mapView = useMemo(() => {
    const coords = filteredProjects
      .map((project: any) => ({
        lat: Number(project.latitude),
        lng: Number(project.longitude),
      }))
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

    if (coords.length === 0) {
      return { center: undefined as [number, number] | undefined, zoom: undefined as number | undefined };
    }

    const center: [number, number] = [
      coords.reduce((sum, point) => sum + point.lat, 0) / coords.length,
      coords.reduce((sum, point) => sum + point.lng, 0) / coords.length,
    ];

    return { center, zoom: coords.length === 1 ? 13 : 9 };
  }, [filteredProjects]);

  const selectedProject = useMemo(
    () =>
      selectedProjectId && selectedProjectId !== "all"
        ? projectLookupById.get(Number(selectedProjectId)) ?? null
        : null,
    [projectLookupById, selectedProjectId],
  );

  // Use selected-project details (from /api/list-project/?id=...) when available.
  const activeSelectedProject = selectedProjectDetails ?? selectedProject;

  /** Combined GeoJSON of all filtered projects (by division/district/tehsil) — same list API as project-management; shows geojson/shapefile boundaries on map */
  const allFilteredProjectsGeo = useMemo(
    () => buildProjectsFeatureCollection(filteredProjects, projectStatusById),
    [filteredProjects, projectStatusById]
  );

  // GeoJSON for the selected project only (used to zoom/focus map).
  const selectedProjectGeo = useMemo(() => {
    if (!activeSelectedProject || !activeSelectedProject.geom) return null;
    return buildProjectsFeatureCollection([activeSelectedProject], projectStatusById);
  }, [activeSelectedProject, projectStatusById]);

  return (
    <Layout title="Advanced GIS Intelligence">
      <div className="flex flex-col gap-4 sm:gap-6 w-full min-w-0">
        {/* Filters — compact inline bar */}
        <Card className="border border-border/60 bg-card shadow-sm overflow-hidden">
          <CardContent className="px-4 py-3 sm:px-5 sm:py-3.5">
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3">

              {/* Label */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Filter className="h-3.5 w-3.5" aria-hidden />
                </div>
                <span className="text-sm font-semibold text-foreground">Filters</span>
              </div>

              {/* Division */}
              <div className="flex flex-col gap-1 w-[calc(50%-0.5rem)] sm:w-[130px]">
                <label className="text-xs font-medium text-muted-foreground">Division</label>
                <Select value={selectedDivisionId} onValueChange={handleDivisionChange}>
                  <SelectTrigger className="h-8 w-full border-border/60 bg-background rounded-lg shadow-sm text-xs">
                    <SelectValue placeholder={divisionsLoading ? "Loading..." : "All"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {divisions.map((div) => (
                      <SelectItem key={div.id} value={String(div.id)}>
                        {div.division_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* District */}
              <div className="flex flex-col gap-1 w-[calc(50%-0.5rem)] sm:w-[130px]">
                <label className="text-xs font-medium text-muted-foreground">District</label>
                <Select
                  value={selectedDistrictId}
                  onValueChange={handleDistrictChange}
                  disabled={selectedDivisionId === "all" || districtsLoading}
                >
                  <SelectTrigger
                    className={cn(
                      "h-8 w-full border-border/60 bg-background rounded-lg shadow-sm text-xs",
                      (selectedDivisionId === "all" || districtsLoading) && "opacity-60 cursor-not-allowed",
                    )}
                  >
                    <SelectValue placeholder={districtsLoading ? "Loading..." : "All"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {selectedDivisionId !== "all" &&
                      districts.map((dist) => (
                        <SelectItem key={dist.id} value={String(dist.id)}>
                          {dist.district_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tehsil */}
              <div className="flex flex-col gap-1 w-[calc(50%-0.5rem)] sm:w-[130px]">
                <label className="text-xs font-medium text-muted-foreground">Tehsil</label>
                <Select
                  value={selectedTehsilId}
                  onValueChange={handleTehsilChange}
                  disabled={selectedDivisionId === "all" || selectedDistrictId === "all" || tehsilsLoading}
                >
                  <SelectTrigger
                    className={cn(
                      "h-8 w-full border-border/60 bg-background rounded-lg shadow-sm text-xs",
                      (selectedDivisionId === "all" || selectedDistrictId === "all" || tehsilsLoading) &&
                        "opacity-60 cursor-not-allowed",
                    )}
                  >
                    <SelectValue placeholder={tehsilsLoading ? "Loading..." : "All"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {selectedDivisionId !== "all" &&
                      selectedDistrictId !== "all" &&
                      tehsils.map((teh) => (
                        <SelectItem key={teh.id} value={String(teh.id)}>
                          {teh.tehsil_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Project */}
              <div className="flex flex-col gap-1 w-[calc(50%-0.5rem)] sm:w-[160px]">
                <label className="text-xs font-medium text-muted-foreground">Project</label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="h-8 w-full border-border/60 bg-background rounded-lg shadow-sm text-xs">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ({filteredProjects.length})</SelectItem>
                    {filteredProjects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.project_name || `#${p.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Clear button — only shown when any filter is active */}
              {(selectedDivisionId !== "all" ||
                selectedDistrictId !== "all" ||
                selectedTehsilId !== "all" ||
                selectedProjectId !== "all") && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setSelectedDivisionId("all");
                    setSelectedDistrictId("all");
                    setSelectedTehsilId("all");
                    setSelectedProjectId("all");
                  }}
                  className="h-8 self-end px-3 text-white bg-red-600 hover:bg-red-700 border-0 rounded-lg font-medium text-xs"
                >
                  Clear
                </Button>
              )}

            </div>
          </CardContent>
        </Card>

        {/* Project stats cards — refined layout, accent bar, icon badge */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {PROJECT_STAT_CARDS.map((stat) => (
            <Card
              key={stat.id}
              className={`overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow duration-200 rounded-xl border-l-4 ${stat.bgClass} ${stat.borderClass}`}
            >
              <CardContent className="p-5 flex flex-col gap-3 relative">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                    {stat.label}
                  </p>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 ${stat.iconOpacity} backdrop-blur-sm`}>
                    <stat.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold font-heading tabular-nums text-white drop-shadow-sm">
                  {projectCounts[stat.id]}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="w-full">

          <div className="w-full min-h-[480px] h-[65vh] max-h-[720px] rounded-xl overflow-hidden">
            <CityMap
              city={selectedCity}
              activeLayers={new Set()}
              searchQuery=""
              onMapReady={setMapRef}
              showLegend={showLegend}
              onLegendClose={() => setShowLegend(false)}
              showStats={false}
              showSurveillanceLayers={false}
              legendProjects={filteredProjects}
              onProjectSelect={(projectId) => {
                setSelectedProjectId(String(projectId));
                // scroll to gantt section (next tick so state renders)
                setTimeout(() => {
                  ganttSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 50);
              }}
              filterCenter={
                !selectedProjectGeo &&
                !allFilteredProjectsGeo &&
                selectedDivisionId !== "all"
                  ? mapView.center
                  : undefined
              }
              filterZoom={
                !selectedProjectGeo &&
                !allFilteredProjectsGeo &&
                selectedDivisionId !== "all"
                  ? mapView.zoom
                  : undefined
              }
              geoData={(selectedProjectGeo ?? allFilteredProjectsGeo) ?? undefined}
            />
          </div>

          {/* Selected Project Details (Gantt / WBS) */}
          {selectedProjectId !== "all" && (
            <div ref={ganttSectionRef}>
              <Card className="mt-4 border-border/60 shadow-sm overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg font-heading font-bold">
                  {(activeSelectedProject?.project_name || `Project ${selectedProjectId}`) +
                    " — Project Gantt"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {selectedProjectLoading || ganttLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-72 max-w-full" />
                    <Skeleton className="h-64 w-full" />
                  </div>
                ) : selectedProjectGanttTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No Gantt timeline data found for this project yet.
                  </p>
                ) : (
                  <ProjectGanttTree
                    tasks={selectedProjectGanttTasks as any}
                    projectName={activeSelectedProject?.project_name ?? undefined}
                    projectId={selectedProjectNumericId ?? undefined}
                    readOnly
                  />
                )}
              </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}


