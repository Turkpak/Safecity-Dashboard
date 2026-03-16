import { Layout } from "@/components/layout/Layout";
import { CityMap } from "@/components/dashboard/CityMap";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { listProjects } from "@/api";
import { Download, FolderKanban, Loader2, AlertTriangle, CalendarCheck, Filter } from "lucide-react";
import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  getAllDivisions,
  getDistrictsByDivision,
  getTehsilsByDivisionAndDistrict,
} from "@/data/punjabHierarchy";
import { getMapCenterForArea } from "@/data/areaMapCenters";
import type { Project } from "@/api/types";

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

/** Build a GeoJSON FeatureCollection from all projects that have geom (for map layer by division/district/tehsil) */
function buildProjectsFeatureCollection(projects: Project[]): { type: "FeatureCollection"; features: Array<{ type: "Feature"; geometry: unknown; properties?: Record<string, unknown> }> } | null {
  const features: Array<{ type: "Feature"; geometry: unknown; properties?: Record<string, unknown> }> = [];
  for (const p of projects) {
    const normalized = normalizeProjectGeom(p.geom);
    if (!normalized) continue;
    const n = normalized as { type: string; features?: Array<{ type: string; geometry?: unknown; properties?: Record<string, unknown> }>; geometry?: unknown; properties?: Record<string, unknown> };
    const props = { id: p.id, project_name: p.project_name ?? `Project #${p.id}` };
    if (n.type === "FeatureCollection" && Array.isArray(n.features)) {
      for (const f of n.features) {
        if (f.geometry) features.push({ type: "Feature", geometry: f.geometry, properties: { ...(f.properties || {}), ...props } });
      }
    } else if (n.type === "Feature" && n.geometry) {
      features.push({ type: "Feature", geometry: n.geometry, properties: { ...(n.properties || {}), ...props } });
    }
  }
  if (features.length === 0) return null;
  return { type: "FeatureCollection", features };
}

