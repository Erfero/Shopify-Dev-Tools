"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowLeft, Download, LogIn, LogOut as LogOutIcon, Paintbrush, RefreshCw, Star, UserPlus, User } from "lucide-react";
import { getUser, logout } from "@/lib/auth";
import { apiFetch } from "@/lib/api-fetch";
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

function StatCard({ label, value, icon, onClick, active }: {
  label: string; value: number | null; icon: React.ReactNode; onClick?: () => void; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group w-full rounded-2xl border px-5 py-4 text-left transition
        ${active
          ? "border-foreground/30 bg-foreground/[0.05] ring-1 ring-foreground/10"
          : "border-border/60 hover:border-foreground/20 hover:bg-foreground/[0.02]"
        }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value ?? "—"}</p>
        </div>
        <div className="mt-1 opacity-40 transition group-hover:opacity-60">{icon}</div>
      </div>
    </button>
  );
}

// Map filter key → actions to fetch from server
const FILTER_ACTIONS: Record<string, string[]> = {
  all:       [],  // no filter = all actions
  themes:    ["theme_generate"],
  csv:       ["csv_generate"],
  downloads: ["theme_download", "csv_download"],
};

// Actions counted for "Actions totales" stat
const TOTAL_ACTIONS = ["login", "logout", "theme_generate", "theme_download", "csv_generate", "csv_download", "register"];

const PAGE_SIZE = 20;

