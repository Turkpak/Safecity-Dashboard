import { get, post } from "./client";
import type { UserCreateInput, UserListItem } from "./types";

const CREATE = "create-user/";
const LIST = "get-user/";

/**
 * GET /api/get-user/ — list all users (no query params).
 */
export async function listUsers(): Promise<UserListItem[]> {
  const data = await get<UserListItem[]>(LIST);
  return Array.isArray(data) ? data : [];
}

/**
 * POST /api/create-user/ — create user.
 * Body: email, first_name, last_name, password, role, stakeholder
 */
export async function createUser(payload: UserCreateInput): Promise<{ user: unknown; tokens: { access: string; refresh: string } }> {
  const body: Record<string, unknown> = {
    email: payload.email.trim(),
    first_name: payload.first_name.trim(),
    last_name: payload.last_name.trim(),
    password: payload.password,
    role: payload.role,
    stakeholder: payload.stakeholder,
    company_name: payload.company_name ?? "SafeCity",
  };
  if (payload.permissions != null) {
    body.permissions = payload.permissions;
  }
  return post<{ user: unknown; tokens: { access: string; refresh: string } }>(CREATE, body);
}
