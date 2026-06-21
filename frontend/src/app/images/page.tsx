"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ImageIcon, Search, X, Check, Loader2, ArrowLeft,
  Sparkles, Store, Plus, Shapes, Copy, Download,
  Award, RefreshCw, CloudUpload, AlertCircle, ChevronDown,
} from "lucide-react";

import Link from "next/link";
import {
  analyzeProductImage,
  searchImages as searchStockImages,
  generateImages,
  findProductIcons,
  uploadImagesToShopify,
  uploadIconBinaryToShopify,
  getImagesConfig,
  type ImageResult,
  type IconResult,
  type ImagesConfig,
} from "@/lib/api-images";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface SavedStore {
  id: string;
  name: string;
  domain: string;
  token: string;
}

interface CustomizerData {
  productName: string;
  brandName: string;
  productDescription: string;
  marketingAngles: string;
  productImageBase64: string[];
  benefits: { title: string; text: string }[];
  advantages: { title: string; text: string }[];
}

type ActiveTab = "search" | "generate" | "icons";

// ── Helpers ────────────────────────────────────────────────────────────────────

const LS_KEY = "shopify_saved_stores";

function loadStores(): SavedStore[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); } catch { return []; }
}
function persistStores(stores: SavedStore[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(stores));
}
function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, b64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new File([arr], filename, { type: mime });
}
async function svgToPngBlob(svgContent: string): Promise<Blob> {
  const size = 512;
  const pad = 64;
  const inner = size - pad * 2;
  const fixed = svgContent
    .replace(/width="[^"]*"/g, `width="${inner}"`)
    .replace(/height="[^"]*"/g, `height="${inner}"`);
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    let objUrl = "";
    img.onload = () => {
      ctx.drawImage(img, pad, pad, inner, inner);
      URL.revokeObjectURL(objUrl);
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob failed"));
      }, "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error("SVG render failed")); };
    const svgBlob = new Blob([fixed], { type: "image/svg+xml" });
    objUrl = URL.createObjectURL(svgBlob);
    img.src = objUrl;
  });
}

