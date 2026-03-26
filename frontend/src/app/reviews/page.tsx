"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Zap, ArrowRight, History, Sparkles, RefreshCw } from "lucide-react";

import { StepIndicator } from "@/components/reviews/StepIndicator";
import { ProductForm } from "@/components/reviews/ProductForm";
import { SettingsForm } from "@/components/reviews/SettingsForm";
import { ImageUpload } from "@/components/reviews/ImageUpload";
import { GenerationProgress } from "@/components/reviews/GenerationProgress";
import { DownloadSection } from "@/components/reviews/DownloadSection";
import { CSVHistoryPanel } from "@/components/reviews/CSVHistoryPanel";
import { MultiProductForm, MultiProductConfig } from "@/components/reviews/MultiProductForm";
import { MultiImageUpload } from "@/components/reviews/MultiImageUpload";
import { GenderedImageUpload } from "@/components/reviews/GenderedImageUpload";
import { deleteSession, SSEEvent } from "@/lib/api-reviews";
import { addPendingEntry, getEntries, CSVEntry } from "@/lib/csvHistory";
import { API } from "@/lib/config";

interface FormState {
  productName: string;
  brandName: string;
  productDescription: string;
  productHandle: string;
  targetGender: string;
  language: string;
  reviewCount: number;
  imageUrls: string[];
  femaleImageUrls: string[];
  maleImageUrls: string[];
  productImages: File[];
}

const INITIAL: FormState = {
  productName: "",
  brandName: "",
  productDescription: "",
  productHandle: "",
  targetGender: "femmes",
  language: "Français",
  reviewCount: 100,
  imageUrls: [],
  femaleImageUrls: [],
  maleImageUrls: [],
  productImages: [],
};

