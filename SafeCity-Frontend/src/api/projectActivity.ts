import { get, post, put, del } from "./client";
import type {
  ProjectActivity,
  ProjectActivityCreateInput,
  ProjectActivityUpdateInput,
} from "./types";

const CREATE_PATH = "create-project-activity/";
const LIST_PATH = "list-project/";
const UPDATE_PATH = "update-project-activity/";
const DELETE_PATH = "delete-project-activity/";

export async function listProjectActivities(
  projectId?: number,
): Promise<ProjectActivity[]> {
  // backend expects the "project" query parameter on the simple
  // /api/gantt-data/ or /api/list-project-activity/ route (see
  // ListProjectActivityView.list()).
  const params = projectId != null ? { project: String(projectId) } : undefined;
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
  activity_id?: string;
  label: string;
  start: string | null;
  end: string | null;
  progress: number;
  parent?: string;
}

export interface GanttResponse {
  tasks: GanttTask[];
}

export async function getProjectGanttData(projectId: number): Promise<GanttTask[]> {
  if (!projectId) return [];

  const data = await get<any>(`project-gantt/${projectId}/`);
  console.log("Response from API:", data);

  // ❌ WRONG
  // const tasksArray = Array.isArray(data) ? data : data?.data || [];

  // ✅ CORRECT
  const tasksArray = data?.tasks || [];

  return tasksArray.map((act: any) => ({
    id: String(act.id),
    activity_id: act.activity_id,
    label: act.activity_name || `#${act.activity_id}`,
    start: act.start_date || null,
    end: act.end_date || act.start_date || null,
    progress: act.progress ?? 0,
    parent: act.parent_id ? String(act.parent_id) : undefined,
  }));
}