import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { ApiError, fetchWithSession } from "@/api/client";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    throw new ApiError(
      res.status === 401 ? "Your session has expired. Please sign in again." :
      res.status === 403 ? "You do not have permission to perform this action, or your security session expired." :
      res.status === 429 ? "Too many requests. Please try again shortly." :
      res.status >= 500 ? "An unexpected server error occurred." :
      `Request failed (HTTP ${res.status}).`, res.status,
    );
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetchWithSession(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetchWithSession(queryKey.join("/") as string);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
