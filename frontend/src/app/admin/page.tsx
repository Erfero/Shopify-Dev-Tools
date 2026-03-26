"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, CheckCircle, XCircle, Trash2, LogOut,
  ShieldCheck, Clock, Users, UserCheck, RefreshCw, ArrowLeft,
} from "lucide-react";
import { API_BASE } from "@/lib/config";
import { getAuthHeaders, getUser, logout } from "@/lib/auth";

interface User {
  id: string;
  email: string;
  is_approved: boolean;
  is_admin: boolean;
  created_at: string;
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number; color: string;
}) {
  return (
    <div className={`rounded-2xl border px-5 py-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <div className="opacity-60">{icon}</div>
      </div>
    </div>
  );
}

function UserRow({ user, actionId, onApprove, onReject, onDelete }: {
  user: User;
  actionId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isLoading = actionId === user.id;

  return (
    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-foreground/[0.01] px-4 py-3 transition hover:bg-foreground/[0.03]">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{user.email}</p>
          {user.is_admin && (
            <span className="rounded-full bg-foreground/[0.08] px-2 py-0.5 text-xs font-medium text-foreground/60">
              Admin
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Inscrit le{" "}
          {new Date(user.created_at).toLocaleDateString("fr-FR", {
            day: "numeric", month: "long", year: "numeric",
          })}
        </p>
      </div>

      {!user.is_admin && (
        <div className="ml-4 flex shrink-0 items-center gap-2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              {!user.is_approved ? (
                <button
                  onClick={() => onApprove(user.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-1.5 text-xs font-medium text-green-600 transition hover:bg-green-500/15"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Donner l'accès
                </button>
              ) : (
                <button
                  onClick={() => onReject(user.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs font-medium text-amber-600 transition hover:bg-amber-500/15"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Révoquer l'accès
                </button>
              )}
              <button
                onClick={() => onDelete(user.id)}
                title="Supprimer définitivement"
                className="flex items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 p-1.5 text-red-500 transition hover:bg-red-500/15"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);

  const currentUser = getUser();

  useEffect(() => {
    if (!currentUser?.is_admin) {
      router.replace("/");
      return;
    }
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchUsers() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/users`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      setUsers(await res.json());
    } catch {
      setError("Impossible de charger les utilisateurs.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    setActionId(id);
    await fetch(`${API_BASE}/api/auth/users/${id}/approve`, { method: "PATCH", headers: getAuthHeaders() });
    await fetchUsers();
    setActionId(null);
  }

  async function handleReject(id: string) {
    setActionId(id);
    await fetch(`${API_BASE}/api/auth/users/${id}/reject`, { method: "PATCH", headers: getAuthHeaders() });
    await fetchUsers();
    setActionId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm(`Supprimer définitivement ${users.find(u => u.id === id)?.email} ?`)) return;
    setActionId(id);
    await fetch(`${API_BASE}/api/auth/users/${id}`, { method: "DELETE", headers: getAuthHeaders() });
    await fetchUsers();
    setActionId(null);
  }

  const pending = users.filter(u => !u.is_approved && !u.is_admin);
  const approved = users.filter(u => u.is_approved && !u.is_admin);
  const admins = users.filter(u => u.is_admin);

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-foreground/[0.05]">
              <ShieldCheck className="h-5 w-5 text-foreground/70" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Gestion des accès</h1>
              <p className="text-xs text-muted-foreground">Connecté en tant que {currentUser?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              disabled={loading}
              title="Rafraîchir"
              className="flex items-center justify-center rounded-xl border border-border/60 p-2 transition hover:bg-foreground/[0.04] disabled:opacity-40"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1.5 rounded-xl border border-border/60 px-3.5 py-2 text-sm transition hover:bg-foreground/[0.04]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-xl border border-border/60 px-3.5 py-2 text-sm transition hover:bg-foreground/[0.04]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Déconnexion
            </button>
          </div>
        </div>

        {/* Explication */}
        <div className="rounded-2xl border border-border/60 bg-foreground/[0.01] px-5 py-4 text-sm text-muted-foreground leading-relaxed">
          <p className="font-medium text-foreground mb-1">Comment ça fonctionne ?</p>
          Quand quelqu'un crée un compte, il est <span className="text-amber-600 font-medium">en attente</span> par défaut — il ne peut pas accéder aux outils.
          Tu dois <span className="text-green-600 font-medium">donner l'accès</span> manuellement pour qu'il puisse se connecter et utiliser l'application.
          Tu peux <span className="text-amber-600 font-medium">révoquer l'accès</span> à tout moment pour bloquer quelqu'un, ou <span className="text-red-500 font-medium">supprimer</span> son compte définitivement.
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500">
            {error}
          </div>
        )}

        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={<Clock className="h-6 w-6" />}
              label="En attente"
              value={pending.length}
              color={pending.length > 0 ? "border-amber-500/30 bg-amber-500/5" : "border-border/60"}
            />
            <StatCard
              icon={<UserCheck className="h-6 w-6" />}
              label="Accès accordé"
              value={approved.length}
              color="border-green-500/20 bg-green-500/5"
            />
            <StatCard
              icon={<Users className="h-6 w-6" />}
              label="Total comptes"
              value={users.length}
              color="border-border/60"
            />
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Section : En attente */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold">En attente d'approbation</h2>
                {pending.length > 0 && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600">
                    {pending.length}
                  </span>
                )}
              </div>
              {pending.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/60 py-6 text-center text-sm text-muted-foreground">
                  Aucune demande en attente
                </p>
              ) : (
                <div className="space-y-2">
                  {pending.map(u => (
                    <UserRow
                      key={u.id}
                      user={u}
                      actionId={actionId}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Section : Accès accordé */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-500" />
                <h2 className="text-sm font-semibold">Accès accordé</h2>
                {approved.length > 0 && (
                  <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-600">
                    {approved.length}
                  </span>
                )}
              </div>
              {approved.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/60 py-6 text-center text-sm text-muted-foreground">
                  Aucun utilisateur approuvé
                </p>
              ) : (
                <div className="space-y-2">
                  {approved.map(u => (
                    <UserRow
                      key={u.id}
                      user={u}
                      actionId={actionId}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Section : Admins */}
            {admins.length > 0 && (
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-foreground/60" />
                  <h2 className="text-sm font-semibold">Administrateurs</h2>
                </div>
                <div className="space-y-2">
                  {admins.map(u => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between rounded-xl border border-border/60 bg-foreground/[0.01] px-4 py-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{u.email}</p>
                          <span className="rounded-full bg-foreground/[0.08] px-2 py-0.5 text-xs text-muted-foreground">Admin</span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Accès complet — ne peut pas être modifié ici
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
