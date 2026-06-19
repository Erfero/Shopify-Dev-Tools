"use client";

import { useEffect } from "react";
import { isAuthenticated, isSessionExpired, isRemembered, updateActivity, logout } from "@/lib/auth";

/**
 * Logs out the user after SESSION_TIMEOUT_MS of inactivity (default 4h).
 * Skipped when the user chose "Se souvenir de moi" (token in localStorage).
 * Call this hook once in any protected client page/layout.
 */
export function useSessionTimeout() {
  useEffect(() => {
    if (!isAuthenticated()) return;

    // "Se souvenir de moi" was checked → token lives in localStorage for 30 days.
    // Do NOT apply the short inactivity timeout in that case.
    if (isRemembered()) return;

    // Check immediately on mount
    if (isSessionExpired()) {
      logout();
      return;
    }

    // Record fresh activity
    updateActivity();

    // Update last-activity on user interactions
    const onActivity = () => updateActivity();
    window.addEventListener("click", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity, { passive: true });
    window.addEventListener("mousemove", onActivity, { passive: true });

    // Check expiry every 5 minutes
    const timer = setInterval(() => {
      if (isSessionExpired()) logout();
    }, 5 * 60 * 1000);

    return () => {
      window.removeEventListener("click", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("mousemove", onActivity);
      clearInterval(timer);
    };
  }, []);
}
