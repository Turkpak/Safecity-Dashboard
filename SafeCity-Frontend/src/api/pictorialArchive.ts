import { get, post, put, del, request } from "./client";
import type { PictorialArchive, PictorialArchiveCreateInput, PictorialArchiveUpdateInput } from "./types";

const CREATE = "create-pictorial-archive/";
const LIST = "list-pictorial-archive/";
const UPDATE = "update-pictorial-archive/";
const DELETE_PATH = "delete-pictorial-archive/";

export async function listPictorialArchives(projectId?: number): Promise<PictorialArchive[]> {
  const params = projectId != null ? { project_id: String(projectId) } : undefined;
  const data = await get<PictorialArchive[]>(LIST, params as Record<string, string> | undefined);
  return Array.isArray(data) ? data : [];
}

export async function getPictorialArchiveById(id: number): Promise<PictorialArchive | null> {
  const data = await get<PictorialArchive>(LIST, { id: String(id) });
  return data ?? null;
}

export async function createPictorialArchive(payload: PictorialArchiveCreateInput): Promise<PictorialArchive> {
  const form = new FormData();
  form.append("project", String(payload.project));
  if (payload.image != null) form.append("image", payload.image);
  form.append("image_date", payload.image_date);
  if (payload.description != null) form.append("description", payload.description);
  return request<PictorialArchive>(CREATE, { method: "POST", formData: form });
}

export async function updatePictorialArchive(
  id: number,
  payload: PictorialArchiveUpdateInput
): Promise<PictorialArchive> {
  const form = new FormData();
  if (payload.image != null) form.append("image", payload.image);
  if (payload.image_date != null) form.append("image_date", payload.image_date);
  if (payload.description != null) form.append("description", payload.description);
  return request<PictorialArchive>(`${UPDATE}${id}/`, {
    method: "PUT",
    formData: form,
  });
}

export async function deletePictorialArchive(id: number): Promise<void> {
  await del(`${DELETE_PATH}${id}/`);
}
