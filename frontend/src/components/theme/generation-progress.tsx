"use client";

import { Progress } from "@/components/ui/progress";
import type { GenerationStep } from "@/lib/api-theme";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const STEP_LABELS: Record<string, string> = {
  colors: "Palette de couleurs",
  homepage: "Page d'accueil",
  product_page: "Page produit",
  faq: "Questions frequentes",
  reviews: "Avis clients",
  legal_pages: "Pages legales",
  story_page: "Notre histoire",
  global_texts: "Textes globaux",
  preview: "Previsualisation",
  complete: "Termine",
};

const ALL_STEPS = [
  "colors",
  "homepage",
  "product_page",
  "faq",
  "reviews",
  "legal_pages",
  "story_page",
  "global_texts",
  "preview",
];

interface GenerationProgressProps {
  steps: GenerationStep[];
  error?: string | null;
}

export function GenerationProgress({ steps, error }: GenerationProgressProps) {
  const completedSteps = steps.filter((s) => s.status === "done").map((s) => s.step);
  const errorSteps = steps.filter((s) => s.status === "error").map((s) => s.step);
  const currentStep = steps.find((s) => s.status === "generating")?.step;

  // Progress counts both done and error steps (they're processed)
  const processedCount = completedSteps.length + errorSteps.length;
  const progress = Math.round((processedCount / ALL_STEPS.length) * 100);
  const allDone = processedCount >= ALL_STEPS.length;
  const hasErrors = errorSteps.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            {!allDone
              ? "Generation en cours..."
              : hasErrors
                ? `Termine avec ${errorSteps.length} erreur(s)`
                : "Generation terminee"}
          </p>
          <p className="text-sm text-muted-foreground">{progress}%</p>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <div className="space-y-1">
        {ALL_STEPS.map((stepId) => {
          const isDone = completedSteps.includes(stepId);
          const isCurrent = currentStep === stepId;
          const errorStep = steps.find((s) => s.step === stepId && s.status === "error");

          return (
            <div key={stepId}>
              <div
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  isCurrent ? "bg-foreground/[0.03]" : ""
                }`}
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-foreground" />
                  ) : errorStep ? (
                    <XCircle className="h-4 w-4 text-destructive" />
                  ) : isCurrent ? (
                    <Loader2 className="h-4 w-4 animate-spin text-foreground/60" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-foreground/10" />
                  )}
                </div>

                <span
                  className={`text-sm ${
                    isDone
                      ? "text-foreground"
                      : isCurrent
                        ? "font-medium text-foreground"
                        : errorStep
                          ? "text-destructive"
                          : "text-muted-foreground/60"
                  }`}
                >
                  {STEP_LABELS[stepId] || stepId}
                </span>
              </div>

              {/* Show error detail inline */}
              {errorStep && errorStep.message && (
                <div className="ml-11 mb-1 rounded-lg bg-destructive/5 px-3 py-1.5">
                  <p className="text-xs text-destructive/80">{errorStep.message}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
