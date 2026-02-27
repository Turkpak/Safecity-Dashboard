import { get, post, put, del, request } from "./client";
import type { Project, ProjectCreateInput, ProjectUpdateInput, ListProjectResponse } from "./types";
import { boundaryFileToGeojson } from "@/utils/boundaryToGeojson";

/** POST /api/create-project/ — multipart: stakeholder, project_name, ..., xer_file, boundary_file */
const CREATE = "create-project/";
/** GET /api/list-project/ — returns GeoJSON FeatureCollection; we normalize to Project[] for the UI */
const LIST = "list-project/";
const UPDATE = "update-project/";
const DELETE_PATH = "delete-project/";

function normalizeProjectFeature(f: {
  id?: number;
  properties?: Record<string, unknown>;
  geometry?: unknown;
}): Project {
  const props = (f.properties ?? f) as Record<string, unknown>;
  const geom = (f as { geometry?: unknown }).geometry ?? props.geom;
  return {
    id: (f.id ?? props.id) as number,
    ...(props as Omit<Project, "id" | "geom">),
    ...(geom !== undefined && { geom }),
  } as Project;
}

export async function listProjects(): Promise<Project[]> {
  const data = await get<ListProjectResponse | Project[] | Array<{ id?: number; properties?: Record<string, unknown> }>>(LIST);
  if (!data) return [];
  if (typeof data === "object" && "features" in data && Array.isArray((data as ListProjectResponse).features)) {
    return (data as ListProjectResponse).features.map((f) => normalizeProjectFeature(f));
  }
  if (Array.isArray(data)) {
    return data.map((f) => normalizeProjectFeature(f as { id?: number; properties?: Record<string, unknown> }));
  }
  return [];
}

export async function getProjectById(id: number): Promise<Project | null> {
  const data = await get<Project | { id?: number; properties?: Record<string, unknown> }>(LIST, { id: String(id) });
  if (!data) return null;
  if (typeof data === "object" && "properties" in data) {
    return normalizeProjectFeature(data as { id?: number; properties?: Record<string, unknown> });
  }
  return data as Project;
}

function appendFormValue(form: FormData, key: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (value instanceof File) {
    form.append(key, value);
    return;
  }
  form.append(key, String(value));
}

export async function createProject(payload: ProjectCreateInput): Promise<Project> {
  const hasFiles = payload.xer_file != null || payload.boundary_file != null;

  if (hasFiles) {
    const form = new FormData();
    appendFormValue(form, "stakeholder", payload.stakeholder);
    appendFormValue(form, "project_name", payload.project_name ?? "");
    appendFormValue(form, "project_description", payload.project_description ?? "");
    appendFormValue(form, "project_starting_date", payload.project_starting_date ?? "");
    appendFormValue(form, "project_reference_no", payload.project_reference_no ?? "");
    appendFormValue(form, "province", payload.province);
    appendFormValue(form, "division", payload.division);
    appendFormValue(form, "district", payload.district);
    appendFormValue(form, "tehsil", payload.tehsil);
    appendFormValue(form, "total_budget_allocated", payload.total_budget_allocated ?? "");
    appendFormValue(form, "budget_utilized", payload.budget_utilized ?? "");

    if (payload.xer_file) form.append("xer_file", payload.xer_file);

    let boundaryFile: File | null = payload.boundary_file ?? null;
    if (boundaryFile) {
      boundaryFile = await boundaryFileToGeojson(boundaryFile);
      form.append("boundary_file", boundaryFile);
    }

    return request<Project>(CREATE, { method: "POST", formData: form });
  }

  return post<Project>(CREATE, {
    stakeholder: payload.stakeholder,
    project_name: payload.project_name ?? null,
    project_description: payload.project_description ?? null,
    project_starting_date: payload.project_starting_date ?? null,
    project_reference_no: payload.project_reference_no ?? null,
    province: payload.province,
    division: payload.division,
    district: payload.district,
    tehsil: payload.tehsil,
    total_budget_allocated: payload.total_budget_allocated ?? null,
    budget_utilized: payload.budget_utilized ?? null,
  });
}

export async function updateProject(id: number, payload: ProjectUpdateInput): Promise<Project> {
  return put<Project>(`${UPDATE}${id}/`, payload);
}

export async function deleteProject(id: number): Promise<void> {
  await del(`${DELETE_PATH}${id}/`);
}
