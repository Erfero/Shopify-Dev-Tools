"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle, Mail } from "lucide-react";
import { API_BASE } from "@/lib/config";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await fetch(`${API_BASE}/api/auth/request-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setError("Impossible de contacter le serveur. Réessayez dans quelques instants.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500/10 border border-green-500/20">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
          </div>
          <h1 className="text-xl font-semibold">Demande enregistrée</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Si un compte existe avec cet email, une demande de réinitialisation a été créée.
          </p>
          <div className="mt-4 rounded-xl border border-border/60 bg-foreground/[0.02] p-4 text-sm text-left space-y-2">
            <p className="font-medium text-foreground">Étapes suivantes :</p>
            <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
              <li>Contactez l&apos;administrateur — votre code est visible dans le panel admin</li>
              <li>Recevez votre code à 6 caractères</li>
              <li>Cliquez sur <strong className="text-foreground">&quot;Entrer mon code&quot;</strong> ci-dessous pour définir votre nouveau mot de passe</li>
            </ol>
          </div>
          <Link
            href="/reset-password"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
          >
            Entrer mon code →
          </Link>
          <Link href="/login" className="mt-3 block text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Retour à la connexion
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
            <Mail className="h-6 w-6 text-foreground/70" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Mot de passe oublié</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Entrez votre email — l&apos;administrateur vous enverra un code de réinitialisation
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
            Envoyer la demande
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-foreground hover:underline">
            ← Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
