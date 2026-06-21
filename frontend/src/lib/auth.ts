const TOKEN_KEY = "sdt_auth_token";
const USER_KEY = "sdt_auth_user";
export const REMEMBER_KEY = "sdt_remember_pref";

export interface AuthUser {
  email: string;
  is_admin: boolean;
  display_name?: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  // Always localStorage — session storage caused users to be logged out on every browser close
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, remember = true): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(REMEMBER_KEY, String(remember));
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setUser(user: AuthUser, remember = true): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  // Also clear sessionStorage for users who were logged in before this fix
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export function isRemembered(): boolean {
  if (typeof window === "undefined") return false;
  // Read from the preference key, not the token key
  return localStorage.getItem(REMEMBER_KEY) !== "false";
}

export function logout(): void {
  clearAuth();
  window.location.href = "/login";
}

// ── Session inactivity timeout (4 hours, only when "Se souvenir de moi" is unchecked) ──

const ACTIVITY_KEY = "sdt_last_activity";
export const SESSION_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours

export function updateActivity(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
}

export function isSessionExpired(): boolean {
  if (typeof window === "undefined") return false;
  if (!isAuthenticated()) return false;
  const raw = localStorage.getItem(ACTIVITY_KEY);
  if (!raw) {
    updateActivity();
    return false;
  }
  return Date.now() - parseInt(raw, 10) > SESSION_TIMEOUT_MS;
}
