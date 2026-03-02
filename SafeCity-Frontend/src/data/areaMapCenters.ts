/**
 * Approximate map centers and zoom levels for Punjab divisions, districts, and tehsils.
 * Used by GIS page to navigate the map when user selects area filters.
 */

export type MapView = { center: [number, number]; zoom: number };

// Division-level centers (approximate centroid / main city of each division)
const DIVISION_CENTERS: Record<string, [number, number]> = {
  Lahore: [31.5204, 74.3587],
  Rawalpindi: [33.5651, 73.0169],
  Gujranwala: [32.1877, 74.1945],
  Gujrat: [32.5742, 74.0754],
  Sargodha: [32.0836, 72.6711],
  Faisalabad: [31.4181, 73.079],
  Multan: [30.1575, 71.5249],
  Bahawalpur: [29.3956, 71.6833],
  "Dera Ghazi Khan": [30.05, 70.6342],
  Sahiwal: [30.6705, 73.1063],
};

// District-level centers (when available; otherwise division center is used)
// Key: "Division|District"
const DISTRICT_CENTERS: Record<string, [number, number]> = {
  "Lahore|Lahore": [31.5204, 74.3587],
  "Lahore|Sheikhupura": [31.7167, 73.985],
  "Lahore|Nankana Sahib": [31.45, 73.7167],
  "Lahore|Kasur": [31.1156, 74.4466],
  "Rawalpindi|Rawalpindi": [33.5651, 73.0169],
  "Rawalpindi|Jhelum": [32.9333, 73.7333],
  "Rawalpindi|Attock": [33.7667, 72.3667],
  "Rawalpindi|Murree": [33.9072, 73.3903],
  "Rawalpindi|Chakwal": [32.9333, 72.8667],
  "Rawalpindi|Talagang": [32.9167, 72.4167],
  "Gujranwala|Gujranwala": [32.1877, 74.1945],
  "Gujranwala|Sialkot": [32.5, 74.5333],
  "Gujranwala|Narowal": [32.1, 74.8833],
  "Gujrat|Gujrat": [32.5742, 74.0754],
  "Gujrat|Hafizabad": [32.0667, 73.6833],
  "Gujrat|Mandi Bahauddin": [32.5833, 73.4833],
  "Gujrat|Wazirabad": [32.45, 74.1167],
  "Sargodha|Sargodha": [32.0836, 72.6711],
  "Sargodha|Khushab": [32.3, 72.35],
  "Sargodha|Mianwali": [32.5833, 71.55],
  "Sargodha|Bhakkar": [31.6333, 71.0667],
  "Faisalabad|Faisalabad": [31.4181, 73.079],
  "Faisalabad|Jhang": [31.2667, 72.3167],
  "Faisalabad|Chiniot": [31.7167, 72.9833],
  "Faisalabad|Toba Tek Singh": [30.9667, 72.4833],
  "Multan|Multan": [30.1575, 71.5249],
  "Multan|Vehari": [29.9667, 72.3167],
  "Multan|Lodhran": [29.5333, 71.6333],
  "Multan|Khanewal": [30.3, 71.9333],
  "Bahawalpur|Bahawalpur": [29.3956, 71.6833],
  "Bahawalpur|Bahawalnagar": [29.9833, 73.2667],
  "Bahawalpur|Rahim Yar Khan": [28.4167, 70.3],
  "Dera Ghazi Khan|Dera Ghazi Khan": [30.05, 70.6342],
  "Dera Ghazi Khan|Rajanpur": [29.1, 70.3333],
  "Dera Ghazi Khan|Layyah": [30.9667, 70.95],
  "Dera Ghazi Khan|Muzaffargarh": [30.0667, 71.2],
  "Sahiwal|Sahiwal": [30.6705, 73.1063],
  "Sahiwal|Okara": [30.8, 73.45],
  "Sahiwal|Pakpattan": [30.35, 73.3833],
};

const DEFAULT_CENTER: [number, number] = [31.52, 74.35]; // Punjab approx
const DEFAULT_ZOOM = 8;

/**
 * Returns map center and zoom for the selected area.
 * - Division only: division center, zoom 10
 * - Division + District: district center (or division), zoom 11
 * - Division + District + Tehsil: same center, zoom 12
 */
export function getMapCenterForArea(
  division: string,
  district?: string,
  tehsil?: string
): MapView {
  if (!division || division === "all") {
    return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
  }

  let center: [number, number] =
    DISTRICT_CENTERS[`${division}|${district}`] ??
    DIVISION_CENTERS[division] ??
    DEFAULT_CENTER;

  if (district && district !== "all") {
    center =
      DISTRICT_CENTERS[`${division}|${district}`] ??
      DIVISION_CENTERS[division] ??
      DEFAULT_CENTER;
  }

  let zoom = 10;
  if (division && division !== "all") zoom = 10;
  if (district && district !== "all") zoom = 11;
  if (tehsil && tehsil !== "all") zoom = 12;

  return { center, zoom };
}
