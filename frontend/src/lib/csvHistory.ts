import { API } from "@/lib/config";

export interface CSVEntry {
  sessionId: string;
  productName: string;
  brandName: string;
  reviewCount: number;
  createdAt: string;
  status: "pending" | "downloaded";
  downloadedAt?: string;
}

export async function getEntries(): Promise<CSVEntry[]> {
  try {
    const resp = await fetch(`${API}/reviews/history`);
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
      headers: { "Content-Type": "application/json" },
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
    });
  } catch {
    // silently ignore
  }
}

export async function deleteEntry(sessionId: string): Promise<void> {
  try {
    await fetch(`${API}/reviews/history/${sessionId}`, {
      method: "DELETE",
    });
  } catch {
    // silently ignore
  }
}
