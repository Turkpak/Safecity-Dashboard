import { requestRaw } from "./client";

const CREATE_PROGRESS_IMAGE = "create-progress-image/";
const LIST_PROGRESS_IMAGE = "list-progress-image/";
const UPDATE_PROGRESS_IMAGE = "update-progress-image/";

export type CreateProgressImageInput = {
  project: number;
  activity: number;
  image: File;
  image_date: string; // YYYY-MM-DD
  caption?: string;
};

export type CreateProgressImageResponse = {
  message?: string;
  data?: unknown;
};

export type ProgressImage = {
  id: number;
  image: string;
  caption: string | null;
  image_date: string;
  uploaded_at: string;
  project: number;
  activity: number;
};

export type ListProgressImagesResponse = {
  status?: number;
  message?: string;
  data?: ProgressImage[];
  error_traceback?: unknown;
};

export async function createProgressImage(
  payload: CreateProgressImageInput
): Promise<CreateProgressImageResponse> {
  const form = new FormData();
  form.append("project", String(payload.project));
  form.append("activity", String(payload.activity));
  form.append("image", payload.image);
  form.append("image_date", payload.image_date);
  if (payload.caption != null && String(payload.caption).trim()) {
    form.append("caption", String(payload.caption).trim());
  }
  return requestRaw<CreateProgressImageResponse>(CREATE_PROGRESS_IMAGE, { method: "POST", formData: form });
}

export async function listProgressImages(params?: { project?: number; activity?: number }): Promise<ProgressImage[]> {
  const q: Record<string, string> = {};
  if (params?.project != null) q.project = String(params.project);
  if (params?.activity != null) q.activity = String(params.activity);
  const search = new URLSearchParams(q).toString();
  const path = search ? `${LIST_PROGRESS_IMAGE}?${search}` : LIST_PROGRESS_IMAGE;
  const res = await requestRaw<ListProgressImagesResponse>(path, { method: "GET" });
  return Array.isArray(res?.data) ? (res.data as ProgressImage[]) : [];
}

export type UpdateProgressImageInput = {
  project: number;
  activity: number;
  image_date: string; // YYYY-MM-DD
  caption?: string;
  image?: File | null;
};

export async function updateProgressImage(
  id: number,
  payload: UpdateProgressImageInput
): Promise<CreateProgressImageResponse> {
  const form = new FormData();
  form.append("project", String(payload.project));
  form.append("activity", String(payload.activity));
  form.append("image_date", payload.image_date);
  if (payload.caption != null) form.append("caption", String(payload.caption));
  if (payload.image != null) form.append("image", payload.image);
  return requestRaw<CreateProgressImageResponse>(`${UPDATE_PROGRESS_IMAGE}${id}/`, { method: "PUT", formData: form });
}

