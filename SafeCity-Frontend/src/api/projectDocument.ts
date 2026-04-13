import { request, requestRaw } from "./client";

const CREATE = "create-project-document/";
const LIST = "list-project-document/";
const UPDATE = "update-project-document/";

export type CreateProjectDocumentInput = {
  project: number;
  activity: number;
  file: File;
  title: string;
};

export async function createProjectDocument(payload: CreateProjectDocumentInput): Promise<unknown> {
  const form = new FormData();
  form.append("project", String(payload.project));
  form.append("activity", String(payload.activity));
  form.append("file", payload.file);
  form.append("title", payload.title.trim() || payload.file.name);
  return request(CREATE, { method: "POST", formData: form });
}

/** Row from GET list-project-document/ (paginated envelope). */
export type ProjectDocumentItem = {
  id: number;
  project: number;
  activity: number | null;
  title: string | null;
  file: string | null;
  file_url?: string | null;
  uploaded_at?: string;
};

function extractListPayload(raw: unknown): ProjectDocumentItem[] {
  const r = raw as Record<string, unknown>;
  const results = r?.results as Record<string, unknown> | undefined;
  if (results?.data != null && Array.isArray(results.data)) return results.data as ProjectDocumentItem[];
  if (Array.isArray(r?.results)) return r.results as ProjectDocumentItem[];
  if (Array.isArray(r?.data)) return r.data as ProjectDocumentItem[];
  return [];
}

/**
 * GET /api/list-project-document/
 * Backend accepts `project` and/or `activity` query params (ProjectActivity PK for `activity`).
 * Some clients use `activity_id`; we send both when filtering by activity for compatibility.
 */
export async function listProjectDocuments(params?: {
  project?: number;
  /** ProjectActivity database id (same as Gantt `db_id` / create payload `activity`). */
  activity?: number;
}): Promise<ProjectDocumentItem[]> {
  const q: Record<string, string> = {};
  if (params?.project != null) q.project = String(params.project);
  if (params?.activity != null) {
    q.activity = String(params.activity);
    q.activity_id = String(params.activity);
  }
  const search = new URLSearchParams(q).toString();
  const path = search ? `${LIST}?${search}` : LIST;
  const raw = await requestRaw<unknown>(path, { method: "GET" });
  return extractListPayload(raw);
}

export type UpdateProjectDocumentInput = {
  project?: number;
  activity?: number | null;
  title?: string | null;
  file?: File | null;
};

export async function updateProjectDocument(
  id: number,
  payload: UpdateProjectDocumentInput
): Promise<unknown> {
  const form = new FormData();
  if (payload.project != null) form.append("project", String(payload.project));
  if (payload.activity !== undefined) {
    if (payload.activity == null) form.append("activity", "");
    else form.append("activity", String(payload.activity));
  }
  if (payload.title !== undefined) form.append("title", payload.title ?? "");
  if (payload.file != null) form.append("file", payload.file);
  return requestRaw(`${UPDATE}${id}/`, { method: "PUT", formData: form });
}
