import { get } from "./client";

// Keep the frontend view names aligned with the canonical backend pages.
// Legacy aliases (zones/circles) are still accepted on the backend for safety.
const PAGE_BY_VIEW = {
  divisions: "divisions",
  districts: "districts",
  tehsils: "tehsils",
  projects: "projects",
} as const;

export type DashboardView =
  keyof typeof PAGE_BY_VIEW;

export interface DashboardSummary {
  total_projects: number;
  physical_progress: number;
  has_physical_data?: boolean;
  financial_progress: number;
  overall_progress: number;

  completed_projects: number;
  in_progress_projects: number;
  delayed_projects: number;
  pending_projects: number;

  total_budget: number;
  total_consume: number;
  remaining_budget: number;

  // Financial Progress Overview
  allocation_total_cost: number;
  pd_release_total_cost: number;
  spending_release_total_cost: number;
  pifra_utilization_total_cost: number;

  // IMPORTANT:
  // This comes from the project data.
  // Do NOT calculate it in frontend.
  percentage_utilization_total: number;
}

export interface DashboardChart {
  planned: number;
  actual: number;
  variance: number;
}

export interface HierarchyRow {
  id: number;
  name: string;
  project_count: number;
  physical_progress: number;
  has_physical_data?: boolean;
  financial_progress: number;
  overall_progress: number;

  // Financial Progress Overview
  allocation_total_cost: number;
  pd_release_total_cost: number;
  spending_release_total_cost: number;
  pifra_utilization_total_cost: number;

  // Keep this field.
  // Backend provides the value.
  percentage_utilization_total: number;
}

export interface DivisionRow {
  id: number;
  name: string;
  project_count: number;
  physical_progress: number;
  has_physical_data?: boolean;
  financial_progress: number;
  overall_progress: number;

  // Financial Progress Overview
  allocation_total_cost: number;
  pd_release_total_cost: number;
  spending_release_total_cost: number;
  pifra_utilization_total_cost: number;
  percentage_utilization_total: number;

  // Legacy alias for "zone" — populated from Zone on the backend.
  division?: number;
  division_name?: string;
  zone?: number;
  zone_name?: string;
}

export interface DistrictRow {
  id: number;
  name: string;
  project_count: number;
  physical_progress: number;
  has_physical_data?: boolean;
  financial_progress: number;
  overall_progress: number;

  // Financial Progress Overview
  allocation_total_cost: number;
  pd_release_total_cost: number;
  spending_release_total_cost: number;
  pifra_utilization_total_cost: number;
  percentage_utilization_total: number;

  district?: number;
  district_name?: string;
  circle?: number;
  circle_name?: string;

  division?: number;
  division_name?: string;
  zone?: number;
  zone_name?: string;
}
export interface TehsilRow {
  id: number;
  name: string;
  project_count: number;
  physical_progress: number;
  has_physical_data?: boolean;
  financial_progress: number;
  overall_progress: number;

  // Financial Progress Overview
  allocation_total_cost: number;
  pd_release_total_cost: number;
  spending_release_total_cost: number;
  pifra_utilization_total_cost: number;
  percentage_utilization_total: number;

  tehsil?: number;
  tehsil_name?: string;

  district?: number;
  district_name?: string;
  actual_district?: number;
  actual_district_name?: string;

  circle?: number;
  circle_name?: string;

  division?: number;
  division_name?: string;
  zone?: number;
  zone_name?: string;
}
export interface DashboardProject {
  id: number;

  project_name: string | null;
  project_description?: string | null;
  project_reference_no?: string | null;
  project_category?: string | null;

  zone?: number | null;
  zone_name?: string | null;

  circle_name?: string | null;

  district?: number | null;
  district_name?: string | null;

  tehsil?: number | null;
  tehsil_name?: string | null;

  total_budget_allocated?: number | string | null;
  budget_utilized?: number | string | null;
  budget_variance?: number | string | null;
  budget_remaining?: number | string | null;

    allocation_total_cost?: number | string | null;
  pd_release_total_cost?: number | string | null;
  spending_release_total_cost?: number | string | null;
  pifra_utilization_total_cost?: number | string | null;

  // Do NOT calculate this in frontend.
  percentage_utilization_total?: number | string | null;

  physical_progress: number;
  has_physical_data?: boolean;
  financial_progress: number;
  overall_progress: number;

  status:
    | "pending"
    | "in_progress"
    | "completed"
    | "in_delay";

  has_delay: boolean;

  latitude?: number | null;
  longitude?: number | null;
}

export interface DashboardPageData {
  page: string;

  summary: DashboardSummary;

  financialChart: DashboardChart;

  physicalChart: DashboardChart;

  bestPerformingProjects: DashboardProject[];

