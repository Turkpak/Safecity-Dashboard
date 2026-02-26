import { post } from "./client";
import { setTokens } from "./client";
import type { LoginCredentials, LoginResponse } from "./types";

const LOGIN_PATH = "login-user/";

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const data = await post<LoginResponse>(LOGIN_PATH, credentials);
  if (data.access && data.refresh) {
    setTokens(data.access, data.refresh);
  }
  return data;
}

export { setTokens, clearTokens, getAccessToken, getRefreshToken } from "./client";
