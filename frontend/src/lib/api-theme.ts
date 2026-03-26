const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

import { getToken } from "@/lib/auth";

/** Wrapper fetch qui ajoute automatiquement le JWT Bearer token. */
function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers as HeadersInit | undefined);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}

export interface UploadResponse {
  session_id: string;
  theme_name: string;
  sections_count: number;
  templates_found: string[];
}

export interface GenerateRequest {
  session_id: string;
  store_name: string;
  store_email: string;
  product_names: string[];
  product_description?: string;
  product_images?: File[];
  language: string;
  target_gender: string;
  product_price?: string;
  store_address?: string;
  siret?: string;
  delivery_delay: string;
  return_policy_days: string;
  marketing_angles?: string;
}

export interface GenerationStep {
  step: string;
  status: "generating" | "done" | "error";
  message: string;
  data?: Record<string, unknown> | null;
}

export async function uploadTheme(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<UploadResponse> {
  const MAX_ATTEMPTS = 3;
  const RETRY_DELAY_MS = 3000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const formData = new FormData();
    formData.append("theme_file", file);

    try {
      const data = await new Promise<UploadResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE}/api/theme/upload`);
        const token = getToken();
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.timeout = 150_000;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            // Upload phase: 0–70 %; server processing: we animate 70–95 %
            onProgress(Math.round((e.loaded / e.total) * 70));
          }
        };

        // Simulate server-side processing progress (70 → 95) while waiting for response
        let serverPct = 70;
        const serverTick = setInterval(() => {
          if (serverPct < 95) {
            serverPct += 1;
            onProgress?.(serverPct);
          }
        }, 300);

        xhr.onload = () => {
          clearInterval(serverTick);
          onProgress?.(100);
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)); }
            catch { reject(new Error("Réponse invalide du serveur")); }
          } else {
            try {
              const body = JSON.parse(xhr.responseText);
              reject(Object.assign(new Error(body.detail || "Erreur lors de l'upload"), { status: xhr.status }));
            } catch {
              reject(Object.assign(new Error("Erreur lors de l'upload"), { status: xhr.status }));
            }
          }
        };

        xhr.onerror = () => { clearInterval(serverTick); reject(new TypeError("Network error")); };
        xhr.ontimeout = () => {
          clearInterval(serverTick);
          reject(new Error("Le serveur met trop de temps à répondre. Veuillez réessayer dans quelques secondes."));
        };

        xhr.send(formData);
      });
      return data;
    } catch (err) {
      const status = (err as { status?: number }).status;
      const isNetwork = err instanceof TypeError;
      const isTimeout = err instanceof Error && err.message.includes("trop de temps");
      // Retry on network / 5xx (server may be waking up)
      if ((isNetwork || isTimeout || (status !== undefined && status >= 500)) && attempt < MAX_ATTEMPTS) {
        onProgress?.(0);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      throw err;
    }
  }

  throw new Error("L'upload a échoué après plusieurs tentatives. Veuillez rafraîchir la page et réessayer.");
}

export async function generateTheme(
  request: GenerateRequest,
  onStep: (step: GenerationStep) => void,
  signal?: AbortSignal,
): Promise<void> {
  const formData = new FormData();
  formData.append("session_id", request.session_id);
  formData.append("store_name", request.store_name);
  formData.append("store_email", request.store_email);
  formData.append("product_names", JSON.stringify(request.product_names));
  formData.append("language", request.language);
  formData.append("target_gender", request.target_gender);
  formData.append("delivery_delay", request.delivery_delay);
  formData.append("return_policy_days", request.return_policy_days);

  if (request.product_description) {
    formData.append("product_description", request.product_description);
  }
  if (request.product_price) {
    formData.append("product_price", request.product_price);
  }
  if (request.store_address) {
    formData.append("store_address", request.store_address);
  }
  if (request.siret) {
    formData.append("siret", request.siret);
  }
  if (request.marketing_angles) {
    formData.append("marketing_angles", request.marketing_angles);
  }

  if (request.product_images) {
    for (const image of request.product_images) {
      formData.append("product_images", image);
    }
  }

  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/api/theme/generate`, {
      method: "POST",
      body: formData,
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return;
    throw err;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Erreur lors de la generation" }));
    throw new Error(err.detail || "Erreur lors de la generation");
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Streaming non supporte");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          try {
            const step: GenerationStep = JSON.parse(trimmed.slice(6));
            onStep(step);
          } catch {
            // skip malformed lines
          }
        }
      }
    }
  } catch (err) {
    reader.cancel().catch(() => undefined);
    if (err instanceof Error && err.name === "AbortError") return;
    throw new Error(
      err instanceof Error && err.message
        ? `Connexion interrompue : ${err.message}`
        : "La connexion au serveur a été interrompue. Veuillez réessayer.",
    );
  }
}

