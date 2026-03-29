"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, ShieldCheck, ArrowLeft, RefreshCw, Search,
  Crown, UserCheck, Clock, Trash2, Pencil, Eye, EyeOff,
  Paintbrush, Star, Activity, LogOut, CheckCircle, XCircle,
} from "lucide-react";
import { API_BASE } from "@/lib/config";
import { getUser, logout } from "@/lib/auth";
import { apiFetch } from "@/lib/api-fetch";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DetailedUser {
  id: string;
  email: string;
  display_name: string;
  is_approved: boolean;
  is_admin: boolean;
  created_at: string;
  last_login: string | null;
  themes: number;
  theme_downloads: number;
  csvs: number;
  csv_downloads: number;
  total_actions: number;
}

// ── EditModal ─────────────────────────────────────────────────────────────────

function EditUserModal({ user, onClose, onSave }: {
  user: DetailedUser;
  onClose: () => void;
  onSave: (data: { email?: string; display_name?: string; new_password?: string }) => Promise<void>;
}) {
  const [email, setEmail] = useState(user.email);
  const [displayName, setDisplayName] = useState(user.display_name);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const data: { email?: string; display_name?: string; new_password?: string } = {};
    if (email.trim().toLowerCase() !== user.email) data.email = email.trim();
    if (displayName.trim() !== user.display_name) data.display_name = displayName.trim();
    if (newPassword) data.new_password = newPassword;
    await onSave(data);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="mb-5 text-base font-semibold flex items-center gap-2">
          <Pencil className="h-4 w-4 text-blue-500" /> Modifier — {user.display_name || user.email}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nom affiché</label>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Nouveau mot de passe <span className="text-muted-foreground/60">(laisser vide pour ne pas changer)</span>
            </label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={newPassword}
                onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 caractères"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2 text-sm font-medium transition hover:bg-muted">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-foreground py-2 text-sm font-medium text-background transition hover:opacity-80 disabled:opacity-50">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const router = useRouter();
  const currentUser = getUser();

  const [users, setUsers] = useState<DetailedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<{ open: boolean; user: DetailedUser | null }>({ open: false, user: null });
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean; title: string; description?: string; variant?: "danger" | "warning"; onConfirm: () => void;
  }>({ open: false, title: "", onConfirm: () => {} });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`${API_BASE}/api/auth/users/detailed`);
      if (r.ok) setUsers(await r.json());
      else toast.error("Impossible de charger les utilisateurs.");
    } catch {
      toast.error("Erreur serveur.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!currentUser?.is_admin) { router.replace("/"); return; }
    fetchUsers();
  }, [currentUser?.is_admin, fetchUsers, router]);

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.display_name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleApprove(id: string) {
    setActionId(id);
    await apiFetch(`${API_BASE}/api/auth/users/${id}/approve`, { method: "PATCH" });
    toast.success("Accès accordé.");
    await fetchUsers(); setActionId(null);
  }

  async function handleReject(id: string) {
    setActionId(id);
    await apiFetch(`${API_BASE}/api/auth/users/${id}/reject`, { method: "PATCH" });
    toast.success("Accès révoqué.");
    await fetchUsers(); setActionId(null);
  }

  function handleDelete(id: string) {
    const u = users.find(u => u.id === id);
    setConfirmModal({
      open: true,
      title: "Supprimer ce compte ?",
      description: `Le compte "${u?.display_name || u?.email}" sera définitivement supprimé.`,
      variant: "danger",
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false }));
        setActionId(id);
        const res = await apiFetch(`${API_BASE}/api/auth/users/${id}`, { method: "DELETE" });
        if (!res.ok) { const d = await res.json(); toast.error(d.detail); }
        else toast.success("Compte supprimé.");
        await fetchUsers(); setActionId(null);
      },
    });
  }

  async function submitEdit(userId: string, data: { email?: string; display_name?: string; new_password?: string }) {
    const res = await apiFetch(`${API_BASE}/api/auth/users/${userId}/edit`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.detail ?? "Erreur lors de la modification.");
      return false;
    }
    toast.success("Utilisateur modifié.");
    await fetchUsers();
    return true;
  }

  function fmtDate(s: string | null) {
    if (!s) return "—";
    try { return new Date(s).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch { return s; }
  }

  function statusBadge(u: DetailedUser) {
    if (u.is_admin) return <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-600"><Crown className="h-3 w-3" />Admin</span>;
    if (u.is_approved) return <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600"><UserCheck className="h-3 w-3" />Actif</span>;
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600"><Clock className="h-3 w-3" />En attente</span>;
  }

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
      {editModal.open && editModal.user && (
        <EditUserModal
          user={editModal.user}
          onClose={() => setEditModal({ open: false, user: null })}
          onSave={async (data) => {
            const ok = await submitEdit(editModal.user!.id, data);
            if (ok) setEditModal({ open: false, user: null });
          }}
        />
      )}

      <div className="min-h-screen bg-background">
        {/* Top bar */}
        <div className="sticky top-0 z-10 border-b border-border/60 bg-background/90 backdrop-blur-sm px-4 py-3">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-foreground/[0.05]">
                <ShieldCheck className="h-4.5 w-4.5 text-foreground/70" />
              </div>
              <div>
                <h1 className="text-base font-semibold leading-none">Gestion des comptes</h1>
                <p className="mt-0.5 text-xs text-muted-foreground hidden sm:block">{users.length} compte{users.length > 1 ? "s" : ""} au total</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={fetchUsers} disabled={loading}
                className="flex items-center justify-center rounded-xl border border-border bg-background p-2 shadow-sm transition hover:bg-muted disabled:opacity-40">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button onClick={() => router.push("/admin")}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-muted">
                <ArrowLeft className="h-3.5 w-3.5" /><span className="hidden sm:inline">Dashboard</span>
              </button>
              <button onClick={logout}
                className="flex items-center gap-1.5 rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background shadow-sm transition hover:opacity-80">
                <LogOut className="h-3.5 w-3.5" /><span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-6 space-y-4">
          {/* Search bar */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Rechercher par nom ou email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total comptes", value: users.length, color: "text-foreground" },
              { label: "En attente", value: users.filter(u => !u.is_approved && !u.is_admin).length, color: "text-amber-600" },
              { label: "Actifs", value: users.filter(u => u.is_approved && !u.is_admin).length, color: "text-green-600" },
              { label: "Admins", value: users.filter(u => u.is_admin).length, color: "text-purple-600" },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border border-border/60 px-4 py-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-semibold mt-0.5 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          {loading && users.length === 0 ? (
            <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 py-16 text-center text-sm text-muted-foreground">
              {search ? "Aucun résultat pour cette recherche." : "Aucun compte enregistré."}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-foreground/[0.02] text-xs text-muted-foreground">
                      <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Utilisateur</th>
                      <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Statut</th>
                      <th className="px-4 py-3 text-left font-medium whitespace-nowrap hidden md:table-cell">Inscrit le</th>
                      <th className="px-4 py-3 text-left font-medium whitespace-nowrap hidden lg:table-cell">Dernière connexion</th>
                      <th className="px-4 py-3 text-center font-medium whitespace-nowrap hidden sm:table-cell">
                        <span className="flex items-center justify-center gap-1"><Paintbrush className="h-3.5 w-3.5" />Thèmes</span>
                      </th>
                      <th className="px-4 py-3 text-center font-medium whitespace-nowrap hidden sm:table-cell">
                        <span className="flex items-center justify-center gap-1"><Star className="h-3.5 w-3.5" />CSV</span>
                      </th>
                      <th className="px-4 py-3 text-center font-medium whitespace-nowrap hidden xl:table-cell">
                        <span className="flex items-center justify-center gap-1"><Activity className="h-3.5 w-3.5" />Actions</span>
                      </th>
                      <th className="px-4 py-3 text-right font-medium whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filtered.map(u => {
                      const isSelf = u.email === currentUser?.email;
                      const isLoading = actionId === u.id;
                      return (
                        <tr key={u.id} className={`hover:bg-foreground/[0.01] transition ${u.is_admin ? "bg-purple-500/[0.01]" : ""}`}>
                          {/* User info */}
                          <td className="px-4 py-3">
                            <p className="font-semibold text-sm whitespace-nowrap">
                              {u.display_name || u.email.split("@")[0]}
                              {isSelf && <span className="ml-1.5 text-xs text-muted-foreground font-normal">(vous)</span>}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{u.email}</p>
                            <p className="text-[10px] text-muted-foreground/50 font-mono mt-0.5 hidden xl:block">{u.id}</p>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 whitespace-nowrap">{statusBadge(u)}</td>

                          {/* Created at */}
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap hidden md:table-cell">
                            {fmtDate(u.created_at)}
                          </td>

                          {/* Last login */}
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                            {u.last_login ? fmtDate(u.last_login) : <span className="text-muted-foreground/40">Jamais</span>}
                          </td>

                          {/* Themes */}
                          <td className="px-4 py-3 text-center hidden sm:table-cell">
                            <span className="text-sm font-semibold text-green-600">{u.themes}</span>
                            {u.theme_downloads > 0 && (
                              <span className="ml-1 text-xs text-muted-foreground">({u.theme_downloads} DL)</span>
                            )}
                          </td>

                          {/* CSVs */}
                          <td className="px-4 py-3 text-center hidden sm:table-cell">
                            <span className="text-sm font-semibold text-amber-600">{u.csvs}</span>
                            {u.csv_downloads > 0 && (
                              <span className="ml-1 text-xs text-muted-foreground">({u.csv_downloads} DL)</span>
                            )}
                          </td>

                          {/* Total actions */}
                          <td className="px-4 py-3 text-center text-sm font-medium hidden xl:table-cell">
                            {u.total_actions}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              ) : (
                                <>
                                  {/* Approve / Reject */}
                                  {!u.is_admin && !u.is_approved && (
                                    <button onClick={() => handleApprove(u.id)}
                                      className="flex items-center gap-1 rounded-lg border border-green-500/30 bg-green-500/5 px-2 py-1.5 text-xs font-medium text-green-600 transition hover:bg-green-500/15 whitespace-nowrap">
                                      <CheckCircle className="h-3.5 w-3.5" /><span className="hidden sm:inline">Accès</span>
                                    </button>
                                  )}
                                  {!u.is_admin && u.is_approved && (
                                    <button onClick={() => handleReject(u.id)}
                                      className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-xs font-medium text-amber-600 transition hover:bg-amber-500/15 whitespace-nowrap">
                                      <XCircle className="h-3.5 w-3.5" /><span className="hidden sm:inline">Révoquer</span>
                                    </button>
                                  )}

                                  {/* Edit */}
                                  <button onClick={() => setEditModal({ open: true, user: u })}
                                    className="flex items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/5 p-1.5 text-blue-500 transition hover:bg-blue-500/15" title="Modifier">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>

                                  {/* Delete */}
                                  {!isSelf && (
                                    <button onClick={() => handleDelete(u.id)}
                                      className="flex items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 p-1.5 text-red-500 transition hover:bg-red-500/15" title="Supprimer">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center pt-2">
            Les mots de passe sont chiffrés en bcrypt — personne ne peut les lire, même l&apos;administrateur. Utilisez &quot;Modifier&quot; pour forcer un nouveau mot de passe.
          </p>
        </div>
      </div>
    </>
  );
}
