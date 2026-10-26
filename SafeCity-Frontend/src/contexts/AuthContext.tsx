import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { getCurrentUser, logout as apiLogout } from "@/api/auth";
import { ApiError, beginSessionLogout, endSessionLogout } from "@/api/client";
import { queryClient } from "@/lib/queryClient";
import type { LoginResponse } from "@/api/types";

const LEGACY_AUTH_STORAGE_KEYS = [
  "safecity_user",
  "safecity_session_expires_at",
  "userRole",
  "safecity_access_token",
  "safecity_refresh_token",
] as const;

function clearLegacyAuthStorage() {
  if (typeof window === "undefined") return;
  LEGACY_AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}

interface AuthContextValue {
  user: LoginResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: LoginResponse | null) => void;
  logout: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<LoginResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setUser = useCallback((u: LoginResponse | null) => {
    // Login (including account switching) invalidates data cached for another identity.
    queryClient.clear();
    setUserState(u);
  }, []);

  const logout = useCallback(async (): Promise<boolean> => {
    await beginSessionLogout();
    let confirmed = false;
    try {
      await apiLogout();
      confirmed = true;
    } catch (error) {
      // A 401 on the logout endpoint also means there is no active server session.
      if (error instanceof ApiError && error.status === 401) confirmed = true;
    } finally {
      endSessionLogout(confirmed);
    }
    if (!confirmed) return false;
    await queryClient.cancelQueries();
    queryClient.clear();
    setUserState(null);
    clearLegacyAuthStorage();
    return true;
  }, []);

  useEffect(() => {
    let active = true;
    clearLegacyAuthStorage();

    const onSessionExpired = () => {
      queryClient.cancelQueries();
      queryClient.clear();
      setUserState(null);
      clearLegacyAuthStorage();
      setIsLoading(false);
    };
    window.addEventListener("safecity:session-expired", onSessionExpired);

    getCurrentUser()
      .then((currentUser) => {
        if (active) setUserState(currentUser);
      })
      .catch((error: unknown) => {
        if (!(error instanceof ApiError && error.status === 401)) {
          console.error("Could not restore the authenticated session.", error);
        }
        if (active) {
          queryClient.clear();
          setUserState(null);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      window.removeEventListener("safecity:session-expired", onSessionExpired);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      setUser,
      logout,
    }),
    [user, isLoading, setUser, logout]
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
      isLoading: false,
      setUser: () => {},
      logout: async () => false,
    } satisfies AuthContextValue;
  }
  return ctx;
}
