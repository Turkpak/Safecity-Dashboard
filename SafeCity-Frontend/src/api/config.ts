export const API_PREFIX = "/api";

export const DEFAULT_BACKEND_URL = "http://localhost:8000";

/**
 * In dev we use Vite proxy: request goes to same origin (e.g. /api/create-stakeholder/)
 * and Vite forwards to 127.0.0.1:8000 so the response comes back (no CORS / "Failed to fetch").
 * Set VITE_API_BASE_URL in .env to override (e.g. for production or no proxy).
 */
function getApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string)?.trim()?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  // Dev with proxy: use same origin so Vite proxies /api to Django
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const { hostname, port } = window.location;
    if (hostname === "localhost" && (port === "5000" || port === "5173" || port === "3000"))
      return ""; // same-origin → proxy handles /api
  }
  if (import.meta.env.DEV) return DEFAULT_BACKEND_URL;
  return "";
}

export const API_BASE_URL = getApiBaseUrl();

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${API_PREFIX}${p}` : `${API_PREFIX}${p}`;
}

/**
 * Build an absolute URL for Django-served media (e.g. `/media/...`).
 * When dev uses Vite proxy (`API_BASE_URL === ""`), media is NOT under `/api`,
 * so we fall back to the backend origin.
 */
export function mediaUrl(path: string): string {
  if (!path) return "";

  // Keep absolute URLs unchanged.
  if (/^https?:\/\//i.test(path)) return path;

  const p = path.startsWith("/") ? path : `/${path}`;

  // Production: use the current website's origin.
  if (import.meta.env.PROD) {
    return `${window.location.origin}${p}`;
  }

  // Development: use the configured backend.
  const base = API_BASE_URL || DEFAULT_BACKEND_URL;
  return `${base}${p}`;
}