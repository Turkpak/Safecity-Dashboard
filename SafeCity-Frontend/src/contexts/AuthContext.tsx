import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { getAccessToken, clearTokens } from "@/api/client";
import type { LoginResponse } from "@/api/types";

const USER_STORAGE_KEY = "safecity_user";

function getStoredUser(): LoginResponse | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LoginResponse) : null;
  } catch {
    return null;
  }
}

interface AuthContextValue {
  user: LoginResponse | null;
  isAuthenticated: boolean;
  setUser: (user: LoginResponse | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<LoginResponse | null>(() => {
    if (typeof window === "undefined") return null;
    const token = getAccessToken();
    const stored = getStoredUser();
    if (!token || !stored) return null;
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

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    localStorage.removeItem("userRole");
  }, [setUser]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) setUserState(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      // Token is the source of truth for API authentication.
      // User details may load slightly later (or be missing in storage during first login).
      isAuthenticated: !!getAccessToken(),
      setUser,
      logout,
    }),
    [user, setUser, logout]
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
      logout: () => {},
    } satisfies AuthContextValue;
  }
  return ctx;
}