  topHierarchy: HierarchyRow[];

  mapProjects: DashboardProject[];

  divisions: DivisionRow[];

  districts: DistrictRow[];

  tehsils: TehsilRow[];

  projects: DashboardProject[];

  projectGanttAll: unknown[];
}


// ============================================================
// Normalizers
// ============================================================

const normalizeDivision = (
  row: any
): DivisionRow => ({
  ...row,

  division:
    row.division ??
    row.division_id ??
    row.id,

  division_name:
    row.division_name ??
    row.zone_name ??
    row.name,
});


const normalizeDistrict = (
  row: any
): DistrictRow => ({
  ...row,

  district:
    row.district ??
    row.district_id ??
    row.id,

  district_name:
    row.district_name ??
    row.circle_name ??
    row.name,

  division:
    row.division ??
    row.division_id,

  division_name:
    row.division_name ??
    row.zone_name,
});


const normalizeTehsil = (
  row: any
): TehsilRow => ({
  ...row,

  tehsil:
    row.tehsil ??
    row.tehsil_id ??
    row.id,

  tehsil_name:
    row.tehsil_name ??
    row.name,

  district:
    row.district ??
    row.district_id,

  district_name:
    row.district_name ??
    row.circle_name,

  division:
    row.division ??
    row.division_id,

  division_name:
    row.division_name ??
    row.zone_name,
});


const normalizeProject = (
  row: any
): DashboardProject => ({
  ...row,

  total_budget_allocated:
    row.total_budget_allocated ??
    row.total_budget ??
    0,

  budget_utilized:
    row.budget_utilized ??
    row.total_consume ??
    0,

  budget_variance:
    row.budget_variance ??
    0,

  budget_remaining:
    row.budget_remaining ??
    row.remaining_budget ??
    0,

  allocation_total_cost:
    row.allocation_total_cost ?? 0,

  pd_release_total_cost:
    row.pd_release_total_cost ?? 0,

  spending_release_total_cost:
    row.spending_release_total_cost ?? 0,

  pifra_utilization_total_cost:
    row.pifra_utilization_total_cost ?? 0,

  percentage_utilization_total:
    row.percentage_utilization_total ?? 0,

  physical_progress:
    Number(
      row.physical_progress ?? 0
    ),

  has_physical_data:
    Boolean(
      row.has_physical_data ?? true
    ),

  financial_progress:
    Number(
      row.financial_progress ?? 0
    ),

  overall_progress:
    Number(
      row.overall_progress ?? 0
    ),

  has_delay:
    Boolean(
      row.has_delay ?? false
    ),

  status:
    row.status ?? "pending",
});


// ============================================================
// Dashboard API
// ============================================================

export async function getDashboardPageData(
  viewType: DashboardView = "divisions"
): Promise<DashboardPageData> {

  const page =
    PAGE_BY_VIEW[viewType] ??
    "divisions";

  const response: any = await get(
    `dashboard/${page}/`
  );

  const data =
    response?.data ??
    response ??
    {};

  return {

    page:
      data.page ??
      page,

    summary:
      data.summary ?? {
        total_projects: 0,
        physical_progress: 0,
        financial_progress: 0,
        overall_progress: 0,
        completed_projects: 0,
        in_progress_projects: 0,
        delayed_projects: 0,
        pending_projects: 0,
        total_budget: 0,
        total_consume: 0,
        remaining_budget: 0,
      },

    financialChart:
      data.financial_chart ?? {
        planned: 100,
        actual: 0,
        variance: 100,
      },

    physicalChart:
      data.physical_chart ?? {
        planned: 100,
        actual: 0,
        variance: 100,
      },

    bestPerformingProjects:
      Array.isArray(
        data.best_performing_projects
      )
        ? data.best_performing_projects.map(
            normalizeProject
          )
        : [],

    topHierarchy:
      Array.isArray(
        data.top_hierarchy
      )
        ? data.top_hierarchy
        : [],

    mapProjects:
      Array.isArray(
        data.map_projects
      )
        ? data.map_projects.map(
            normalizeProject
          )
        : [],

    divisions:
      Array.isArray(
        data.divisions
      )
        ? data.divisions.map(
            normalizeDivision
          )
        : [],

    districts:
      Array.isArray(
        data.districts
      )
        ? data.districts.map(
            normalizeDistrict
          )
        : [],

    tehsils:
      Array.isArray(
        data.tehsils
      )
        ? data.tehsils.map(
            normalizeTehsil
          )
        : [],

    projects:
      Array.isArray(
        data.projects
      )
        ? data.projects.map(
            normalizeProject
          )
        : [],

    projectGanttAll:
      Array.isArray(
        data.project_gantt_all
      )
        ? data.project_gantt_all
        : [],
  };
}