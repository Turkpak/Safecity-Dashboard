import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, TrendingUp } from "lucide-react";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// City coordinates for Punjab cities
const CITY_COORDINATES: Record<string, { pos: [number, number], name: string }> = {
  sheikhupura: { pos: [31.7167, 73.9833], name: "Sheikhupura" },
  sialkot: { pos: [32.4945, 74.5222], name: "Sialkot" },
  gujrat: { pos: [32.5739, 74.0776], name: "Gujrat" },
  jehlum: { pos: [32.9333, 73.7333], name: "Jehlum" },
  attock: { pos: [33.7667, 72.3667], name: "Attock" },
  hassanAbdal: { pos: [33.8167, 72.6833], name: "Hassan Abdal" },
  sahiwal: { pos: [30.6667, 73.1000], name: "Sahiwal" },
  okara: { pos: [30.8081, 73.4458], name: "Okara" },
  jhang: { pos: [31.2833, 72.3333], name: "Jhang" },
  muzaffargarh: { pos: [30.0667, 71.2000], name: "Muzaffargarh" },
};

interface CityData {
  overall: number;
}

interface InstallationMapProps {
  cityData: Record<string, CityData>;
  selectedCity?: string;
  onCitySelect?: (city: string) => void;
}

const getProgressColor = (percentage: number): string => {
  if (percentage >= 80) return "#10b981"; // green
  if (percentage >= 60) return "#3b82f6"; // blue
  if (percentage >= 40) return "#f59e0b"; // orange
  return "#ef4444"; // red
};

const getProgressIcon = (percentage: number) => {
  const color = getProgressColor(percentage);
  return L.divIcon({
    className: 'installation-marker',
    html: `
      <div style="
        background: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 10px;
      ">
        ${percentage}%
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

export function InstallationMap({ cityData, selectedCity, onCitySelect }: InstallationMapProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Divisonwise Milestone Progress Map</CardTitle>
          <CardDescription>Geographic overview across Punjab</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[320px] sm:h-[420px] lg:h-[500px] w-full bg-muted animate-pulse rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  // Calculate center point (roughly center of Punjab)
  const center: [number, number] = [31.5, 73.0];
  const zoom = 7;

  return (
    <Card className="shadow-lg border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 font-heading text-xl font-bold">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          Progress Map
        </CardTitle>
        <CardDescription className="text-sm">Geographic overview of camera installation across Punjab cities</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[320px] sm:h-[420px] lg:h-[500px] w-full rounded-xl overflow-hidden border relative z-0">
          <MapContainer
            center={center}
            zoom={zoom}
            style={{ height: "100%", width: "100%", zIndex: 0 }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {Object.entries(CITY_COORDINATES).map(([key, city]) => {
              const data = cityData[key];
              if (!data) return null;
              
              const percentage = data.overall;
              const color = getProgressColor(percentage);
              const isSelected = selectedCity === key;
              
              return (
                <div key={key}>
                  <Marker
                    position={city.pos}
                    icon={getProgressIcon(percentage)}
                    eventHandlers={{
                      click: () => onCitySelect?.(key),
                    }}
                  >
                    <Popup>
                      <div className="p-2 min-w-[200px]">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-bold text-sm">{city.name}</h3>
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                            style={{ 
                              borderColor: color,
                              color: color 
                            }}
                          >
                            {percentage}%
                          </Badge>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Overall Progress</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                          {isSelected && (
                            <p className="text-primary font-medium mt-2">Currently Selected</p>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                </div>
              );
            })}
            
            {/* Selected city highlight circle */}
            {selectedCity && CITY_COORDINATES[selectedCity] && (() => {
              const city = CITY_COORDINATES[selectedCity];
              const data = cityData[selectedCity];
              if (!data) return null;
              const color = getProgressColor(data.overall);
              return (
                <Circle
                  key={`circle-${selectedCity}`}
                  center={city.pos}
                  radius={15000}
                  pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.1,
                    weight: 2,
                  }}
                />
              );
            })()}
          </MapContainer>
        </div>
        
        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
            <span>80-100% (Excellent)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <span>60-79% (Good)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-orange-500"></div>
            <span>40-59% (In Progress)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span>0-39% (Early Stage)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

