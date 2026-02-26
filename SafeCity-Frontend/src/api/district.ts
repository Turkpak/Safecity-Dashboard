import { get, post, put, del } from "./client";
import type { District, DistrictCreateInput, DistrictUpdateInput } from "./types";

const CREATE = "create-district/";
const LIST = "list-district/";
const UPDATE = "update-district/";
const DELETE_PATH = "delete-district/";

export async function listDistricts(divisionId?: number): Promise<District[]> {
  const params = divisionId != null ? { division: String(divisionId) } : undefined;
  const data = await get<District[]>(LIST, params as Record<string, string> | undefined);
  return Array.isArray(data) ? data : [];
}

export async function getDistrictById(id: number): Promise<District | null> {
  const data = await get<District>(LIST, { id: String(id) });
  return data ?? null;
}

export async function createDistrict(payload: DistrictCreateInput): Promise<District> {
  return post<District>(CREATE, payload);
}

export async function updateDistrict(id: number, payload: DistrictUpdateInput): Promise<District> {
  return put<District>(`${UPDATE}${id}/`, payload);
}

export async function deleteDistrict(id: number): Promise<void> {
  await del(`${DELETE_PATH}${id}/`);
}
