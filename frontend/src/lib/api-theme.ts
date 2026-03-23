const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || "";

/** Wrapper fetch qui ajoute automatiquement le header X-API-Token si configuré. */
function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  if (!API_TOKEN) return fetch(url, options);
  const headers = new Headers(options.headers as HeadersInit | undefined);
  headers.set("X-API-Token", API_TOKEN);
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

export async function uploadTheme(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("theme_file", file);

  // AbortController timeout: 120 seconds for large theme ZIPs
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);

  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/api/theme/upload`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("L'upload a pris trop de temps. Veuillez réessayer.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ detail: "Erreur lors de l'upload" }));
    throw new Error(errBody.detail || "Erreur lors de l'upload");
  }

  return res.json();
}

export async function generateTheme(
  request: GenerateRequest,
  onStep: (step: GenerationStep) => void,
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

  const res = await apiFetch(`${API_BASE}/api/theme/generate`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Erreur lors de la generation" }));
    throw new Error(err.detail || "Erreur lors de la generation");
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Streaming non supporte");

  const decoder = new TextDecoder();
  let buffer = "";

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
