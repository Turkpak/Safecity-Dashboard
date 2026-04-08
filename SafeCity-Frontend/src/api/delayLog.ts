import { get, post, requestRaw } from "./client";

export type AddDelayLogInput = {
  project: number;
  /** Matches `id` from `GET project-gantt-nested/:id/` (ProjectActivity primary key). */
  activity: number;
  /** ISO date (YYYY-MM-DD) */
  delay_start_date: string;
  /** ISO date (YYYY-MM-DD) */
  delay_end_date: string;
  category: string;
  /** Stakeholder id */
  action_by: number;
  issue: string;
  recommended_action: string;
};

export type AddDelayLogResponse = {
  status?: boolean;
  message?: string;
  [k: string]: unknown;
};

export async function addDelayLog(payload: AddDelayLogInput): Promise<AddDelayLogResponse> {
  return post<AddDelayLogResponse>("add-delay-log/", payload);
}

export type DelayLogItem = {
  id: number;
  action_by_info: { stakeholder_type: string; stakeholder_title: string } | null;
  delay_start_date: string;
  delay_end_date: string;
  delay_days: number;
  originator: string | null;
  category: string | null;
  issue: string | null;
  recommended_action: string | null;
  created_at: string;
  project: number;
  activity: number;
  action_by: number | null;
  created_by: number | null;
};

export type ListDelayLogsResponse = {
  count: number;
  data: DelayLogItem[];
};

export async function listDelayLogs(params?: { project?: number; activity?: number }): Promise<ListDelayLogsResponse> {
  const q: Record<string, string> = {};
  if (params?.project != null) q.project = String(params.project);
  if (params?.activity != null) q.activity = String(params.activity);
  const search = new URLSearchParams(q).toString();
  const path = search ? `list-delay-log/?${search}` : "list-delay-log/";
  return requestRaw<ListDelayLogsResponse>(path, { method: "GET" });
}

export type UpdateDelayLogInput = {
  project: number;
  activity: number;
  delay_start_date: string; // YYYY-MM-DD
  delay_end_date: string; // YYYY-MM-DD
  category: string;
  issue: string;
  recommended_action: string;
};

export type UpdateDelayLogResponse = {
  status?: boolean;
  message?: string;
  data?: DelayLogItem;
  [k: string]: unknown;
};

export async function updateDelayLog(id: number, payload: UpdateDelayLogInput): Promise<UpdateDelayLogResponse> {
  // Backend expects /api/update-delay-log/<id>/ with a JSON body.
  return requestRaw<UpdateDelayLogResponse>(`update-delay-log/${id}/`, { method: "PUT", body: payload });
}

