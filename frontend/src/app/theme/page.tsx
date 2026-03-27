"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Paintbrush, History, Sparkles, ChevronLeft, ChevronRight, CheckCircle2, Download, RefreshCw } from "lucide-react";
import { UploadZone } from "@/components/theme/upload-zone";
import { StoreConfigForm, type StoreConfig } from "@/components/theme/store-config-form";
import { GenerationProgress } from "@/components/theme/generation-progress";
import { TextPreview } from "@/components/theme/text-preview";
import { GeneratedDataEditor } from "@/components/theme/generated-data-editor";
import { ThemeHistoryPanel } from "@/components/theme/theme-history";
import { AnalyticsPanel } from "@/components/theme/analytics-panel";
import {
  uploadTheme,
  generateTheme,
  applyTheme,
  getDownloadUrl,
  type UploadResponse,
  type GenerationStep,
} from "@/lib/api-theme";
import Link from "next/link";
import { getUser } from "@/lib/auth";

type AppStep = "upload" | "configure" | "generating" | "preview" | "done";

const STEPS: { key: AppStep; label: string }[] = [
  { key: "upload",     label: "Import ZIP" },
  { key: "configure",  label: "Configuration" },
  { key: "generating", label: "Génération IA" },
  { key: "preview",    label: "Prévisualisation" },
  { key: "done",       label: "Téléchargement" },
];

const sv = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  exit:    { opacity: 0, x: -16, transition: { duration: 0.18, ease: "easeIn" } },
};

