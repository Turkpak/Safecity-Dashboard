import { ApiError } from "@/api/client";

/** Display-only interpretation of DRF's validation errors. Never changes a request payload. */
export type FormErrorInfo = {
  summary: string;
  details: string[];
  fields: string[];
};

const FIELD_LABELS: Record<string, string> = {
  email: "Email address",
  first_name: "First name",
  last_name: "Last name",
  password: "Password",
  role: "Role",
  stakeholder: "Stakeholder",
  user: "User",
  permissions: "Page permissions",
  sidebar_label: "Page",
  sub_label: "Page section",
  can_view: "View permission",
  can_create: "Create permission",
  can_update: "Update permission",
  can_delete: "Delete permission",
  project_name: "Project name",
  project_description: "Project description",
  project_reference_no: "Project reference number",
  project_starting_date: "Project starting date",
  province: "Province",
  division: "Division",
  district: "District",
  tehsil: "Tehsil",
  xer_file: "XER schedule file",
  boundary_file: "Project boundary file",
  geom: "Project boundary geometry",
  total_budget_allocated: "Total budget allocated",
  budget_utilized: "Budget utilized",
  budget_variance: "Budget variance",
  budget_remaining: "Budget remaining",
  allocation_capital_cost: "Allocation capital cost",
  allocation_revenue_cost: "Allocation revenue cost",
  allocation_total_cost: "Allocation total cost",
  pd_release_capital_cost: "P&D release capital cost",
  pd_release_cost: "P&D release revenue cost",
  pd_release_total_cost: "P&D release total cost",
  spending_release_capital_cost: "Spending release capital cost",
  spending_release_revenue_cost: "Spending release revenue cost",
  spending_release_total_cost: "Spending release total cost",
  pifra_utilization_capital_cost: "PIFRA utilization capital cost",
  pifra_utilization_revenue_cost: "PIFRA utilization revenue cost",
  pifra_utilization_total_cost: "PIFRA utilization total cost",
  pifra_utilization_date: "PIFRA utilization date",
  percentage_utilization_capital: "Capital utilization percentage",
  percentage_utilization_revenue: "Revenue utilization percentage",
  percentage_utilization_total: "Total utilization percentage",
};

const GENERIC_ERRORS = /^(serializer error\.?|validation error\.?|exception error\.?|unzip error\.?|error\.?|bad request\.?|request failed(?::?\s*\d+|\s*\(http \d+\))?)$/i;
const SAFE_LIMIT = 240;

function cleanMessage(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  return trimmed.length > SAFE_LIMIT ? `${trimmed.slice(0, SAFE_LIMIT - 1)}…` : trimmed;
}

function getLabel(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function flattenValidation(
  value: unknown,
  fields: string[],
  result: string[],
  field = "",
  depth = 0,
): void {
  if (depth > 5 || result.length >= 10 || value == null) return;
  if (typeof value === "string" || typeof value === "number") {
    const message = cleanMessage(String(value));
    if (!message || GENERIC_ERRORS.test(message)) return;
    result.push(field ? `${getLabel(field)}: ${message}` : message);
    if (field && !fields.includes(field)) fields.push(field);
  } else if (Array.isArray(value)) {
    for (const entry of value) flattenValidation(entry, fields, result, field, depth + 1);
  } else if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (key === "status" || key === "error_traceback") continue;
      const rootField = ["non_field_errors", "detail", "message", "error"].includes(key)
        ? field : (field || key);
      flattenValidation(entry, fields, result, rootField, depth + 1);
    }
  }
}

/** Normalize wrapped API `data`, ordinary DRF field errors and local file parsing errors. */
export function getFormApiError(error: unknown, fallback: string): FormErrorInfo {
  if (error instanceof ApiError) {
    if (error.status === 401) return { summary: "Your session has expired. Please sign in again.", details: [], fields: [] };
    if (error.status === 403) return { summary: "You do not have permission to complete this action, or the session security check failed. Please refresh and try again.", details: [], fields: [] };
    if (error.status === 429) return { summary: "Too many attempts. Please wait before trying again.", details: [], fields: [] };
    if (error.status >= 500) return { summary: "The server could not complete the request. Please try again or contact support.", details: [], fields: [] };
    const fields: string[] = [];
    const details: string[] = [];
    flattenValidation(error.details, fields, details);
    const serverMessage = cleanMessage(error.message);
    if (/^unzip error\.?$/i.test(serverMessage)) {
      return { summary: "The project boundary archive could not be opened. Please upload a valid KMZ or ZIP shapefile.", details: [], fields: ["boundary_file"] };
    }
    const specificMessage = serverMessage && !GENERIC_ERRORS.test(serverMessage) ? serverMessage : "";
    // A backend exception may include only generic safe_error_data, not validation fields.
    // Avoid claiming that a particular field caused the failure without evidence.
    const summary = fields.length ? (specificMessage || "Please correct the following fields and try again.")
      : specificMessage || (details.length ? details[0] : fallback);
    return {
      summary,
      details: [...new Set(fields.length ? details : (details.length > 1 ? details : []))],
      fields,
    };
  }

  const text = error instanceof Error ? cleanMessage(error.message) : "";
  if (/failed to fetch|networkerror|load failed/i.test(text)) {
    return { summary: "Cannot connect to the server. Check your connection and try again.", details: [], fields: [] };
  }
  if (text.startsWith("Project boundary file:")) {
    return { summary: text, details: [], fields: ["boundary_file"] };
  }
  if (/unzip|end of data|invalid zip|central directory|shpjs|shape.?file|corrupt|unsupported boundary/i.test(text)) {
    return { summary: "The project boundary archive could not be read. Upload a valid ZIP shapefile (with .shp and .dbf), KMZ or GeoJSON file.", details: [], fields: ["boundary_file"] };
  }
  return { summary: text && !GENERIC_ERRORS.test(text) ? text : fallback, details: [], fields: [] };
}

/** When the backend identifies an earlier wizard field, take the user there. */
export function projectErrorStep(fields: string[]): 1 | 2 | 3 | null {
  const stepOne = new Set(["project_name", "project_description", "project_reference_no", "project_starting_date", "province", "division", "district", "tehsil", "stakeholder"]);
  const stepTwo = new Set(["boundary_file", "geom", "xer_file"]);
  if (fields.some((field) => stepOne.has(field))) return 1;
  if (fields.some((field) => stepTwo.has(field))) return 2;
  return fields.length ? 3 : null;
}
