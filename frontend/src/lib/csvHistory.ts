import { API } from "@/lib/config";
import { getToken } from "@/lib/auth";

export interface CSVEntry {
  sessionId: string;
  productName: string;
  brandName: string;
  reviewCount: number;
  createdAt: string;
  status: "pending" | "downloaded";
  downloadedAt?: string;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getEntries(): Promise<CSVEntry[]> {
  try {
    const resp = await fetch(`${API}/reviews/history`, { headers: authHeaders() });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.entries as CSVEntry[];
  } catch {
    return [];
  }
}

export async function addPendingEntry(data: {
  sessionId: string;
  productName: string;
  brandName: string;
  reviewCount: number;
}): Promise<void> {
  try {
    await fetch(`${API}/reviews/history/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
  } catch {
    // silently ignore
  }
}

export async function markAsDownloaded(sessionId: string): Promise<void> {
  try {
    await fetch(`${API}/reviews/history/${sessionId}/mark-downloaded`, {
      method: "POST",
      headers: authHeaders(),
    });
  } catch {
    // silently ignore
  }
}

export async function deleteEntry(sessionId: string): Promise<void> {
  try {
    await fetch(`${API}/reviews/history/${sessionId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
  } catch {
    // silently ignore
  }
}
