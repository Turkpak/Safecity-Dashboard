// import { get, post } from "./client";
// import type { LoginCredentials, LoginResponse } from "./types";

// const LOGIN_PATH = "login-user/";
// const CURRENT_USER_PATH = "get-user/me/";

// export async function login(
//   credentials: LoginCredentials & { captcha_token: string }
// ): Promise<void> {
//   await post<void>(LOGIN_PATH, credentials);
// }

// export async function getCurrentUser(): Promise<LoginResponse> {
//   return get<LoginResponse>(CURRENT_USER_PATH);
// }

// export async function logout(): Promise<void> {
//   await post("login-user/logout/");
// }



import { get, post } from "./client";
import type { LoginResponse } from "./types";

const LOGIN_PATH = "login-user/";
const CURRENT_USER_PATH = "get-user/me/";
const CAPTCHA_PATH = "captcha/";

export interface CaptchaResponse {
  key: string;
  image_url: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  captcha_key: string;
  captcha_value: string;
}

export async function getCaptcha(): Promise<CaptchaResponse> {
  return get<CaptchaResponse>(CAPTCHA_PATH);
}

export async function login(
  credentials: LoginCredentials
): Promise<void> {
  await post<void>(LOGIN_PATH, credentials);
}

export async function getCurrentUser(): Promise<LoginResponse | null> {
  return get<LoginResponse | null>(CURRENT_USER_PATH);
}

export async function logout(): Promise<void> {
  await post("login-user/logout/");
}
