"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getHistory,
  getHistoryDownloadUrl,
  deleteHistoryItem,
  clearHistory,
  type HistoryEntry,
} from "@/lib/api-theme";
import { History, Download, Trash2, FileArchive, X } from "lucide-react";

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ThemeHistoryPanel({ onClose, isAdmin = false }: { onClose: () => void; isAdmin?: boolean }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getHistory();
    setEntries(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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

  return (
    <>
      {/* Overlay */}
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 49 }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        style={{
          position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 50,
          width: "min(420px, 100vw)",
          background: "white",
          boxShadow: "-4px 0 32px rgba(0,0,0,0.12)",
          display: "flex", flexDirection: "column",
          animation: "slideInRight 0.25s ease",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "oklch(0.97 0 0)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <History size={17} style={{ color: "var(--primary)" }} />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Historique des thèmes</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{entries.length} thème{entries.length !== 1 ? "s" : ""} généré{entries.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "oklch(0.96 0 0)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={15} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2.5px solid var(--primary)", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
            </div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
              <FileArchive size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <p style={{ fontSize: 14 }}>Aucun thème généré</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Vos thèmes apparaîtront ici après génération</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, border: "1.5px solid var(--border)", background: "white" }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "oklch(0.97 0 0)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <FileArchive size={17} style={{ color: "var(--text-secondary)" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.store_name || entry.filename}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{formatDate(entry.created_at)}</p>
                    {isAdmin && entry.user_email && (
                      <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1, opacity: 0.7 }}>
                        👤 {entry.user_email}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {entry.available ? (
                      <button
                        onClick={() => handleDownload(entry)}
                        title="Télécharger"
                        style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "oklch(0.97 0 0)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "oklch(0.94 0 0)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "oklch(0.97 0 0)"; }}
                      >
                        <Download size={14} />
                      </button>
                    ) : (
                      <span style={{ fontSize: 10, color: "var(--text-muted)", padding: "0 4px" }}>Expiré</span>
                    )}
                    <button
                      onClick={() => handleDelete(entry.id)}
                      title="Supprimer"
                      style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "oklch(0.97 0 0)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444", opacity: 0.5 }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "#FEF2F2"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.5"; e.currentTarget.style.background = "oklch(0.97 0 0)"; }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {entries.length > 0 && (
          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
            <button
              onClick={handleClearAll}
              style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1.5px solid #FEE2E2", background: "#FEF2F2", color: "#DC2626", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#FEE2E2"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#FEF2F2"; }}
            >
              <Trash2 size={13} /> Tout supprimer
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// Legacy export for backwards compat
export function ThemeHistory() {
  return null;
}
