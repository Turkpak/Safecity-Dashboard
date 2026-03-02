import { Layout } from "@/components/layout/Layout";
import { CityMap } from "@/components/dashboard/CityMap";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { listProjects } from "@/api";
import { Download, FolderKanban, Loader2, AlertTriangle, CalendarCheck, Filter } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getAllDivisions,
  getDistrictsByDivision,
  getTehsilsByDivisionAndDistrict,
} from "@/data/punjabHierarchy";

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

export default function GISLayers() {
  const [selectedCity, setSelectedCity] = useState("lahore");
  const [showLegend, setShowLegend] = useState(true);
  const [mapRef, setMapRef] = useState<any>(null);
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [selectedTehsil, setSelectedTehsil] = useState<string>("all");

  const handleDivisionChange = (value: string) => {
    setSelectedDivision(value);
    setSelectedDistrict("all");
    setSelectedTehsil("all");
  };

  const handleDistrictChange = (value: string) => {
    setSelectedDistrict(value);
    setSelectedTehsil("all");
  };

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  const totalProjects = projects.length;
  const inProgressCount = Math.round(totalProjects * 0.5);
  const inDelayCount = Math.round(totalProjects * 0.15);
  const pendingCount = Math.max(0, totalProjects - inProgressCount - inDelayCount);

  const projectCounts = {
    total: totalProjects,
    in_progress: inProgressCount,
    in_delay: inDelayCount,
    pending: pendingCount,
  } as const;

  const handleExportMap = () => {
    // Export functionality - can be enhanced with html2canvas
    alert("Map export functionality - Coming soon!");
  };

  return (
    <Layout title="Advanced GIS Intelligence">
      <div className="flex flex-col gap-6">
        {/* Filter bar — Division / District / Tehsil (same as Finance page) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 shadow-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Filter className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Filters:</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 sm:flex-shrink-0">
                <label className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap">Division:</label>
                <Select value={selectedDivision} onValueChange={handleDivisionChange}>
                  <SelectTrigger className="w-full sm:w-[160px] h-9 border-border/50 bg-background rounded-md">
                    <SelectValue placeholder="All Divisions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Divisions</SelectItem>
                    {getAllDivisions().map((div) => (
                      <SelectItem key={div} value={div}>{div}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 sm:flex-shrink-0">
                <label className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap">District:</label>
                <Select
                  value={selectedDistrict}
                  onValueChange={handleDistrictChange}
                  disabled={selectedDivision === "all"}
                >
                  <SelectTrigger
                    className={`w-full sm:w-[160px] h-9 border-border/50 bg-background rounded-md ${selectedDivision === "all" ? "opacity-50 cursor-not-allowed" : ""}`}
                    disabled={selectedDivision === "all"}
                  >
                    <SelectValue placeholder="All Districts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Districts</SelectItem>
                    {selectedDivision !== "all" &&
                      getDistrictsByDivision(selectedDivision).map((dist) => (
                        <SelectItem key={dist} value={dist}>{dist}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 sm:flex-shrink-0">
                <label className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap">Tehsil:</label>
                <Select
                  value={selectedTehsil}
                  onValueChange={setSelectedTehsil}
                  disabled={selectedDivision === "all" || selectedDistrict === "all"}
                >
                  <SelectTrigger
                    className={`w-full sm:w-[160px] h-9 border-border/50 bg-background rounded-md ${selectedDivision === "all" || selectedDistrict === "all" ? "opacity-50 cursor-not-allowed" : ""}`}
                    disabled={selectedDivision === "all" || selectedDistrict === "all"}
                  >
                    <SelectValue placeholder="All Tehsils" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tehsils</SelectItem>
                    {selectedDivision !== "all" &&
                      selectedDistrict !== "all" &&
                      getTehsilsByDivisionAndDistrict(selectedDivision, selectedDistrict).map((teh) => (
                        <SelectItem key={teh} value={teh}>{teh}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {(selectedDivision !== "all" || selectedDistrict !== "all" || selectedTehsil !== "all") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedDivision("all");
                    setSelectedDistrict("all");
                    setSelectedTehsil("all");
                  }}
                  className="h-9 px-3 text-xs font-medium w-full sm:w-auto mt-2 sm:mt-0"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
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
              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lahore">Lahore</SelectItem>
                  <SelectItem value="rawalpindi">Rawalpindi</SelectItem>
                  <SelectItem value="gujranwala">Gujranwala</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportMap}
                className="h-8 text-xs"
              >
                <Download className="h-3 w-3 mr-1" /> Export
              </Button>
              <Badge variant="secondary" className="px-2 py-1 font-mono text-[10px] hidden sm:inline-flex">
                {selectedCity.toUpperCase()}_GRID_ACTIVE
              </Badge>
              <Badge className="bg-emerald-500 hover:bg-emerald-600 px-3 py-1 font-mono text-[10px]">SYNCED</Badge>
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
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}


