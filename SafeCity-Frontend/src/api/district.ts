import { get, post, put, del } from "./client";
import type { District, DistrictCreateInput, DistrictUpdateInput } from "./types";

/** POST /api/create-district/ — body: { district_name: string, division: number, province: number } (ids from list-province / list-division) */
const CREATE = "create-district/";
/** GET /api/list-district/ — returns all districts with province_name, division_name for table (Province → Division → District) */
const LIST = "list-district/";
/** PUT /api/update-district/{id}/ — body: { district_name?: string, division?: number, province?: number } (use district id in URL) */
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

/** Update district by id. Body: { district_name, division, province } (ids from list-province / list-division). */
export async function updateDistrict(id: number, payload: DistrictUpdateInput): Promise<District> {
  return put<District>(`${UPDATE}${id}/`, payload);
}

export async function deleteDistrict(id: number): Promise<void> {
  await del(`${DELETE_PATH}${id}/`);
}
