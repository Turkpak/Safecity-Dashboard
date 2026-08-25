/**
 * dashboardPhysicalProgress.ts
 * ============================================================
 * CANONICAL physical-progress pipeline for the SafeCity Dashboard.
 *
 * ONE value — currentScopePhysical — drives:
 *   1. Header Overall badge
 *   2. Overall Progress donut center
 *   3. Overall Progress legend Actual value
 *   4. Overall Progress legend Variance value
 *   5. Dashboard current-scope physical summary
 *   6. Export/report physical value
 *
 * Rules enforced here:
 *   - Only `row.physical_progress` is used. Never `overall_progress`,
 *     `financial_progress`, `overall`, or any other field.
 *   - 0.00% rows ARE included in the average (0 is valid progress).
 *   - Only rows with null/undefined/NaN physical_progress are excluded.
 *   - No integer rounding — always toFixed(2) or toFixed(4) for internals.
 *   - Backend physical_progress is already 0–100; no ×100 conversion.
 * ============================================================
 */

import type { Project } from "../api/types";

// ============================================================
// Context shape
// ============================================================

export interface ScopeContext {
  /** Root view page: 'divisions' | 'districts' | 'tehsils' | 'projects' | '' */
  viewType: "divisions" | "districts" | "tehsils" | "projects" | "";

  /**
   * Drill-down level currently active.
   * 'division'  → showing districts inside a division
   * 'district'  → showing tehsils inside a district
   * 'tehsil'    → showing projects inside a tehsil
   * null        → root view (no drill-down)
   */
  level: "division" | "district" | "tehsil" | null;

  /** ID of the selected division (when level === 'division'). */
  selectedDivisionId: number | null;

  /** ID of the selected district (when level === 'district'). */
  selectedDistrictId: number | null;

  /** ID of the selected tehsil (when level === 'tehsil'). */
  selectedTehsilId: number | null;

  /** When a project details view is open, this holds that project. */
  selectedProjectForDetails: Project | null;

  /**
   * Full unfiltered API row arrays. Must be the complete scope before search/show-more.
   * Typed as any[] so DivisionRow/DistrictRow/TehsilRow (api/dashboard types) are accepted
   * without requiring exact structural compatibility with api/types.
   */
  apiDivisions: any[];
  apiDistricts: any[];
  apiTehsils: any[];
  apiProjects: any[];
}

// ============================================================
// Result type returned by getCurrentScopeRows
// ============================================================

export interface ScopeResult {
  rows: any[];
  scopeType: string;
}

// ============================================================
// 1. safeNumber
// ============================================================

/**
 * Convert any value to a finite number.
 * null / undefined / "" → returns null (excluded from averages).
 * "0" / 0 / "0.00"     → returns 0 (valid, included in averages).
 * NaN / Infinity        → returns null (excluded).
 */
export function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

// ============================================================
// 2. normalizeProgress
// ============================================================

/**
 * Clamp a percentage value to [0, 100].
 *
 * Dashboard row physical_progress is ALREADY in the 0–100 range
 * (the backend _percent() helper normalises at ingest time).
 * Do NOT multiply by 100 here.
 *
 * Preserves decimals — no integer rounding.
 */
export function normalizeProgress(value: unknown): number {
  const n = safeNumber(value);
  if (n === null) return 0;
  return Math.max(0, Math.min(100, n));
}

// ============================================================
// 3. ID helpers — robust field-name resolution
// ============================================================

/** Own ID of a Division row. */
export function getOwnDivisionId(row: any): number {
  if (!row) return 0;
  const id = row.id ?? row.division ?? row.zone;
  return Number(id ?? 0);
}

/** Own ID of a District row. */
export function getOwnDistrictId(row: any): number {
  if (!row) return 0;
  const id = row.id ?? row.district ?? row.circle;
  return Number(id ?? 0);
}

/** Own ID of a Tehsil row. */
export function getOwnTehsilId(row: any): number {
  if (!row) return 0;
  const id = row.id ?? row.tehsil;
  return Number(id ?? 0);
}

