import { getToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers as HeadersInit | undefined);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}

export interface ImageResult {
  id: string;
  source: "Pexels" | "Unsplash";
  url: string;
  thumb: string;
  photographer: string;
  alt: string;
  query: string;
}

export interface AnalysisResult {
  visual_description: string;
  product_category: string;
  target_audience: string;
  usage_context: string;
  search_queries: string[];
  dalle_prompt: string;
}

export interface ShopifyUploadResult {
  success: boolean;
  id: string;
  url: string;
  filename: string;
  error?: string;
}

export interface ImagesConfig {
  pexels: boolean;
  unsplash: boolean;
  vision_model: string;
}

export async function getImagesConfig(): Promise<ImagesConfig> {
  const r = await apiFetch(`${API_BASE}/api/images/config`);
  if (!r.ok) throw new Error("Config unavailable");
  return r.json();
}

export async function analyzeProductImage(
  imageFile: File,
  productName: string,
  productDescription: string,
  marketingAngles: string,
): Promise<AnalysisResult> {
  const fd = new FormData();
  fd.append("image", imageFile);
  fd.append("product_name", productName);
  fd.append("product_description", productDescription);
  fd.append("marketing_angles", marketingAngles);

  const r = await apiFetch(`${API_BASE}/api/images/analyze`, { method: "POST", body: fd });
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail || "Analyse échouée");
  return data.analysis as AnalysisResult;
}

export async function searchImages(queries: string[]): Promise<ImageResult[]> {
  const r = await apiFetch(`${API_BASE}/api/images/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queries, per_query: 10 }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail || "Recherche échouée");
  return data.images as ImageResult[];
}

export async function uploadImagesToShopify(
  images: ImageResult[],
  storeDomain: string,
  apiToken: string,
): Promise<{ uploaded: number; results: ShopifyUploadResult[] }> {
  const r = await apiFetch(`${API_BASE}/api/images/upload-shopify-bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      images: images.map((img, i) => ({
        url: img.url,
        filename: `product-lifestyle-${i + 1}.jpg`,
        alt_text: img.alt,
      })),
      store_domain: storeDomain,
      api_token: apiToken,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail || "Upload échoué");
  return { uploaded: data.uploaded, results: data.results };
}
