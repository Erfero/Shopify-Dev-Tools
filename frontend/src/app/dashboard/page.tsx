"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowLeft, Download, LogIn, Paintbrush, RefreshCw, Star, UserPlus } from "lucide-react";
import { getUser, logout, getAuthHeaders } from "@/lib/auth";
import { API_BASE } from "@/lib/config";

interface ActivityEntry {
  id: number;
  user_email: string;
  action: string;
  details: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  login:          { label: "Connexion",         icon: <LogIn className="h-3.5 w-3.5" />,     color: "text-blue-500 bg-blue-500/10" },
  register:       { label: "Inscription",       icon: <UserPlus className="h-3.5 w-3.5" />,  color: "text-purple-500 bg-purple-500/10" },
  theme_generate: { label: "Thème généré",      icon: <Paintbrush className="h-3.5 w-3.5" />, color: "text-green-600 bg-green-500/10" },
  theme_download: { label: "Thème téléchargé",  icon: <Download className="h-3.5 w-3.5" />,  color: "text-emerald-600 bg-emerald-500/10" },
  csv_generate:   { label: "Avis générés",      icon: <Star className="h-3.5 w-3.5" />,      color: "text-amber-600 bg-amber-500/10" },
  csv_download:   { label: "CSV téléchargé",    icon: <Download className="h-3.5 w-3.5" />,  color: "text-orange-600 bg-orange-500/10" },
};

function ActionBadge({ action }: { action: string }) {
  const meta = ACTION_LABELS[action] ?? { label: action, icon: <Activity className="h-3.5 w-3.5" />, color: "text-foreground/60 bg-foreground/10" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
      {meta.icon}{meta.label}
    </span>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 px-5 py-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <div className="mt-1 opacity-40">{icon}</div>
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
    if (!user) { router.push("/login"); return; }
    fetchLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/my-activity?limit=100`, { headers: getAuthHeaders() });
      if (res.ok) setLogs(await res.json());
    } finally {
      setLoading(false);
    }
  }

  const counts = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.action] = (acc[l.action] ?? 0) + 1;
    return acc;
  }, {});

  const themesGenerated = counts["theme_generate"] ?? 0;
  const csvGenerated    = counts["csv_generate"] ?? 0;
  const downloads       = (counts["theme_download"] ?? 0) + (counts["csv_download"] ?? 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/90 backdrop-blur-sm px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-foreground/[0.05]">
              <Activity className="h-4 w-4 text-foreground/70" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none">Mon historique</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="flex items-center justify-center rounded-xl border border-border bg-background p-2 shadow-sm transition hover:bg-muted disabled:opacity-40"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-muted"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Accueil
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background shadow-sm transition hover:opacity-80"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Welcome */}
        <div>
          <h2 className="text-xl font-semibold">Bonjour 👋</h2>
          <p className="mt-1 text-sm text-muted-foreground">Voici un résumé de votre activité sur Shopify Dev Tools.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Actions totales"  value={logs.length}   icon={<Activity className="h-5 w-5" />} />
          <StatCard label="Thèmes générés"   value={themesGenerated} icon={<Paintbrush className="h-5 w-5" />} />
          <StatCard label="Avis générés"     value={csvGenerated}  icon={<Star className="h-5 w-5" />} />
          <StatCard label="Téléchargements"  value={downloads}     icon={<Download className="h-5 w-5" />} />
        </div>

        {/* Activity log */}
        <div className="overflow-hidden rounded-2xl border border-border/60">
          <div className="flex items-center justify-between border-b border-border/60 bg-foreground/[0.02] px-5 py-3">
            <h3 className="text-sm font-semibold">Journal d&apos;activité</h3>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Chargement…</div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Aucune activité enregistrée pour votre compte.
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between px-5 py-3 hover:bg-foreground/[0.01] transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <ActionBadge action={log.action} />
                    {log.details && (() => {
                      try {
                        const d = JSON.parse(log.details!);
                        const detail = d.store_name ?? d.product ?? d.filename ?? null;
                        return detail ? <span className="text-xs text-muted-foreground truncate max-w-[200px]">{detail}</span> : null;
                      } catch { return <span className="text-xs text-muted-foreground truncate max-w-[200px]">{log.details}</span>; }
                    })()}
                  </div>
                  <span className="ml-4 shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick access */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            onClick={() => router.push("/theme")}
            className="group flex flex-col rounded-2xl border border-border/60 bg-foreground/[0.01] p-6 text-left transition hover:border-foreground/20 hover:bg-foreground/[0.03]"
          >
            <Paintbrush className="mb-3 h-5 w-5 text-foreground/50" />
            <p className="font-semibold">Générateur de thème</p>
            <p className="mt-1 text-sm text-muted-foreground">Créer ou modifier un thème Shopify</p>
          </button>
          <button
            onClick={() => router.push("/reviews")}
            className="group flex flex-col rounded-2xl border border-border/60 bg-foreground/[0.01] p-6 text-left transition hover:border-foreground/20 hover:bg-foreground/[0.03]"
          >
            <Star className="mb-3 h-5 w-5 text-foreground/50" />
            <p className="font-semibold">Générateur d&apos;avis</p>
            <p className="mt-1 text-sm text-muted-foreground">Générer des avis clients CSV</p>
          </button>
        </div>
      </div>
    </div>
  );
}
