import type { Division, District, Tehsil, Project } from "../api/types";

export interface ScopeContext {
  viewType: "divisions" | "districts" | "tehsils" | "projects" | "";
  level: "division" | "district" | "tehsil" | null;
  selectedDivisionId: number | null;
  selectedDistrictId: number | null;
  selectedTehsilId: number | null;
  selectedProjectForDetails: Project | null;
  apiDivisions: Division[];
  apiDistricts: District[];
  apiTehsils: Tehsil[];
  apiProjects: Project[];
}

export function safeNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeProgress(value: unknown): number {
  const numVal = safeNumber(value);
  return Math.max(0, Math.min(100, numVal));
}

export function getDivisionId(row: any): number {
  if (!row) return 0;
  const id = row.division ?? row.zone ?? row.division_id ?? row.zone_id ?? row.id;
  return safeNumber(id);
}

export function getDistrictId(row: any): number {
  if (!row) return 0;
  const id = row.district ?? row.circle ?? row.district_id ?? row.circle_id ?? row.id;
  return safeNumber(id);
}

export function getTehsilId(row: any): number {
  if (!row) return 0;
  const id = row.tehsil ?? row.tehsil_id ?? row.id;
  return safeNumber(id);
}

export function getRowPhysical(row: any): number {
  if (!row) return 0;
  const val = row.physical_progress !== undefined ? row.physical_progress : (row.overall !== undefined ? row.overall : 0);
  return normalizeProgress(val);
}

export function averageProgress(rows: any[]): number {
  if (!rows || rows.length === 0) return 0;

  let validSum = 0;
  let validCount = 0;

  for (const row of rows) {
    if (row === null || row === undefined) continue;
    const val = row.physical_progress !== undefined ? row.physical_progress : (row.overall !== undefined ? row.overall : null);
    if (val === null || val === undefined) continue;
    const numVal = Number(val);
    if (Number.isNaN(numVal)) continue;

    validSum += normalizeProgress(numVal);
    validCount++;
  }

  if (validCount === 0) return 0;
  const avg = validSum / validCount;
  return Number(avg.toFixed(4));
}

export function formatProgress(value: number): string {
  return value.toFixed(2);
}

export function getCurrentScopeRows(context: ScopeContext): {
  rows: any[];
  scopeType: string;
} {
  const {
    viewType,
    level,
    selectedDivisionId,
    selectedDistrictId,
    selectedTehsilId,
    selectedProjectForDetails,
    apiDivisions,
    apiDistricts,
    apiTehsils,
    apiProjects,
  } = context;

  // Selected project details
  if (selectedProjectForDetails) {
    return {
      rows: [selectedProjectForDetails],
      scopeType: "project",
    };
  }

  // Level drilldowns
  if (level === "tehsil" && selectedTehsilId !== null) {
    const rows = apiProjects.filter(
      (p) => safeNumber(p.tehsil) === selectedTehsilId
    );
    return {
      rows,
      scopeType: "selected-tehsil-projects",
    };
  }

  if (level === "district" && selectedDistrictId !== null) {
    const rows = apiTehsils.filter(
      (t) => safeNumber(t.district) === selectedDistrictId
    );
    return {
      rows,
      scopeType: "selected-district-tehsils",
    };
  }

  if (level === "division" && selectedDivisionId !== null) {
    const rows = apiDistricts.filter(
      (d) => safeNumber(d.division ?? d.zone) === selectedDivisionId
    );
    return {
      rows,
      scopeType: "selected-division-districts",
    };
  }

  // Root view types
  if (viewType === "projects") {
    return {
      rows: apiProjects,
      scopeType: "all-projects",
    };
  }

  if (viewType === "tehsils") {
    return {
      rows: apiTehsils,
      scopeType: "all-tehsils",
    };
  }

  if (viewType === "districts") {
    return {
      rows: apiDistricts,
      scopeType: "all-districts",
    };
  }

  if (viewType === "divisions") {
    return {
      rows: apiDivisions,
      scopeType: "all-divisions",
    };
  }

  return {
    rows: [],
    scopeType: "unknown",
  };
}

export function calculateCurrentScopePhysical(context: ScopeContext): number {
  const { selectedProjectForDetails } = context;
  if (selectedProjectForDetails) {
    return getRowPhysical(selectedProjectForDetails);
  }

  const { rows } = getCurrentScopeRows(context);
  return averageProgress(rows);
}

export function buildCurrentPhysicalChartData(currentScopePhysical: number) {
  const planned = 100;
  const actual = currentScopePhysical;
  const variance = Math.max(0, 100 - actual);

  const maxValue = Math.max(planned, actual);
  const totalForPie = maxValue + variance;

  const normalizedPlanned = totalForPie > 0 ? (planned / totalForPie) * 100 : 0;
  const normalizedActual = totalForPie > 0 ? (actual / totalForPie) * 100 : 0;
  const normalizedVariance = totalForPie > 0 ? (variance / totalForPie) * 100 : 0;

  return {
    planned,
    actual,
    variance,
    normalizedPlanned,
    normalizedActual,
    normalizedVariance,
  };
}