export default function GISLayers() {
  const [selectedCity, setSelectedCity] = useState("lahore");
  const [showLegend, setShowLegend] = useState(true);
  const [mapRef, setMapRef] = useState<any>(null);
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [selectedTehsil, setSelectedTehsil] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

  const handleDivisionChange = (value: string) => {
    setSelectedDivision(value);
    setSelectedDistrict("all");
    setSelectedTehsil("all");
    setSelectedProjectId("all");
  };

  const handleDistrictChange = (value: string) => {
    setSelectedDistrict(value);
    setSelectedTehsil("all");
    setSelectedProjectId("all");
  };

  const handleTehsilChange = (value: string) => {
    setSelectedTehsil(value);
    setSelectedProjectId("all");
  };

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  const filteredProjects = useMemo((): Project[] => {
    if (selectedDivision === "all") return projects;
    let list = projects.filter(
      (p) => p.division_name && p.division_name.trim().toLowerCase() === selectedDivision.trim().toLowerCase()
    );
    if (selectedDistrict !== "all") {
      list = list.filter(
        (p) => p.district_name && p.district_name.trim().toLowerCase() === selectedDistrict.trim().toLowerCase()
      );
    }
    if (selectedTehsil !== "all") {
      list = list.filter(
        (p) => p.tehsil_name && p.tehsil_name.trim().toLowerCase() === selectedTehsil.trim().toLowerCase()
      );
    }
    return list;
  }, [projects, selectedDivision, selectedDistrict, selectedTehsil]);

  const totalFiltered = filteredProjects.length;
  const inProgressCount = Math.round(totalFiltered * 0.5);
  const inDelayCount = Math.round(totalFiltered * 0.15);
  const pendingCount = Math.max(0, totalFiltered - inProgressCount - inDelayCount);

  const projectCounts = {
    total: totalFiltered,
    in_progress: inProgressCount,
    in_delay: inDelayCount,
    pending: pendingCount,
  } as const;

  const mapView = useMemo(
    () =>
      getMapCenterForArea(
        selectedDivision === "all" ? "" : selectedDivision,
        selectedDistrict === "all" ? undefined : selectedDistrict,
        selectedTehsil === "all" ? undefined : selectedTehsil
      ),
    [selectedDivision, selectedDistrict, selectedTehsil]
  );

  const selectedProject = useMemo(
    () =>
      selectedProjectId && selectedProjectId !== "all"
        ? filteredProjects.find((p) => String(p.id) === selectedProjectId) ?? null
        : null,
    [filteredProjects, selectedProjectId]
  );

  /** Combined GeoJSON of all filtered projects (by division/district/tehsil) — same list API as project-management; shows geojson/shapefile boundaries on map */
  const allFilteredProjectsGeo = useMemo(
    () => buildProjectsFeatureCollection(filteredProjects),
    [filteredProjects]
  );

  const handleExportMap = () => {
    // Export functionality - can be enhanced with html2canvas
    alert("Map export functionality - Coming soon!");
  };

  return (
    <Layout title="Advanced GIS Intelligence">
      <div className="flex flex-col gap-6">
        {/* Filters — card panel with clear hierarchy */}
        <Card className="border border-border/60 bg-card shadow-sm overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Filter className="h-4 w-4" aria-hidden />
                </div>
                <span className="text-sm font-semibold text-foreground">Filters</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 flex-1 min-w-0">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Division</label>
                  <Select value={selectedDivision} onValueChange={handleDivisionChange}>
                    <SelectTrigger className="h-9 w-[140px] sm:w-[160px] border-border/60 bg-background rounded-lg shadow-sm">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {getAllDivisions().map((div) => (
                        <SelectItem key={div} value={div}>{div}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">District</label>
                  <Select
                    value={selectedDistrict}
                    onValueChange={handleDistrictChange}
                    disabled={selectedDivision === "all"}
                  >
                    <SelectTrigger
                      className={`h-9 w-[140px] sm:w-[160px] border-border/60 bg-background rounded-lg shadow-sm ${selectedDivision === "all" ? "opacity-60" : ""}`}
                      disabled={selectedDivision === "all"}
                    >
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {selectedDivision !== "all" &&
                        getDistrictsByDivision(selectedDivision).map((dist) => (
                          <SelectItem key={dist} value={dist}>{dist}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Tehsil</label>
                  <Select
                    value={selectedTehsil}
                    onValueChange={handleTehsilChange}
                    disabled={selectedDivision === "all" || selectedDistrict === "all"}
                  >
                    <SelectTrigger
                      className={`h-9 w-[140px] sm:w-[160px] border-border/60 bg-background rounded-lg shadow-sm ${selectedDivision === "all" || selectedDistrict === "all" ? "opacity-60" : ""}`}
                      disabled={selectedDivision === "all" || selectedDistrict === "all"}
                    >
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {selectedDivision !== "all" &&
                        selectedDistrict !== "all" &&
                        getTehsilsByDivisionAndDistrict(selectedDivision, selectedDistrict).map((teh) => (
                          <SelectItem key={teh} value={teh}>{teh}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Project</label>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger className="h-9 w-[160px] sm:w-[180px] border-border/60 bg-background rounded-lg shadow-sm">
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
                {(selectedDivision !== "all" || selectedDistrict !== "all" || selectedTehsil !== "all" || selectedProjectId !== "all") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDivision("all");
                      setSelectedDistrict("all");
                      setSelectedTehsil("all");
                      setSelectedProjectId("all");
                    }}
                    className="h-9 px-4 rounded-lg font-medium shrink-0 self-end"
                  >
                    Clear filters
                  </Button>
                )}
              </div>
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold font-heading text-primary">Operations Center</h2>


            <div className="flex flex-wrap gap-2 items-center">
            
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportMap}
                className="h-8 text-xs"
              >
                <Download className="h-3 w-3 mr-1" /> Export
              </Button>
             
            </div>
          </div>

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
              filterCenter={!allFilteredProjectsGeo && selectedDivision !== "all" ? mapView.center : undefined}
              filterZoom={!allFilteredProjectsGeo && selectedDivision !== "all" ? mapView.zoom : undefined}
              geoData={allFilteredProjectsGeo ?? undefined}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}


