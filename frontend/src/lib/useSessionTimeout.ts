"use client";

import { useEffect } from "react";
import { isAuthenticated, isSessionExpired, updateActivity, logout } from "@/lib/auth";

/**
 * Logs out the user after SESSION_TIMEOUT_MS of inactivity (default 4h).
 * Call this hook once in any protected client page/layout.
 */
export function useSessionTimeout() {
  useEffect(() => {
    if (!isAuthenticated()) return;

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