export function getDownloadUrl(sessionId: string): string {
  return `${API_BASE}/api/theme/download/${sessionId}`;
}

export async function previewTexts(sessionId: string): Promise<Record<string, Record<string, string>>> {
  const res = await apiFetch(`${API_BASE}/api/theme/preview/${sessionId}`);
  if (!res.ok) throw new Error("Erreur lors du chargement de l'apercu");
  const data = await res.json();
  return data.texts;
}

export async function applyTheme(
  sessionId: string,
  generatedData: Record<string, unknown>,
): Promise<{ download_url: string }> {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("generated_data", JSON.stringify(generatedData));

  const res = await apiFetch(`${API_BASE}/api/theme/apply`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Erreur lors de l'application" }));
    throw new Error(err.detail || "Erreur lors de l'application");
  }

  return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  await apiFetch(`${API_BASE}/api/theme/session/${sessionId}`, { method: "DELETE" });
}

export interface HistoryEntry {
  id: string;
  filename: string;
  store_name: string;
  created_at: string;
  available: boolean;
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const res = await apiFetch(`${API_BASE}/api/theme/history`);
  if (!res.ok) return [];
  return res.json();
}

export function getHistoryDownloadUrl(historyId: string): string {
  return `${API_BASE}/api/theme/history/${historyId}/download`;
}

export async function deleteHistoryItem(historyId: string): Promise<void> {
  await apiFetch(`${API_BASE}/api/theme/history/${historyId}`, { method: "DELETE" });
}

export async function clearHistory(): Promise<void> {
  await apiFetch(`${API_BASE}/api/theme/history`, { method: "DELETE" });
}

export async function regenerateSection(
  sessionId: string,
  section: string,
  onStep: (step: GenerationStep) => void,
  signal?: AbortSignal,
): Promise<void> {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("section", section);

  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/api/theme/regenerate`, {
      method: "POST",
      body: formData,
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return;
    throw err;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Erreur lors de la régénération" }));
    throw new Error(err.detail || "Erreur lors de la régénération");
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Streaming non supporté");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          try {
            const step: GenerationStep = JSON.parse(trimmed.slice(6));
            onStep(step);
          } catch {
            // skip malformed lines
          }
        }
      }
    }
  } catch (err) {
    reader.cancel().catch(() => undefined);
    if (err instanceof Error && err.name === "AbortError") return;
    throw new Error(
      err instanceof Error && err.message
        ? `Connexion interrompue : ${err.message}`
        : "La connexion au serveur a été interrompue.",
    );
  }
}

export interface AnalyticsSummary {
  total: number;
  successful: number;
  success_rate: number;
  avg_duration: number;
  by_language: Record<string, number>;
  total_regenerations: number;
}

export async function getAnalytics(): Promise<AnalyticsSummary> {
  const res = await apiFetch(`${API_BASE}/api/theme/analytics`);
  if (!res.ok) throw new Error("Erreur lors du chargement des analytics");
  return res.json();
}
