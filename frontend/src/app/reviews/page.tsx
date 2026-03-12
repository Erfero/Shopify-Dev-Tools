"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
    reviewCount: 50, imageUrls: [], reviewImageFiles: [], productImages: [],
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
        const reviewUrlsPerProduct: string[][] = await Promise.all(
          multiProducts.map(async (p) => {
            if (p.reviewImageFiles.length === 0) return p.imageUrls.filter(Boolean);
            const uploadForm = new FormData();
            p.reviewImageFiles.forEach((f) => uploadForm.append("files", f));
            const uploadResp = await fetch(`${API}/reviews/upload-images`, {
              method: "POST",
              body: uploadForm,
              signal: controller.signal,
            });
            if (!uploadResp.ok) return p.imageUrls.filter(Boolean);
            const uploadData = await uploadResp.json();
            return [...p.imageUrls.filter(Boolean), ...(uploadData.urls ?? [])];
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
              image_urls: reviewUrlsPerProduct[idx],
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
      reviewCount: 50, imageUrls: [], reviewImageFiles: [], productImages: [],
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

  return (
    <div className="review-tool-root" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <header
        style={{
          background: "white",
          borderBottom: "1px solid var(--border)",
          position: "sticky", top: 0, zIndex: 40,
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{ maxWidth: 760, margin: "0 auto", padding: "14px 20px" }}
        >
          <div className="flex items-center gap-3">
            <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>← Accueil</span>
            </a>
            <div style={{ width: 1, height: 20, background: "var(--border)" }} />
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "var(--gradient)" }}
            >
              <Zap size={17} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight" style={{ color: "var(--text)" }}>
                Loox Review Generator
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                CSV compatible Shopify Loox
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHistory(true)}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 10,
                border: "1.5px solid var(--border)",
                background: "white",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-secondary)",
                fontFamily: "inherit",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            >
              <History size={14} />
              <span className="hidden sm:inline">Fichiers</span>
              {csvEntries.filter((e) => e.status === "pending").length > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -6, right: -6,
                    background: "#EF4444",
                    color: "white",
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: "50%",
                    width: 18, height: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {csvEntries.filter((e) => e.status === "pending").length}
                </span>
              )}
            </button>

            <div
              className="hidden sm:flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: "oklch(0.97 0 0)", color: "var(--primary)", border: "1px solid oklch(0.922 0 0)" }}
            >
              <Sparkles size={11} />
              Propulsé par OpenRouter AI
            </div>
          </div>
        </div>
      </header>

      {/* Hero banner (step 1 only) */}
      {step === 1 && (
        <div
          style={{
            background: "linear-gradient(135deg, oklch(0.205 0 0) 0%, oklch(0.269 0 0) 100%)",
            padding: "36px 20px",
          }}
        >
          <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-4 text-xs font-semibold"
              style={{ background: "rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.9)" }}
            >
              <Sparkles size={12} /> Générateur d&apos;avis IA pour Loox
            </div>
            <h1
              className="font-extrabold leading-tight mb-3"
              style={{ fontSize: "clamp(26px, 4vw, 38px)", color: "white" }}
            >
              Générez 100 avis authentiques
              <br />
              <span style={{ color: "rgba(255,255,255,0.65)" }}>en quelques minutes</span>
            </h1>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, maxWidth: 480, margin: "0 auto 20px" }}>
              L&apos;IA analyse vos photos produit, génère des avis réalistes avec réponses boutique,
              et exporte un CSV prêt à importer dans Loox.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {["✓ 100 langues", "✓ Réponses incluses", "✓ Analyse vision IA", "✓ Format Loox officiel"].map((f) => (
                <span
                  key={f}
                  className="text-xs font-medium px-3 py-1 rounded-full"
                  style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px 80px" }}>
        <StepIndicator currentStep={step} multi={mode === "multi"} />

        <div className="card" style={{ padding: "clamp(20px, 4vw, 36px)" }}>
          {step === 1 && (
            <>
              <div
                className="flex items-center gap-1 p-1 mb-6 rounded-xl"
                style={{ background: "#F3F4F6", width: "fit-content" }}
              >
                {(["single", "multi"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    style={{
                      padding: "6px 16px",
                      borderRadius: 10,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      transition: "all 0.15s",
                      background: mode === m ? "white" : "transparent",
                      color: mode === m ? "var(--primary)" : "var(--text-muted)",
                      boxShadow: mode === m ? "var(--shadow-sm)" : "none",
                    }}
                  >
                    {m === "single" ? "1 produit" : "Plusieurs produits"}
                  </button>
                ))}
              </div>

              {mode === "single" ? (
                <ProductForm
                  productName={form.productName}
                  brandName={form.brandName}
                  productDescription={form.productDescription}
                  productHandle={form.productHandle}
                  productImages={form.productImages}
                  onChange={set}
                  onProductImagesChange={(files) => setForm((p) => ({ ...p, productImages: files }))}
                />
              ) : (
                <MultiProductForm
                  products={multiProducts}
                  onChange={setMultiProducts}
                />
              )}
            </>
          )}
          {step === 2 && mode === "single" && (
            <SettingsForm
              targetGender={form.targetGender}
              language={form.language}
              reviewCount={form.reviewCount}
              onChange={set}
            />
          )}
          {step === 2 && mode === "multi" && (
            <MultiImageUpload
              products={multiProducts}
              onChange={setMultiProducts}
            />
          )}
          {step === 3 && mode === "single" && (
            <ImageUpload
              imageUrls={form.imageUrls}
              onUrlsChange={(urls) => setForm((p) => ({ ...p, imageUrls: urls }))}
            />
          )}
          {step === 4 && (
            <GenerationProgress
              events={events}
              isGenerating={isGenerating}
              currentProgress={progress}
              currentCount={count}
              totalCount={form.reviewCount}
              error={error}
            />
          )}
          {step === 5 && sessionId && (
            <DownloadSection
              sessionId={sessionId}
              reviewCount={count || form.reviewCount}
              brandName={mode === "multi" ? (multiProducts[0]?.brandName ?? "") : form.brandName}
              onReset={handleReset}
              onDownloaded={refreshEntries}
            />
          )}
        </div>

        {/* Navigation */}
        {step !== 5 && (
          <div className="flex items-center justify-between mt-5">
            <button className="btn-secondary" onClick={handleBack} disabled={step === 1}>
              <ChevronLeft size={16} /> Retour
            </button>

            {step !== 4 && (
              <button className="btn-primary" onClick={handleNext} disabled={!canNext()}>
                {(mode === "multi" && step === 2) || step === 3
                  ? <><Sparkles size={15} />{nextLabel}</>
                  : <>{nextLabel}<ChevronRight size={16} /></>}
              </button>
            )}

            {step === 4 && done && (
              <button className="btn-primary" onClick={() => setStep(5)}>
                <ArrowRight size={15} /> Télécharger les avis
              </button>
            )}

            {step === 4 && isGenerating && (
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--primary)" }}>
                <div
                  className="w-4 h-4 rounded-full border-2 animate-spin"
                  style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
                />
                Génération en cours...
              </div>
            )}

            {step === 4 && error && !isGenerating && (
              <button className="btn-primary" onClick={mode === "multi" ? startMultiGeneration : startGeneration}>
                <RefreshCw size={14} /> Réessayer
              </button>
            )}
          </div>
        )}
      </main>

      {showHistory && (
        <CSVHistoryPanel
          entries={csvEntries}
          onClose={() => setShowHistory(false)}
          onRefresh={refreshEntries}
        />
      )}

      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "20px",
          textAlign: "center",
          fontSize: 12,
          color: "var(--text-muted)",
          background: "white",
        }}
      >
        Loox Review Generator · <a href="/" style={{ color: "var(--primary)", textDecoration: "none" }}>← Retour à l&apos;accueil</a> · Propulsé par{" "}
        <span style={{ color: "var(--primary)", fontWeight: 600 }}>OpenRouter AI</span>
      </footer>
    </div>
  );
}