export default function DashboardPage() {
  const router = useRouter();
  const user = typeof window !== "undefined" ? getUser() : null;
  const [logs, setLogs] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  // Counts from a separate "totals" fetch (no pagination, limited to relevant actions)
  const [totalCounts, setTotalCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    fetchTotals();
    fetchLogs(0, filter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchTotals() {
    try {
      // Fetch a large slice to count totals; server filters to relevant actions
      const params = new URLSearchParams({ limit: "500", offset: "0" });
      for (const a of TOTAL_ACTIONS) params.append("actions", a);
      const res = await apiFetch(`${API_BASE}/api/admin/my-activity?${params}`);
      if (res.ok) {
        const data: ActivityEntry[] = await res.json();
        const counts: Record<string, number> = {};
        for (const entry of data) {
          counts[entry.action] = (counts[entry.action] ?? 0) + 1;
        }
        setTotalCounts(counts);
      }
    } catch { /* handled */ }
  }

  async function fetchLogs(p: number, currentFilter: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE + 1),
        offset: String(p * PAGE_SIZE),
      });
      const actions = FILTER_ACTIONS[currentFilter] ?? [];
      for (const a of actions) params.append("actions", a);

      const res = await apiFetch(`${API_BASE}/api/admin/my-activity?${params}`);
      if (res.ok) {
        const data: ActivityEntry[] = await res.json();
        setHasMore(data.length > PAGE_SIZE);
        setLogs(data.slice(0, PAGE_SIZE));
        setPage(p);
      }
    } catch {
      // 401 handled by apiFetch
    } finally {
      setLoading(false);
    }
  }

  function changeFilter(newFilter: string) {
    setFilter(newFilter);
    fetchLogs(0, newFilter);
  }

  const themesGenerated = totalCounts?.["theme_generate"] ?? null;
  const csvGenerated    = totalCounts?.["csv_generate"] ?? null;
  const downloads       = totalCounts
    ? (totalCounts["theme_download"] ?? 0) + (totalCounts["csv_download"] ?? 0)
    : null;
  const totalAll        = totalCounts
    ? Object.values(totalCounts).reduce((s, v) => s + v, 0)
    : null;

  const filterLabel: Record<string, string> = {
    themes: "Thèmes", csv: "Avis", downloads: "Téléchargements",
  };

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
              <h1 className="text-base font-semibold leading-none">{user?.display_name || "Mon historique"}</h1>
              <p className="mt-0.5 text-xs text-muted-foreground hidden sm:block">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLogs(page, filter)}
              disabled={loading}
              className="flex items-center justify-center rounded-xl border border-border bg-background p-2 shadow-sm transition hover:bg-muted disabled:opacity-40"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => router.push("/profile")}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-muted"
            >
              <User className="h-3.5 w-3.5" /><span className="hidden sm:inline">Profil</span>
            </button>
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-muted"
            >
              <ArrowLeft className="h-3.5 w-3.5" /><span className="hidden sm:inline">Accueil</span>
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background shadow-sm transition hover:opacity-80"
            >
              <LogOutIcon className="h-3.5 w-3.5 sm:hidden" /><span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Welcome */}
        <div>
          <h2 className="text-xl font-semibold">Bonjour{user?.display_name ? `, ${user.display_name}` : ""} 👋</h2>
          <p className="mt-1 text-sm text-muted-foreground">Voici un résumé de votre activité sur Shopify Dev Tools.</p>
        </div>

        {/* Stats — cliquer pour filtrer le journal */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Actions totales"  value={totalAll}        icon={<Activity className="h-5 w-5" />}
            active={filter === "all"} onClick={() => changeFilter("all")} />
          <StatCard label="Thèmes générés"   value={themesGenerated} icon={<Paintbrush className="h-5 w-5" />}
            active={filter === "themes"} onClick={() => changeFilter(filter === "themes" ? "all" : "themes")} />
          <StatCard label="Avis générés"     value={csvGenerated}    icon={<Star className="h-5 w-5" />}
            active={filter === "csv"} onClick={() => changeFilter(filter === "csv" ? "all" : "csv")} />
          <StatCard label="Téléchargements"  value={downloads}       icon={<Download className="h-5 w-5" />}
            active={filter === "downloads"} onClick={() => changeFilter(filter === "downloads" ? "all" : "downloads")} />
        </div>

        {/* Activity log */}
        <div className="overflow-hidden rounded-2xl border border-border/60">
          <div className="flex items-center justify-between border-b border-border/60 bg-foreground/[0.02] px-5 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Journal d&apos;activité</h3>
              {filter !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-2.5 py-0.5 text-xs font-medium">
                  {filterLabel[filter] ?? filter}
                  <button onClick={() => changeFilter("all")} className="ml-0.5 opacity-60 hover:opacity-100 transition" aria-label="Effacer le filtre">✕</button>
                </span>
              )}
            </div>
            {(filter === "themes" || filter === "csv") && (
              <button
                onClick={() => router.push(filter === "themes" ? "/theme" : "/reviews")}
                className="text-xs text-muted-foreground transition hover:text-foreground"
              >
                Gérer →
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Chargement…</div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {filter !== "all" ? "Aucune action dans cette catégorie." : "Aucune activité enregistrée pour votre compte."}
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between px-5 py-3 transition hover:bg-foreground/[0.01]">
                  <div className="flex min-w-0 items-center gap-3">
                    <ActionBadge action={log.action} />
                    {log.details && (() => {
                      try {
                        const d = JSON.parse(log.details!);
                        const detail = d.store_name ?? d.product ?? d.filename ?? null;
                        return detail ? <span className="max-w-[200px] truncate text-xs text-muted-foreground">{detail}</span> : null;
                      } catch { return <span className="max-w-[200px] truncate text-xs text-muted-foreground">{log.details}</span>; }
                    })()}
                  </div>
                  <span className="ml-4 shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Pagination — always shown */}
          {!loading && (page > 0 || hasMore) && (
            <div className="flex items-center justify-between border-t border-border/40 px-5 py-3">
              <button disabled={page === 0} onClick={() => fetchLogs(page - 1, filter)}
                className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-30">
                ← Précédent
              </button>
              <span className="text-xs text-muted-foreground">Page {page + 1}</span>
              <button disabled={!hasMore} onClick={() => fetchLogs(page + 1, filter)}
                className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-30">
                Suivant →
              </button>
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
