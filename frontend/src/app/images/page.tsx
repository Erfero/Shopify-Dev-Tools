"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ImageIcon, Upload, Search, CheckSquare, CloudUpload,
  ChevronLeft, X, Check, Loader2, ArrowLeft, ExternalLink,
  Sparkles, Store, Plus
} from "lucide-react";
import Link from "next/link";
import {
  analyzeProductImage,
  searchImages,
  generateImages,
  uploadImagesToShopify,
  type AnalysisResult,
  type ImageResult,
} from "@/lib/api-images";
import { toast } from "sonner";

type Step = "product" | "analyzing" | "gallery" | "shopify" | "done";

interface SavedStore {
  id: string;
  name: string;
  domain: string;
  token: string;
}

const LS_KEY = "shopify_saved_stores";

function loadStores(): SavedStore[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistStores(stores: SavedStore[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(stores));
}

const sv = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  exit:    { opacity: 0, x: -16, transition: { duration: 0.18, ease: "easeIn" } },
};

export default function ImagesPage() {
  const [step, setStep] = useState<Step>("product");

  // Product info
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [marketingAngles, setMarketingAngles] = useState("");
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Analysis
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  // Mode
  const [mode, setMode] = useState<"search" | "generate">("search");

  // Gallery
  const [images, setImages] = useState<ImageResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Saved stores
  const [savedStores, setSavedStores] = useState<SavedStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [showAddStore, setShowAddStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreDomain, setNewStoreDomain] = useState("");
  const [newStoreToken, setNewStoreToken] = useState("");

  // Upload
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<{ uploaded: number; urls: string[] } | null>(null);

  useEffect(() => {
    const stores = loadStores();
    setSavedStores(stores);
    if (stores.length > 0) setSelectedStoreId(stores[0].id);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const onImageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setProductImage(file);
      setProductImagePreview(URL.createObjectURL(file));
    }
  }, []);

  const onImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProductImage(file);
      setProductImagePreview(URL.createObjectURL(file));
    }
  };

  const handleAnalyze = async () => {
    if (!productName.trim()) {
      toast.error("Nom du produit requis.");
      return;
    }
    setStep("analyzing");
    try {
      const result = await analyzeProductImage(productImage, productName, productDescription, marketingAngles);
      setAnalysis(result);

      if (mode === "search") {
        setLoadingSearch(true);
        const imgs = await searchImages(result.search_queries, 2, 8);
        setImages(imgs);
        setLoadingSearch(false);
        if (imgs.length === 0) toast.warning("Aucune image trouvée. Vérifie tes clés API Pexels/Unsplash.");
      } else {
        const prompt = result.dalle_prompt ||
          `Professional lifestyle product photo of ${productName}, high quality, realistic, white background`;
        const imgs = await generateImages(prompt, 2, 8);
        setImages(imgs);
        if (imgs.length === 0) toast.warning("Génération échouée. Vérifie ta clé OpenRouter.");
      }

      setStep("gallery");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      toast.error(msg);
      setStep("product");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const goToShopify = () => {
    if (selected.size === 0) return;
    if (savedStores.length === 0) setShowAddStore(true);
    setStep("shopify");
  };

  const addStore = () => {
    if (!newStoreName.trim() || !newStoreDomain.trim() || !newStoreToken.trim()) {
      toast.error("Tous les champs sont requis.");
      return;
    }
    const store: SavedStore = {
      id: Date.now().toString(),
      name: newStoreName.trim(),
      domain: newStoreDomain.trim().replace(/^https?:\/\//, ""),
      token: newStoreToken.trim(),
    };
    const updated = [...savedStores, store];
    persistStores(updated);
    setSavedStores(updated);
    setSelectedStoreId(store.id);
    setShowAddStore(false);
    setNewStoreName(""); setNewStoreDomain(""); setNewStoreToken("");
    toast.success("Boutique sauvegardée !");
  };

  const deleteStore = (id: string) => {
    const updated = savedStores.filter(s => s.id !== id);
    persistStores(updated);
    setSavedStores(updated);
    if (selectedStoreId === id) setSelectedStoreId(updated[0]?.id || "");
  };

  const handleUpload = async () => {
    if (selected.size === 0) { toast.error("Sélectionne au moins une image."); return; }
    const store = savedStores.find(s => s.id === selectedStoreId);
    if (!store) { toast.error("Sélectionne une boutique."); return; }
    setUploading(true);
    try {
      const toUpload = images.filter(img => selected.has(img.id));
      const { uploaded, results } = await uploadImagesToShopify(toUpload, store.domain, store.token);
      const urls = results.filter(r => r.success).map(r => r.url);
      setUploadResults({ uploaded, urls });
      setStep("done");
      toast.success(`${uploaded} image(s) uploadée(s) sur Shopify !`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload échoué";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const resetAll = () => {
    setStep("product");
    setSelected(new Set());
    setImages([]);
    setAnalysis(null);
    setUploadResults(null);
    setProductImage(null);
    setProductImagePreview(null);
    setProductName("");
    setProductDescription("");
    setMarketingAngles("");
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
          <span className="text-border/60">|</span>
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-foreground/60" />
            <span className="font-semibold text-sm">Image Finder</span>
          </div>
          <div className="ml-auto flex gap-2">
            {(["product","analyzing","gallery","shopify","done"] as Step[]).map((s, i) => (
              <div key={s} className={`h-1.5 w-8 rounded-full transition-colors ${
                ["product","analyzing","gallery","shopify","done"].indexOf(step) >= i
                  ? "bg-foreground/70" : "bg-foreground/10"
              }`} />
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <AnimatePresence mode="wait">

          {/* ── STEP 1: Product info ──────────────────────────────────────── */}
          {step === "product" && (
            <motion.div key="product" {...sv} className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold">Recherche d&apos;images produit</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Uploade ton image produit — l&apos;IA analyse visuellement le produit et cherche des photos lifestyle correspondantes sur Pexels et Unsplash.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                {/* Image drop zone */}
                <div>
                  <label className="block text-sm font-medium mb-2">Image du produit <span className="text-muted-foreground text-xs font-normal">(optionnel — améliore la précision)</span></label>
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={onImageDrop}
                    onClick={() => fileRef.current?.click()}
                    className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/60 bg-foreground/[0.01] p-6 cursor-pointer hover:border-foreground/30 hover:bg-foreground/[0.03] transition-all min-h-[200px]"
                  >
                    {productImagePreview ? (
                      <>
                        <img src={productImagePreview} alt="produit" className="max-h-40 rounded-lg object-contain" />
                        <button
                          onClick={e => { e.stopPropagation(); setProductImage(null); setProductImagePreview(null); }}
                          className="absolute top-2 right-2 rounded-full bg-background border border-border p-1 hover:bg-muted"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <p className="mt-2 text-xs text-muted-foreground">{productImage?.name}</p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground text-center">
                          Glisse ton image ici<br />
                          <span className="text-xs">ou clique pour choisir</span>
                        </p>
                      </>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onImageSelect} />
                  </div>
                </div>

                {/* Product info */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Nom du produit <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={productName}
                      onChange={e => setProductName(e.target.value)}
                      placeholder="ex: Sérum vitamine C 30ml"
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Description / bénéfices</label>
                    <textarea
                      value={productDescription}
                      onChange={e => setProductDescription(e.target.value)}
                      placeholder="ex: Sérum anti-âge à base de vitamine C pure, réduit les taches, illumine le teint en 14 jours..."
                      rows={3}
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Angles marketing</label>
                    <textarea
                      value={marketingAngles}
                      onChange={e => setMarketingAngles(e.target.value)}
                      placeholder="ex: Résultats visibles en 7 jours, peau lumineuse avant/après, femmes 30-50 ans, routine beauté quotidienne, formule naturelle..."
                      rows={3}
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Résultats attendus, public cible, arguments de vente — enrichit la recherche d&apos;images.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* Mode toggle */}
                <div className="flex gap-1 p-1 rounded-xl bg-foreground/[0.04] border border-border/40">
                  <button
                    onClick={() => setMode("search")}
                    className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                      mode === "search"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Search className="h-3.5 w-3.5" />
                    Trouver des photos
                  </button>
                  <button
                    onClick={() => setMode("generate")}
                    className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                      mode === "generate"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Générer avec DALL-E
                  </button>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={!productName.trim()}
                  className="flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-80 disabled:opacity-30"
                >
                  {mode === "search" ? <Search className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  {mode === "search" ? "Rechercher des photos" : "Générer avec DALL-E"}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: Analyzing ─────────────────────────────────────────── */}
          {step === "analyzing" && (
            <motion.div key="analyzing" {...sv} className="flex flex-col items-center justify-center py-24 gap-6">
              <div className="relative">
                <div className="h-16 w-16 rounded-2xl bg-foreground/[0.05] border border-border/60 flex items-center justify-center">
                  <Loader2 className="h-7 w-7 text-foreground/50 animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <h2 className="font-semibold text-lg">Analyse en cours…</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  L&apos;IA analyse ton image produit et recherche des photos correspondantes
                </p>
              </div>
              <div className="flex gap-2">
                {(mode === "search"
                  ? ["Analyse visuelle IA", "Recherche Pexels", "Recherche Unsplash"]
                  : ["Analyse du produit", "Génération DALL-E 3"]
                ).map((label, i) => (
                  <span key={i} className="rounded-full border border-border/60 bg-foreground/[0.03] px-3 py-1 text-xs text-muted-foreground animate-pulse" style={{ animationDelay: `${i * 0.3}s` }}>
                    {label}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: Gallery ───────────────────────────────────────────── */}
          {step === "gallery" && (
            <motion.div key="gallery" {...sv} className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Sélectionne tes images</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {images.filter(i => i.orientation === "landscape").length} landscape · {images.filter(i => i.orientation === "portrait").length} portrait · {selected.size} sélectionnée(s)
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setStep("product")}
                    className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" /> Modifier
                  </button>
                  <button
                    onClick={goToShopify}
                    disabled={selected.size === 0}
                    className="flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:opacity-80 disabled:opacity-30"
                  >
                    <Store className="h-4 w-4" />
                    Uploader sur Shopify ({selected.size})
                  </button>
                </div>
              </div>

              {/* Analysis tags */}
              {analysis && (
                <div className="rounded-xl border border-border/60 bg-foreground/[0.01] p-4 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Analyse IA du produit</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: "Catégorie", value: analysis.product_category },
                        { label: "Cible", value: analysis.target_audience },
                        { label: "Usage", value: analysis.usage_context },
                      ].map(({ label, value }) => (
                        <span key={label} className="rounded-full border border-border/50 bg-background px-2.5 py-0.5 text-xs">
                          <span className="text-muted-foreground">{label} : </span>
                          {value}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Requêtes de recherche utilisées ({analysis.search_queries.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.search_queries.map((q, i) => (
                        <span key={i} className="rounded-full bg-foreground/5 border border-border/40 px-2.5 py-0.5 text-xs text-muted-foreground">
                          {q}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {loadingSearch ? (
                <div className="space-y-6">
                  <div>
                    <div className="h-3.5 w-28 rounded bg-foreground/[0.05] mb-2 animate-pulse" />
                    <div className="grid grid-cols-2 gap-3">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="aspect-video rounded-xl bg-foreground/[0.04] animate-pulse" />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="h-3.5 w-28 rounded bg-foreground/[0.05] mb-2 animate-pulse" />
                    <div className="grid grid-cols-4 gap-3">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="aspect-[3/4] rounded-xl bg-foreground/[0.04] animate-pulse" />
                      ))}
                    </div>
                  </div>
                </div>
              ) : images.length === 0 ? (
                <div className="flex flex-col items-center py-20 gap-3 text-muted-foreground">
                  <Search className="h-10 w-10 opacity-30" />
                  <p className="text-sm">Aucune image trouvée. Vérifie tes clés API Pexels / Unsplash.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Landscape 16:9 */}
                  {images.filter(img => img.orientation === "landscape").length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Landscape 16:9 · {images.filter(img => img.orientation === "landscape").length} image(s)
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {images.filter(img => img.orientation === "landscape").map(img => (
                          <button
                            key={img.id}
                            onClick={() => toggleSelect(img.id)}
                            className={`group relative rounded-xl overflow-hidden border-2 transition-all focus:outline-none ${
                              selected.has(img.id) ? "border-foreground shadow-md" : "border-transparent hover:border-foreground/30"
                            }`}
                          >
                            <img src={img.thumb} alt={img.alt} className="w-full aspect-video object-cover" loading="lazy" />
                            <div className={`absolute inset-0 bg-foreground/40 transition-opacity ${selected.has(img.id) ? "opacity-100" : "opacity-0 group-hover:opacity-20"}`} />
                            {selected.has(img.id) && (
                              <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground">
                                <Check className="h-3 w-3 text-background" />
                              </div>
                            )}
                            <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white/90">{img.source}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Portrait 3:4 */}
                  {images.filter(img => img.orientation === "portrait").length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Portrait 3:4 · {images.filter(img => img.orientation === "portrait").length} image(s)
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {images.filter(img => img.orientation === "portrait").map(img => (
                          <button
                            key={img.id}
                            onClick={() => toggleSelect(img.id)}
                            className={`group relative rounded-xl overflow-hidden border-2 transition-all focus:outline-none ${
                              selected.has(img.id) ? "border-foreground shadow-md" : "border-transparent hover:border-foreground/30"
                            }`}
                          >
                            <img src={img.thumb} alt={img.alt} className="w-full aspect-[3/4] object-cover" loading="lazy" />
                            <div className={`absolute inset-0 bg-foreground/40 transition-opacity ${selected.has(img.id) ? "opacity-100" : "opacity-0 group-hover:opacity-20"}`} />
                            {selected.has(img.id) && (
                              <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground">
                                <Check className="h-3 w-3 text-background" />
                              </div>
                            )}
                            <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white/90">{img.source}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ── STEP 4: Store picker ──────────────────────────────────────── */}
          {step === "shopify" && (
            <motion.div key="shopify" {...sv} className="space-y-6 max-w-lg mx-auto">
              <div>
                <button onClick={() => setStep("gallery")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
                  <ChevronLeft className="h-4 w-4" /> Retour à la galerie
                </button>
                <h2 className="text-xl font-semibold">Choisir une boutique</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selected.size} image(s) à uploader
                </p>
              </div>

              {/* Saved store cards */}
              {savedStores.length > 0 && !showAddStore && (
                <div className="grid sm:grid-cols-2 gap-3">
                  {savedStores.map(store => (
                    <button
                      key={store.id}
                      onClick={() => setSelectedStoreId(store.id)}
                      className={`group relative flex flex-col text-left rounded-xl border-2 p-4 transition-all ${
                        selectedStoreId === store.id
                          ? "border-foreground bg-foreground/[0.03]"
                          : "border-border/60 hover:border-foreground/30"
                      }`}
                    >
                      <Store className="h-4 w-4 mb-2 text-foreground/50" />
                      <span className="font-semibold text-sm">{store.name}</span>
                      <span className="text-xs text-muted-foreground mt-0.5 truncate">{store.domain}</span>
                      {selectedStoreId === store.id && (
                        <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground">
                          <Check className="h-3 w-3 text-background" />
                        </div>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); deleteStore(store.id); }}
                        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 rounded-full p-1 text-muted-foreground hover:text-red-500 transition-all"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </button>
                  ))}

                  <button
                    onClick={() => setShowAddStore(true)}
                    className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/60 p-4 hover:border-foreground/30 text-muted-foreground hover:text-foreground transition-all min-h-[88px]"
                  >
                    <Plus className="h-5 w-5 mb-1" />
                    <span className="text-sm">Ajouter une boutique</span>
                  </button>
                </div>
              )}

              {/* Add store form */}
              {(savedStores.length === 0 || showAddStore) && (
                <div className="rounded-xl border border-border/60 bg-foreground/[0.01] p-5 space-y-4">
                  <p className="text-sm font-medium">
                    {savedStores.length === 0 ? "Ajoute ta première boutique" : "Nouvelle boutique"}
                  </p>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">Nom affiché</label>
                    <input
                      type="text"
                      value={newStoreName}
                      onChange={e => setNewStoreName(e.target.value)}
                      placeholder="ex: CurmaParis"
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">Domaine Shopify</label>
                    <input
                      type="text"
                      value={newStoreDomain}
                      onChange={e => setNewStoreDomain(e.target.value)}
                      placeholder="ma-boutique.myshopify.com"
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">Token Admin API</label>
                    <input
                      type="password"
                      value={newStoreToken}
                      onChange={e => setNewStoreToken(e.target.value)}
                      placeholder="shpat_xxxxxxxxxxxxxxxxxxxx"
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={addStore}
                      className="flex-1 rounded-xl bg-foreground py-2.5 text-sm font-semibold text-background hover:opacity-80 transition-opacity"
                    >
                      Sauvegarder
                    </button>
                    {showAddStore && savedStores.length > 0 && (
                      <button
                        onClick={() => setShowAddStore(false)}
                        className="rounded-xl border border-border px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Upload button */}
              {!showAddStore && selectedStoreId && (
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-sm font-semibold text-background transition hover:opacity-80 disabled:opacity-30"
                >
                  {uploading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Upload en cours…</>
                  ) : (
                    <><CloudUpload className="h-4 w-4" /> Uploader {selected.size} image(s)</>
                  )}
                </button>
              )}
            </motion.div>
          )}

          {/* ── STEP 5: Done ─────────────────────────────────────────────── */}
          {step === "done" && uploadResults && (
            <motion.div key="done" {...sv} className="flex flex-col items-center py-12 gap-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10 border border-green-500/30">
                <CheckSquare className="h-8 w-8 text-green-500" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-semibold">{uploadResults.uploaded} image(s) uploadée(s) !</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tes images sont maintenant disponibles dans la médiathèque de ta boutique Shopify.
                </p>
              </div>

              {uploadResults.urls.length > 0 && (
                <div className="w-full max-w-lg space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">URLs Shopify :</p>
                  {uploadResults.urls.map((url, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-border/60 bg-foreground/[0.02] px-3 py-2">
                      <span className="text-xs text-muted-foreground truncate flex-1">{url}</span>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 hover:text-foreground transition-colors">
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </a>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={resetAll}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                >
                  Nouvelle recherche
                </button>
                <Link href="/" className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:opacity-80 transition-opacity">
                  Accueil
                </Link>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
