"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Layers, Loader2, Eye, EyeOff } from "lucide-react";
import { API_BASE } from "@/lib/config";
import { setToken, setUser, updateActivity, REMEMBER_KEY } from "@/lib/auth";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(REMEMBER_KEY) !== "false";
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (loading) {
      setLoadingSeconds(0);
      timerRef.current = setInterval(() => setLoadingSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setLoadingSeconds(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading]);

  const handleRememberChange = (checked: boolean) => {
    setRemember(checked);
    localStorage.setItem(REMEMBER_KEY, String(checked));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Erreur de connexion.");
        return;
      }
      setToken(data.access_token, remember);
      setUser({ email, is_admin: data.is_admin, display_name: data.display_name ?? "" }, remember);
      updateActivity();
      router.replace("/");
    } catch {
      setError("Impossible de contacter le serveur. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  const loadingLabel =
    loadingSeconds >= 8 ? "Démarrage du serveur (~30s)…" :
    loadingSeconds >= 3 ? "Connexion en cours…" :
    "Se connecter";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/[0.05] border border-border/60">
            <Layers className="h-6 w-6 text-foreground/70" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Connexion</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Shopify Dev Tools</p>
        </div>

        {/* Google login */}
        <div className="mb-4">
          <GoogleAuthButton text="signin_with" onError={setError} />
        </div>

        {/* Divider */}
        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-3 text-muted-foreground">ou avec email</span>
          </div>
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
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-sm font-medium">Mot de passe</label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Mot de passe oublié ?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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

          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => handleRememberChange(e.target.checked)}
              className="h-4 w-4 rounded border-border/60 accent-foreground"
            />
            <span className="text-sm text-muted-foreground">
              Se souvenir de moi
              <span className="ml-1 text-xs opacity-60">{remember ? "(30 jours)" : "(4h d'inactivité)"}</span>
            </span>
          </label>

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
            {loadingLabel}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link href="/register" className="font-medium text-foreground hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
