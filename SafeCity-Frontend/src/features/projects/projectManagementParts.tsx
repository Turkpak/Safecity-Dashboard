import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import { FileText, FolderKanban, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Project as ApiProject } from "@/api/types";
import { mediaUrl } from "@/api/config";

/** Format stakeholder for display using API stakeholder_details (names) instead of IDs */
export function formatProjectStakeholder(project: ApiProject): string {
  const details = project.stakeholder_details;
  if (details && details.length > 0) {
    return details
      .map((d) =>
        d.stakeholder_title && d.stakeholder_type
          ? `${d.stakeholder_title} (${d.stakeholder_type})`
          : d.stakeholder_title || d.stakeholder_type || ""
      )
      .filter(Boolean)
      .join(", ") || fallbackStakeholderLabel(project);
  }
  return fallbackStakeholderLabel(project);
}
export function fallbackStakeholderLabel(project: ApiProject): string {
  const ids = Array.isArray(project.stakeholder) ? project.stakeholder : [project.stakeholder];
  if (ids.length > 0) return `Stakeholder #${ids.join(", #")}`;
  return "—";
}

export type ProjectAccent = {
  /** subtle left border accent */
  borderClass: string;
  /** light tinted background for icon container */
  iconBgClass: string;
  /** icon color */
  iconClass: string;
};

export function getProjectAccent(projectId: number): ProjectAccent {
  const accents: ProjectAccent[] = [
    {
      borderClass: "border-l-sky-500",
      iconBgClass: "bg-sky-50 dark:bg-sky-950/35",
      iconClass: "text-sky-700 dark:text-sky-300",
    },
    {
      borderClass: "border-l-emerald-500",
      iconBgClass: "bg-emerald-50 dark:bg-emerald-950/35",
      iconClass: "text-emerald-700 dark:text-emerald-300",
    },
    {
      borderClass: "border-l-violet-500",
      iconBgClass: "bg-violet-50 dark:bg-violet-950/35",
      iconClass: "text-violet-700 dark:text-violet-300",
    },
    {
      borderClass: "border-l-amber-500",
      iconBgClass: "bg-amber-50 dark:bg-amber-950/35",
      iconClass: "text-amber-800 dark:text-amber-300",
    },
  ];
  const idx = Math.abs(projectId) % accents.length;
  return accents[idx];
}

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Component to fit map bounds to GeoJSON
export function GeoJSONFitBounds({ data }: { data: any }) {
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

// Map component for displaying project area
export function ProjectAreaMap({ geoData }: { geoData: any }) {
  const [isMounted, setIsMounted] = useState(false);
  const center: [number, number] = [31.5204, 74.3587]; // Default to Lahore

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className="h-[400px] w-full bg-muted animate-pulse rounded-lg" />;
  }

  return (
    <div className="h-[400px] w-full rounded-lg overflow-hidden border">
      <MapContainer
        center={center}
        zoom={10}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geoData && (
          <>
            <GeoJSON data={geoData} style={{ color: "#3b82f6", weight: 3, fillColor: "#3b82f6", fillOpacity: 0.2 }} />
            <GeoJSONFitBounds data={geoData} />
          </>
        )}
      </MapContainer>
    </div>
  );
}

export const XER_FILE_INPUT_ID = "xer-file-input-wizard";

/** Step 2: Primavera XER — opens the device file picker (same backend multipart field `xer_file`). */
export function WizardXerUploadSection({
  editingProject,
  xerFile,
  onXerInputChange,
  onClearXer,
}: {
  editingProject: ApiProject | null;
  xerFile: File | null;
  onXerInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearXer: () => void;
}) {
  const openPicker = () => document.getElementById(XER_FILE_INPUT_ID)?.click();

  const existingXerHref =
    editingProject?.xer_file &&
    (editingProject.xer_file.startsWith("http")
      ? editingProject.xer_file
      : mediaUrl(editingProject.xer_file.startsWith("/") ? editingProject.xer_file : `/${editingProject.xer_file}`));

  return (
    <div className="flex flex-col gap-3 min-w-0 h-full">
      <div>
        <Label htmlFor={XER_FILE_INPUT_ID} className="text-sm font-medium">
          Primavera schedule (XER){editingProject ? "" : " *"}
        </Label>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Export from Primavera P6
        </p>
      </div>

      {editingProject && editingProject.xer_file && !xerFile && (
        <div className="rounded-lg border bg-muted/50 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-medium truncate">
              Current: {
                editingProject.xer_file_name
                || editingProject.xer_file?.split("/").pop()
                || "Schedule file uploaded"
              }
            </p>
            {existingXerHref ? (
              <a
                href={existingXerHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline inline-block"
              >
                Open / download
              </a>
            ) : null}
          </div>
        </div>
      )}

      <div
        className={`relative rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-2 text-center px-4 py-6 min-h-[13rem] flex-1 touch-manipulation ${
          xerFile
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 active:bg-muted/40 cursor-pointer"
        }`}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Select XER schedule file"
      >
        {xerFile ? (
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-full">
            <FileText className="h-10 w-10 text-primary shrink-0" />
            <div className="flex-1 min-w-0 text-left w-full">
              <p className="font-medium text-sm sm:text-base break-all">{xerFile.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {(xerFile.size / 1024).toFixed(2)} KB · ready to upload
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 h-11 w-11"
              onClick={(e) => {
                e.stopPropagation();
                onClearXer();
              }}
              aria-label="Remove XER file"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <Upload className="h-10 w-10 text-muted-foreground shrink-0" />
            <p className="text-sm font-medium">Tap to choose from this device</p>
            <p className="text-xs text-muted-foreground max-w-md">
              .xer only — same file is sent to the server on Create for schedule import.
            </p>
          </>
        )}
      </div>

      <Button type="button" variant="secondary" className="w-full min-h-11 px-6" onClick={openPicker}>
        <FolderKanban className="h-4 w-4 mr-2 shrink-0" />
        Choose file…
      </Button>

      <Input
        id={XER_FILE_INPUT_ID}
        type="file"
        accept=".xer,.XER,application/octet-stream"
        onChange={onXerInputChange}
        className="sr-only"
      />
    </div>
  );
}