export default function ThemePage() {
  const currentUser = getUser();
  const isAdmin = currentUser?.is_admin ?? false;
  const [appStep, setAppStep] = useState<AppStep>("upload");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null);
  const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const lastConfigRef = useRef<StoreConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const generateAbortRef = useRef<AbortController | null>(null);

  // ── Undo / Redo ────────────────────────────────────────────────────────────
  const [historyStack, setHistoryStack] = useState<Array<Record<string, unknown>>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyIndexRef = useRef(-1);

  const pushToHistory = useCallback((newData: Record<string, unknown>) => {
    const currentIndex = historyIndexRef.current;
    setHistoryStack((prev) => {
      const trimmed = prev.slice(0, currentIndex + 1);
      return [...trimmed, newData].slice(-10);
    });
    const nextIndex = Math.min(currentIndex + 1, 9);
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    historyIndexRef.current = newIndex;
    setHistoryIndex(newIndex);
    setPreviewData(historyStack[newIndex]);
  }, [historyIndex, historyStack]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= historyStack.length - 1) return;
    const newIndex = historyIndex + 1;
    historyIndexRef.current = newIndex;
    setHistoryIndex(newIndex);
    setPreviewData(historyStack[newIndex]);
  }, [historyIndex, historyStack]);

  const currentStepIdx = STEPS.findIndex((s) => s.key === appStep);

  // ── Restore session from localStorage on first mount ──────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme_session");
      if (!saved) return;
      const { uploadData: ud, appStep: as, previewData: pd } = JSON.parse(saved);
      if (ud?.session_id) {
        setUploadData(ud);
        // Never restore "generating" — it means the page was refreshed mid-flight
        setAppStep((as === "generating" ? "configure" : as) ?? "configure");
        if (pd) setPreviewData(pd);
      }
    } catch {
      localStorage.removeItem("theme_session");
    }
  }, []);

  // ── Persist session to localStorage whenever key state changes ────────────
  useEffect(() => {
    if (!uploadData) return;
    try {
      localStorage.setItem(
        "theme_session",
        JSON.stringify({ uploadData, appStep, previewData }),
      );
    } catch {
      // Storage full or unavailable — silently ignore
    }
  }, [uploadData, appStep, previewData]);

  const handleFileSelected = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    try {
      const data = await uploadTheme(file, setUploadProgress);
      setUploadData(data);
      setAppStep("configure");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, []);

  const handleGenerate = useCallback(async (config: StoreConfig) => {
    if (!uploadData) return;
    lastConfigRef.current = config;

    generateAbortRef.current?.abort();
    const controller = new AbortController();
    generateAbortRef.current = controller;

    setAppStep("generating");
    setGenerationSteps([]);
    setGenerationError(null);
    setPreviewData(null);
    setIsGenerating(true);
    try {
      await generateTheme(
        { session_id: uploadData.session_id, ...config },
        (step) => {
          setGenerationSteps((prev) => {
            const idx = prev.findIndex((s) => s.step === step.step);
            if (idx >= 0) { const u = [...prev]; u[idx] = step; return u; }
            return [...prev, step];
          });
          if (step.step === "preview" && step.status === "done" && step.data) {
            const newData = step.data as Record<string, unknown>;
            setPreviewData(newData);
            pushToHistory(newData);
            setAppStep("preview");
          }
          if (step.status === "error") {
            setGenerationError(step.message || null);
          }
        },
        controller.signal,
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setGenerationError(err instanceof Error ? err.message : "Erreur lors de la génération");
    } finally {
      setIsGenerating(false);
      if (generateAbortRef.current === controller) generateAbortRef.current = null;
    }
  }, [uploadData]);

  const handleCancelGeneration = useCallback(() => {
    generateAbortRef.current?.abort();
    generateAbortRef.current = null;
    setIsGenerating(false);
    setGenerationSteps([]);
    setGenerationError(null);
    setAppStep("configure");
  }, []);

  const handleValidate = useCallback(async (editedData: Record<string, unknown>) => {
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
  }, [uploadData]);

  const handleReset = useCallback(() => {
    generateAbortRef.current?.abort();
    generateAbortRef.current = null;
    setIsGenerating(false);
    setAppStep("upload");
    setUploadData(null);
    setGenerationSteps([]);
    setGenerationError(null);
    setPreviewData(null);
    setApplyError(null);
    setUploadError(null);
    localStorage.removeItem("theme_session");
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

      {/* Sticky Header */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{ background: "white", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 40 }}
      >
        <div className="flex items-center justify-between" style={{ maxWidth: 820, margin: "0 auto", padding: "12px 16px" }}>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none", flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>← Accueil</span>
            </Link>
            <div className="hidden sm:block" style={{ width: 1, height: 20, background: "var(--border)", flexShrink: 0 }} />
            <div className="hidden sm:flex w-9 h-9 rounded-xl items-center justify-center flex-shrink-0" style={{ background: "var(--gradient)" }}>
              <Paintbrush size={17} className="text-white" />
            </div>
            <div className="hidden sm:block min-w-0">
              <p className="font-bold text-sm leading-tight truncate" style={{ color: "var(--text)" }}>Theme Customizer</p>
              <p className="truncate" style={{ fontSize: 11, color: "var(--text-muted)" }}>Personnalisation IA de thème Shopify</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {isAdmin && (
              <button
                onClick={() => setShowAnalytics(true)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 10, border: "1.5px solid var(--border)", background: "white", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "inherit", transition: "all 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "oklch(0.97 0 0)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "white"; }}
              >
                <Sparkles size={14} />
                <span className="hidden sm:inline">Analytics</span>
              </button>
            )}
            <button
              onClick={() => setShowHistory(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 10, border: "1.5px solid var(--border)", background: "white", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "inherit", transition: "all 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "oklch(0.97 0 0)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "white"; }}
            >
              <History size={14} />
              <span className="hidden sm:inline">Historique</span>
            </button>
            <div className="hidden sm:flex" style={{ padding: "4px 10px", borderRadius: 8, background: "oklch(0.97 0 0)", border: "1px solid var(--border)", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", alignItems: "center" }}>
              <Sparkles size={10} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
              Propulsé par OpenRouter AI
            </div>
          </div>
        </div>
      </motion.header>

      {/* Dark banner — upload step only */}
      <AnimatePresence>
        {appStep === "upload" && (
          <motion.div
            key="banner"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35 }}
            style={{
              background: "linear-gradient(135deg, oklch(0.18 0.02 260) 0%, oklch(0.22 0.03 270) 100%)",
              overflow: "hidden",
            }}
          >
            <div style={{ maxWidth: 820, margin: "0 auto", padding: "36px 20px 32px", textAlign: "center" }}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
              >
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 14px", borderRadius: 20, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", marginBottom: 16 }}>
                  <Paintbrush size={12} style={{ color: "rgba(255,255,255,0.7)" }} />
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Shopify Theme Customizer</span>
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: "white", marginBottom: 8 }}>
                  Personnalisez votre thème avec l&apos;IA
                </h1>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", maxWidth: 420, margin: "0 auto" }}>
                  Importez votre thème ZIP, configurez votre boutique, et laissez l&apos;IA générer des textes personnalisés.
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step Indicator */}
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 28 }}>
          {STEPS.map((step, i) => {
            const isActive = appStep === step.key;
            const isDone = currentStepIdx > i;
            return (
              <div key={step.key} style={{ display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <motion.div
                    animate={isActive ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      width: 28, height: 28,
                      borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700,
                      background: isActive ? "var(--primary)" : isDone ? "var(--primary)" : "oklch(0.93 0 0)",
                      color: isActive || isDone ? "white" : "var(--text-muted)",
                      transition: "all 0.3s",
                      boxShadow: isActive ? "0 0 0 3px oklch(0.85 0.08 260)" : "none",
                    }}
                  >
                    {isDone ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : i + 1}
                  </motion.div>
                  <span className="step-indicator-label" style={{
                    fontSize: 10, fontWeight: isActive ? 700 : 500,
                    color: isActive ? "var(--primary)" : isDone ? "var(--text-secondary)" : "var(--text-muted)",
                    whiteSpace: "nowrap",
                  }}>
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{
                    width: "clamp(16px, 4vw, 48px)", height: 2, marginBottom: 18,
                    marginLeft: "clamp(1px, 0.5vw, 2px)", marginRight: "clamp(1px, 0.5vw, 2px)",
                    background: isDone ? "var(--primary)" : "oklch(0.91 0 0)",
                    transition: "background 0.4s",
                    borderRadius: 1,
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Main content */}
        <div style={{ maxWidth: appStep === "preview" ? 720 : 600, margin: "0 auto", paddingBottom: 60 }}>
          <AnimatePresence mode="wait">

            {/* Upload */}
            {appStep === "upload" && (
              <motion.div key="upload" variants={sv} initial="initial" animate="animate" exit="exit">
                <div className="card" style={{ padding: "clamp(16px, 4vw, 32px)" }}>
                  <div style={{ marginBottom: 24, textAlign: "center" }}>
                    <h2 style={{ fontWeight: 700, fontSize: 18, color: "var(--text)", marginBottom: 6 }}>
                      Importer votre thème
                    </h2>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      Uploadez le fichier ZIP de votre thème Shopify
                    </p>
                  </div>
                  <UploadZone
                    onFileSelected={handleFileSelected}
                    isUploading={isUploading}
                    uploadProgress={uploadProgress}
                    error={uploadError}
                  />
                </div>
              </motion.div>
            )}

            {/* Configure */}
            {appStep === "configure" && uploadData && (
              <motion.div key="configure" variants={sv} initial="initial" animate="animate" exit="exit">
                <div className="card" style={{ padding: "clamp(16px, 4vw, 32px)" }}>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <button
                        onClick={() => setAppStep("upload")}
                        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                      >
                        <ChevronLeft size={14} /> Retour
                      </button>
                      {previewData && (
                        <button
                          onClick={() => setAppStep("preview")}
                          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--primary)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                        >
                          Voir les textes générés <ChevronRight size={14} />
                        </button>
                      )}
                    </div>
                    <h2 style={{ fontWeight: 700, fontSize: 18, color: "var(--text)", marginBottom: 6 }}>
                      Configurer votre boutique
                    </h2>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      Ces informations serviront à générer des textes personnalisés
                    </p>
                  </div>
                  <StoreConfigForm
                    themeName={uploadData.theme_name}
                    onSubmit={handleGenerate}
                    isGenerating={false}
                  />
                </div>
              </motion.div>
            )}

            {/* Generating */}
            {appStep === "generating" && (
              <motion.div key="generating" variants={sv} initial="initial" animate="animate" exit="exit">
                <div className="card" style={{ padding: "clamp(16px, 4vw, 32px)" }}>
                  <div style={{ marginBottom: 24, textAlign: "center" }}>
                    <h2 style={{ fontWeight: 700, fontSize: 18, color: "var(--text)", marginBottom: 6 }}>
                      Génération en cours
                    </h2>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      L&apos;IA personnalise votre thème...
                    </p>
                  </div>
                  <GenerationProgress steps={generationSteps} error={generationError} />
                  <TextPreview steps={generationSteps} />
                  <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 24 }}>
                    <button
                      onClick={handleCancelGeneration}
                      style={{ padding: "10px 20px", borderRadius: 10, border: "1.5px solid var(--border)", background: "white", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text)", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <ChevronLeft size={13} /> {isGenerating ? "Annuler" : "Retour à la configuration"}
                    </button>
                    {(generationSteps.some((s) => s.step === "preview" && s.status === "error") || !!generationError) && !isGenerating && (
                      <button
                        onClick={() => {
                          setGenerationSteps([]);
                          setGenerationError(null);
                          handleGenerate(lastConfigRef.current!);
                        }}
                        style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "var(--primary)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "white", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <RefreshCw size={13} /> Réessayer
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Preview / Edit */}
            {appStep === "preview" && previewData && (
              <motion.div key="preview" variants={sv} initial="initial" animate="animate" exit="exit">
                <div className="card" style={{ padding: "clamp(16px, 4vw, 32px)" }}>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <button
                        onClick={() => setAppStep("configure")}
                        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                      >
                        <ChevronLeft size={14} /> Modifier la configuration
                      </button>
                      {(historyStack.length > 1) && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button
                            onClick={handleUndo}
                            disabled={historyIndex <= 0}
                            style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8, border: "1.5px solid var(--border)", background: "white", cursor: historyIndex <= 0 ? "default" : "pointer", fontSize: 12, fontWeight: 600, color: historyIndex <= 0 ? "var(--text-muted)" : "var(--text-secondary)", fontFamily: "inherit", opacity: historyIndex <= 0 ? 0.5 : 1 }}
                          >
                            <ChevronLeft size={12} /> Annuler
                          </button>
                          <button
                            onClick={handleRedo}
                            disabled={historyIndex >= historyStack.length - 1}
                            style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8, border: "1.5px solid var(--border)", background: "white", cursor: historyIndex >= historyStack.length - 1 ? "default" : "pointer", fontSize: 12, fontWeight: 600, color: historyIndex >= historyStack.length - 1 ? "var(--text-muted)" : "var(--text-secondary)", fontFamily: "inherit", opacity: historyIndex >= historyStack.length - 1 ? 0.5 : 1 }}
                          >
                            Refaire <ChevronRight size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                    <h2 style={{ fontWeight: 700, fontSize: 18, color: "var(--text)", marginBottom: 6 }}>
                      Prévisualisation et édition
                    </h2>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      Vérifiez et ajustez les textes générés, puis validez pour créer votre thème.
                    </p>
                  </div>
                  <GeneratedDataEditor
                    data={previewData}
                    onValidate={handleValidate}
                    isApplying={isApplying}
                    applyError={applyError}
                    sessionId={uploadData?.session_id}
                    onSectionRegenerated={(section, newData) => {
                      const updated = { ...previewData, [section]: newData };
                      setPreviewData(updated);
                      pushToHistory(updated);
                    }}
                  />
                </div>
              </motion.div>
            )}

            {/* Done */}
            {appStep === "done" && uploadData && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="card" style={{ padding: "40px 32px", textAlign: "center" }}>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 20 }}
                    style={{ width: 64, height: 64, borderRadius: "50%", background: "#DCFCE7", border: "2px solid #BBF7D0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}
                  >
                    <CheckCircle2 size={28} style={{ color: "#15803D" }} />
                  </motion.div>
                  <h2 style={{ fontWeight: 800, fontSize: 22, color: "var(--text)", marginBottom: 8 }}>
                    Votre thème est prêt !
                  </h2>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 28, maxWidth: 360, margin: "0 auto 28px" }}>
                    Téléchargez le fichier ZIP et importez-le dans votre boutique Shopify
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320, margin: "0 auto" }}>
                    <a
                      href={getDownloadUrl(uploadData.session_id)}
                      download
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 24px", borderRadius: 12, background: "var(--primary)", color: "white", textDecoration: "none", fontWeight: 700, fontSize: 15, boxShadow: "0 4px 14px rgba(99,102,241,0.3)" }}
                    >
                      <Download size={16} />
                      Télécharger le thème
                    </a>
                    <button
                      onClick={() => setAppStep("preview")}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 24px", borderRadius: 12, border: "1.5px solid var(--border)", background: "white", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "inherit" }}
                    >
                      <ChevronLeft size={13} />
                      Modifier les textes
                    </button>
                    <button
                      onClick={handleReset}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 24px", borderRadius: 12, border: "1.5px solid var(--border)", background: "white", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "inherit" }}
                    >
                      <RefreshCw size={13} />
                      Nouveau thème
                    </button>
                  </div>

                  <div style={{ marginTop: 24, padding: "14px 16px", borderRadius: 10, background: "oklch(0.97 0 0)", border: "1px solid var(--border)", textAlign: "left", maxWidth: 360, margin: "24px auto 0" }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>Comment importer ?</p>
                    <ol style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, paddingLeft: 16 }}>
                      <li>Allez dans Boutique en ligne → Thèmes</li>
                      <li>Cliquez sur &quot;Ajouter un thème&quot;</li>
                      <li>Choisissez &quot;Importer depuis un fichier ZIP&quot;</li>
                      <li>Sélectionnez le fichier téléchargé</li>
                    </ol>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* History slide-in panel */}
      <AnimatePresence>
        {showHistory && <ThemeHistoryPanel onClose={() => setShowHistory(false)} isAdmin={isAdmin} />}
      </AnimatePresence>

      {/* Analytics panel */}
      <AnimatePresence>
        {showAnalytics && <AnalyticsPanel onClose={() => setShowAnalytics(false)} />}
      </AnimatePresence>
    </div>
  );
}