/** Parent Division ID on a District/Tehsil/Project row. */
export function getParentDivisionId(row: any): number {
  if (!row) return 0;
  const id = row.division ?? row.zone ?? row.division_id ?? row.zone_id;
  return Number(id ?? 0);
}

/** Parent District ID on a Tehsil/Project row. */
export function getParentDistrictId(row: any): number {
  if (!row) return 0;
  const id = row.district ?? row.circle ?? row.district_id ?? row.circle_id;
  return Number(id ?? 0);
}

/** Parent Tehsil ID on a Project row. */
export function getParentTehsilId(row: any): number {
  if (!row) return 0;
  const id = row.tehsil ?? row.tehsil_id;
  return Number(id ?? 0);
}

// ============================================================
// Legacy single-field helpers (kept for backward compat)
// ============================================================

export function getDivisionId(row: any): number {
  return getOwnDivisionId(row);
}

export function getDistrictId(row: any): number {
  return getOwnDistrictId(row);
}

export function getTehsilId(row: any): number {
  return getOwnTehsilId(row);
}

// ============================================================
// 4. getRowPhysical
// ============================================================

/**
 * Extract physical_progress from a single row.
 *
 * Uses ONLY row.physical_progress.
 * Never falls back to overall_progress, financial_progress, or overall.
 * 0 is valid and returned as 0.
 */
export function getRowPhysical(row: any): number | null {
  if (!row) return null;

  // physical_progress must be explicitly present on the row
  if (row.physical_progress === undefined) return null;

  const n = safeNumber(row.physical_progress);
  if (n === null) return null;

  return Math.max(0, Math.min(100, n));
}

// ============================================================
// 5. averageProgress
// ============================================================

/**
 * Calculate the arithmetic average of physical_progress across rows.
 *
 * Rules:
 *   - Uses getRowPhysical(row) which reads only physical_progress.
 *   - 0.00% rows ARE included (0 is valid progress).
 *   - Only rows where physical_progress is null/undefined/NaN are excluded.
 *   - has_physical_data is NOT used as an exclusion filter here;
 *     the spec requires 0% rows to be included in the average.
 *   - Returns Number(avg.toFixed(2)).
 *
 * Examples:
 *   [0.74, 0, 0]                    → 0.25
 *   [0.18, 0.14, 0, 0, 0, 0, 0]    → 0.05
 */
export function averageProgress(rows: any[]): number {
  if (!rows || rows.length === 0) return 0;

  let validSum = 0;
  let validCount = 0;

  for (const row of rows) {
    if (row === null || row === undefined) continue;

    const physical = getRowPhysical(row);

    // null means physical_progress is missing on this row — skip it
    if (physical === null) continue;

    validSum += physical;
    validCount++;
  }

  if (validCount === 0) return 0;

  const avg = validSum / validCount;
  return Number(avg.toFixed(2));
}

// ============================================================
// 6. formatProgress
// ============================================================

/**
 * Format a progress number for display.
 * Always shows two decimal places. No integer rounding.
 *
 * Examples:
 *   0.2467 → "0.25"  (toFixed(2) rounds the representation)
 *   0.0457 → "0.05"
 *   0      → "0.00"
 *   100    → "100.00"
 */
export function formatProgress(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return n.toFixed(2);
}

// ============================================================
// 7. getCurrentScopeRows
// ============================================================

/**
 * Determine the canonical set of rows for the current dashboard scope.
 *
 * Returns the FULL hierarchy scope — rows BEFORE search filtering
 * and BEFORE Show More / Show Less display limiting.
 *
 * Use:
 *   currentScopeRowsForProgress = getCurrentScopeRows(context).rows
 *   displayedRows               = applySearch(currentScopeRowsForProgress).slice(0, limit)
 *
 * Header and donut MUST use currentScopeRowsForProgress.
 * Cards use displayedRows.
 */
