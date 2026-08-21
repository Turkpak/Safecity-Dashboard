import { get } from "./client";
import type { DashboardView } from "./dashboard";

export type PhysicalReportSelection = {
  type: "division" | "district" | "tehsil" | "project";
  id: number;
  name: string;
} | null;

export interface PhysicalReportData {
  report: {
    scope: DashboardView;
    scope_type: "division" | "district" | "tehsil" | "project" | null;
    scope_id: number | null;
    scope_name: string;
    reporting_date: string;
  };
  physical: {
    progress: number;
    remaining: number;
    valid_projects: number;
    total_projects: number;
  };
  project_status: {
    completed: number;
    in_progress: number;
    pending: number;
    with_delay_logs: number;
  };
  child_progress: Array<{
    id: number;
    name: string;
    physical_progress: number;
    valid_projects: number;
    total_projects: number;
  }>;
  progress_distribution: Array<{ bucket: string; count: number }>;
  top_projects: Array<{ project_id: number; project_name: string; physical_progress: number }>;
  bottom_projects: Array<{ project_id: number; project_name: string; physical_progress: number }>;
  activity_status: { total: number; completed: number; in_progress: number; not_started: number };
  schedule: {
    projects_with_schedule: number;
    projects_without_schedule: number;
    past_finish_incomplete: number;
    not_started_after_planned_start: number;
  };
  execution_matrix: Array<{
    project_id: number;
    project_name: string;
    physical_progress: number;
    planned_time_elapsed_pct: number;
    variance_points: number;
  }>;
  data_currency: {
    latest_progress_date: string | null;
    activities_with_progress_date: number;
    activities_without_progress_date: number;
  };
  delay_analysis: {
    has_data: boolean;
    affected_activities: number;
    affected_projects: number;
    total_delay_days: number;
    by_category: Array<{ category: string; delay_days: number }>;
    by_originator: Array<{ originator: string; count: number }>;
    top_delayed_activities: Array<{
      activity_id: number;
      activity_name: string;
      project_name: string;
      delay_days: number;
    }>;
  };
  wbs_progress: Array<{
    id: number;
    name: string;
    physical_progress: number;
    remaining_progress: number;
    activity_count: number;
  }>;
  wbs_remaining: Array<{
    id: number;
    name: string;
    physical_progress: number;
    remaining_progress: number;
    activity_count: number;
  }>;
  top_incomplete_activities: Array<{
    activity_id: string;
    activity_name: string;
    physical_progress: number;
    remaining_progress: number;
  }>;
  insights: string[];
}

export async function getPhysicalProgressReport(
  scope: DashboardView,
  selection?: PhysicalReportSelection,
): Promise<PhysicalReportData> {
  const params: Record<string, string | number> = { scope };
  if (selection) {
    params.type = selection.type;
    params.id = selection.id;
  }
  return get<PhysicalReportData>("physical-progress-report/", params);
}
