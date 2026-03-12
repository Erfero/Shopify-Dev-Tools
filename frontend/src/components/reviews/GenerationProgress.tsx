"use client";

import { Loader2, CheckCircle2, AlertCircle, Zap } from "lucide-react";
import { SSEEvent } from "@/lib/api-reviews";

interface GenerationProgressProps {
  events: SSEEvent[];
  isGenerating: boolean;
  currentProgress: number;
  currentCount: number;
  totalCount: number;
  error: string | null;
}

export function GenerationProgress({
  events, isGenerating, currentProgress, currentCount, totalCount, error,
}: GenerationProgressProps) {
  const done = events.some((e) => e.type === "complete");
  const lastMsg = events[events.length - 1]?.message ?? "";

  return (
    <div className="animate-fade-up">
      <div className="flex items-start gap-4 mb-8 pb-6" style={{ borderBottom: "1px solid oklch(0.922 0 0)" }}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: done
              ? "linear-gradient(135deg, #DCFCE7, #BBF7D0)"
              : "oklch(0.97 0 0)",
          border: "1px solid oklch(0.922 0 0)",
          }}
        >
          {done ? (
            <CheckCircle2 size={22} style={{ color: "#15803D" }} />
          ) : (
            <Zap size={22} style={{ color: "var(--primary)" }} />
          )}
        </div>
        <div>
          <h2 className="font-bold text-xl" style={{ color: "var(--text)" }}>
            {done ? "Génération terminée !" : "Génération en cours..."}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {done
              ? `${currentCount} avis avec réponses générés avec succès`
              : "L'IA rédige vos avis, veuillez patienter..."}
          </p>
        </div>
      </div>

      {/* Progress card */}
      <div
        className="rounded-2xl p-6 mb-5"
        style={{
          background: done ? "#F0FDF4" : "oklch(0.985 0 0)",
          border: `1px solid ${done ? "#BBF7D0" : "oklch(0.922 0 0)"}`,
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {isGenerating && !done ? (
              <Loader2 size={15} className="animate-spin" style={{ color: "var(--primary)" }} />
            ) : done ? (
              <CheckCircle2 size={15} style={{ color: "#15803D" }} />
            ) : error ? (
              <AlertCircle size={15} style={{ color: "#DC2626" }} />
            ) : null}
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              {lastMsg || "Préparation..."}
            </span>
          </div>
          <span className="font-bold text-lg" style={{ color: done ? "#15803D" : "var(--primary)" }}>
            {currentCount}
            <span className="font-normal text-sm ml-1" style={{ color: "var(--text-muted)" }}>/ {totalCount}</span>
          </span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${currentProgress}%` }} />
        </div>
        <div className="flex justify-between mt-2">
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{currentProgress}%</span>
          {isGenerating && !done && (
            <span style={{ fontSize: 12, color: "var(--primary)" }} className="animate-pulse">
              Génération en cours...
            </span>
          )}
          {done && (
            <span style={{ fontSize: 12, color: "#15803D", fontWeight: 600 }}>✓ Terminé</span>
          )}
        </div>
      </div>

      {/* Event log */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid oklch(0.922 0 0)", background: "oklch(0.985 0 0)" }}
      >
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid oklch(0.922 0 0)", background: "oklch(0.97 0 0)" }}
        >
          <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            Journal de génération
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {events.length} événement{events.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="p-4 max-h-52 overflow-y-auto space-y-1.5">
          {events.length === 0 ? (
            <div className="flex items-center gap-2 py-3 justify-center">
              {[0, 1, 2].map((i) => (
                <div key={i} className="dot-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          ) : (
            events.map((ev, i) => (
              <div key={i} className="flex items-start gap-2" style={{ fontSize: 13 }}>
                <span
                  className="shrink-0 font-bold"
                  style={{
                    color: ev.type === "complete" ? "#15803D"
                      : ev.type === "error" ? "#DC2626"
                      : ev.type === "start" ? "var(--primary)"
                      : "var(--text-muted)",
                  }}
                >
                  {ev.type === "complete" ? "✓" : ev.type === "error" ? "✗" : ev.type === "start" ? "▶" : "·"}
                </span>
                <span style={{ color: "var(--text-secondary)" }}>{ev.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {error && (
        <div className="error-banner mt-4">
          <AlertCircle size={16} className="shrink-0" />
          <div>
            <p className="font-semibold text-sm">Erreur de génération</p>
            <p className="text-xs mt-0.5 opacity-80">{error}</p>
          </div>
        </div>
      )}

      {done && (
        <div className="success-banner mt-4">
          <CheckCircle2 size={20} className="shrink-0" />
          <div>
            <p className="font-semibold">{currentCount} avis générés avec succès !</p>
            <p className="text-xs mt-0.5 opacity-80">
              Cliquez sur &quot;Télécharger&quot; pour récupérer vos fichiers CSV.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
