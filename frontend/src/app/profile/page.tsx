"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, User, KeyRound, CheckCircle2, Loader2, Eye, EyeOff } from "lucide-react";
import { getUser, setUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api-fetch";
import { toast } from "sonner";
import { API_BASE } from "@/lib/config";

export default function ProfilePage() {
  const router = useRouter();
  const currentUser = getUser();

  const [displayName, setDisplayName] = useState(currentUser?.display_name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loadingName, setLoadingName] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) { toast.error("Le nom ne peut pas être vide."); return; }
    setLoadingName(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.detail ?? "Erreur."); return; }
      if (currentUser) setUser({ ...currentUser, display_name: data.display_name });
      toast.success("Nom mis à jour !");
    } catch { /* apiFetch handles 401 */ } finally {
      setLoadingName(false);
    }
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error("Les mots de passe ne correspondent pas."); return; }
    if (newPassword.length < 6) { toast.error("Le mot de passe doit contenir au moins 6 caractères."); return; }
    setLoadingPassword(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.detail ?? "Erreur."); return; }
      toast.success("Mot de passe mis à jour !");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch { /* apiFetch handles 401 */ } finally {
      setLoadingPassword(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/90 backdrop-blur-sm px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-foreground/5">
              <User className="h-4 w-4 text-foreground/70" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none">Mon profil</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">{currentUser?.email}</p>
            </div>
          </div>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-muted"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Retour
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Display name */}
        <div className="overflow-hidden rounded-2xl border border-border/60">
          <div className="flex items-center gap-2 border-b border-border/60 bg-foreground/[0.02] px-5 py-3">
            <User className="h-4 w-4 text-foreground/60" />
            <h2 className="text-sm font-semibold">Nom affiché</h2>
          </div>
          <form onSubmit={handleSaveName} className="px-5 py-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nom ou pseudo</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Votre nom affiché"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none ring-0 transition focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Utilisé dans le journal d&apos;activité et les statistiques.
              </p>
            </div>
            <button
              type="submit"
              disabled={loadingName}
              className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-80 disabled:opacity-50"
            >
              {loadingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Enregistrer
            </button>
          </form>
        </div>

        {/* Password */}
        <div className="overflow-hidden rounded-2xl border border-border/60">
          <div className="flex items-center gap-2 border-b border-border/60 bg-foreground/[0.02] px-5 py-3">
            <KeyRound className="h-4 w-4 text-foreground/60" />
            <h2 className="text-sm font-semibold">Changer le mot de passe</h2>
          </div>
          <form onSubmit={handleSavePassword} className="px-5 py-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Mot de passe actuel</label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 pr-10 text-sm outline-none ring-0 transition focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
                />
                <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 pr-10 text-sm outline-none ring-0 transition focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
                />
                <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Confirmer le nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 pr-10 text-sm outline-none ring-0 transition focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loadingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-80 disabled:opacity-50"
            >
              {loadingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Mettre à jour
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
