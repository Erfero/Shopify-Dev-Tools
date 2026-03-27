"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, CheckCircle, XCircle, Trash2, LogOut, ShieldCheck,
  Clock, Users, UserCheck, RefreshCw, ArrowLeft, Activity,
  BarChart3, Paintbrush, Star, Download, LogIn, UserPlus, Wifi,
  Crown,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { API_BASE } from "@/lib/config";
import { getUser, logout } from "@/lib/auth";
import { apiFetch } from "@/lib/api-fetch";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

// ── Types ─────────────────────────────────────────────────────────────────────

interface User { id: string; email: string; is_approved: boolean; is_admin: boolean; created_at: string; display_name: string; }
interface ActivityEntry { id: number; user_email: string; display_name: string; action: string; details: string | null; ip_address: string | null; created_at: string; }
interface Stats {
  by_action: Record<string, number>;
  by_day: { date: string; count: number }[];
  top_users: { email: string; count: number; display_name: string }[];
  active_users: string[];
  themes_by_user: { email: string; count: number; display_name: string }[];
  csv_by_user: { email: string; count: number; display_name: string }[];
  themes_by_language: { language: string; count: number }[];
  reviews_by_language: { language: string; count: number }[];
  total: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  login:          { label: "Connexion",            icon: <LogIn className="h-3.5 w-3.5" />,    color: "text-blue-500 bg-blue-500/10" },
  register:       { label: "Inscription",          icon: <UserPlus className="h-3.5 w-3.5" />, color: "text-purple-500 bg-purple-500/10" },
  theme_generate: { label: "Thème généré",         icon: <Paintbrush className="h-3.5 w-3.5" />, color: "text-green-600 bg-green-500/10" },
  theme_download: { label: "Thème téléchargé",     icon: <Download className="h-3.5 w-3.5" />, color: "text-emerald-600 bg-emerald-500/10" },
  csv_generate:   { label: "CSV généré",           icon: <Star className="h-3.5 w-3.5" />,     color: "text-amber-600 bg-amber-500/10" },
  csv_download:   { label: "CSV téléchargé",       icon: <Download className="h-3.5 w-3.5" />, color: "text-orange-600 bg-orange-500/10" },
};

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#3b82f6", "#ec4899", "#14b8a6"];

function ActionBadge({ action }: { action: string }) {
  const meta = ACTION_LABELS[action] ?? { label: action, icon: <Activity className="h-3.5 w-3.5" />, color: "text-foreground/60 bg-foreground/10" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
      {meta.icon}{meta.label}
    </span>
  );
}

