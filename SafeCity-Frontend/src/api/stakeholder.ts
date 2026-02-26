import { get, post, put, del } from "./client";
import type { Stakeholder, StakeholderCreateInput, StakeholderUpdateInput } from "./types";

/** POST /api/create-stakeholder/ — body: { stakeholder_type, stakeholder_title [, status] } */
const CREATE_PATH = "create-stakeholder/";
const LIST = "list-stakeholder/";
const UPDATE = "update-stakeholder/";
const DELETE_PATH = "delete-stakeholder/";

export async function listStakeholders(): Promise<Stakeholder[]> {
  const data = await get<Stakeholder[]>(LIST);
  return Array.isArray(data) ? data : [];
}

export async function getStakeholderById(id: number): Promise<Stakeholder | null> {
  const data = await get<Stakeholder>(LIST, { id: String(id) });
  return data ?? null;
}

/**
 * POST request to create a new stakeholder.
 * Endpoint: http://127.0.0.1:8000/api/create-stakeholder/
 * Body: { stakeholder_type: string, stakeholder_title: string } — both required.
 */
export async function createStakeholder(payload: StakeholderCreateInput): Promise<Stakeholder> {
  const body: Record<string, string> = {
    stakeholder_type: payload.stakeholder_type.trim(),
    stakeholder_title: payload.stakeholder_title.trim(),
  };
  if (payload.status != null && payload.status !== undefined) {
    body.status = payload.status;
  }
  return post<Stakeholder>(CREATE_PATH, body);
}

export async function updateStakeholder(id: number, payload: StakeholderUpdateInput): Promise<Stakeholder> {
  return put<Stakeholder>(`${UPDATE}${id}/`, payload);
}

export async function deleteStakeholder(id: number): Promise<void> {
  await del(`${DELETE_PATH}${id}/`);
}
