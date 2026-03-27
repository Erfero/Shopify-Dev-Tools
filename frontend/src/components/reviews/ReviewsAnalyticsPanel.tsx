"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api-fetch";
import { API_BASE } from "@/lib/config";

interface Stats {
  by_action: Record<string, number>;
  csv_by_user: { email: string; count: number; display_name: string }[];
  reviews_by_language: { language: string; count: number }[];
  total: number;
}

interface ReviewsAnalyticsPanelProps {
  onClose: () => void;
}

export function ReviewsAnalyticsPanel({ onClose }: ReviewsAnalyticsPanelProps) {
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`${API_BASE}/api/admin/stats`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));
  }, []);

  const totalGenerated = data?.by_action["csv_generate"] ?? 0;
  const totalDownloaded = data?.by_action["csv_download"] ?? 0;
  const topLanguages = data?.reviews_by_language ?? [];
  const maxLang = topLanguages.length > 0 ? topLanguages[0].count : 1;
  const topUsers = data?.csv_by_user?.slice(0, 5) ?? [];
  const maxUser = topUsers.length > 0 ? topUsers[0].count : 1;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 50 }}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "min(380px, 100vw)", background: "white",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.10)",
          zIndex: 51, display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: "1px solid var(--border)" }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Analytics Avis</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Statistiques du générateur Loox</p>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid var(--border)", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {loading && (
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
              <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          )}

          {error && (
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", fontSize: 13 }}>
              {error}
            </div>
          )}

          {data && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Summary cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <MiniCard label="CSV générés" value={String(totalGenerated)} />
                <MiniCard label="Téléchargements" value={String(totalDownloaded)} highlight={totalDownloaded > 0} />
              </div>

              {/* Language breakdown */}
              {topLanguages.length > 0 && (
                <div style={{ borderRadius: 12, border: "1px solid var(--border)", padding: "14px 16px" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>Répartition par langue</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {topLanguages.map(({ language, count }) => {
                      const pct = totalGenerated > 0 ? Math.round((count / totalGenerated) * 100) : 0;
                      const barPct = Math.round((count / maxLang) * 100);
                      return (
                        <div key={language} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>{language}</span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{count} ({pct}%)</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: "oklch(0.93 0 0)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${barPct}%`, borderRadius: 3, background: "#f59e0b", transition: "width 0.4s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Top users */}
              {topUsers.length > 0 && (
                <div style={{ borderRadius: 12, border: "1px solid var(--border)", padding: "14px 16px" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>Top générateurs</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {topUsers.map(({ email, count, display_name }) => {
                      const barPct = Math.round((count / maxUser) * 100);
                      return (
                        <div key={email} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>{display_name}</span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{count} CSV</span>
                          </div>
                          <div style={{ height: 5, borderRadius: 3, background: "oklch(0.93 0 0)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${barPct}%`, borderRadius: 3, background: "#6366f1", transition: "width 0.4s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {totalGenerated === 0 && (
                <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", paddingTop: 16 }}>
                  Aucune donnée disponible pour le moment.
                </p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

function MiniCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ borderRadius: 10, border: "1px solid var(--border)", padding: "12px 14px", background: highlight ? "oklch(0.97 0.02 260)" : "white" }}>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, color: highlight ? "oklch(0.45 0.12 260)" : "var(--text)" }}>{value}</p>
    </div>
  );
}
