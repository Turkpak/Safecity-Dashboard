import { post } from "./client";
import type { UserCreateInput } from "./types";

const CREATE = "create-user/";

/**
 * POST /api/create-user/ — create user (super admin only).
 * Body: email, first_name, last_name, password, stakeholder
 */
export async function createUser(payload: UserCreateInput): Promise<{ user: unknown; tokens: { access: string; refresh: string } }> {
  const body = {
    email: payload.email.trim(),
    first_name: payload.first_name.trim(),
    last_name: payload.last_name.trim(),
    password: payload.password,
    stakeholder: payload.stakeholder,
    company_name: payload.company_name ?? "SafeCity",
  };
  return post<{ user: unknown; tokens: { access: string; refresh: string } }>(CREATE, body);
}
