"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { UploadZone } from "@/components/theme/upload-zone";
import { StoreConfigForm, type StoreConfig } from "@/components/theme/store-config-form";
import { GenerationProgress } from "@/components/theme/generation-progress";
import { TextPreview } from "@/components/theme/text-preview";
import { DownloadSection } from "@/components/theme/download-section";
import { GeneratedDataEditor } from "@/components/theme/generated-data-editor";
import { ThemeHistory } from "@/components/theme/theme-history";
import {
  uploadTheme,
  generateTheme,
  applyTheme,
  type UploadResponse,
  type GenerationStep,
} from "@/lib/api-theme";
import Link from "next/link";
import { fadeUp, scalePop } from "@/lib/motion";

type AppStep = "upload" | "configure" | "generating" | "preview" | "done";

const APP_STEPS: AppStep[] = ["upload", "configure", "generating", "preview", "done"];

export default function ThemePage() {
  const [appStep, setAppStep] = useState<AppStep>("upload");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null);
  const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const lastConfigRef = useRef<StoreConfig | null>(null);

  const handleFileSelected = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      const data = await uploadTheme(file);
      setUploadData(data);
      setAppStep("configure");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleGenerate = useCallback(
    async (config: StoreConfig) => {
      if (!uploadData) return;

      lastConfigRef.current = config;
      setAppStep("generating");
      setGenerationSteps([]);
      setGenerationError(null);
      setPreviewData(null);

      try {
        await generateTheme(
          {
            session_id: uploadData.session_id,
            ...config,
          },
          (step) => {
            setGenerationSteps((prev) => {
              const existing = prev.findIndex((s) => s.step === step.step);
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = step;
                return updated;
              }
              return [...prev, step];
            });

            // Generation complete — move to preview/edit step
            if (step.step === "preview" && step.status === "done" && step.data) {
              setPreviewData(step.data as Record<string, unknown>);
              setAppStep("preview");
            }

            // If generation fails entirely
            if (step.step === "preview" && step.status === "error") {
              setGenerationError(step.message || null);
            }

            if (step.status === "error" && step.step !== "preview") {
              setGenerationError(step.message);
            }
          },
        );
      } catch (err) {
        setGenerationError(err instanceof Error ? err.message : "Erreur lors de la generation");
      }
    },
    [uploadData],
  );

  const handleValidate = useCallback(
    async (editedData: Record<string, unknown>) => {
      if (!uploadData) return;

      setIsApplying(true);
      setApplyError(null);

      try {
        await applyTheme(uploadData.session_id, editedData);
        setAppStep("done");
      } catch (err) {
        setApplyError(err instanceof Error ? err.message : "Erreur lors de l'application");
      } finally {
        setIsApplying(false);
      }
    },
    [uploadData],
  );

  const handleReset = useCallback(() => {
    setAppStep("upload");
    setUploadData(null);
    setGenerationSteps([]);
    setGenerationError(null);
    setPreviewData(null);
    setApplyError(null);
    setUploadError(null);
  }, []);

  const currentStepIdx = APP_STEPS.indexOf(appStep);

  const stepVariants = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2, ease: "easeIn" } },
  };

  return (
    <motion.div
      className="flex min-h-screen flex-col items-center bg-background px-4 py-12 sm:py-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <motion.header
        className="mb-12 text-center sm:mb-16"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Accueil
          </Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Shopify Theme Customizer
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Personnalisez automatiquement votre theme avec l&apos;IA
        </p>
      </motion.header>

      {/* Steps indicator */}
      <motion.div
        className="mb-10 flex items-center gap-2"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        {APP_STEPS.map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <motion.div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-all ${
                appStep === step
                  ? "bg-foreground text-background"
                  : currentStepIdx > i
                    ? "bg-foreground/10 text-foreground"
                    : "bg-foreground/4 text-muted-foreground/50"
              }`}
              animate={appStep === step ? { scale: [1, 1.15, 1] } : { scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              {currentStepIdx > i ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                i + 1
              )}
            </motion.div>
            {i < APP_STEPS.length - 1 && (
              <motion.div
                className="h-px sm:w-10"
                style={{ width: 32 }}
                initial={{ backgroundColor: "rgb(0,0,0,0.06)" }}
                animate={{ backgroundColor: currentStepIdx > i ? "rgb(0,0,0,0.2)" : "rgb(0,0,0,0.06)" }}
                transition={{ duration: 0.4 }}
              />
            )}
          </div>
        ))}
      </motion.div>

      {/* Main content */}
      <main className={`w-full ${appStep === "preview" ? "max-w-2xl" : "max-w-lg"}`}>
        <AnimatePresence mode="wait">
          {/* Upload */}
          {appStep === "upload" && (
            <motion.div key="upload" className="space-y-6" variants={stepVariants} initial="initial" animate="animate" exit="exit">
              <div className="text-center">
                <h2 className="text-lg font-medium">Importer votre theme</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Uploadez le fichier ZIP de votre theme Shopify
                </p>
              </div>
              <UploadZone
                onFileSelected={handleFileSelected}
                isUploading={isUploading}
                error={uploadError}
              />
            </motion.div>
          )}

          {/* Configure */}
          {appStep === "configure" && uploadData && (
            <motion.div key="configure" className="space-y-6" variants={stepVariants} initial="initial" animate="animate" exit="exit">
              <div className="text-center">
                <h2 className="text-lg font-medium">Configurer votre boutique</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ces informations serviront a generer des textes personnalises
                </p>
              </div>
              <StoreConfigForm
                themeName={uploadData.theme_name}
                onSubmit={handleGenerate}
                isGenerating={false}
              />
            </motion.div>
          )}

          {/* Generating */}
          {appStep === "generating" && (
            <motion.div key="generating" className="space-y-8" variants={stepVariants} initial="initial" animate="animate" exit="exit">
              <div className="text-center">
                <h2 className="text-lg font-medium">Generation en cours</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  L&apos;IA personnalise votre theme...
                </p>
              </div>
              <GenerationProgress steps={generationSteps} error={generationError} />
              <TextPreview steps={generationSteps} />
              {generationSteps.some((s) => s.step === "preview" && s.status === "error") && (
                <div className="flex justify-center gap-3 pt-2">
                  <Button variant="outline" onClick={() => setAppStep("configure")}>
                    Modifier la configuration
                  </Button>
                  <Button onClick={() => {
                    setGenerationSteps([]);
                    setGenerationError(null);
                    handleGenerate(lastConfigRef.current!);
                  }}>
                    Reessayer
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {/* Preview / Edit */}
          {appStep === "preview" && previewData && (
            <motion.div key="preview" className="space-y-6" variants={stepVariants} initial="initial" animate="animate" exit="exit">
              <div className="text-center">
                <h2 className="text-lg font-medium">Prévisualisation et édition</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Vérifiez et ajustez les textes générés, puis validez pour créer votre thème.
                </p>
              </div>
              <GeneratedDataEditor
                data={previewData}
                onValidate={handleValidate}
                isApplying={isApplying}
                applyError={applyError}
              />
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setAppStep("configure")}
                >
                  ← Modifier la configuration
                </Button>
              </div>
            </motion.div>
          )}

          {/* Done */}
          {appStep === "done" && uploadData && (
            <motion.div key="done" className="space-y-8" variants={scalePop} initial="hidden" animate="visible">
              <div className="text-center">
                <h2 className="text-lg font-medium">Votre theme est pret</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Telechargez-le et importez-le dans votre boutique Shopify
                </p>
              </div>
              <DownloadSection
                sessionId={uploadData.session_id}
                onReset={handleReset}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* History */}
      <motion.div
        className="mt-16 flex flex-col items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <ThemeHistory key={appStep === "done" ? "refresh" : "idle"} />
      </motion.div>

      {/* Footer */}
      <footer className="mt-8 pt-4">
        <p className="text-xs text-muted-foreground/50">
          Shopify Theme Customizer v1.0
        </p>
      </footer>
    </motion.div>
  );
}
