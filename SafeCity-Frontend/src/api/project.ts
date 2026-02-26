import { get, post, put, del } from "./client";
import type { Project, ProjectCreateInput, ProjectUpdateInput, ListProjectResponse } from "./types";

/** POST /api/create-project/ — body: stakeholder, project_name, project_description, project_starting_date, project_reference_no, province, division, district, tehsil, total_budget_allocated, budget_utilized */
const CREATE = "create-project/";
/** GET /api/list-project/ — returns GeoJSON FeatureCollection; we normalize to Project[] for the UI */
const LIST = "list-project/";
const UPDATE = "update-project/";
const DELETE_PATH = "delete-project/";

export async function listProjects(): Promise<Project[]> {
  const data = await get<ListProjectResponse | Project[]>(LIST);
  if (data && typeof data === "object" && "features" in data && Array.isArray(data.features)) {
    return data.features.map((f) => ({ id: f.id, ...f.properties }));
  }
  return Array.isArray(data) ? data : [];
}

export async function getProjectById(id: number): Promise<Project | null> {
  const data = await get<Project>(LIST, { id: String(id) });
  return data ?? null;
}

export async function createProject(payload: ProjectCreateInput): Promise<Project> {
  return post<Project>(CREATE, payload);
}

export async function updateProject(id: number, payload: ProjectUpdateInput): Promise<Project> {
  return put<Project>(`${UPDATE}${id}/`, payload);
}

export async function deleteProject(id: number): Promise<void> {
  await del(`${DELETE_PATH}${id}/`);
}
