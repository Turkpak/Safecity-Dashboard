import { apiUrl } from "./config";
import type { ApiEnvelope } from "./types";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

async function ensureCsrfCookie(): Promise<void> {
  if (!getCookie("csrftoken")) {
    await fetch(apiUrl("csrf/"), { credentials: "include" });
  }
}

export async function fetchWithSession(url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const isUnsafe = !["GET", "HEAD", "OPTIONS", "TRACE"].includes(method);
  if (isUnsafe) await ensureCsrfCookie();

  const headers = new Headers(init.headers);
  const csrfToken = getCookie("csrftoken");
  if (isUnsafe && csrfToken) headers.set("X-CSRFToken", csrfToken);

  const requestInit: RequestInit = { ...init, headers, credentials: "include" };
  let response = await fetch(url, requestInit);
  const pathname = new URL(url, window.location.href).pathname;
  const isAuthEndpoint = pathname.includes("/login-user/");

  if (response.status === 401 && !isAuthEndpoint) {
    await ensureCsrfCookie();
    const refreshHeaders = new Headers();
    const currentCsrfToken = getCookie("csrftoken");
    if (currentCsrfToken) refreshHeaders.set("X-CSRFToken", currentCsrfToken);
    const refreshResponse = await fetch(apiUrl("login-user/refresh/"), {
      method: "POST",
      headers: refreshHeaders,
      credentials: "include",
    });
    if (refreshResponse.ok) {
      response = await fetch(url, requestInit);
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("safecity:session-expired"));
    }
  }

  return response;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: any;

  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(res.ok ? "Unable to read the server response." : `Request failed (HTTP ${res.status}).`, res.status);
  }

  if (res.status >= 400) {
    // The backend sends {status, message: "Serializer error.", data: {field: [errors]}}.
    // Preserve the field errors for the form rather than displaying that generic message.
    const isEnvelope = json && typeof json === "object" && "data" in json && "status" in json;
    const message = typeof json?.message === "string" ? json.message
      : typeof json?.detail === "string" ? json.detail : `Request failed (HTTP ${res.status}).`;
    throw new ApiError(message, res.status, isEnvelope ? json.data : json);
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

/**
 * Raw API call that returns the full JSON body (no `{data: ...}` unwrapping).
 * Use this for endpoints like `list-delay-log/` that already return `{count, data}`.
 */
export async function requestRaw<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {}, formData } = options;
  const url = apiUrl(path);
  const isJson = !formData && body !== undefined;
  const requestHeaders: Record<string, string> = {
    ...headers,
  };
  if (isJson) {
    requestHeaders["Content-Type"] = "application/json";
  }

  let requestBody: string | FormData | undefined;
  if (formData) requestBody = formData;
  else if (body !== undefined) requestBody = JSON.stringify(body);

  const res = await fetchWithSession(url, {
    method,
    headers: requestHeaders,
    body: requestBody,
  });

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
 * Call the backend API using HttpOnly authentication cookies.
 * Throws on non-2xx or when backend returns status >= 400 in envelope.
 * Returns the `data` part of the API response.
 */
export async function request<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {}, formData } = options;
  const url = apiUrl(path);
  const isJson = !formData && body !== undefined;
  const requestHeaders: Record<string, string> = {
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

  const res = await fetchWithSession(url, {
    method,
    headers: requestHeaders,
    body: requestBody,
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
