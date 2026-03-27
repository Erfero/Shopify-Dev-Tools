"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, logout, getAuthHeaders } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface ActivityEntry {
  id: number;
  user_email: string;
  action: string;
  details: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login: { label: "Connexion", color: "bg-blue-500/20 text-blue-300 border border-blue-500/30" },
  register: { label: "Inscription", color: "bg-purple-500/20 text-purple-300 border border-purple-500/30" },
  theme_generate: { label: "Thème généré", color: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" },
  theme_download: { label: "Thème téléchargé", color: "bg-teal-500/20 text-teal-300 border border-teal-500/30" },
  csv_generate: { label: "Avis générés", color: "bg-amber-500/20 text-amber-300 border border-amber-500/30" },
  csv_download: { label: "CSV téléchargé", color: "bg-orange-500/20 text-orange-300 border border-orange-500/30" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-center gap-4">
      <div className="text-3xl">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm text-white/50">{label}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const user = typeof window !== "undefined" ? getUser() : null;
  const [logs, setLogs] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    fetchLogs();
  }, []);

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/my-activity?limit=100`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } finally {
      setLoading(false);
    }
  }

  const counts = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.action] = (acc[l.action] ?? 0) + 1;
    return acc;
  }, {});

  const themesGenerated = counts["theme_generate"] ?? 0;
  const csvGenerated = counts["csv_generate"] ?? 0;
  const downloads = (counts["theme_download"] ?? 0) + (counts["csv_download"] ?? 0);
  const totalActions = logs.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/30 backdrop-blur border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="text-white/60 hover:text-white transition text-sm flex items-center gap-1"
          >
            ← Accueil
          </button>
          <span className="text-white/20">/</span>
          <h1 className="font-semibold text-white">Mon historique</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/50">{user?.email}</span>
          <button
            onClick={logout}
            className="text-sm bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 px-3 py-1.5 rounded-lg transition"
          >
            Déconnexion
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-bold">Bonjour 👋</h2>
          <p className="text-white/50 mt-1">Voici un résumé de votre activité sur Shopify Dev Tools.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Actions totales" value={totalActions} icon="📊" />
          <StatCard label="Thèmes générés" value={themesGenerated} icon="🎨" />
          <StatCard label="Avis générés" value={csvGenerated} icon="⭐" />
          <StatCard label="Téléchargements" value={downloads} icon="📥" />
        </div>

        {/* Activity log */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-semibold text-white">Journal d&apos;activité</h3>
            <button
              onClick={fetchLogs}
              className="text-xs bg-white/10 hover:bg-white/20 border border-white/10 text-white/70 px-3 py-1.5 rounded-lg transition"
            >
              Actualiser
            </button>
          </div>

          {loading ? (
            <div className="px-6 py-10 text-center text-white/40">Chargement…</div>
          ) : logs.length === 0 ? (
            <div className="px-6 py-10 text-center text-white/40">
              Aucune activité enregistrée pour votre compte.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {logs.map((log) => {
                const meta = ACTION_LABELS[log.action];
                return (
                  <div key={log.id} className="px-6 py-4 flex items-start gap-4 hover:bg-white/5 transition">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            meta?.color ?? "bg-white/10 text-white/60"
                          }`}
                        >
                          {meta?.label ?? log.action}
                        </span>
                        {log.details && (
                          <span className="text-sm text-white/60 truncate max-w-xs">{log.details}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-white/30 whitespace-nowrap shrink-0 mt-0.5">
                      {formatDate(log.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Back to tools */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => router.push("/theme")}
            className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 rounded-xl p-5 text-left transition"
          >
            <div className="text-2xl mb-2">🎨</div>
            <div className="font-semibold">Générateur de thème</div>
            <div className="text-sm text-emerald-300/60 mt-1">Créer ou modifier un thème Shopify</div>
          </button>
          <button
            onClick={() => router.push("/reviews")}
            className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-xl p-5 text-left transition"
          >
            <div className="text-2xl mb-2">⭐</div>
            <div className="font-semibold">Générateur d&apos;avis</div>
            <div className="text-sm text-amber-300/60 mt-1">Générer des avis clients CSV</div>
          </button>
        </div>
      </div>
    </div>
  );
}
