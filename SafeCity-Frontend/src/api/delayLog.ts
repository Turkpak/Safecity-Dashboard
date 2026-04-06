import { post } from "./client";

export type AddDelayLogInput = {
  project: number;
  /** Matches `activity_id` from `GET project-gantt-nested/:id/` (numeric). */
  activity: number;
  /** ISO date (YYYY-MM-DD) */
  delay_start_date: string;
  /** ISO date (YYYY-MM-DD) */
  delay_end_date: string;
  action_by: string;
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

