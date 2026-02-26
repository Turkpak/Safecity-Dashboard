import { get, post, put, del } from "./client";
import type { Division, DivisionCreateInput, DivisionUpdateInput } from "./types";

/** POST /api/create-division/ — body: { division_name: string, province: number } (province = id from list-province) */
const CREATE = "create-division/";
const LIST = "list-division/";
const UPDATE = "update-division/";
const DELETE_PATH = "delete-division/";

export async function listDivisions(provinceId?: number): Promise<Division[]> {
  const params = provinceId != null ? { province: String(provinceId) } : undefined;
  const data = await get<Division[]>(LIST, params as Record<string, string> | undefined);
  return Array.isArray(data) ? data : [];
}

export async function getDivisionById(id: number): Promise<Division | null> {
  const data = await get<Division>(LIST, { id: String(id) });
  return data ?? null;
}

export async function createDivision(payload: DivisionCreateInput): Promise<Division> {
  return post<Division>(CREATE, payload);
}

export async function updateDivision(id: number, payload: DivisionUpdateInput): Promise<Division> {
  return put<Division>(`${UPDATE}${id}/`, payload);
}

export async function deleteDivision(id: number): Promise<void> {
  await del(`${DELETE_PATH}${id}/`);
}
