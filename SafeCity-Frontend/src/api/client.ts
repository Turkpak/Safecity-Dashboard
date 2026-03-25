import { apiUrl } from "./config";
import type { ApiEnvelope } from "./types";

const AUTH_TOKEN_KEY = "safecity_access_token";
const REFRESH_TOKEN_KEY = "safecity_refresh_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(access: string, refresh?: string | null): void {
  localStorage.setItem(AUTH_TOKEN_KEY, access);
  if (refresh) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }
}

export function clearTokens(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function getAuthHeaders(): Record<string, string> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: any;

  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(res.statusText || `Request failed: ${res.status}`);
  }

  if (res.status >= 400) {
    throw new Error(json?.message || `Request failed: ${res.status}`);
  }

  // ✅ handle raw array
  if (Array.isArray(json)) {
    return json as T;
  }

  // ✅ handle normal API (with data)
  if ("data" in json) {
    return json.data as T;
  }

  // ✅ handle gantt API (tasks, links)
  return json as T;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  /** For multipart/form-data (e.g. file upload). When set, body is ignored. */
  formData?: FormData;
}

/**
 * Call the backend API. Uses Authorization: Bearer if token is present.
 * Throws on non-2xx or when backend returns status >= 400 in envelope.
 * Returns the `data` part of the API response.
 */
export async function request<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {}, formData } = options;
  const url = apiUrl(path);
  const authHeaders = getAuthHeaders();

  const isJson = !formData && body !== undefined;
  const requestHeaders: Record<string, string> = {
    ...authHeaders,
    ...headers,
  };
  if (isJson) {
    requestHeaders["Content-Type"] = "application/json";
  }

  let requestBody: string | FormData | undefined;
  if (formData) {
    requestBody = formData;
  } else if (body !== undefined) {
    requestBody = JSON.stringify(body);
  }

  const res = await fetch(url, {
    method,
    headers: requestHeaders,
    body: requestBody,
    credentials: "include",
  });

  return parseResponse<T>(res);
}

/** GET request */
export async function get<T = unknown>(path: string, params?: Record<string, string | number>): Promise<T> {
  let url = path;
  if (params && Object.keys(params).length > 0) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") search.set(k, String(v));
    }
    const q = search.toString();
    if (q) url += (path.includes("?") ? "&" : "?") + q;
  }
  return request<T>(url, { method: "GET" });
}

/** POST request */
export async function post<T = unknown>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body });
}

/** PUT request */
export async function put<T = unknown>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "PUT", body });
}

/** PATCH request */
export async function patch<T = unknown>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "PATCH", body });
}

/** DELETE request */
export async function del<T = unknown>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}
