import { MapContainer, TileLayer, Marker, Popup, Circle, LayersControl, LayerGroup, Polyline, useMap, GeoJSON } from "react-leaflet";
import { useEffect, useState, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import { Camera, AlertTriangle, Truck, Shield, Activity, Landmark, Construction, Upload, MapPin, Info, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LayerType } from "@/pages/GISLayers";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom Icons
const getPoliceIcon = () => L.divIcon({
  className: 'police-station-icon',
  html: `<div class="p-1.5 bg-primary rounded-lg border-2 border-white shadow-xl"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const getPatrolIcon = (color: string) => L.divIcon({
  className: 'patrol-unit-icon',
  html: `<div class="p-1 bg-${color} rounded-full border-2 border-white shadow-lg animate-pulse"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M15 18H9"/></svg></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const getConstructionIcon = () => L.divIcon({
  className: 'construction-icon',
  html: `<div class="p-1.5 bg-orange-500 rounded-lg border-2 border-white shadow-xl animate-bounce"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="10" width="20" height="12" rx="2"/><path d="M6 10V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/></svg></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const getIncidentIcon = (severity: string) => L.divIcon({
  className: 'incident-icon',
  html: `<div class="p-1.5 ${severity === 'High' ? 'bg-destructive animate-ping' : 'bg-orange-600'} rounded-full border-2 border-white shadow-xl"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const MOCK_DATA = {
  cameras: [
    // Lahore
    { id: 1, pos: [31.5204, 74.3587], status: "Online", type: "PTZ", alerts: 2, label: "Mall Road Sector 1" },
    { id: 2, pos: [31.5497, 74.3436], status: "Offline", type: "Fixed", alerts: 0, label: "Gulberg Main Blvd" },
    // Rawalpindi
    { id: 101, pos: [33.5651, 73.0169], status: "Online", type: "PTZ", alerts: 1, label: "Saddar Metro Station" },
    { id: 102, pos: [33.5900, 73.0300], status: "Online", type: "Fixed", alerts: 0, label: "Murree Road Intersection" },
    // Gujranwala
    { id: 201, pos: [32.1877, 74.1945], status: "Online", type: "PTZ", alerts: 3, label: "GT Road Central" },
    { id: 202, pos: [32.1600, 74.2100], status: "Offline", type: "Fixed", alerts: 0, label: "Sialkot Bypass" },
  ],
  incidents: [
    // Lahore
    { id: 1, pos: [31.5100, 74.3300], type: "Traffic Accident", severity: "High", time: "10:15 AM", status: "Responding" },
    // Rawalpindi
    { id: 101, pos: [33.5750, 73.0200], type: "Suspicious Activity", severity: "Medium", time: "11:20 AM", status: "Pending" },
    // Gujranwala
    { id: 201, pos: [32.1950, 74.2000], type: "Fire Alert", severity: "High", time: "09:45 AM", status: "Responding" },
  ],
  patrols: [
    // Lahore
    { id: 1, pos: [31.5300, 74.3400], label: "Dolphin Unit 102", status: "Active", type: "Motorcycle", color: "emerald-500" },
    // Rawalpindi
    { id: 101, pos: [33.5550, 73.0100], label: "PRU Unit 88", status: "Active", type: "Car", color: "blue-500" },
    // Gujranwala
    { id: 201, pos: [32.1750, 74.1850], label: "Warden 42", status: "Active", type: "Motorcycle", color: "emerald-500" },
  ],
  stations: [
    { id: 1, pos: [31.5250, 74.3600], name: "Model Town PS", units: 12, radius: 2000 },
    { id: 101, pos: [33.5600, 73.0150], name: "Civil Lines Pindi", units: 18, radius: 2000 },
    { id: 201, pos: [32.1850, 74.1900], name: "City PS Gujranwala", units: 14, radius: 2000 },
  ],
  traffic: [
    { id: 1, path: [[31.520, 74.358], [31.540, 74.358], [31.560, 74.350]], level: "High", speed: "12 km/h" },
    { id: 2, path: [[31.500, 74.300], [31.520, 74.320], [31.540, 74.340]], level: "Low", speed: "45 km/h" },
  ],
  construction: [
    { id: 1, pos: [31.5350, 74.3550], label: "Flyover Project B", progress: "45%", image: "https://images.unsplash.com/photo-1541888946425-d81bb19480c5?auto=format&fit=crop&w=300&q=80" },
    { id: 2, pos: [31.4850, 74.3150], label: "Underpass Sector 4", progress: "70%", image: "https://images.unsplash.com/photo-1503387762-592dea58ef21?auto=format&fit=crop&w=300&q=80" },
    { id: 3, pos: [31.5100, 74.3650], label: "Orange Line Exp", progress: "25%", image: "https://images.unsplash.com/photo-1590644365607-1c5a519a9a37?auto=format&fit=crop&w=300&q=80" },
  ]
};

const CITY_COORDINATES: Record<string, [number, number]> = {
  lahore: [31.5204, 74.3587],
  rawalpindi: [33.5651, 73.0169],
  gujranwala: [32.1877, 74.1945],
};

// Component to handle map center changes
function MapCenterHandler({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// Component to handle fitting map to GeoJSON bounds
function GeoJSONFitBounds({ data }: { data: any }) {
  const map = useMap();
  useEffect(() => {
    if (data) {
      try {
        const layer = L.geoJSON(data);
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 15,
            animate: true,
            duration: 1.5
          });
        }
      } catch (err) {
        console.error("Error fitting map to GeoJSON:", err);
      }
    }
  }, [data, map]);
  return null;
}

export function CityMap({
  city = "lahore",
  activeLayers = new Set<LayerType>(["cameras", "incidents", "patrols", "construction", "traffic"]),
  searchQuery = "",
  onMapReady,
  geoData,
  showStats = true,
  showLegend = true,
  onLegendClose
}: {
  city?: string;
  activeLayers?: Set<LayerType>;
  searchQuery?: string;
  onMapReady?: (map: any) => void;
  geoData?: any;
  showStats?: boolean;
  showLegend?: boolean;
  onLegendClose?: () => void;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [constructionSites, setConstructionSites] = useState(MOCK_DATA.construction);
  const center = CITY_COORDINATES[city.toLowerCase()] || CITY_COORDINATES.lahore;
  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, id: number) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setConstructionSites(prev => prev.map(site =>
          site.id === id ? { ...site, image: event.target?.result as string } : site
        ));
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  // Filter data based on search query AND active layers
  const filteredCameras = (activeLayers.has("cameras") ? MOCK_DATA.cameras : []).filter(cam =>
    !searchQuery || cam.label.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredIncidents = (activeLayers.has("incidents") ? MOCK_DATA.incidents : []).filter(inc =>
    !searchQuery || inc.type.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredPatrols = (activeLayers.has("patrols") ? MOCK_DATA.patrols : []).filter(unit =>
    !searchQuery || unit.label.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredConstruction = activeLayers.has("construction") ? constructionSites : [];
  const filteredTraffic = activeLayers.has("traffic") ? MOCK_DATA.traffic : [];
  const filteredStations = activeLayers.has("stations") ? MOCK_DATA.stations : [];
  const filteredHotspots = activeLayers.has("hotspots") ? MOCK_DATA.incidents : [];

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (mapRef.current && onMapReady) {
      onMapReady(mapRef.current);
    }
  }, [onMapReady]);

  if (!isMounted) {
    return <div className="h-[360px] sm:h-[520px] lg:h-[600px] w-full bg-muted animate-pulse rounded-xl" />;
  }

  return (
    <div className="min-h-[400px] h-full w-full rounded-xl overflow-hidden border shadow-2xl relative z-0 group">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
        ref={mapRef}
      >
        <MapCenterHandler center={center} />
        {geoData && <GeoJSONFitBounds data={geoData} />}
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Operational Dark">
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Street View">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            />
          </LayersControl.BaseLayer>

          <LayersControl.Overlay checked name="CCTV Coverage">
            <LayerGroup>
              {filteredCameras.map(cam => (
                <Circle
                  key={cam.id}
                  center={cam.pos as [number, number]}
                  radius={cam.status === 'Online' ? 300 : 50}
                  pathOptions={{
                    color: cam.status === 'Online' ? '#3b82f6' : '#ef4444',
                    fillOpacity: 0.2
                  }}
                >
                  <Popup>
                    <div className="p-2 w-48 font-sans">
                      <div className="flex items-center gap-2 border-b pb-2 mb-2">
                        <Camera className="h-4 w-4 text-primary" />
                        <span className="font-bold text-sm">{cam.label}</span>
                      </div>
                      <p className="text-xs">STATUS: <span className={cam.status === 'Online' ? 'text-emerald-500' : 'text-destructive'}>{cam.status}</span></p>
                      <button className="w-full mt-3 bg-primary text-white text-[10px] py-1.5 rounded uppercase font-bold tracking-widest hover:bg-primary/90">Request Feed</button>
                    </div>
                  </Popup>
                </Circle>
              ))}
            </LayerGroup>
          </LayersControl.Overlay>

          <LayersControl.Overlay checked name="Live Incidents">
            <LayerGroup>
              {filteredIncidents.map(inc => (
                <Marker key={inc.id} position={inc.pos as [number, number]} icon={getIncidentIcon(inc.severity)}>
                  <Popup>
                    <div className="p-2 w-48 font-sans">
                      <div className="flex items-center gap-2 border-b pb-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="font-bold text-sm">{inc.type}</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <p><span className="font-bold">Severity:</span> {inc.severity}</p>
                        <p><span className="font-bold">Time:</span> {inc.time}</p>
                        <p><span className="font-bold">Status:</span> {inc.status}</p>
                      </div>
                      <Button variant="outline" className="w-full mt-3 text-[10px] h-7 border-destructive/20 text-destructive hover:bg-destructive hover:text-white">Dispatch Quick Response</Button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </LayerGroup>
          </LayersControl.Overlay>

          <LayersControl.Overlay checked name="Patrol Units">
            <LayerGroup>
              {filteredPatrols.map(unit => (
                <Marker key={unit.id} position={unit.pos as [number, number]} icon={getPatrolIcon(unit.color)}>
                  <Popup>
                    <div className="p-2 text-xs font-sans">
                      <p className="font-bold border-b pb-1 mb-1">{unit.label}</p>
                      <p>STATUS: {unit.status}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </LayerGroup>
          </LayersControl.Overlay>

          <LayersControl.Overlay checked name="Construction Projects">
            <LayerGroup>
              {filteredConstruction.map(site => (
                <Marker key={site.id} position={site.pos as [number, number]} icon={getConstructionIcon()}>
                  <Popup>
                    <div className="p-2 w-52 font-sans">
                      <div className="flex items-center gap-2 border-b pb-2 mb-2">
                        <Construction className="h-4 w-4 text-orange-500" />
                        <span className="font-bold text-sm">{site.label}</span>
                      </div>
                      <div className="aspect-video bg-muted rounded overflow-hidden mb-2 relative group">
                        <img src={site.image} alt={site.label} className="w-full h-full object-cover" />
                        <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                          <Upload className="h-6 w-6 text-white" />
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, site.id)} />
                        </label>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-medium uppercase tracking-tighter">Progress</span>
                        <span className="font-bold text-orange-500">{site.progress}</span>
                      </div>
                      <div className="w-full bg-muted h-1 rounded-full mt-1 overflow-hidden">
                        <div className="bg-orange-500 h-full" style={{ width: site.progress }} />
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </LayerGroup>
          </LayersControl.Overlay>

          <LayersControl.Overlay name="Police Stations">
            <LayerGroup>
              {filteredStations.map(station => (
                <LayerGroup key={station.id}>
                  <Marker position={station.pos as [number, number]} icon={getPoliceIcon()}>
                    <Popup>
                      <div className="p-2 text-xs">
                        <p className="font-bold">{station.name}</p>
                        <p>ACTIVE UNITS: {station.units}</p>
                      </div>
                    </Popup>
                  </Marker>
                  <Circle center={station.pos as [number, number]} radius={station.radius} pathOptions={{ color: 'rgba(30, 58, 138, 0.2)', dashArray: '5, 10' }} />
                </LayerGroup>
              ))}
            </LayerGroup>
          </LayersControl.Overlay>

          <LayersControl.Overlay checked name="Traffic Density">
            <LayerGroup>
              {filteredTraffic.map(route => (
                <Polyline
                  key={route.id}
                  positions={route.path as [number, number][]}
                  pathOptions={{
                    color: route.level === 'High' ? '#ef4444' : '#10b981',
                    weight: 6,
                    opacity: 0.8
                  }}
                >
                  <Popup>
                    <div className="text-xs">
                      <p className="font-bold">Congestion: {route.level}</p>
                      <p>Avg Speed: {route.speed}</p>
                    </div>
                  </Popup>
                </Polyline>
              ))}
            </LayerGroup>
          </LayersControl.Overlay>

          <LayersControl.Overlay name="Incident Hotspots">
            <LayerGroup>
              {/* Heatmap circles for hotspots */}
              {filteredHotspots.map(inc => (
                <Circle
                  key={`hotspot-${inc.id}`}
                  center={inc.pos as [number, number]}
                  radius={inc.severity === 'High' ? 500 : 300}
                  pathOptions={{
                    color: inc.severity === 'High' ? '#ef4444' : '#f97316',
                    fillColor: inc.severity === 'High' ? '#ef4444' : '#f97316',
                    fillOpacity: 0.3,
                    weight: 2
                  }}
                >
                  <Popup>
                    <div className="text-xs">
                      <p className="font-bold">{inc.type}</p>
                      <p>Hotspot Radius: {inc.severity === 'High' ? '500m' : '300m'}</p>
                    </div>
                  </Popup>
                </Circle>
              ))}
            </LayerGroup>
          </LayersControl.Overlay>

          {geoData && (
            <LayersControl.Overlay checked name="Proposed Area Boundary">
              <GeoJSON
                data={geoData}
                pathOptions={{
                  color: '#ef4444',
                  fillColor: '#ef4444',
                  fillOpacity: 0.1,
                  weight: 3,
                  dashArray: '10, 10'
                }}
              />
            </LayersControl.Overlay>
          )}
        </LayersControl>
      </MapContainer>

      {/* Real-time Status Floating Bar */}
      {showStats && (
        <div className="absolute bottom-6 left-6 right-6 z-[400] flex justify-between pointer-events-none">
          <div className="bg-primary text-white px-4 py-2 rounded-lg shadow-2xl border border-white/10 backdrop-blur pointer-events-auto flex items-center gap-4">
            <div className="flex items-center gap-2 border-r pr-4 border-white/20">
              <Activity className="h-4 w-4 text-secondary" />
              <span className="text-xs font-bold uppercase tracking-widest">Map Engine Live</span>
            </div>
            <div className="flex gap-4 text-[10px] font-mono">
              <span>CAMS: 4,500</span>
              <span className="text-secondary font-bold tracking-widest">ALERTS: 12</span>
              <span className="text-emerald-400 font-bold tracking-widest">PATROLS: 86</span>
              <span className="text-orange-400 font-bold tracking-widest">CONST: 8</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Legend Overlay */}
      {showLegend && (
        <div className="absolute top-4 left-4 z-[400] w-52 transition-all duration-300">
          <div className="bg-white/95 backdrop-blur-md rounded-lg shadow-2xl border border-primary/10 overflow-hidden">
            <div
              className="bg-primary px-3 py-1.5 flex items-center justify-between border-b border-white/10 cursor-pointer"
              onClick={() => setIsLegendCollapsed(!isLegendCollapsed)}
            >
              <div className="flex items-center gap-1.5">
                <Info className="h-3 w-3 text-secondary" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-white">Map Legend</span>
              </div>
              <button
                className="text-white/70 hover:text-white transition-colors"
              >
                {isLegendCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>
            {!isLegendCollapsed && (
              <div className="p-2.5">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-2 pb-2 border-b border-primary/5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 border border-white shadow-sm shrink-0"></div>
                    <span className="text-[9px] font-bold text-primary/80 leading-tight">Online Cam</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 border border-white shadow-sm shrink-0"></div>
                    <span className="text-[9px] font-bold text-primary/80 leading-tight">Offline Cam</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-destructive border border-white animate-pulse shadow-sm shrink-0"></div>
                    <span className="text-[9px] font-bold text-primary/80 leading-tight">High Risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-600 border border-white shadow-sm shrink-0"></div>
                    <span className="text-[9px] font-bold text-primary/80 leading-tight">Med Risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 border border-white animate-pulse shadow-sm shrink-0"></div>
                    <span className="text-[9px] font-bold text-primary/80 leading-tight">Patrol</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded bg-orange-500 border border-white shadow-sm shrink-0"></div>
                    <span className="text-[9px] font-bold text-primary/80 leading-tight">Const Site</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded bg-primary border border-white shadow-sm shrink-0"></div>
                    <span className="text-[9px] font-bold text-primary/80 leading-tight">Police Station</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-0.5 bg-red-500 rounded-full"></div>
                      <span className="text-[9px] font-bold text-primary/80 leading-tight">High Traffic</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-0.5 bg-emerald-500 rounded-full"></div>
                      <span className="text-[9px] font-bold text-primary/80 leading-tight">Low Traffic</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}