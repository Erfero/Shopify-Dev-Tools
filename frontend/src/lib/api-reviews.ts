import { API as API_ENDPOINT, API_BASE } from "@/lib/config";
import { getToken } from "@/lib/auth";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface SSEEvent {
  type: "start" | "progress" | "complete" | "error";
  message: string;
  progress: number;
  count?: number;
  session_id?: string;
}

export function getDownloadUrl(sessionId: string, format: "full" | "import"): string {
  return `${API_ENDPOINT}/reviews/download/${sessionId}?format=${format}`;
}

export async function getPreview(
  sessionId: string
): Promise<{ reviews: Array<{ author: string; review: string; reply: string }>; count: number }> {
  const response = await fetch(`${API_ENDPOINT}/reviews/preview/${sessionId}`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Preview introuvable");
  return response.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`${API_ENDPOINT}/reviews/session/${sessionId}`, { method: "DELETE", headers: authHeaders() });
}

export async function uploadImages(files: File[]): Promise<string[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const response = await fetch(`${API_ENDPOINT}/reviews/upload-images`, {
    method: "POST",
    body: formData,
    headers: authHeaders(),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail || "Erreur lors de l'upload des images.");
  }
  const data = await response.json();
  const urls = data.urls as string[];
  return urls.map(toAbsoluteUrl);
}

/** Convert a relative path or localhost URL to a proper absolute backend URL. */
export function toAbsoluteUrl(url: string): string {
  if (url.startsWith("/")) {
    return `${API_BASE}${url}`;
  }
  if (/https?:\/\/localhost(:\d+)?\//.test(url) && !API_BASE.includes("localhost")) {
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    return `${API_BASE}${path}`;
  }
  return url;
}