export default function ReviewsPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL);

  const [isGenerating, setIsGenerating] = useState(false);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [progress, setProgress] = useState(0);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [done, setDone] = useState(false);

  const [csvEntries, setCsvEntries] = useState<CSVEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [mode, setMode] = useState<"single" | "multi">("single");
  const [multiProducts, setMultiProducts] = useState<MultiProductConfig[]>([{
    id: crypto.randomUUID(),
    productName: "", brandName: "", productDescription: "",
    productHandle: "", targetGender: "femmes", language: "Français",
    reviewCount: 50, imageUrls: [], reviewImageFiles: [],
    femaleReviewImageFiles: [], maleReviewImageFiles: [], productImages: [],
  }]);

  const refreshEntries = useCallback(async () => {
    const entries = await getEntries();
    setCsvEntries(entries);
  }, []);

  useEffect(() => {
    getEntries().then(setCsvEntries);
  }, []);

  const abortRef = useRef<(() => void) | null>(null);

  const set = useCallback((field: string, value: string | number) => {
    setForm((p) => ({ ...p, [field]: value }));
  }, []);

  const step1Valid =
    form.productName.trim() &&
    form.brandName.trim() &&
    form.productDescription.trim() &&
    form.productHandle.trim();

  const isMultiValid = multiProducts.length > 0 && multiProducts.every(
    (p) => p.productName.trim() && p.brandName.trim() && p.productDescription.trim() && p.productHandle.trim()
  );

  const canNext = () => {
    if (mode === "multi" && step === 1) return isMultiValid;
    if (mode === "multi" && step === 2) return true;
    if (step === 1) return !!step1Valid;
    if (step === 2) return !!(form.targetGender && form.language);
    if (step === 3) return true;
    if (step === 4) return done;
    return false;
  };

  const startGeneration = () => {
    const sid = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    setSessionId(sid);
    setEvents([]);
    setProgress(0);
    setCount(0);
    setError(null);
    setDone(false);
    setIsGenerating(true);
    setStep(4);

    const formData = new FormData();
    formData.append("product_name", form.productName);
    formData.append("brand_name", form.brandName);
    formData.append("product_description", form.productDescription);
    formData.append("product_handle", form.productHandle);
    formData.append("target_gender", form.targetGender);
    formData.append("language", form.language);
    formData.append("review_count", form.reviewCount.toString());
    formData.append("session_id", sid);
    formData.append("image_urls", JSON.stringify(form.imageUrls.filter(Boolean)));
    formData.append("female_image_urls", JSON.stringify(form.femaleImageUrls.filter(Boolean)));
    formData.append("male_image_urls", JSON.stringify(form.maleImageUrls.filter(Boolean)));
    form.productImages.forEach((img) => formData.append("product_images", img));

    const controller = new AbortController();
    abortRef.current = () => controller.abort();

    (async () => {
      try {
        const resp = await fetch(`${API}/reviews/generate`, {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
        if (!resp.ok) { setError(`Erreur serveur ${resp.status}`); setIsGenerating(false); return; }
        const reader = resp.body?.getReader();
        if (!reader) { setError("Flux SSE non disponible"); setIsGenerating(false); return; }
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done: rdone, value } = await reader.read();
          if (rdone) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (t.startsWith("data: ")) {
              try {
                const ev = JSON.parse(t.slice(6)) as SSEEvent;
                setEvents((p) => [...p, ev]);
                setProgress(ev.progress);
                if (ev.count !== undefined) setCount(ev.count);
                if (ev.type === "complete") {
                  setIsGenerating(false);
                  setDone(true);
                  await addPendingEntry({
                    sessionId: sid,
                    productName: form.productName,
                    brandName: form.brandName,
                    reviewCount: ev.count ?? form.reviewCount,
                  });
                  await refreshEntries();
                }
                if (ev.type === "error") { setError(ev.message); setIsGenerating(false); }
              } catch {}
            }
          }
        }
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setError(e instanceof Error ? e.message : "Erreur inconnue");
          setIsGenerating(false);
        }
      }
    })();
  };

  const startMultiGeneration = () => {
    const sid = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    setSessionId(sid);
    setEvents([]);
    setProgress(0);
    setCount(0);
    setError(null);
    setDone(false);
    setIsGenerating(true);
    setStep(4);

    const controller = new AbortController();
    abortRef.current = () => controller.abort();

    (async () => {
      try {
        async function uploadFiles(files: File[]): Promise<string[]> {
          if (files.length === 0) return [];
          const uploadForm = new FormData();
          files.forEach((f) => uploadForm.append("files", f));
          const resp = await fetch(`${API}/reviews/upload-images`, {
            method: "POST", body: uploadForm, signal: controller.signal,
          });
          if (!resp.ok) return [];
          const data = await resp.json();
          return data.urls ?? [];
        }

        const perProductUrls = await Promise.all(
          multiProducts.map(async (p) => {
            if (p.targetGender === "mixte") {
              const [femaleUrls, maleUrls] = await Promise.all([
                uploadFiles(p.femaleReviewImageFiles),
                uploadFiles(p.maleReviewImageFiles),
              ]);
              return { image_urls: [], female_image_urls: femaleUrls, male_image_urls: maleUrls };
            } else {
              const uploadedUrls = await uploadFiles(p.reviewImageFiles);
              return {
                image_urls: [...p.imageUrls.filter(Boolean), ...uploadedUrls],
                female_image_urls: [],
                male_image_urls: [],
              };
            }
          })
        );

        const formData = new FormData();
        formData.append("session_id", sid);
        formData.append(
          "products_json",
          JSON.stringify(
            multiProducts.map((p, idx) => ({
              product_name: p.productName,
              brand_name: p.brandName,
              product_description: p.productDescription,
              product_handle: p.productHandle,
              target_gender: p.targetGender,
              language: p.language,
              review_count: p.reviewCount,
              image_urls: perProductUrls[idx].image_urls,
              female_image_urls: perProductUrls[idx].female_image_urls,
              male_image_urls: perProductUrls[idx].male_image_urls,
            }))
          )
        );
        multiProducts.forEach((p, idx) => {
          p.productImages.forEach((file) => {
            formData.append(`product_images_${idx}`, file);
          });
        });

        const resp = await fetch(`${API}/reviews/generate-multi`, {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
        if (!resp.ok) { setError(`Erreur serveur ${resp.status}`); setIsGenerating(false); return; }
        const reader = resp.body?.getReader();
        if (!reader) { setError("Flux SSE non disponible"); setIsGenerating(false); return; }
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done: rdone, value } = await reader.read();
          if (rdone) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (t.startsWith("data: ")) {
              try {
                const ev = JSON.parse(t.slice(6)) as SSEEvent;
                setEvents((p) => [...p, ev]);
                setProgress(ev.progress);
                if (ev.count !== undefined) setCount(ev.count);
                if (ev.type === "complete") {
                  setIsGenerating(false);
                  setDone(true);
                  const totalReviews = ev.count ?? multiProducts.reduce((s, p) => s + p.reviewCount, 0);
                  const namesLabel = multiProducts.length === 1
                    ? multiProducts[0].productName
                    : `${multiProducts.length} produits`;
                  await addPendingEntry({
                    sessionId: sid,
                    productName: namesLabel,
                    brandName: multiProducts[0]?.brandName ?? "",
                    reviewCount: totalReviews,
                  });
                  await refreshEntries();
                }
                if (ev.type === "error") { setError(ev.message); setIsGenerating(false); }
              } catch {}
            }
          }
        }
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setError(e instanceof Error ? e.message : "Erreur inconnue");
          setIsGenerating(false);
        }
      }
    })();
  };

  const handleNext = () => {
    if (mode === "multi" && step === 2) { startMultiGeneration(); return; }
    if (step === 3) { startGeneration(); return; }
    if (step < 5) setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step === 5) { setStep(4); return; }
    if (step === 4 && isGenerating) { abortRef.current?.(); setIsGenerating(false); }
    if (mode === "multi" && step === 4) { setStep(2); return; }
    if (step > 1) setStep((s) => s - 1);
  };

  const handleReset = async () => {
    abortRef.current?.();
    if (sessionId) { try { await deleteSession(sessionId); } catch {} }
    setStep(1);
    setForm(INITIAL);
    setMultiProducts([{
      id: crypto.randomUUID(),
      productName: "", brandName: "", productDescription: "",
      productHandle: "", targetGender: "femmes", language: "Français",
      reviewCount: 50, imageUrls: [], reviewImageFiles: [],
      femaleReviewImageFiles: [], maleReviewImageFiles: [], productImages: [],
    }]);
    setEvents([]); setProgress(0); setCount(0);
    setError(null); setSessionId(""); setDone(false); setIsGenerating(false);
  };

  const nextLabel =
    (mode === "multi" && step === 2) || step === 3
      ? "Générer les avis"
      : step === 4 && done
      ? "Voir les téléchargements"
      : "Suivant";

  const sv = {
    initial: { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
    exit:    { opacity: 0, x: -16, transition: { duration: 0.18, ease: "easeIn" } },
  };

  return (
    <div className="review-tool-root" style={{ minHeight: "100vh", background: "var(--bg)" }}>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{ background: "white", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 40 }}
      >
        <div className="flex items-center justify-between" style={{ maxWidth: 760, margin: "0 auto", padding: "14px 20px" }}>
          <div className="flex items-center gap-3">
            <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>← Accueil</span>
            </a>
            <div style={{ width: 1, height: 20, background: "var(--border)" }} />
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient)" }}>
              <Zap size={17} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight" style={{ color: "var(--text)" }}>Loox Review Generator</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>CSV compatible Shopify Loox</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHistory(true)}
              style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 10, border: "1.5px solid var(--border)", background: "white", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "inherit", transition: "all 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            >
              <History size={14} />
              <span className="hidden sm:inline">Fichiers</span>
              {csvEntries.filter((e) => e.status === "pending").length > 0 && (
                <span style={{ position: "absolute", top: -6, right: -6, background: "#EF4444", color: "white", fontSize: 10, fontWeight: 700, borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {csvEntries.filter((e) => e.status === "pending").length}
                </span>
              )}
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: "oklch(0.97 0 0)", color: "var(--primary)", border: "1px solid oklch(0.922 0 0)" }}>
              <Sparkles size={11} /> Propulsé par OpenRouter AI
            </div>
          </div>
        </div>
      </motion.header>

      {/* Hero banner (step 1 only) */}
      <AnimatePresence>
        {step === 1 && (
          <motion.div
            key="hero"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{ background: "linear-gradient(135deg, oklch(0.205 0 0) 0%, oklch(0.269 0 0) 100%)", padding: "36px 20px" }}
          >
            <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-4 text-xs font-semibold" style={{ background: "rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.9)" }}>
                <Sparkles size={12} /> Générateur d&apos;avis IA pour Loox
              </div>
              <h1 className="font-extrabold leading-tight mb-3" style={{ fontSize: "clamp(26px, 4vw, 38px)", color: "white" }}>
                Générez 100 avis authentiques<br />
                <span style={{ color: "rgba(255,255,255,0.65)" }}>en quelques minutes</span>
              </h1>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, maxWidth: 480, margin: "0 auto 20px" }}>
                L&apos;IA analyse vos photos produit, génère des avis réalistes avec réponses boutique,
                et exporte un CSV prêt à importer dans Loox.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {["✓ 100 langues", "✓ Réponses incluses", "✓ Analyse vision IA", "✓ Format Loox officiel"].map((f) => (
                  <span key={f} className="text-xs font-medium px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}>{f}</span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main */}
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px 80px" }}>
        <StepIndicator currentStep={step} multi={mode === "multi"} />

        <motion.div
          className="card"
          style={{ padding: "clamp(20px, 4vw, 36px)" }}
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="s1" {...sv}>
                <div className="flex items-center gap-1 p-1 mb-6 rounded-xl" style={{ background: "#F3F4F6", width: "fit-content" }}>
                  {(["single", "multi"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setMode(m)} style={{ padding: "6px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s", background: mode === m ? "white" : "transparent", color: mode === m ? "var(--primary)" : "var(--text-muted)", boxShadow: mode === m ? "var(--shadow-sm)" : "none" }}>
                      {m === "single" ? "1 produit" : "Plusieurs produits"}
                    </button>
                  ))}
                </div>
                {mode === "single" ? (
                  <ProductForm productName={form.productName} brandName={form.brandName} productDescription={form.productDescription} productHandle={form.productHandle} productImages={form.productImages} onChange={set} onProductImagesChange={(files) => setForm((p) => ({ ...p, productImages: files }))} />
                ) : (
                  <MultiProductForm products={multiProducts} onChange={setMultiProducts} />
                )}
              </motion.div>
            )}
            {step === 2 && mode === "single" && (
              <motion.div key="s2" {...sv}>
                <SettingsForm targetGender={form.targetGender} language={form.language} reviewCount={form.reviewCount} onChange={set} />
              </motion.div>
            )}
            {step === 2 && mode === "multi" && (
              <motion.div key="s2m" {...sv}>
                <MultiImageUpload products={multiProducts} onChange={setMultiProducts} />
              </motion.div>
            )}
            {step === 3 && mode === "single" && (
              <motion.div key="s3" {...sv}>
                {form.targetGender === "mixte" ? (
                  <GenderedImageUpload
                    femaleImageUrls={form.femaleImageUrls}
                    maleImageUrls={form.maleImageUrls}
                    onFemaleUrlsChange={(urls) => setForm((p) => ({ ...p, femaleImageUrls: urls }))}
                    onMaleUrlsChange={(urls) => setForm((p) => ({ ...p, maleImageUrls: urls }))}
                  />
                ) : (
                  <ImageUpload imageUrls={form.imageUrls} onUrlsChange={(urls) => setForm((p) => ({ ...p, imageUrls: urls }))} />
                )}
              </motion.div>
            )}
            {step === 4 && (
              <motion.div key="s4" {...sv}>
                <GenerationProgress events={events} isGenerating={isGenerating} currentProgress={progress} currentCount={count} totalCount={form.reviewCount} error={error} />
              </motion.div>
            )}
            {step === 5 && sessionId && (
              <motion.div key="s5" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35, type: "spring", stiffness: 300, damping: 24 }}>
                <DownloadSection sessionId={sessionId} reviewCount={count || form.reviewCount} brandName={mode === "multi" ? (multiProducts[0]?.brandName ?? "") : form.brandName} onReset={handleReset} onDownloaded={refreshEntries} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Navigation */}
        <motion.div
          className="flex items-center justify-between mt-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <motion.button className="btn-secondary" onClick={handleBack} disabled={step === 1} whileTap={{ scale: 0.97 }}>
            <ChevronLeft size={16} /> Retour
          </motion.button>

          {step !== 5 && (
            <>
              {step !== 4 && (
                <motion.button className="btn-primary" onClick={handleNext} disabled={!canNext()} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  {(mode === "multi" && step === 2) || step === 3
                    ? <><Sparkles size={15} />{nextLabel}</>
                    : <>{nextLabel}<ChevronRight size={16} /></>}
                </motion.button>
              )}
              {step === 4 && done && (
                <motion.button className="btn-primary" onClick={() => setStep(5)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <ArrowRight size={15} /> Télécharger les avis
                </motion.button>
              )}
              {step === 4 && isGenerating && (
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--primary)" }}>
                  <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
                  Génération en cours...
                </div>
              )}
              {step === 4 && error && !isGenerating && (
                <motion.button className="btn-primary" onClick={mode === "multi" ? startMultiGeneration : startGeneration} whileTap={{ scale: 0.97 }}>
                  <RefreshCw size={14} /> Réessayer
                </motion.button>
              )}
            </>
          )}
        </motion.div>
      </main>

      {showHistory && (
        <CSVHistoryPanel entries={csvEntries} onClose={() => setShowHistory(false)} onRefresh={refreshEntries} />
      )}

      <footer style={{ borderTop: "1px solid var(--border)", padding: "20px", textAlign: "center", fontSize: 12, color: "var(--text-muted)", background: "white" }}>
        Loox Review Generator · <a href="/" style={{ color: "var(--primary)", textDecoration: "none" }}>← Retour à l&apos;accueil</a> · Propulsé par{" "}
        <span style={{ color: "var(--primary)", fontWeight: 600 }}>OpenRouter AI</span>
      </footer>
    </div>
  );
}
