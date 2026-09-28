import { post } from "./client";
import type { LoginCredentials, LoginResponse } from "./types";

const LOGIN_PATH = "login-user/";

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  return post<LoginResponse>(LOGIN_PATH, credentials);
}

export async function logout(): Promise<void> {
  await post("login-user/logout/");
}
