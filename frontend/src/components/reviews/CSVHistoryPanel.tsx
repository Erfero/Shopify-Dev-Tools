"use client";

import { useState } from "react";
import {
  X,
  Download,
  Trash2,
  Clock,
  CheckCircle2,
  FileText,
  FileSpreadsheet,
  AlertCircle,
  History,
} from "lucide-react";
import { CSVEntry, markAsDownloaded, deleteEntry } from "@/lib/csvHistory";
import { getDownloadUrl } from "@/lib/api-reviews";
import { getToken } from "@/lib/auth";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface Props {
  entries: CSVEntry[];
  onClose: () => void;
  onRefresh: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CSVHistoryPanel({ entries, onClose, onRefresh }: Props) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const pending = entries.filter((e) => e.status === "pending");
  const downloaded = entries.filter((e) => e.status === "downloaded");

  const handleDownload = async (sessionId: string, format: "full" | "import") => {
    const key = `${sessionId}-${format}`;
    setDownloading(key);
    setErrors((prev) => ({ ...prev, [sessionId]: "" }));
    try {
      const token = getToken();
      const resp = await fetch(getDownloadUrl(sessionId, format), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) {
        if (resp.status === 404) {
          setErrors((prev) => ({
            ...prev,
            [sessionId]: "Session expirée — veuillez regénérer les avis",
          }));
        } else {
          setErrors((prev) => ({ ...prev, [sessionId]: "Erreur de téléchargement" }));
        }
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const disposition = resp.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="([^"]+)"/);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameMatch?.[1] ?? `loox_${sessionId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      await markAsDownloaded(sessionId);
      onRefresh();
    } catch {
      setErrors((prev) => ({ ...prev, [sessionId]: "Erreur réseau" }));
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = (sessionId: string) => {
    setConfirmDelete(sessionId);
  };

  const confirmDoDelete = async () => {
    if (!confirmDelete) return;
    await deleteEntry(confirmDelete);
    setConfirmDelete(null);
    onRefresh();
  };

  const entryToDelete = entries.find((e) => e.sessionId === confirmDelete);

  return (
    <>
    <ConfirmModal
      open={!!confirmDelete}
      title="Supprimer cet historique ?"
      description={entryToDelete ? `"${entryToDelete.productName}" sera définitivement supprimé.` : undefined}
      confirmLabel="Supprimer"
      onConfirm={confirmDoDelete}
      onCancel={() => setConfirmDelete(null)}
    />
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 16px",
        overflowY: "auto",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="card animate-fade-up"
        style={{
          width: "100%",
          maxWidth: 560,
          padding: 0,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border)",
            background: "white",
          }}
        >
          <div>
            <div className="flex items-center gap-2">
              <History size={16} style={{ color: "var(--text-secondary)" }} />
              <p className="font-bold text-base" style={{ color: "var(--text)" }}>
                Fichiers CSV
              </p>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {pending.length} en attente · {downloaded.length} téléchargé{downloaded.length > 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "oklch(0.97 0 0)",
              border: "1px solid oklch(0.922 0 0)",
              borderRadius: 10,
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "20px 24px", maxHeight: "70vh", overflowY: "auto" }}>
          {entries.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "40px 0",
                color: "var(--text-muted)",
                fontSize: 14,
              }}
            >
              <FileText size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <p>Aucun fichier CSV pour le moment</p>
              <p className="text-xs mt-1">Les fichiers générés apparaîtront ici</p>
            </div>
          )}

          {/* Pending section */}
          {pending.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} style={{ color: "#D97706" }} />
                <p className="font-semibold text-sm" style={{ color: "#D97706" }}>
                  En attente de téléchargement ({pending.length})
                </p>
              </div>
              <div className="space-y-3">
                {pending.map((entry) => (
                  <EntryCard
                    key={entry.sessionId}
                    entry={entry}
                    error={errors[entry.sessionId]}
                    downloading={downloading}
                    onDownload={handleDownload}
                    onDelete={handleDelete}
                    accent="#D97706"
                    bg="#FFFBEB"
                    border="#FDE68A"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Downloaded section */}
          {downloaded.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={14} style={{ color: "#15803D" }} />
                <p className="font-semibold text-sm" style={{ color: "#15803D" }}>
                  Historique ({downloaded.length})
                </p>
              </div>
              <div className="space-y-3">
                {downloaded.map((entry) => (
                  <EntryCard
                    key={entry.sessionId}
                    entry={entry}
                    error={errors[entry.sessionId]}
                    downloading={downloading}
                    onDownload={handleDownload}
                    onDelete={handleDelete}
                    accent="#15803D"
                    bg="#F0FDF4"
                    border="#BBF7D0"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

interface EntryCardProps {
  entry: CSVEntry;
  error?: string;
  downloading: string | null;
  onDownload: (sessionId: string, format: "full" | "import") => void;
  onDelete: (sessionId: string) => void;
  accent: string;
  bg: string;
  border: string;
}

function EntryCard({ entry, error, downloading, onDownload, onDelete, accent, bg, border }: EntryCardProps) {
  return (
    <div
      style={{
        background: bg,
        border: `1.5px solid ${border}`,
        borderRadius: 14,
        padding: "14px 16px",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>
            {entry.productName}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {entry.brandName} · {entry.reviewCount} avis
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {entry.status === "downloaded" && entry.downloadedAt
              ? `Téléchargé le ${formatDate(entry.downloadedAt)}`
              : `Généré le ${formatDate(entry.createdAt)}`}
          </p>
        </div>
        <button
          onClick={() => onDelete(entry.sessionId)}
          title="Supprimer définitivement"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "#EF4444",
            padding: 4,
            borderRadius: 8,
            flexShrink: 0,
            opacity: 0.6,
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {error && (
        <div
          className="flex items-center gap-1.5 text-xs mb-2"
          style={{ color: "#DC2626" }}
        >
          <AlertCircle size={12} />
          {error}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <DownloadBtn
          label="CSV Import"
          icon={<FileText size={12} />}
          loading={downloading === `${entry.sessionId}-import`}
          accent={accent}
          onClick={() => onDownload(entry.sessionId, "import")}
        />
        <DownloadBtn
          label="CSV Complet"
          icon={<FileSpreadsheet size={12} />}
          loading={downloading === `${entry.sessionId}-full`}
          accent={accent}
          onClick={() => onDownload(entry.sessionId, "full")}
          recommended
        />
      </div>
    </div>
  );
}

interface DownloadBtnProps {
  label: string;
  icon: React.ReactNode;
  loading: boolean;
  accent: string;
  onClick: () => void;
  recommended?: boolean;
}

function DownloadBtn({ label, icon, loading, accent, onClick, recommended }: DownloadBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        fontWeight: 600,
        padding: "5px 12px",
        borderRadius: 8,
        border: `1.5px solid ${accent}`,
        background: "white",
        color: accent,
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.5 : 1,
        transition: "opacity 0.15s",
        fontFamily: "inherit",
      }}
    >
      {loading ? (
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            border: `2px solid ${accent}`,
            borderTopColor: "transparent",
            animation: "spin 0.7s linear infinite",
          }}
        />
      ) : (
        <>
          {icon}
          <Download size={10} />
        </>
      )}
      {label}
      {recommended && !loading && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            background: accent,
            color: "white",
            borderRadius: 4,
            padding: "1px 4px",
          }}
        >
          REC
        </span>
      )}
    </button>
  );
}
