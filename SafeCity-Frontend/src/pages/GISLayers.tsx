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

const DEFAULT_ACTIVE_LAYERS = new Set<LayerType>([
  "cameras", "incidents", "patrols", "construction", "traffic"
]);

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

  const projectBoundaryGeo = useMemo(
    () => (selectedProject?.geom ? normalizeProjectGeom(selectedProject.geom) : null),
    [selectedProject]
  );

  const handleExportMap = () => {
    // Export functionality - can be enhanced with html2canvas
    alert("Map export functionality - Coming soon!");
  };

  return (
    <Layout title="Advanced GIS Intelligence">
      <div className="flex flex-col gap-6">
        {/* Filters — single row; Filter icon only (no text); short Project text */}
        <div className="flex flex-nowrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm font-medium text-muted-foreground shrink-0">Division</label>
            <Select value={selectedDivision} onValueChange={handleDivisionChange}>
              <SelectTrigger className="h-9 w-[140px] border-border/50 bg-background rounded-md">
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
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm font-medium text-muted-foreground shrink-0">District</label>
            <Select
              value={selectedDistrict}
              onValueChange={handleDistrictChange}
              disabled={selectedDivision === "all"}
            >
              <SelectTrigger
                className={`h-9 w-[140px] border-border/50 bg-background rounded-md ${selectedDivision === "all" ? "opacity-50 cursor-not-allowed" : ""}`}
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
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm font-medium text-muted-foreground shrink-0">Tehsil</label>
            <Select
              value={selectedTehsil}
              onValueChange={handleTehsilChange}
              disabled={selectedDivision === "all" || selectedDistrict === "all"}
            >
              <SelectTrigger
                className={`h-9 w-[140px] border-border/50 bg-background rounded-md ${selectedDivision === "all" || selectedDistrict === "all" ? "opacity-50 cursor-not-allowed" : ""}`}
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
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm font-medium text-muted-foreground shrink-0">Project</label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="h-9 w-[160px] border-border/50 bg-background rounded-md">
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
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedDivision("all");
                setSelectedDistrict("all");
                setSelectedTehsil("all");
                setSelectedProjectId("all");
              }}
              className="h-9 px-3 text-xs font-medium shrink-0"
            >
              Clear
            </Button>
          )}
        </div>

        {/* Project stats cards — situation-based colors */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {PROJECT_STAT_CARDS.map((stat) => (
            <Card
              key={stat.id}
              className={`border-none shadow-md text-white overflow-hidden relative group border-l-4 ${stat.bgClass} ${stat.borderClass}`}
            >
              <div className={`absolute right-[-10px] top-[-10px] ${stat.iconOpacity} group-hover:scale-110 transition-transform`}>
                <stat.icon className="h-20 w-20" />
              </div>
              <CardContent className="p-4 flex flex-col gap-1 relative z-10">
                <p className="text-[10px] uppercase font-bold tracking-widest opacity-90">{stat.label}</p>
                <p className="text-2xl font-bold font-heading">{projectCounts[stat.id]}</p>
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
              activeLayers={DEFAULT_ACTIVE_LAYERS}
              searchQuery=""
              onMapReady={setMapRef}
              showLegend={showLegend}
              onLegendClose={() => setShowLegend(false)}
              showStats={false}
              filterCenter={!projectBoundaryGeo && selectedDivision !== "all" ? mapView.center : undefined}
              filterZoom={!projectBoundaryGeo && selectedDivision !== "all" ? mapView.zoom : undefined}
              geoData={projectBoundaryGeo ?? undefined}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}


