import { get, post, put, del } from "./client";
import type { Province, ProvinceCreateInput, ProvinceUpdateInput } from "./types";

const BASE = "create-province/";
const LIST = "list-province/";
const UPDATE = "update-province/";
const DELETE = "delete-province/";

export async function listProvinces(): Promise<Province[]> {
  const data = await get<Province[]>(LIST);
  return Array.isArray(data) ? data : [];
}

export async function getProvinceById(id: number): Promise<Province | null> {
  const data = await get<Province>(LIST, { id: String(id) });
  return data ?? null;
}

export async function createProvince(payload: ProvinceCreateInput): Promise<Province> {
  return post<Province>(BASE, payload);
}

export async function updateProvince(id: number, payload: ProvinceUpdateInput): Promise<Province> {
  return put<Province>(`${UPDATE}${id}/`, payload);
}

export async function deleteProvince(id: number): Promise<void> {
  await del(`${DELETE}${id}/`);
}
