"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Layers, Loader2, CheckCircle } from "lucide-react";
import { API_BASE } from "@/lib/config";
import { setToken, setUser } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Erreur lors de la création du compte.");
        return;
      }
      // Admin auto-approuvé → token direct
      if (data.access_token) {
        setToken(data.access_token);
        setUser({ email, is_admin: data.is_admin });
        router.replace("/");
      } else {
        // Compte créé mais en attente d'approbation
        setPending(true);
      }
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  if (pending) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500/10 border border-green-500/20">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
          </div>
          <h1 className="text-xl font-semibold">Compte créé !</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Votre compte est en attente d&apos;approbation par l&apos;administrateur.
            Vous recevrez l&apos;accès dès qu&apos;il aura validé votre demande.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm font-medium text-foreground hover:underline"
          >
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/[0.05] border border-border/60">
            <Layers className="h-6 w-6 text-foreground/70" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Créer un compte</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Shopify Dev Tools</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              className="w-full rounded-xl border border-border/60 bg-foreground/[0.02] px-3.5 py-2.5 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Mot de passe</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 caractères"
              className="w-full rounded-xl border border-border/60 bg-foreground/[0.02] px-3.5 py-2.5 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Confirmer le mot de passe</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-border/60 bg-foreground/[0.02] px-3.5 py-2.5 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-2.5 text-sm text-red-500">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Créer mon compte
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Déjà un compte ?{" "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
