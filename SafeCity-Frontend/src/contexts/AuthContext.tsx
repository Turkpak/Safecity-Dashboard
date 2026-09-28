import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { logout as apiLogout } from "@/api/auth";
import type { LoginResponse } from "@/api/types";

const USER_STORAGE_KEY = "safecity_user";
const SESSION_EXPIRES_AT_KEY = "safecity_session_expires_at";
const DEFAULT_SESSION_MS = 60 * 60 * 1000; // 60 minutes (match backend ACCESS_TOKEN_LIFETIME)

/** Nonsecret local state used for navigation and session expiry. */
const AUTH_STORAGE_KEYS = [
  "safecity_user",
  "userRole",
  "safecity_session_expires_at",
] as const;

function getStoredUser(): LoginResponse | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as LoginResponse & Record<string, unknown>;
    let changed = false;
    for (const key of ["token", "access", "refresh"]) {
      if (key in stored) {
        delete stored[key];
        changed = true;
      }
    }
    if (changed) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(stored));
    return stored;
  } catch {
    return null;
  }
}

function getSessionExpiresAt(): number | null {
  const raw = localStorage.getItem(SESSION_EXPIRES_AT_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function isSessionExpired(): boolean {
  const expiresAt = getSessionExpiresAt();
  return expiresAt !== null && Date.now() >= expiresAt;
}

interface AuthContextValue {
  user: LoginResponse | null;
  isAuthenticated: boolean;
  setUser: (user: LoginResponse | null) => void;
  startSession: (durationMs?: number) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<LoginResponse | null>(() => {
    if (typeof window === "undefined") return null;
    localStorage.removeItem("safecity_access_token");
    localStorage.removeItem("safecity_refresh_token");
    if (isSessionExpired()) {
      AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      return null;
    }
    const stored = getStoredUser();
    if (!stored) return null;
    return stored;
  });

  const setUser = useCallback((u: LoginResponse | null) => {
    setUserState(u);
    if (u) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(u));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, []);

  const startSession = useCallback((durationMs: number = DEFAULT_SESSION_MS) => {
    localStorage.setItem(SESSION_EXPIRES_AT_KEY, String(Date.now() + durationMs));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    void apiLogout().catch(() => undefined);
  }, [setUser]);

  useEffect(() => {
    const syncAuthState = () => {
      if (!getStoredUser() || isSessionExpired()) {
        setUserState(null);
        AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      }
    };

    syncAuthState();

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (AUTH_STORAGE_KEYS.includes(e.key as any)) {
        syncAuthState();
      }
    };
    const onSessionExpired = () => {
      setUserState(null);
      AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("safecity:session-expired", onSessionExpired);

    const interval = window.setInterval(syncAuthState, 1000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("safecity:session-expired", onSessionExpired);
      window.clearInterval(interval);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user && !isSessionExpired(),
      setUser,
      startSession,
      logout,
    }),
    [user, setUser, startSession, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  // In dev (Fast Refresh / HMR), components can temporarily render outside providers.
  // Returning a safe fallback prevents the entire app from crashing.
  if (!ctx) {
    return {
      user: null,
      isAuthenticated: false,
      setUser: () => {},
      startSession: () => {},
      logout: () => {},
    } satisfies AuthContextValue;
  }
  return ctx;
}
