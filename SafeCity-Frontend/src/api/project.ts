import { get, post, put, del } from "./client";
import type { Project, ProjectCreateInput, ProjectUpdateInput } from "./types";

const CREATE = "create-project/";
const LIST = "list-project/";
const UPDATE = "update-project/";
const DELETE_PATH = "delete-project/";

export async function listProjects(): Promise<Project[]> {
  const data = await get<Project[]>(LIST);
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
