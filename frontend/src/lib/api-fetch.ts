/**
 * Authenticated fetch wrapper.
 *
 * - Automatically injects the Bearer token from localStorage/sessionStorage.
 * - On 401: calls logout() and throws an error to stop execution.
 */
import { getToken, logout } from "@/lib/auth";

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const resp = await fetch(url, { ...options, headers });
  if (resp.status === 401) {
    logout();
    throw new Error("Session expirée. Redirection vers la connexion…");
  }
  return resp;
}
