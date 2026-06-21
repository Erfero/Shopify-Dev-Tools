"use client";

import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { API_BASE } from "@/lib/config";
import { setToken, setUser, updateActivity } from "@/lib/auth";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

interface Props {
  onError?: (msg: string) => void;
  text?: "signin_with" | "signup_with" | "continue_with";
}

export function GoogleAuthButton({ onError, text = "signin_with" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!GOOGLE_CLIENT_ID) return null;

  async function handleSuccess(response: CredentialResponse) {
    if (!response.credential) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError?.(data.detail || "Connexion Google échouée.");
        return;
      }
      setToken(data.access_token, true);
      setUser({ email: data.email ?? "", is_admin: data.is_admin, display_name: data.display_name ?? "" }, true);
      updateActivity();
      router.replace("/");
    } catch {
      onError?.("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={loading ? "opacity-50 pointer-events-none" : ""}>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => onError?.("Connexion Google annulée ou échouée.")}
          text={text}
          shape="rectangular"
          theme="outline"
          size="large"
          width="100%"
        />
      </GoogleOAuthProvider>
    </div>
  );
}
