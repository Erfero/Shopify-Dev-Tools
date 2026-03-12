"use client";

import { Check, Package, Settings2, Image, Sparkles, Download } from "lucide-react";

const STEPS_SINGLE = [
  { id: 1, label: "Produit", icon: Package },
  { id: 2, label: "Paramètres", icon: Settings2 },
  { id: 3, label: "Images", icon: Image },
  { id: 4, label: "Génération", icon: Sparkles },
  { id: 5, label: "Téléchargement", icon: Download },
];

const STEPS_MULTI = [
  { id: 1, label: "Produits", icon: Package },
  { id: 2, label: "Photos", icon: Image },
  { id: 4, label: "Génération", icon: Sparkles },
  { id: 5, label: "Téléchargement", icon: Download },
];

export function StepIndicator({ currentStep, multi = false }: { currentStep: number; multi?: boolean }) {
  const STEPS = multi ? STEPS_MULTI : STEPS_SINGLE;
  return (
    <div className="flex items-start justify-center gap-0 mb-10 px-1 w-full overflow-hidden">
      {STEPS.map((step, index) => {
        const done = step.id < currentStep;
        const active = step.id === currentStep;
        const Icon = step.icon;

        return (
          <div key={step.id} className="flex items-start min-w-0">
            <div className="flex flex-col items-center" style={{ minWidth: 44, maxWidth: 64 }}>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 shrink-0"
                style={
                  done
                    ? { background: "var(--gradient)", color: "white" }
                    : active
                    ? { background: "var(--gradient)", color: "white", boxShadow: "0 0 0 5px rgba(0,0,0,0.08)" }
                    : { background: "oklch(0.97 0 0)", color: "oklch(0.708 0 0)", border: "1.5px solid oklch(0.922 0 0)" }
                }
              >
                {done ? <Check size={13} strokeWidth={2.5} /> : <Icon size={13} strokeWidth={2} />}
              </div>
              <span
                className="text-center leading-tight mt-1.5 hidden sm:block"
                style={{
                  fontSize: 10,
                  fontWeight: active ? 600 : 500,
                  color: active ? "var(--primary)" : done ? "oklch(0.269 0 0)" : "var(--text-muted)",
                  wordBreak: "break-word",
                  maxWidth: 56,
                }}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className="mt-4 mx-0.5 shrink-0"
                style={{
                  height: 2,
                  width: "clamp(14px, 3.5vw, 32px)",
                  borderRadius: 99,
                  background: done ? "var(--gradient)" : "oklch(0.922 0 0)",
                  transition: "background 0.4s",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
