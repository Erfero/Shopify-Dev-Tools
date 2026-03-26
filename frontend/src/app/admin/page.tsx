"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, XCircle, Trash2, LogOut, ShieldCheck } from "lucide-react";
import { API_BASE } from "@/lib/config";
import { getAuthHeaders, getUser, logout } from "@/lib/auth";

interface User {
  id: string;
  email: string;
  is_approved: boolean;
  is_admin: boolean;
  created_at: string;
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

  async function approve(id: string) {
    setActionId(id);
    await fetch(`${API_BASE}/api/auth/users/${id}/approve`, { method: "PATCH", headers: getAuthHeaders() });
    await fetchUsers();
    setActionId(null);
  }

  async function reject(id: string) {
    setActionId(id);
    await fetch(`${API_BASE}/api/auth/users/${id}/reject`, { method: "PATCH", headers: getAuthHeaders() });
    await fetchUsers();
    setActionId(null);
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    setActionId(id);
    await fetch(`${API_BASE}/api/auth/users/${id}`, { method: "DELETE", headers: getAuthHeaders() });
    await fetchUsers();
    setActionId(null);
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/[0.05] border border-border/60">
              <ShieldCheck className="h-5 w-5 text-foreground/70" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Panel Admin</h1>
              <p className="text-xs text-muted-foreground">{currentUser?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/")}
              className="rounded-xl border border-border/60 px-3.5 py-2 text-sm transition hover:bg-foreground/[0.04]"
            >
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

        {error && (
          <p className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {users.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">Aucun utilisateur.</p>
            )}
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-foreground/[0.01] px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{u.email}</p>
                    {u.is_admin && (
                      <span className="shrink-0 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-xs text-muted-foreground">
                        Admin
                      </span>
                    )}
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        u.is_approved
                          ? "bg-green-500/10 text-green-600"
                          : "bg-amber-500/10 text-amber-600"
                      }`}
                    >
                      {u.is_approved ? "Approuvé" : "En attente"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                </div>

                {!u.is_admin && (
                  <div className="ml-4 flex shrink-0 items-center gap-1.5">
                    {actionId === u.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        {!u.is_approved ? (
                          <button
                            onClick={() => approve(u.id)}
                            title="Approuver"
                            className="flex items-center gap-1 rounded-lg border border-green-500/30 bg-green-500/5 px-2.5 py-1.5 text-xs text-green-600 transition hover:bg-green-500/10"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Approuver
                          </button>
                        ) : (
                          <button
                            onClick={() => reject(u.id)}
                            title="Révoquer l'accès"
                            className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-xs text-amber-600 transition hover:bg-amber-500/10"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Révoquer
                          </button>
                        )}
                        <button
                          onClick={() => remove(u.id)}
                          title="Supprimer"
                          className="flex items-center justify-center rounded-lg border border-red-500/30 bg-red-500/5 p-1.5 text-red-500 transition hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
