import { get, post, put, del } from "./client";
import type { Tehsil, TehsilCreateInput, TehsilUpdateInput } from "./types";

const CREATE = "create-tehsil/";
const LIST = "list-tehsil/";
const UPDATE = "update-tehsil/";
const DELETE_PATH = "delete-tehsil/";

export async function listTehsils(districtId?: number): Promise<Tehsil[]> {
  const params = districtId != null ? { district: String(districtId) } : undefined;
  const data = await get<Tehsil[]>(LIST, params as Record<string, string> | undefined);
  return Array.isArray(data) ? data : [];
}

export async function getTehsilById(id: number): Promise<Tehsil | null> {
  const data = await get<Tehsil>(LIST, { id: String(id) });
  return data ?? null;
}

export async function createTehsil(payload: TehsilCreateInput): Promise<Tehsil> {
  return post<Tehsil>(CREATE, payload);
}

export async function updateTehsil(id: number, payload: TehsilUpdateInput): Promise<Tehsil> {
  return put<Tehsil>(`${UPDATE}${id}/`, payload);
}

export async function deleteTehsil(id: number): Promise<void> {
  await del(`${DELETE_PATH}${id}/`);
}
