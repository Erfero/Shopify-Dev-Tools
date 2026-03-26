import { API as API_BASE } from "@/lib/config";
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
  return `${API_BASE}/reviews/download/${sessionId}?format=${format}`;
}

export async function getPreview(
  sessionId: string
): Promise<{ reviews: Array<{ author: string; review: string; reply: string }>; count: number }> {
  const response = await fetch(`${API_BASE}/reviews/preview/${sessionId}`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Preview introuvable");
  return response.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/reviews/session/${sessionId}`, { method: "DELETE", headers: authHeaders() });
}

export async function uploadImages(files: File[]): Promise<string[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const response = await fetch(`${API_BASE}/reviews/upload-images`, {
    method: "POST",
    body: formData,
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Erreur lors de l'upload des images.");
  const data = await response.json();
  const urls = data.urls as string[];
  // Rewrite localhost URLs to use the actual API base (handles misconfigured BACKEND_URL)
  return urls.map((url) => {
    if (/https?:\/\/localhost(:\d+)?\//.test(url) && !API_BASE.includes("localhost")) {
      const path = url.replace(/^https?:\/\/[^/]+/, "");
      return `${API_BASE}${path}`;
    }
    return url;
  });
}
