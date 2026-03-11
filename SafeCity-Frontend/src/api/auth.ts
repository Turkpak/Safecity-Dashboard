import { post } from "./client";
import { setTokens } from "./client";
import type { LoginCredentials, LoginResponse } from "./types";

const LOGIN_PATH = "login-user/";

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const data = await post<LoginResponse>(LOGIN_PATH, credentials);
  const access = data.access ?? data.token;
  if (access) setTokens(access, data.refresh);
  return data;
}

export { setTokens, clearTokens, getAccessToken, getRefreshToken } from "./client";
