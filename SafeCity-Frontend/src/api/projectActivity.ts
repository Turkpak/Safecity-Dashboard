import { get, post, put, del } from "./client";
import type {
  ProjectActivity,
  ProjectActivityCreateInput,
  ProjectActivityUpdateInput,
} from "./types";

const CREATE_PATH = "create-project-activity/";
const LIST_PATH = "list-project-activity/";
const UPDATE_PATH = "update-project-activity/";
const DELETE_PATH = "delete-project-activity/";

export async function listProjectActivities(
  projectId?: number,
): Promise<ProjectActivity[]> {
  const params = projectId != null ? { project_id: String(projectId) } : undefined;
  const data = await get<ProjectActivity[] | ProjectActivity[]>(LIST_PATH, params);
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return [];
}

export async function createProjectActivity(
  payload: ProjectActivityCreateInput,
): Promise<ProjectActivity> {
  // backend accepts all fields as plain body
  return post<ProjectActivity>(CREATE_PATH, payload as any);
}

export async function updateProjectActivity(
  id: number,
  payload: ProjectActivityUpdateInput,
): Promise<ProjectActivity> {
  return put<ProjectActivity>(`${UPDATE_PATH}${id}/`, payload as any);
}

export async function deleteProjectActivity(id: number): Promise<void> {
  await del(`${DELETE_PATH}${id}/`);
}

export interface GanttTask {
  id: string;
  label: string;
  start: string | null;
  end: string | null;
  progress: number;
}

export interface GanttResponse {
  tasks: GanttTask[];
}

export async function getProjectGanttData(projectId: number): Promise<GanttTask[]> {
  const data = await get<GanttResponse>(`${LIST_PATH}gantt-data/`, { project_id: String(projectId) });
  return data?.tasks || [];
}

export async function getProjectXerGanttData(projectId: number): Promise<GanttTask[]> {
  const data = await get<GanttResponse>(`${LIST_PATH}xer-gantt-data/`, { project_id: String(projectId) });
  return data?.tasks || [];
}