export function getCurrentScopeRows(context: ScopeContext): ScopeResult {
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

  // ── Selected Project details ────────────────────────────────
  if (selectedProjectForDetails) {
    return {
      rows: [selectedProjectForDetails],
      scopeType: "project",
    };
  }

  // ── Tehsil drilldown → Projects inside selected Tehsil ──────
  if (level === "tehsil" && selectedTehsilId !== null) {
    const rows = apiProjects.filter(
      (p) => getParentTehsilId(p) === selectedTehsilId
    );
    return {
      rows,
      scopeType: "selected-tehsil-projects",
    };
  }

  // ── District drilldown → Tehsils inside selected District ───
  if (level === "district" && selectedDistrictId !== null) {
    const rows = apiTehsils.filter(
      (t) => getParentDistrictId(t) === selectedDistrictId
    );
    return {
      rows,
      scopeType: "selected-district-tehsils",
    };
  }

  // ── Division drilldown → Districts inside selected Division ──
  if (level === "division" && selectedDivisionId !== null) {
    const rows = apiDistricts.filter(
      (d) => getParentDivisionId(d) === selectedDivisionId
    );
    return {
      rows,
      scopeType: "selected-division-districts",
    };
  }

  // ── Root view: all rows of the view type ─────────────────────
  if (viewType === "projects") {
    return { rows: apiProjects, scopeType: "all-projects" };
  }

  if (viewType === "tehsils") {
    return { rows: apiTehsils, scopeType: "all-tehsils" };
  }

  if (viewType === "districts") {
    return { rows: apiDistricts, scopeType: "all-districts" };
  }

  if (viewType === "divisions") {
    return { rows: apiDivisions, scopeType: "all-divisions" };
  }

  return { rows: [], scopeType: "unknown" };
}

// ============================================================
// 8. calculateCurrentScopePhysical
// ============================================================

/**
 * Single entry-point that returns the canonical physical progress
 * percentage for the current dashboard scope.
 *
 * This value MUST be used for ALL of:
 *   - Header Overall badge
 *   - Overall Progress donut center
 *   - Overall Progress legend Actual
 *   - Overall Progress legend Variance  (100 − this)
 *
 * Never compute physical progress a second time anywhere in the UI.
 */
export function calculateCurrentScopePhysical(context: ScopeContext): number {
  const { selectedProjectForDetails } = context;

  if (selectedProjectForDetails) {
    const physical = getRowPhysical(selectedProjectForDetails);
    return physical !== null ? physical : 0;
  }

  const { rows } = getCurrentScopeRows(context);
  return averageProgress(rows);
}

// ============================================================
// 9. buildCurrentPhysicalChartData
// ============================================================

/**
 * Build normalised data for the Overall Progress donut chart.
 *
 * Returns raw values (planned/actual/variance) AND normalised
 * slice percentages suitable for Recharts PieChart.
 *
 * The Pie chart is rendered as:
 *   Planned  = blue  (#60a5fa)
 *   Actual   = green (#22c55e)
 *   Variance = red   (#ef4444)
 *
 * Center label and legend MUST show actual and variance from
 * this same structure — no independent calculation.
 */
export function buildCurrentPhysicalChartData(currentScopePhysical: number) {
  const actual = Number.isFinite(currentScopePhysical)
    ? Math.max(0, Math.min(100, currentScopePhysical))
    : 0;

  const planned = 100;
  const variance = Number(Math.max(0, 100 - actual).toFixed(2));

  // Normalise for Recharts — pie slices must share one total.
  const maxVal = Math.max(planned, actual);
  const totalForPie = maxVal + variance;

  const normalizedPlanned =
    totalForPie > 0 ? (planned / totalForPie) * 100 : 0;
  const normalizedActual =
    totalForPie > 0 ? (actual / totalForPie) * 100 : 0;
  const normalizedVariance =
    totalForPie > 0 ? (variance / totalForPie) * 100 : 0;

  return {
    planned,
    actual,
    variance,
    normalizedPlanned,
    normalizedActual,
    normalizedVariance,
  };
}
