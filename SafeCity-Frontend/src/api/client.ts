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

// A single CSRF fetch and a single refresh request are shared across concurrent calls.
// This prevents a burst of 401s from rotating refresh cookies against each other.
let csrfPromise: Promise<void> | null = null;
let refreshPromise: Promise<boolean> | null = null;
let logoutPending = false;
let sessionEpoch = 0;
let refreshRevision = 0;

const AUTH_PATHS = new Set(["/api/login-user/", "/api/login-user/refresh/", "/api/login-user/logout/"]);

export function resetSessionAfterLogin(): void {
  logoutPending = false;
  sessionEpoch += 1;
}

/** Wait for an already-started refresh before invalidating the cookie server-side. */
export async function beginSessionLogout(): Promise<void> {
  logoutPending = true;
  if (refreshPromise) await refreshPromise.catch(() => false);
}

/** A failed logout must not be misrepresented as server-side revocation. */
export function endSessionLogout(confirmed: boolean): void {
  if (confirmed) sessionEpoch += 1;
  logoutPending = false;
}

async function ensureCsrfCookie(): Promise<void> {
  if (getCookie("csrftoken")) return;
  if (!csrfPromise) {
    csrfPromise = (async () => {
      const response = await fetch(apiUrl("csrf/"), { credentials: "include" });
      if (!response.ok) throw new ApiError("Unable to establish the secure request session.", response.status);
      if (!getCookie("csrftoken")) throw new ApiError("CSRF security cookie was not received. Please reload the page.", 403);
    })().finally(() => { csrfPromise = null; });
  }
  await csrfPromise;
}

function announceExpiredSession(): void {
  if (typeof window !== "undefined" && !logoutPending) {
    window.dispatchEvent(new Event("safecity:session-expired"));
  }
}

async function refreshSession(): Promise<boolean> {
  if (logoutPending) return false;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        await ensureCsrfCookie();
        const csrf = getCookie("csrftoken");
        const headers = new Headers();
        if (csrf) headers.set("X-CSRFToken", csrf);
        const res = await fetch(apiUrl("login-user/refresh/"), {
          method: "POST", headers, credentials: "include", cache: "no-store",
        });
        if (res.ok) refreshRevision += 1;
        return res.ok;
      } catch {
        return false;
      }
    })().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function fetchWithSession(url: string, init: RequestInit = {}): Promise<Response> {
  const pathname = new URL(url, typeof window === "undefined" ? "http://localhost" : window.location.href).pathname;
  const isLogout = pathname === "/api/login-user/logout/";
  const isAuthEndpoint = AUTH_PATHS.has(pathname);
  if (logoutPending && !isLogout) throw new ApiError("Sign-out in progress.", 401);
  const epoch = sessionEpoch;
  const requestRefreshRevision = refreshRevision;
  const method = (init.method ?? "GET").toUpperCase();
  const unsafe = !["GET", "HEAD", "OPTIONS", "TRACE"].includes(method);
  if (unsafe) await ensureCsrfCookie();

  const headers = new Headers(init.headers);
  if (unsafe) {
    const csrf = getCookie("csrftoken");
    if (csrf) headers.set("X-CSRFToken", csrf);
  }
  const requestInit: RequestInit = { ...init, headers, credentials: "include" };
  let response = await fetch(url, requestInit);
  // Responses started before logout must not populate private UI state afterward.
  if ((epoch !== sessionEpoch || logoutPending) && !isLogout) throw new ApiError("Session changed.", 401);
  if (response.status === 401 && !isAuthEndpoint && !logoutPending) {
    // A separate request may already have refreshed while this 401 was in flight.
    const refreshed = refreshRevision !== requestRefreshRevision || await refreshSession();
    if (epoch !== sessionEpoch || logoutPending) throw new ApiError("Session changed.", 401);
    if (refreshed) {
      // Refresh may rotate the CSRF cookie; send the newest token on the sole retry.
      const latestCsrf = getCookie("csrftoken");
      if (unsafe && latestCsrf) headers.set("X-CSRFToken", latestCsrf);
      response = await fetch(url, requestInit);
    }
    if (!refreshed || response.status === 401) announceExpiredSession();
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
  if (json !== null && typeof json === "object" && "data" in json) {
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
    throw new ApiError(res.ok ? "Unable to read the server response." : `Request failed (HTTP ${res.status}).`, res.status);
  }
  if (!res.ok) {
    const isEnvelope = json && typeof json === "object" && "status" in json && "data" in json;
    const message = typeof json?.message === "string" ? json.message :
      typeof json?.detail === "string" ? json.detail : `Request failed (HTTP ${res.status}).`;
    throw new ApiError(message, res.status, isEnvelope ? json.data : json);
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