const sv = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  exit: { opacity: 0, x: -12, transition: { duration: 0.15, ease: "easeIn" } },
};

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ImagesPage() {
  // Customizer data (auto-loaded from localStorage)
  const [customizerData, setCustomizerData] = useState<CustomizerData | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("search");

  // Results per tab
  const [searchResults, setSearchResults] = useState<ImageResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [generateResults, setGenerateResults] = useState<ImageResult[]>([]);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [iconResults, setIconResults] = useState<IconResult[]>([]);
  const [iconsLoading, setIconsLoading] = useState(false);

  // Config
  const [config, setConfig] = useState<ImagesConfig | null>(null);

  // Shopify stores
  const [savedStores, setSavedStores] = useState<SavedStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [showStorePanel, setShowStorePanel] = useState(false);
  const [showAddStore, setShowAddStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreDomain, setNewStoreDomain] = useState("");
  const [newStoreToken, setNewStoreToken] = useState("");

  // Per-image upload state
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const storePanelRef = useRef<HTMLDivElement>(null);

  const refreshCustomizerData = useRef(() => {});

  useEffect(() => {
    const stores = loadStores();
    setSavedStores(stores);
    if (stores.length > 0) setSelectedStoreId(stores[0].id);
    getImagesConfig().then(setConfig).catch(() => {});

    // Reads the latest data from the Customizer out of localStorage.
    // Called on mount AND whenever the window gets focus (covers same-tab and cross-tab navigation).
    const readFromCustomizer = () => {
      try {
        const sessionRaw = localStorage.getItem("theme_session");
        const imagesRaw = localStorage.getItem("theme_product_images");
        const session = sessionRaw ? JSON.parse(sessionRaw) : null;
        const lastConfig = session?.lastConfig ?? {};
        const hp = session?.previewData?.homepage ?? {};
        const imageBase64: string[] = imagesRaw ? JSON.parse(imagesRaw) : [];

        setCustomizerData({
          productName: (Array.isArray(lastConfig.product_names) ? lastConfig.product_names[0] : "").trim(),
          brandName: (lastConfig.store_name ?? "").trim(),
          productDescription: (lastConfig.product_description ?? "").trim(),
          marketingAngles: (lastConfig.marketing_angles ?? "").trim(),
          productImageBase64: imageBase64,
          benefits: Array.isArray(hp.benefits) ? hp.benefits.slice(0, 3) : [],
          advantages: Array.isArray(hp.advantages) ? hp.advantages.slice(0, 3) : [],
        });
      } catch {}
    };

    refreshCustomizerData.current = readFromCustomizer;
    readFromCustomizer();

    // Re-read every time the user comes back to this tab or window
    const onVisibility = () => { if (document.visibilityState === "visible") readFromCustomizer(); };
    window.addEventListener("focus", readFromCustomizer);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", readFromCustomizer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close store panel when clicking outside
  useEffect(() => {
    if (!showStorePanel) return;
    const handler = (e: MouseEvent) => {
      if (storePanelRef.current && !storePanelRef.current.contains(e.target as Node)) {
        setShowStorePanel(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showStorePanel]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const hasData = Boolean(customizerData?.productName);
  const selectedStore = savedStores.find(s => s.id === selectedStoreId) ?? null;

  const getFirstProductFile = (): File | null => {
    if (!customizerData?.productImageBase64.length) return null;
    return dataUrlToFile(customizerData.productImageBase64[0], "product-0.jpg");
  };

  // ── Action handlers ───────────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!customizerData?.productName) { toast.error("Aucune donnée du Customizer."); return; }
    setSearchLoading(true);
    try {
      const file = getFirstProductFile();
      const analysis = await analyzeProductImage(
        file, customizerData.productName, customizerData.productDescription, customizerData.marketingAngles,
      );
      const imgs = await searchStockImages(analysis.search_queries, 3, 12);
      setSearchResults(imgs);
      if (imgs.length === 0) toast.warning("Aucune image trouvée. Vérifie tes clés Pexels/Unsplash.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Recherche échouée");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!customizerData?.productName) { toast.error("Aucune donnée du Customizer."); return; }
    setGenerateLoading(true);
    try {
      const file = getFirstProductFile();
      const analysis = await analyzeProductImage(
        file, customizerData.productName, customizerData.productDescription, customizerData.marketingAngles,
      );
      const prompt = analysis.dalle_prompt ||
        `Professional lifestyle product photo of ${customizerData.productName}, high quality, realistic`;
      const imgs = await generateImages(prompt, 3, 12);
      setGenerateResults(imgs);
      if (imgs.length === 0) toast.warning("Génération échouée. Réessaie dans quelques secondes.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Génération échouée");
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleGenerateIcons = async () => {
    if (!customizerData?.productName) { toast.error("Aucune donnée du Customizer."); return; }
    setIconsLoading(true);
    try {
      const allBenefits = [
        ...customizerData.benefits.map(b => `${b.title}: ${stripHtml(b.text)}`),
        ...customizerData.advantages.map(a => `${a.title}: ${stripHtml(a.text)}`),
      ].join(". ");
      const marketingText = allBenefits || customizerData.marketingAngles;
      const icns = await findProductIcons(
        customizerData.productName, customizerData.productDescription, marketingText, 6,
      );
      setIconResults(icns);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Génération d'icônes échouée");
    } finally {
      setIconsLoading(false);
    }
  };

  const handleUploadSingle = async (img: ImageResult) => {
    if (!selectedStore) { toast.error("Configure une boutique Shopify d'abord."); setShowStorePanel(true); return; }
    setUploadingId(img.id);
    try {
      const result = await uploadImagesToShopify([img], selectedStore.domain, selectedStore.token);
      if (result.uploaded > 0) toast.success("Image uploadée sur Shopify !");
      else toast.error("Upload échoué.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload échoué");
    } finally {
      setUploadingId(null);
    }
  };

  const handleUploadIcon = async (icon: IconResult) => {
    if (!selectedStore) { toast.error("Configure une boutique Shopify d'abord."); setShowStorePanel(true); return; }
    const uid = `icon-${icon.icon}`;
    setUploadingId(uid);
    try {
      if (!icon.svg) throw new Error("SVG manquant pour cet icône.");
      const blob = await svgToPngBlob(icon.svg);
      await uploadIconBinaryToShopify(blob, `${icon.icon}.png`, icon.label, selectedStore.domain, selectedStore.token);
      toast.success("Icône uploadée sur Shopify !");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload échoué");
    } finally {
      setUploadingId(null);
    }
  };

  // ── Download helpers ──────────────────────────────────────────────────────────

  const downloadImage = async (img: ImageResult) => {
    try {
      const resp = await fetch(img.url);
      if (!resp.ok) throw new Error();
      const blob = await resp.blob();
      const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
      const safe = (img.alt || img.source).replace(/[^a-z0-9]/gi, "_").slice(0, 40);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl; a.download = `${safe}.${ext}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast.success("Image téléchargée !");
    } catch {
      window.open(img.url, "_blank", "noopener,noreferrer");
    }
  };

  const downloadAsPng = async (svgContent: string, iconName: string) => {
    if (!svgContent) { toast.error("SVG non disponible."); return; }
    try {
      const blob = await svgToPngBlob(svgContent);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl; a.download = `${iconName}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch { toast.error("Erreur rendu PNG."); }
  };

  const downloadSvg = (svgContent: string, iconName: string) => {
    if (!svgContent) { toast.error("SVG non disponible."); return; }
    const fixed = svgContent
      .replace(/width="[^"]*"/g, 'width="64"')
      .replace(/height="[^"]*"/g, 'height="64"');
    const blob = new Blob([fixed], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${iconName}.svg`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Store management ──────────────────────────────────────────────────────────

  const addStore = () => {
    if (!newStoreName.trim() || !newStoreDomain.trim() || !newStoreToken.trim()) {
      toast.error("Tous les champs sont requis."); return;
    }
    const store: SavedStore = {
      id: Date.now().toString(),
      name: newStoreName.trim(),
      domain: newStoreDomain.trim().replace(/^https?:\/\//, ""),
      token: newStoreToken.trim(),
    };
    const updated = [...savedStores, store];
    persistStores(updated); setSavedStores(updated);
    setSelectedStoreId(store.id); setShowAddStore(false);
    setNewStoreName(""); setNewStoreDomain(""); setNewStoreToken("");
    toast.success("Boutique sauvegardée !");
  };

  const deleteStore = (id: string) => {
    const updated = savedStores.filter(s => s.id !== id);
    persistStores(updated); setSavedStores(updated);
    if (selectedStoreId === id) setSelectedStoreId(updated[0]?.id || "");
  };

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">

      {/* ── Header ── */}
      <div className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Link>
          <span className="text-border/60">|</span>
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-foreground/60" />
            <span className="font-semibold text-sm">Image Finder</span>
          </div>

          {/* Store selector pill */}
          <div className="ml-auto relative" ref={storePanelRef}>
            <button
              onClick={() => { setShowStorePanel(v => !v); setShowAddStore(false); }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border ${
                selectedStore
                  ? "border-green-500/40 bg-green-500/8 text-green-700 dark:text-green-400 hover:bg-green-500/15"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              <Store className="h-3 w-3" />
              {selectedStore ? selectedStore.name : "Boutique Shopify"}
              <ChevronDown className={`h-3 w-3 transition-transform ${showStorePanel ? "rotate-180" : ""}`} />
            </button>

            {/* Store dropdown */}
            <AnimatePresence>
              {showStorePanel && (
                <motion.div
                  key="store-dropdown"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-border/80 bg-background shadow-xl p-4 space-y-3 z-30"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Boutique Shopify</p>
                    <button onClick={() => setShowStorePanel(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {savedStores.length > 0 && (
                    <div className="space-y-1.5">
                      {savedStores.map(store => (
                        <button
                          key={store.id}
                          onClick={() => { setSelectedStoreId(store.id); setShowStorePanel(false); }}
                          className={`group w-full flex items-center gap-2.5 text-left rounded-xl border-2 px-3 py-2.5 transition-all ${
                            selectedStoreId === store.id
                              ? "border-foreground bg-foreground/[0.03]"
                              : "border-border/60 hover:border-foreground/30"
                          }`}
                        >
                          <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{store.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{store.domain}</p>
                          </div>
                          {selectedStoreId === store.id && <Check className="h-4 w-4 text-foreground shrink-0" />}
                          <button
                            onClick={e => { e.stopPropagation(); deleteStore(store.id); }}
                            className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-red-500 transition-all"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </button>
                      ))}
                    </div>
                  )}

                  {showAddStore ? (
                    <div className="space-y-2 pt-1">
                      <input
                        value={newStoreName} onChange={e => setNewStoreName(e.target.value)}
                        placeholder="Nom de la boutique"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                      />
                      <input
                        value={newStoreDomain} onChange={e => setNewStoreDomain(e.target.value)}
                        placeholder="ma-boutique.myshopify.com"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                      />
                      <input
                        type="password" value={newStoreToken} onChange={e => setNewStoreToken(e.target.value)}
                        placeholder="shpat_xxxxxxxxxxxxxxxxxxxx"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                      />
                      <div className="flex gap-2">
                        <button onClick={addStore} className="flex-1 rounded-xl bg-foreground py-2 text-sm font-semibold text-background hover:opacity-80 transition-opacity">
                          Sauvegarder
                        </button>
                        <button onClick={() => setShowAddStore(false)} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted transition-colors">
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddStore(true)}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Ajouter une boutique
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">

        {/* Customizer data summary */}
        {hasData ? (
          <div className="rounded-2xl border border-border/60 bg-foreground/[0.01] px-4 py-3.5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-center shrink-0">
                  <Check className="h-4 w-4 text-green-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {customizerData!.productName}
                    {customizerData!.brandName && (
                      <span className="font-normal text-muted-foreground"> — {customizerData!.brandName}</span>
                    )}
                  </p>
                  {customizerData!.productDescription && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {customizerData!.productDescription.slice(0, 90)}{customizerData!.productDescription.length > 90 ? "…" : ""}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {customizerData!.productImageBase64.length > 0 && (
                  <div className="flex -space-x-2">
                    {customizerData!.productImageBase64.slice(0, 3).map((b64, i) => (
                      <img key={i} src={b64} alt={`produit ${i + 1}`} className="h-8 w-8 rounded-lg object-cover border-2 border-background" />
                    ))}
                    {customizerData!.productImageBase64.length > 3 && (
                      <div className="h-8 w-8 rounded-lg bg-foreground/10 border-2 border-background flex items-center justify-center">
                        <span className="text-[10px] font-medium">+{customizerData!.productImageBase64.length - 3}</span>
                      </div>
                    )}
                  </div>
                )}
                <button
                  onClick={() => refreshCustomizerData.current()}
                  title="Recharger les dernières données du Customizer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <Link
                  href="/theme"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Modifier →
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-foreground/[0.01] p-8 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-semibold text-sm">Aucune donnée du Customizer</p>
            <p className="text-xs text-muted-foreground mt-1.5 mb-5 max-w-sm mx-auto">
              Lance d&apos;abord la génération dans l&apos;outil <strong>Shopify Customizer</strong> pour utiliser Image Finder.
              Les informations produit, bénéfices et images seront récupérées automatiquement.
            </p>
            <Link
              href="/theme"
              className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-80 transition-opacity"
            >
              Aller au Customizer →
            </Link>
          </div>
        )}

        {/* Tabs + content (only shown when Customizer data available) */}
        {hasData && (
          <>
            {/* Tab bar */}
            <div className="flex gap-1 p-1 rounded-xl bg-foreground/[0.04] border border-border/40">
              {(["search", "generate", "icons"] as ActiveTab[]).map(tab => {
                const Icon = tab === "search" ? Search : tab === "generate" ? Sparkles : Shapes;
                const disabled = tab === "generate" && !config?.together;
                const labels: Record<ActiveTab, string> = {
                  search: "Trouver des photos",
                  generate: config?.together ? "Générer avec FLUX" : "FLUX (clé manquante)",
                  icons: "Icônes",
                };
                return (
                  <button
                    key={tab}
                    onClick={() => !disabled && setActiveTab(tab)}
                    disabled={disabled}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      activeTab === tab
                        ? "bg-background shadow-sm text-foreground"
                        : disabled
                          ? "opacity-30 cursor-not-allowed text-muted-foreground"
                          : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <AnimatePresence mode="wait">

              {/* ── Trouver des photos ── */}
              {activeTab === "search" && (
                <motion.div key="search" {...sv} className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs text-muted-foreground">
                      L&apos;IA analyse ton produit et cherche <strong>3 photos landscape</strong> + <strong>12 portrait</strong> sur Pexels &amp; Unsplash.
                    </p>
                    <button
                      onClick={handleSearch}
                      disabled={searchLoading}
                      className="shrink-0 flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:opacity-80 disabled:opacity-30 transition-opacity"
                    >
                      {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      {searchResults.length > 0 ? "Actualiser" : "Rechercher des photos"}
                    </button>
                  </div>

                  {searchLoading ? (
                    <GallerySkeleton />
                  ) : searchResults.length > 0 ? (
                    <GalleryGrid
                      images={searchResults}
                      uploadingId={uploadingId}
                      onDownload={downloadImage}
                      onUpload={handleUploadSingle}
                    />
                  ) : (
                    <EmptyState icon={Search} message="Clique sur « Rechercher des photos » pour démarrer" />
                  )}
                </motion.div>
              )}

              {/* ── Générer avec FLUX ── */}
              {activeTab === "generate" && (
                <motion.div key="generate" {...sv} className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs text-muted-foreground">
                      L&apos;IA génère <strong>3 images landscape</strong> + <strong>12 portrait</strong> via FLUX AI (Pollinations.ai, gratuit).
                    </p>
                    <button
                      onClick={handleGenerate}
                      disabled={generateLoading}
                      className="shrink-0 flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:opacity-80 disabled:opacity-30 transition-opacity"
                    >
                      {generateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {generateResults.length > 0 ? "Régénérer" : "Générer avec FLUX"}
                    </button>
                  </div>

                  {generateLoading ? (
                    <GallerySkeleton />
                  ) : generateResults.length > 0 ? (
                    <GalleryGrid
                      images={generateResults}
                      uploadingId={uploadingId}
                      onDownload={downloadImage}
                      onUpload={handleUploadSingle}
                    />
                  ) : (
                    <EmptyState icon={Sparkles} message="Clique sur « Générer avec FLUX » pour créer des images IA" />
                  )}
                </motion.div>
              )}

              {/* ── Icônes ── */}
              {activeTab === "icons" && (
                <motion.div key="icons" {...sv} className="space-y-5">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <p className="text-xs text-muted-foreground">
                      Génère <strong>6 icônes</strong> basées sur les bénéfices du Customizer — 3 icônes visuelles + 3 avantages texte.
                    </p>
                    <button
                      onClick={handleGenerateIcons}
                      disabled={iconsLoading}
                      className="shrink-0 flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:opacity-80 disabled:opacity-30 transition-opacity"
                    >
                      {iconsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shapes className="h-4 w-4" />}
                      {iconResults.length > 0 ? "Régénérer" : "Générer les icônes"}
                    </button>
                  </div>

                  {iconsLoading ? (
                    <div className="space-y-6">
                      <div>
                        <div className="h-3 w-48 rounded bg-foreground/[0.05] mb-3 animate-pulse" />
                        <div className="grid grid-cols-3 gap-4">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-44 rounded-2xl bg-foreground/[0.04] animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="h-3 w-48 rounded bg-foreground/[0.05] mb-3 animate-pulse" />
                        <div className="grid grid-cols-3 gap-4">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-44 rounded-2xl bg-foreground/[0.04] animate-pulse" style={{ animationDelay: `${(i + 3) * 0.1}s` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : iconResults.length > 0 ? (
                    <div className="space-y-6">
                      {/* Group 1: icon-prominent (for the theme's icons section) */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                          <Shapes className="h-3.5 w-3.5" />
                          Icônes visuelles (3) — section icônes du thème
                        </p>
                        <div className="grid grid-cols-3 gap-4">
                          {iconResults.slice(0, 3).map(icon => (
                            <IconCard
                              key={`ic-${icon.icon}`}
                              icon={icon}
                              mode="icon"
                              uploadingId={uploadingId}
                              onDownloadSvg={() => downloadSvg(icon.svg, icon.icon)}
                              onDownloadPng={() => downloadAsPng(icon.svg, icon.icon)}
                              onUpload={() => handleUploadIcon(icon)}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Group 2: benefit-prominent (for the theme's advantages section) */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                          <Award className="h-3.5 w-3.5" />
                          Avantages texte (3) — section bénéfices du thème
                        </p>
                        <div className="grid grid-cols-3 gap-4">
                          {iconResults.slice(3, 6).map(icon => (
                            <IconCard
                              key={`bn-${icon.icon}`}
                              icon={icon}
                              mode="benefit"
                              uploadingId={uploadingId}
                              onDownloadSvg={() => downloadSvg(icon.svg, icon.icon)}
                              onDownloadPng={() => downloadAsPng(icon.svg, icon.icon)}
                              onUpload={() => handleUploadIcon(icon)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <EmptyState icon={Shapes} message="Clique sur « Générer les icônes » pour créer 6 icônes produit" />
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground rounded-2xl border border-dashed border-border/60">
      <Icon className="h-10 w-10 opacity-20" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function GallerySkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-3.5 w-36 rounded bg-foreground/[0.05] mb-2 animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-video rounded-xl bg-foreground/[0.04] animate-pulse" style={{ animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
      </div>
      <div>
        <div className="h-3.5 w-36 rounded bg-foreground/[0.05] mb-2 animate-pulse" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-foreground/[0.04] animate-pulse" style={{ animationDelay: `${i * 0.05}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function GalleryGrid({
  images,
  uploadingId,
  onDownload,
  onUpload,
}: {
  images: ImageResult[];
  uploadingId: string | null;
  onDownload: (img: ImageResult) => void;
  onUpload: (img: ImageResult) => Promise<void>;
}) {
  const landscape = images.filter(i => i.orientation === "landscape");
  const portrait = images.filter(i => i.orientation === "portrait");

  return (
    <div className="space-y-6">
      {landscape.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Landscape 16:9 · {landscape.length} image(s)
          </p>
          <div className="grid grid-cols-3 gap-3">
            {landscape.map(img => (
              <ImageCard key={img.id} img={img} uploadingId={uploadingId} onDownload={onDownload} onUpload={onUpload} />
            ))}
          </div>
        </div>
      )}
      {portrait.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Portrait 3:4 · {portrait.length} image(s)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {portrait.map(img => (
              <ImageCard key={img.id} img={img} uploadingId={uploadingId} onDownload={onDownload} onUpload={onUpload} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ImageCard({
  img,
  uploadingId,
  onDownload,
  onUpload,
}: {
  img: ImageResult;
  uploadingId: string | null;
  onDownload: (img: ImageResult) => void;
  onUpload: (img: ImageResult) => Promise<void>;
}) {
  const isUploading = uploadingId === img.id;
  const otherUploading = uploadingId !== null && uploadingId !== img.id;

  return (
    <div className="group relative rounded-xl overflow-hidden border border-border/40 bg-foreground/[0.02]">
      <img
        src={img.thumb}
        alt={img.alt}
        className={`w-full object-cover ${img.orientation === "landscape" ? "aspect-video" : "aspect-[3/4]"}`}
        loading="lazy"
      />
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/25 transition-colors duration-150" />
      {/* Action buttons — visible on hover */}
      <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button
          onClick={() => onDownload(img)}
          title="Télécharger"
          className="flex items-center justify-center rounded-full bg-background/95 shadow-md p-2.5 hover:scale-105 transition-transform"
        >
          <Download className="h-4 w-4 text-foreground" />
        </button>
        <button
          onClick={() => onUpload(img)}
          disabled={otherUploading}
          title="Uploader sur Shopify"
          className="flex items-center justify-center rounded-full bg-background/95 shadow-md p-2.5 hover:scale-105 disabled:opacity-40 transition-all"
        >
          {isUploading
            ? <Loader2 className="h-4 w-4 text-foreground animate-spin" />
            : <CloudUpload className="h-4 w-4 text-foreground" />
          }
        </button>
      </div>
      {/* Source badge */}
      <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white/90">
        {img.photographer === "FLUX AI" ? "FLUX" : img.source}
      </span>
    </div>
  );
}

function IconCard({
  icon,
  mode,
  uploadingId,
  onDownloadSvg,
  onDownloadPng,
  onUpload,
}: {
  icon: IconResult;
  mode: "icon" | "benefit";
  uploadingId: string | null;
  onDownloadSvg: () => void;
  onDownloadPng: () => void;
  onUpload: () => Promise<void>;
}) {
  const isUploading = uploadingId === `icon-${icon.icon}`;
  const anyUploading = uploadingId !== null;

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-border/60 p-4 ${
      mode === "icon" ? "bg-foreground/[0.01]" : "bg-foreground/[0.025]"
    }`}>
      {mode === "icon" ? (
        <div className="flex flex-col items-center gap-2.5 text-center flex-1">
          <div className="w-16 h-16 rounded-2xl bg-white dark:bg-white/5 flex items-center justify-center p-2 shadow-sm border border-border/30">
            <div
              className="w-full h-full"
              dangerouslySetInnerHTML={{ __html: icon.svg }}
            />
          </div>
          <div>
            <p className="font-semibold text-sm leading-snug">{icon.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{icon.benefit}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 shrink-0"
              dangerouslySetInnerHTML={{ __html: icon.svg }}
            />
            <p className="font-semibold text-sm leading-snug">{icon.label}</p>
          </div>
          <p className="text-sm text-foreground/75 leading-snug">{icon.benefit}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-1 pt-1">
        <button
          onClick={() => { navigator.clipboard.writeText(icon.svg); toast.success("SVG copié !"); }}
          title="Copier le code SVG"
          className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-border py-1.5 text-xs hover:bg-muted transition-colors"
        >
          <Copy className="h-3 w-3" />
        </button>
        <button
          onClick={onDownloadSvg}
          title="Télécharger .svg"
          className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-border py-1.5 text-xs hover:bg-muted transition-colors"
        >
          SVG
        </button>
        <button
          onClick={onDownloadPng}
          title="Télécharger .png (512×512)"
          className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-border py-1.5 text-xs hover:bg-muted transition-colors"
        >
          PNG
        </button>
        <button
          onClick={onUpload}
          disabled={anyUploading}
          title="Uploader sur Shopify"
          className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-border py-1.5 text-xs hover:bg-muted disabled:opacity-40 transition-colors"
        >
          {isUploading
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <CloudUpload className="h-3 w-3" />
          }
        </button>
      </div>
    </div>
  );
}
