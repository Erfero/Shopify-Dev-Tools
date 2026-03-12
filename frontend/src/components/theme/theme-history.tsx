"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  getHistory,
  getHistoryDownloadUrl,
  deleteHistoryItem,
  clearHistory,
  type HistoryEntry,
} from "@/lib/api-theme";
import { History, Download, Trash2, FileArchive } from "lucide-react";

export function ThemeHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getHistory();
    setEntries(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownload = (entry: HistoryEntry) => {
    const a = document.createElement("a");
    a.href = getHistoryDownloadUrl(entry.id);
    a.download = entry.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = async (id: string) => {
    await deleteHistoryItem(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleClearAll = async () => {
    await clearHistory();
    setEntries([]);
  };

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  if (loading) return null;
  if (entries.length === 0) return null;

  return (
    <div className="w-full max-w-lg space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <History className="h-3.5 w-3.5 text-muted-foreground" />
          Historique
        </h3>
        <button
          onClick={handleClearAll}
          className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          Tout supprimer
        </button>
      </div>

      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-3 rounded-xl border border-border/50 bg-foreground/[0.02] px-4 py-3"
          >
            {/* Icon */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.05]">
              <FileArchive className="h-4 w-4 text-foreground/60" />
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight">
                {entry.store_name || entry.filename}
              </p>
              <p className="text-xs text-muted-foreground">{formatDate(entry.created_at)}</p>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-1">
              {entry.available ? (
                <button
                  onClick={() => handleDownload(entry)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground transition-colors"
                  title="Télécharger"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              ) : (
                <span className="text-xs text-muted-foreground/40 px-1">Expiré</span>
              )}
              <button
                onClick={() => handleDelete(entry.id)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/40 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                title="Supprimer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