function StatCard({ label, value, sub, icon, highlight }: { label: string; value: number | string; sub?: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border px-5 py-4 ${highlight ? "border-amber-500/30 bg-amber-500/5" : "border-border/60"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className="mt-1 opacity-50">{icon}</div>
      </div>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = "overview" | "activity" | "users";

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [users, setUsers] = useState<User[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [activityPage, setActivityPage] = useState(0);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean; title: string; description?: string; variant?: "danger" | "warning"; onConfirm: () => void;
  }>({ open: false, title: "", onConfirm: () => {} });

  const currentUser = getUser();
  const ACTIVITY_PAGE_SIZE = 6;

  const fetchAll = useCallback(async (page = 0) => {
    setLoading(true);

    await Promise.allSettled([
      // ── Users ──────────────────────────────────────────────────────────
      apiFetch(`${API_BASE}/api/auth/users`)
        .then(async r => {
          if (r.ok) { setUsers(await r.json()); }
          else {
            const e = await r.json().catch(() => ({}));
            toast.error(`Utilisateurs (${r.status}): ${e.detail ?? "Erreur serveur"}`);
          }
        })
        .catch(() => toast.error("Impossible de joindre le serveur (utilisateurs).")),

      // ── Activity ────────────────────────────────────────────────────────
      apiFetch(`${API_BASE}/api/admin/activity?limit=${ACTIVITY_PAGE_SIZE + 1}&offset=${page * ACTIVITY_PAGE_SIZE}`)
        .then(async r => {
          if (r.ok) {
            const data: ActivityEntry[] = await r.json();
            setActivityHasMore(data.length > ACTIVITY_PAGE_SIZE);
            setActivity(data.slice(0, ACTIVITY_PAGE_SIZE));
            setActivityPage(page);
          } else {
            const e = await r.json().catch(() => ({}));
            toast.error(`Activité (${r.status}): ${e.detail ?? "Erreur serveur"}`);
          }
        })
        .catch(() => toast.error("Impossible de joindre le serveur (activité).")),

      // ── Stats ───────────────────────────────────────────────────────────
      apiFetch(`${API_BASE}/api/admin/stats`)
        .then(async r => {
          if (r.ok) { setStats(await r.json()); }
          else {
            const e = await r.json().catch(() => ({}));
            toast.error(`Stats (${r.status}): ${e.detail ?? "Erreur serveur"}`);
          }
        })
        .catch(() => toast.error("Impossible de joindre le serveur (stats).")),
    ]);

    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentUser?.is_admin) { router.replace("/"); return; }
    fetchAll(0);
    const interval = setInterval(() => fetchAll(activityPage), 30_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.is_admin, fetchAll, router]);

  async function handleApprove(id: string) {
    setActionId(id);
    await apiFetch(`${API_BASE}/api/auth/users/${id}/approve`, { method: "PATCH" });
    toast.success("Accès accordé.");
    await fetchAll(activityPage); setActionId(null);
  }
  async function handleReject(id: string) {
    setActionId(id);
    await apiFetch(`${API_BASE}/api/auth/users/${id}/reject`, { method: "PATCH" });
    toast.success("Accès révoqué.");
    await fetchAll(activityPage); setActionId(null);
  }
  function handleDelete(id: string) {
    const u = users.find(u => u.id === id);
    setConfirmModal({
      open: true,
      title: "Supprimer ce compte ?",
      description: `Le compte "${u?.display_name || u?.email}" sera définitivement supprimé. Cette action est irréversible.`,
      variant: "danger",
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false }));
        setActionId(id);
        try {
          const res = await apiFetch(`${API_BASE}/api/auth/users/${id}`, { method: "DELETE" });
          if (!res.ok) { const d = await res.json(); toast.error(d.detail); }
          else toast.success("Compte supprimé.");
        } catch { /* apiFetch handles 401 */ }
        await fetchAll(activityPage); setActionId(null);
      },
    });
  }
  function handlePromote(id: string) {
    const u = users.find(u => u.id === id);
    setConfirmModal({
      open: true,
      title: "Promouvoir en administrateur ?",
      description: `"${u?.display_name || u?.email}" aura accès à toutes les données et pourra gérer les accès.`,
      variant: "warning",
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false }));
        setActionId(id);
        await apiFetch(`${API_BASE}/api/auth/users/${id}/promote`, { method: "PATCH" });
        toast.success("Utilisateur promu administrateur.");
        await fetchAll(activityPage); setActionId(null);
      },
    });
  }
  function handleDemote(id: string) {
    const u = users.find(u => u.id === id);
    setConfirmModal({
      open: true,
      title: "Retirer le rôle admin ?",
      description: `"${u?.display_name || u?.email}" redeviendra un utilisateur standard.`,
      variant: "warning",
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false }));
        setActionId(id);
        try {
          const res = await apiFetch(`${API_BASE}/api/auth/users/${id}/demote`, { method: "PATCH" });
          if (!res.ok) { const d = await res.json(); toast.error(d.detail); }
          else toast.success("Rôle admin retiré.");
        } catch { /* apiFetch handles 401 */ }
        await fetchAll(activityPage); setActionId(null);
      },
    });
  }

  const admins   = users.filter(u => u.is_admin);
  const pending  = users.filter(u => !u.is_approved && !u.is_admin);
  const approved = users.filter(u => u.is_approved && !u.is_admin);

  const activeUserNames = stats
    ? stats.active_users.map(email => {
        const u = users.find(u => u.email === email);
        return u?.display_name || email.split("@")[0];
      }).join(", ")
    : "";

  const pieData = stats ? Object.entries(stats.by_action).map(([name, value]) => ({
    name: ACTION_LABELS[name]?.label ?? name, value,
  })) : [];

  return (
    <>
    <ConfirmModal
      open={confirmModal.open}
      title={confirmModal.title}
      description={confirmModal.description}
      variant={confirmModal.variant}
      confirmLabel="Confirmer"
      onConfirm={confirmModal.onConfirm}
      onCancel={() => setConfirmModal(m => ({ ...m, open: false }))}
    />
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/90 backdrop-blur-sm px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-foreground/[0.05]">
              <ShieldCheck className="h-4.5 w-4.5 text-foreground/70" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none">Dashboard Admin</h1>
              <p className="mt-0.5 text-xs text-muted-foreground hidden sm:block">{currentUser?.email}</p>
            </div>
            {stats && (
              <span className="hidden sm:flex ml-2 items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600">
                <Wifi className="h-3 w-3" />
                {stats.active_users.length} actif{stats.active_users.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => fetchAll(activityPage)} disabled={loading} className="flex items-center justify-center rounded-xl border border-border bg-background p-2 shadow-sm transition hover:bg-muted disabled:opacity-40">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={() => router.push("/")} className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-muted">
              <ArrowLeft className="h-3.5 w-3.5" /><span className="hidden sm:inline">Retour</span>
            </button>
            <button onClick={logout} className="flex items-center gap-1.5 rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background shadow-sm transition hover:opacity-80">
              <LogOut className="h-3.5 w-3.5" /><span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 rounded-2xl border border-border/60 bg-foreground/[0.02] p-1 w-full sm:w-fit overflow-x-auto no-scrollbar">
          {([
            ["overview" as Tab, <BarChart3 className="h-4 w-4" />, "Aperçu"],
            ["activity" as Tab, <Activity className="h-4 w-4" />, "Activité"],
            ["users" as Tab, <Users className="h-4 w-4" />, <span className="flex items-center gap-1">Utilisateurs{pending.length > 0 && <span className="inline-flex items-center justify-center h-4 min-w-[1rem] rounded-full bg-amber-500 text-white text-[10px] font-bold px-1">{pending.length}</span>}</span>],
          ] as [Tab, React.ReactNode, React.ReactNode][]).map(([id, icon, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 sm:px-4 py-2 text-sm font-medium transition whitespace-nowrap ${tab === id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        {loading && !stats && activity.length === 0 && users.length === 0 ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* ── TAB APERÇU ─────────────────────────────────────────────── */}
            {tab === "overview" && !stats && !loading && (
              <div className="rounded-2xl border border-dashed border-border/60 py-16 text-center text-sm text-muted-foreground">
                Impossible de charger les statistiques. Vérifiez la console ou les toasts d&apos;erreur ci-dessus.
              </div>
            )}
            {tab === "overview" && stats && (
              <div className="space-y-6">
                {/* Stat cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label="Actions totales"       value={stats.total}                      icon={<Activity className="h-5 w-5" />} />
                  <StatCard label="Thèmes générés"        value={stats.by_action.theme_generate ?? 0} icon={<Paintbrush className="h-5 w-5" />} />
                  <StatCard label="CSV générés"           value={stats.by_action.csv_generate ?? 0}   icon={<Star className="h-5 w-5" />} />
                  <StatCard label="Actifs maintenant"     value={stats.active_users.length}        icon={<Wifi className="h-5 w-5" />} highlight={stats.active_users.length > 0}
                    sub={stats.active_users.length > 0 ? `🛜 ${activeUserNames}` : "Personne en ce moment"} />
                </div>

                {/* Charts row 1: activity over time */}
                <div className="rounded-2xl border border-border/60 p-5">
                  <h2 className="mb-4 text-sm font-semibold">Activité des 14 derniers jours</h2>
                  {stats.by_day.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Pas encore de données</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={stats.by_day} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid hsl(var(--border))" }}
                          cursor={{ fill: "hsl(var(--border))", opacity: 0.5 }}
                          labelFormatter={d => `Le ${d}`}
                          formatter={(v: number) => [v, "actions"]}
                        />
                        <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Charts row 2: top users + répartition */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/60 p-5">
                    <h2 className="mb-4 text-sm font-semibold">Top utilisateurs</h2>
                    {stats.top_users.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">Pas encore de données</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={stats.top_users} layout="vertical">
                          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                          <YAxis type="category" dataKey="display_name" tick={{ fontSize: 10 }} width={120} />
                          <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [v, "actions"]} />
                          <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  <div className="rounded-2xl border border-border/60 p-5">
                    <h2 className="mb-4 text-sm font-semibold">Répartition des actions</h2>
                    {pieData.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">Pas encore de données</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={65} innerRadius={30}>
                            {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid hsl(var(--border))" }} formatter={(v: number, name: string) => [v, name]} />
                          <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 4 }} formatter={(value) => <span style={{ color: "hsl(var(--muted-foreground))" }}>{value}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Thèmes et CSV par utilisateur */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/60 p-5">
                    <h2 className="mb-3 text-sm font-semibold flex items-center gap-1.5"><Paintbrush className="h-4 w-4" /> Thèmes par utilisateur</h2>
                    {stats.themes_by_user.length === 0 ? <p className="text-sm text-muted-foreground">Aucune génération</p> : (
                      <div className="space-y-2">
                        {stats.themes_by_user.map(u => {
                          const max = stats.themes_by_user[0]?.count ?? 1;
                          return (
                            <div key={u.email}>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="truncate font-medium">{u.display_name}</span>
                                <span className="ml-2 shrink-0 text-xs text-muted-foreground">{u.count}</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                                <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${Math.round((u.count / max) * 100)}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="rounded-2xl border border-border/60 p-5">
                    <h2 className="mb-3 text-sm font-semibold flex items-center gap-1.5"><Star className="h-4 w-4" /> CSV avis par utilisateur</h2>
                    {stats.csv_by_user.length === 0 ? <p className="text-sm text-muted-foreground">Aucune génération</p> : (
                      <div className="space-y-2">
                        {stats.csv_by_user.map(u => {
                          const max = stats.csv_by_user[0]?.count ?? 1;
                          return (
                            <div key={u.email}>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="truncate font-medium">{u.display_name}</span>
                                <span className="ml-2 shrink-0 text-xs text-muted-foreground">{u.count}</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                                <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${Math.round((u.count / max) * 100)}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Language breakdowns */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <LanguageBreakdown
                    title="Langues — Theme Customizer"
                    icon={<Paintbrush className="h-4 w-4" />}
                    data={stats.themes_by_language}
                    total={stats.by_action.theme_generate ?? 0}
                    color="#22c55e"
                  />
                  <LanguageBreakdown
                    title="Langues — Loox Reviews"
                    icon={<Star className="h-4 w-4" />}
                    data={stats.reviews_by_language}
                    total={stats.by_action.csv_generate ?? 0}
                    color="#f59e0b"
                  />
                </div>

                {/* Summary text */}
                <div className="rounded-2xl border border-border/60 bg-foreground/[0.01] p-5">
                  <h2 className="mb-3 text-sm font-semibold">Résumé</h2>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Thèmes générés</p>
                      <p className="font-semibold">{stats.by_action.theme_generate ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Thèmes téléchargés</p>
                      <p className="font-semibold">{stats.by_action.theme_download ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CSV générés</p>
                      <p className="font-semibold">{stats.by_action.csv_generate ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CSV téléchargés</p>
                      <p className="font-semibold">{stats.by_action.csv_download ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Inscriptions</p>
                      <p className="font-semibold">{stats.by_action.register ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Connexions</p>
                      <p className="font-semibold">{stats.by_action.login ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Utilisateurs actifs</p>
                      <p className="font-semibold">{stats.active_users.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total actions</p>
                      <p className="font-semibold">{stats.total}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB ACTIVITÉ ───────────────────────────────────────────── */}
            {tab === "activity" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Toutes les actions en temps réel — actualisé toutes les 30 secondes.</p>
                {activity.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 py-16 text-center text-sm text-muted-foreground">
                    Aucune activité enregistrée
                  </div>
                ) : (
                  <>
                  <div className="rounded-2xl border border-border/60 overflow-hidden">
                    <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/60 bg-foreground/[0.02] text-xs text-muted-foreground">
                          <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Utilisateur</th>
                          <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Action</th>
                          <th className="px-4 py-3 text-left font-medium hidden sm:table-cell whitespace-nowrap">Détails</th>
                          <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Date & heure</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {activity.map(a => (
                          <tr key={a.id} className="hover:bg-foreground/[0.01] transition">
                            <td className="px-4 py-2.5">
                              <p className="font-medium text-sm whitespace-nowrap">{a.display_name || a.user_email.split("@")[0]}</p>
                              <p className="text-xs text-muted-foreground whitespace-nowrap">{a.user_email}</p>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap"><ActionBadge action={a.action} /></td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs hidden sm:table-cell max-w-[200px] truncate">
                              {a.details ? (() => { try { const d = JSON.parse(a.details!); return d.store_name ?? d.product ?? d.filename ?? a.details; } catch { return a.details; } })() : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(a.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                  {/* Pagination */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      disabled={activityPage === 0}
                      onClick={() => fetchAll(activityPage - 1)}
                      className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-muted disabled:opacity-30"
                    >
                      ← Précédent
                    </button>
                    <span className="text-xs text-muted-foreground">Page {activityPage + 1}</span>
                    <button
                      disabled={!activityHasMore}
                      onClick={() => fetchAll(activityPage + 1)}
                      className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-muted disabled:opacity-30"
                    >
                      Suivant →
                    </button>
                  </div>
                  </>
                )}
              </div>
            )}

            {/* ── TAB UTILISATEURS ───────────────────────────────────────── */}
            {tab === "users" && (
              <div className="space-y-6">
                {/* Explication */}
                <div className="rounded-2xl border border-border/60 bg-foreground/[0.01] px-5 py-4 text-sm text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground">Comment ça fonctionne : </span>
                  Après inscription, un utilisateur est <span className="text-amber-600 font-medium">en attente</span>. Donne-lui l&apos;accès pour qu&apos;il puisse utiliser les outils. Tu peux le <span className="text-purple-600 font-medium">promouvoir Admin</span> pour qu&apos;il puisse aussi gérer les accès, <span className="text-amber-600 font-medium">révoquer</span> son accès, ou <span className="text-red-500 font-medium">supprimer</span> définitivement son compte.
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label="En attente" value={pending.length} icon={<Clock className="h-5 w-5" />} highlight={pending.length > 0} />
                  <StatCard label="Utilisateurs actifs" value={approved.length} icon={<UserCheck className="h-5 w-5" />} />
                  <StatCard label="Administrateurs" value={admins.length} icon={<Crown className="h-5 w-5" />} />
                  <StatCard label="Total comptes" value={users.length} icon={<Users className="h-5 w-5" />} />
                </div>

                {/* Admins */}
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <Crown className="h-4 w-4 text-purple-500" />
                    <h2 className="text-sm font-semibold">Administrateurs</h2>
                    <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-600">{admins.length}</span>
                  </div>
                  <div className="space-y-2">
                    {admins.map(u => (
                      <UserRow key={u.id} user={u} actionId={actionId} currentUserId={currentUser?.email ?? ""}
                        onApprove={handleApprove} onReject={handleReject} onDelete={handleDelete}
                        onPromote={handlePromote} onDemote={handleDemote} />
                    ))}
                  </div>
                </section>

                {/* Pending */}
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <h2 className="text-sm font-semibold">En attente d&apos;approbation</h2>
                    {pending.length > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600">{pending.length}</span>}
                  </div>
                  {pending.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border/60 py-6 text-center text-sm text-muted-foreground">Aucune demande en attente</p>
                  ) : (
                    <div className="space-y-2">
                      {pending.map(u => (
                        <UserRow key={u.id} user={u} actionId={actionId} currentUserId={currentUser?.email ?? ""}
                          onApprove={handleApprove} onReject={handleReject} onDelete={handleDelete}
                          onPromote={handlePromote} onDemote={handleDemote} />
                      ))}
                    </div>
                  )}
                </section>

                {/* Approved users */}
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-green-500" />
                    <h2 className="text-sm font-semibold">Utilisateurs avec accès</h2>
                    {approved.length > 0 && <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-600">{approved.length}</span>}
                  </div>
                  {approved.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border/60 py-6 text-center text-sm text-muted-foreground">Aucun utilisateur approuvé</p>
                  ) : (
                    <div className="space-y-2">
                      {approved.map(u => (
                        <UserRow key={u.id} user={u} actionId={actionId} currentUserId={currentUser?.email ?? ""}
                          onApprove={handleApprove} onReject={handleReject} onDelete={handleDelete}
                          onPromote={handlePromote} onDemote={handleDemote} />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </div>
    </>
  );
}

// ── LanguageBreakdown component ───────────────────────────────────────────────

function LanguageBreakdown({ title, icon, data, total, color }: {
  title: string; icon: React.ReactNode;
  data: { language: string; count: number }[];
  total: number; color: string;
}) {
  const max = data.length > 0 ? data[0].count : 1;
  return (
    <div className="rounded-2xl border border-border/60 p-5">
      <h2 className="mb-3 text-sm font-semibold flex items-center gap-1.5">{icon} {title}</h2>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune donnée</p>
      ) : (
        <div className="space-y-2">
          {data.map(({ language, count }) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={language}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium truncate">{language}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">{count} ({pct}%)</span>
                </div>
                <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((count / max) * 100)}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── UserRow component ─────────────────────────────────────────────────────────

function UserRow({ user, actionId, currentUserId, onApprove, onReject, onDelete, onPromote, onDemote }: {
  user: User; actionId: string | null; currentUserId: string;
  onApprove: (id: string) => void; onReject: (id: string) => void; onDelete: (id: string) => void;
  onPromote: (id: string) => void; onDemote: (id: string) => void;
}) {
  const isSelf = user.email === currentUserId;
  const isLoading = actionId === user.id;

  return (
    <div className={`flex items-center justify-between rounded-xl border px-4 py-3 transition hover:bg-foreground/[0.03] ${user.is_admin ? "border-purple-500/20 bg-purple-500/[0.02]" : "border-border/60 bg-foreground/[0.01]"}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{user.display_name || user.email.split("@")[0]}</p>
          {user.is_admin && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-600">
              <Crown className="h-3 w-3" /> Admin{isSelf ? " (vous)" : ""}
            </span>
          )}
          {!user.is_admin && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.is_approved ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"}`}>
              {user.is_approved ? "Accès accordé" : "En attente"}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground truncate">{user.email}</p>
        <p className="text-xs text-muted-foreground/60">
          Inscrit le {new Date(user.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="ml-2 sm:ml-4 flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            {/* Admin actions */}
            {user.is_admin && !isSelf && (
              <button onClick={() => onDemote(user.id)} className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-purple-600 transition hover:bg-purple-500/15">
                <Crown className="h-3.5 w-3.5 opacity-50" /><span className="hidden sm:inline">Retirer </span>admin
              </button>
            )}

            {/* Regular user actions */}
            {!user.is_admin && (
              <>
                {!user.is_approved ? (
                  <button onClick={() => onApprove(user.id)} className="flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-green-600 transition hover:bg-green-500/15">
                    <CheckCircle className="h-3.5 w-3.5" /><span className="hidden sm:inline">Donner l&apos;</span>accès
                  </button>
                ) : (
                  <>
                    <button onClick={() => onPromote(user.id)} className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-purple-600 transition hover:bg-purple-500/15">
                      <Crown className="h-3.5 w-3.5" /><span className="hidden sm:inline">Promouvoir </span>Admin
                    </button>
                    <button onClick={() => onReject(user.id)} className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-amber-600 transition hover:bg-amber-500/15">
                      <XCircle className="h-3.5 w-3.5" /> Révoquer
                    </button>
                  </>
                )}
              </>
            )}

            {/* Delete — everyone except self */}
            {!isSelf && (
              <button onClick={() => onDelete(user.id)} className="flex items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 p-1.5 text-red-500 transition hover:bg-red-500/15" title="Supprimer le compte">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
