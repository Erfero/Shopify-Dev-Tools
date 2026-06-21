"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, KeyRound, Eye, EyeOff } from "lucide-react";
import { API_BASE } from "@/lib/config";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: code.toUpperCase(), new_password: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Code invalide ou expiré. Refaites une demande.");
        return;
      }
      setDone(true);
      setTimeout(() => router.replace("/login"), 3000);
    } catch {
      setError("Impossible de contacter le serveur. Réessayez dans quelques instants.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500/10 border border-green-500/20">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
          </div>
          <h1 className="text-xl font-semibold">Mot de passe réinitialisé !</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Vous allez être redirigé vers la page de connexion…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/[0.05] border border-border/60">
            <KeyRound className="h-6 w-6 text-foreground/70" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Nouveau mot de passe</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Entrez le code à 6 caractères reçu de l&apos;administrateur
          </p>
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
            <label className="mb-1.5 block text-sm font-medium">Code de réinitialisation</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex: A1B2C3"
              maxLength={6}
              className="w-full rounded-xl border border-border/60 bg-foreground/[0.02] px-3.5 py-2.5 text-sm font-mono outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10 tracking-widest text-center"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Nouveau mot de passe</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
                className="w-full rounded-xl border border-border/60 bg-foreground/[0.02] px-3.5 py-2.5 pr-10 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
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
            Réinitialiser le mot de passe
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Pas encore de code ?{" "}
          <Link href="/forgot-password" className="font-medium text-foreground hover:underline">
            Faire une demande
          </Link>
          {" · "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
