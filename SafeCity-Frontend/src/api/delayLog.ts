import { post } from "./client";

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

