import { Layout } from "@/components/layout/Layout";
import { CityMap } from "@/components/dashboard/CityMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Map as MapIcon,
  Layers,
  Camera,
  AlertTriangle,
  Truck,
  Shield,
  Activity,
  Landmark,
  TrendingUp,
  MapPin,
  Construction,
  Search,
  Download,
  Filter,
  Info,
  Ruler,
  Zap
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";

const GIS_STATS = [
  { label: "CCTV Uptime", value: "98.4%", change: "+0.2%", icon: Camera },
  { label: "Patrol Coverage", value: "92%", change: "+5%", icon: Truck },
  { label: "Construction Radius", value: "1.8km", change: "-0.1km", icon: Construction },
  { label: "Station Nodes", value: "24", change: "0", icon: Landmark },
];

export type LayerType = "cameras" | "incidents" | "patrols" | "construction" | "stations" | "traffic" | "hotspots";

export default function GISLayers() {
  const [selectedCity, setSelectedCity] = useState("lahore");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeLayers, setActiveLayers] = useState<Set<LayerType>>(new Set([
    "cameras", "incidents", "patrols", "construction", "traffic"
  ] as LayerType[]));
  const [showLegend, setShowLegend] = useState(true);
  const [mapRef, setMapRef] = useState<any>(null);

  const layerConfig = [
    {
      id: "cameras" as LayerType,
      icon: Camera,
      label: "CCTV Network",
      detail: "4,500 Cameras",
      status: "Active",
      color: "text-blue-500",
      layerName: "CCTV Coverage"
    },
    {
      id: "construction" as LayerType,
      icon: Construction,
      label: "Construction Sites",
      detail: "8 Active Projects",
      status: "In Progress",
      color: "text-orange-500",
      layerName: "Construction Projects"
    },
    {
      id: "hotspots" as LayerType,
      icon: AlertTriangle,
      label: "Hotspot Zones",
      detail: "12 Critical",
      status: "Warning",
      color: "text-secondary",
      layerName: "Incident Hotspots"
    },
    {
      id: "patrols" as LayerType,
      icon: Truck,
      label: "Patrol Fleet",
      detail: "86 Units",
      status: "Tracking",
      color: "text-emerald-500",
      layerName: "Patrol Units"
    },
    {
      id: "stations" as LayerType,
      icon: Landmark,
      label: "Police Stations",
      detail: "24 Locations",
      status: "Static",
      color: "text-primary",
      layerName: "Police Stations"
    },
    {
      id: "traffic" as LayerType,
      icon: Activity,
      label: "Traffic Sensors",
      detail: "1,200 Nodes",
      status: "Live",
      color: "text-purple-500",
      layerName: "Traffic Density"
    },
  ];

  const toggleLayer = (layerId: LayerType) => {
    setActiveLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(layerId)) {
        newSet.delete(layerId);
      } else {
        newSet.add(layerId);
      }
      return newSet;
    });
  };

  const filteredLayers = useMemo(() => {
    if (!searchQuery) return layerConfig;
    const query = searchQuery.toLowerCase();
    return layerConfig.filter(layer =>
      layer.label.toLowerCase().includes(query) ||
      layer.detail.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleExportMap = () => {
    // Export functionality - can be enhanced with html2canvas
    alert("Map export functionality - Coming soon!");
  };

  return (
    <Layout title="Advanced GIS Intelligence">
      <div className="flex flex-col gap-6">
        {/* Statistics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {GIS_STATS.map((stat) => (
            <Card key={stat.label} className="border-none shadow-sm bg-primary text-white overflow-hidden relative group">
              <div className="absolute right-[-10px] top-[-10px] opacity-10 group-hover:scale-110 transition-transform">
                <stat.icon className="h-20 w-20" />
              </div>
              <CardContent className="p-4 flex flex-col gap-1 relative z-10">
                <p className="text-[10px] uppercase font-bold tracking-widest opacity-70">{stat.label}</p>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold font-heading">{stat.value}</span>
                  <span className="text-[10px] mb-1 text-emerald-400 font-bold">{stat.change}</span>
                </div>
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

          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* GIS Explorer Sidebar */}
              <div className="lg:col-span-4 space-y-6">
                <Card className="border-primary/10">
                  <CardHeader className="p-4 border-b space-y-3">
                    <CardTitle className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                      <Layers className="h-3 w-3" /> Spatial Inventory
                    </CardTitle>
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search layers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-8 text-xs"
                      />
                    </div>
                  </CardHeader>
                  <ScrollArea className="h-[320px] sm:h-[420px] lg:h-[600px]">
                    <CardContent className="p-4 space-y-3">
                      {filteredLayers.map((item) => {
                        const isActive = activeLayers.has(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleLayer(item.id)}
                            className={`flex items-center justify-between p-4 rounded-xl transition-all duration-200 cursor-pointer group shadow-sm border border-transparent active:scale-[0.98] select-none ${isActive ? 'bg-primary/10 border-primary/20' : 'bg-muted/30 hover:bg-muted hover:border-muted-foreground/10'
                              }`}
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <div className={`p-2.5 rounded-lg transition-colors shadow-sm ${isActive ? 'bg-primary/20 text-primary' : 'bg-white group-hover:bg-muted text-muted-foreground'
                                }`}>
                                <item.icon className="h-5 w-5" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-bold tracking-tight mb-0.5">{item.label}</p>
                                <p className="text-[11px] text-muted-foreground uppercase font-semibold">{item.detail}</p>
                              </div>
                            </div>
                            <Switch
                              checked={isActive}
                              className="ml-2 pointer-events-none"
                            />
                          </div>
                        );
                      })}
                    </CardContent>
                  </ScrollArea>
                </Card>


              </div>

              {/* Advanced Map Engine */}
              <div className="lg:col-span-8">
                <CityMap
                  city={selectedCity}
                  activeLayers={activeLayers}
                  searchQuery={searchQuery}
                  onMapReady={setMapRef}
                  showLegend={showLegend}
                  onLegendClose={() => setShowLegend(false)}
                  showStats={false}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}


