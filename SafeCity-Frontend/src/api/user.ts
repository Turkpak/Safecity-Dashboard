import { get, post, put, patch } from "./client";
import type {
  UserCreateInput,
  UserListItem,
  CreateUserResponse,
  UserPermissionCreateInput,
  UserWithPermissions,
} from "./types";

const CREATE = "create-user/";
const LIST = "get-user/";
const USER_PERMISSIONS = "user-permissions/";

/**
 * GET /api/user-permissions/ — list all users with their page permissions (super_admin only).
 * Returns array of { user_id, full_name, email, role, permissions[] }.
 */
export async function getUsersWithPermissions(): Promise<UserWithPermissions[]> {
  const data = await get<UserWithPermissions[]>(USER_PERMISSIONS);
  return Array.isArray(data) ? data : [];
}

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
export async function createUser(payload: UserCreateInput): Promise<CreateUserResponse> {
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
  return post<CreateUserResponse>(CREATE, body);
}

/**
 * POST /api/user-permissions/ — assign page CRUD permissions to a user (super_admin only).
 * Body: user, sidebar_label, sub_label?, can_view, can_create, can_update, can_delete
 */
export async function createUserPermission(
  payload: UserPermissionCreateInput
): Promise<unknown> {
  const body: Record<string, unknown> = {
    user: payload.user,
    sidebar_label: payload.sidebar_label,
    can_view: payload.can_view,
    can_create: payload.can_create,
    can_update: payload.can_update,
    can_delete: payload.can_delete,
  };
  if (payload.sub_label != null && payload.sub_label !== "") {
    body.sub_label = payload.sub_label;
  }
  return post(USER_PERMISSIONS, body);
}

/**
 * PUT /api/user-permissions/:id/ — update page CRUD permissions (super_admin only).
 * Body: user, sidebar_label, sub_label?, can_view, can_create, can_update, can_delete (full object).
 */
export async function updateUserPermission(
  id: number,
  payload: UserPermissionCreateInput
): Promise<unknown> {
  const body: Record<string, unknown> = {
    user: payload.user,
    sidebar_label: payload.sidebar_label,
    can_view: payload.can_view,
    can_create: payload.can_create,
    can_update: payload.can_update,
    can_delete: payload.can_delete,
  };
  if (payload.sub_label != null && payload.sub_label !== "") {
    body.sub_label = payload.sub_label;
  }
  return put(`${USER_PERMISSIONS}${id}/`, body);
}


export async function updateUserStatus(
  id: number,
  is_active: boolean
): Promise<UserListItem> {
  return patch<UserListItem>(`update-user-status/${id}/`, {
    is_active,
  });
}