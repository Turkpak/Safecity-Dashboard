/**
 * Converts boundary files (KML, KMZ, shapefile) to GeoJSON for API upload.
 * .geojson / .json files are returned as-is. Backend expects boundary_file as GeoJSON.
 */

import { kml } from "@tmcw/togeojson";
import shp from "shpjs";
import JSZip from "jszip";

const GEOJSON_EXTENSIONS = ["geojson", "json"];

function getExtension(file: File): string {
  const name = file.name.toLowerCase();
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop()! : "";
}

/**
 * Converts a boundary file to a GeoJSON File for upload.
 * - .geojson / .json: returned as-is (same file).
 * - .kml: parsed and converted to GeoJSON.
 * - .kmz: unzipped, first .kml parsed and converted to GeoJSON.
 * - .zip / .shp: shapefile parsed and converted to GeoJSON.
 */
export async function boundaryFileToGeojson(file: File): Promise<File> {
  const ext = getExtension(file);

  if (GEOJSON_EXTENSIONS.includes(ext)) {
    return file;
  }

  if (ext === "kml") {
    const text = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/xml");
    const geojson = kml(doc);
    const blob = new Blob([JSON.stringify(geojson)], {
      type: "application/geo+json",
    });
    return new File([blob], "boundary.geojson", { type: "application/geo+json" });
  }

  if (ext === "kmz") {
    const buf = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    const kmlEntry = Object.keys(zip.files).find(
      (k) => k.toLowerCase().endsWith(".kml")
    );
    if (!kmlEntry) {
      throw new Error("KMZ archive does not contain a .kml file");
    }
    const kmlText = await zip.files[kmlEntry].async("string");
    const parser = new DOMParser();
    const doc = parser.parseFromString(kmlText, "text/xml");
    const geojson = kml(doc);
    const blob = new Blob([JSON.stringify(geojson)], {
      type: "application/geo+json",
    });
    return new File([blob], "boundary.geojson", { type: "application/geo+json" });
  }

  if (ext === "zip" || ext === "shp") {
    const buf = await file.arrayBuffer();
    const geojson = await shp(buf);
    // shpjs returns GeoJSON or array of { fileName, features } for multiple layers
    const data = Array.isArray(geojson)
      ? { type: "FeatureCollection" as const, features: (geojson as { features?: unknown[] }[]).flatMap((l) => l.features ?? []) }
      : geojson;
    const blob = new Blob([JSON.stringify(data)], {
      type: "application/geo+json",
    });
    return new File([blob], "boundary.geojson", { type: "application/geo+json" });
  }

  throw new Error(
    `Unsupported boundary file type: .${ext}. Use .geojson, .json, .kml, .kmz, or shapefile (.zip/.shp).`
  );
}
