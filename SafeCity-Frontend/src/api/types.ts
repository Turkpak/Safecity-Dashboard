/**
 * Types matching the Django backend serializers and API responses.
 */

/** Standard API response envelope from backend */
export interface ApiEnvelope<T = unknown> {
  status: number;
  message: string;
  data: T;
  error_traceback?: string;
}

// ---------------------------------------------------------------------------
// Auth & User
// ---------------------------------------------------------------------------

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  msg: { login: string; verified: boolean };
  email: string;
  first_name: string;
  last_name: string;
  id: number;
  token: string;
  refresh: string;
  access: string;
  is_admin?: boolean;
  /** From backend: super_admin | contractor | consultant */
  role?: string;
  stakeholder_id: number | null;
  stakeholder_type: string | null;
  is_active: boolean;
}

/** CRUD permissions assignable by Super Admin when creating a user (optional; backend can adopt later) */
export interface UserCrudPermissions {
  create?: boolean;
  read?: boolean;
  update?: boolean;
  delete?: boolean;
}

/** Payload for POST /api/create-user/ (User Management form) */
export interface UserCreateInput {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  role: string; // e.g. "consultant" | "contractor"
  stakeholder: number;
  company_name?: string;
  /** Optional CRUD permissions (Super Admin assigns to Contractor/Consultant); backend can accept when implemented */
  permissions?: UserCrudPermissions;
}

/** User item from GET /api/get-user/ (list) */
export interface UserListItem {
  id: number;
  email: string;
  full_name: string;
  role?: string; // super_admin | contractor | consultant
  stakeholder: number | null;
  is_active: boolean;
}

/** Response from POST /api/create-user/ — includes created user with id */
export interface CreateUserResponse {
  user: { id: number; email: string; full_name: string; role?: string; [key: string]: unknown };
  tokens: { access: string; refresh: string };
}

/** Payload for POST /api/user-permissions/ (assign page CRUD to a user) */
export interface UserPermissionCreateInput {
  user: number;
  sidebar_label: string;
  sub_label?: string | null;
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

/** One permission item from GET /api/user-permissions/ (permissions array) */
export interface UserPermissionItem {
  id: number;
  user: number;
  user_email?: string;
  user_full_name?: string;
  sidebar_label: string;
  sub_label: string | null;
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  created_by?: number | null;
  created_by_email?: string | null;
  updated_by?: number | null;
}

/** One user with permissions from GET /api/user-permissions/ */
export interface UserWithPermissions {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
  permissions: UserPermissionItem[];
}

// ---------------------------------------------------------------------------
// Province
// ---------------------------------------------------------------------------

export interface Province {
  id: number;
  province_name: string;
}

export interface ProvinceCreateInput {
  province_name: string;
}

export interface ProvinceUpdateInput {
  province_name?: string;
}

// ---------------------------------------------------------------------------
// Division
// ---------------------------------------------------------------------------

export interface Division {
  id: number;
  division_name: string;
  province: number;
  province_name: string;
}

export interface DivisionCreateInput {
  division_name: string;
  province: number;
}

export interface DivisionUpdateInput {
  division_name?: string;
  province?: number;
}

// ---------------------------------------------------------------------------
// District
// ---------------------------------------------------------------------------

export interface District {
  id: number;
  district_name: string;
  division: number;
  province: number;
  province_name: string;
  division_name: string;
}

export interface DistrictCreateInput {
  district_name: string;
  division: number;
  province: number;
}

export interface DistrictUpdateInput {
  district_name?: string;
  division?: number;
  province?: number;
}

// ---------------------------------------------------------------------------
// Tehsil
// ---------------------------------------------------------------------------

export interface Tehsil {
  id: number;
  tehsil_name: string;
  district: number;
  division: number;
  province: number;
  province_name: string;
  division_name: string;
  district_name: string;
}

export interface TehsilCreateInput {
  tehsil_name: string;
  district: number;
  division: number;
  province: number;
}

export interface TehsilUpdateInput {
  tehsil_name?: string;
  district?: number;
  division?: number;
  province?: number;
}

// ---------------------------------------------------------------------------
// Stakeholder
// ---------------------------------------------------------------------------

export type StakeholderStatus = "active" | "disable";

export interface Stakeholder {
  id: number;
  stakeholder_type: string;
  stakeholder_title: string;
  status: StakeholderStatus;
}

export interface StakeholderCreateInput {
  stakeholder_type: string;
  stakeholder_title: string;
  status?: StakeholderStatus;
}

export interface StakeholderUpdateInput {
  stakeholder_type?: string;
  stakeholder_title?: string;
  status?: StakeholderStatus;
}

// ---------------------------------------------------------------------------
// Project (GeoFeatureModelSerializer may return geom as GeoJSON)
// ---------------------------------------------------------------------------

/** GET list-project returns a GeoJSON FeatureCollection; each feature has id + properties */
export interface ListProjectFeature {
  id: number;
  type: string;
  geometry: unknown;
  properties: Omit<Project, "id">;
}

export interface ListProjectResponse {
  type: "FeatureCollection";
  features: ListProjectFeature[];
}

export interface Project {
  id: number;
  stakeholder: number;
  stakeholder_type?: string | null;
  stakeholder_title?: string | null;
  project_name: string | null;
  project_description: string | null;
  project_starting_date: string | null;
  project_reference_no: string | null;
  province: number;
  division: number;
  district: number;
  tehsil: number;
  province_name?: string | null;
  division_name?: string | null;
  district_name?: string | null;
  tehsil_name?: string | null;
  total_budget_allocated: string | null;
  budget_utilized: string | null;
  budget_variance?: string | null;
  budget_remaining?: string | null;
  xer_file: string | null;
  boundary_file: string | null;
  geom?: unknown;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreateInput {
  stakeholder: number;
  project_name?: string | null;
  project_description?: string | null;
  project_starting_date?: string | null;
  project_reference_no?: string | null;
  province: number;
  division: number;
  district: number;
  tehsil: number;
  total_budget_allocated?: number | string | null;
  budget_utilized?: number | string | null;
  /** .xer file for project schedule */
  xer_file?: File | null;
  /** Boundary: .geojson (sent as-is) or .kml/.kmz/.zip/.shp (converted to GeoJSON on frontend) */
  boundary_file?: File | null;
}

export interface ProjectUpdateInput {
  stakeholder?: number;
  project_name?: string | null;
  project_description?: string | null;
  project_starting_date?: string | null;
  project_reference_no?: string | null;
  province?: number;
  division?: number;
  district?: number;
  tehsil?: number;
  total_budget_allocated?: string | null;
  budget_utilized?: string | null;
  budget_variance?: string | null;
  budget_remaining?: string | null;
}

// ---------------------------------------------------------------------------
// Pictorial Archive
// ---------------------------------------------------------------------------

export interface PictorialArchive {
  id: number;
  project: number;
  image: string;
  image_date: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface PictorialArchiveCreateInput {
  project: number;
  image?: File;
  image_date: string;
  description?: string;
}

export interface PictorialArchiveUpdateInput {
  image?: File;
  image_date?: string;
  description?: string;
}
