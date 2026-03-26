"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { LANGUAGES } from "@/lib/languages";
import { Store, Mail, Package, Image, Globe, Scale, Sparkles, Users, Upload } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { ImageLightbox } from "@/components/shared/ImageLightbox";

export interface StoreConfig {
  store_name: string;
  store_email: string;
  product_names: string[];
  product_description: string;
  product_images: File[];
  language: string;
  target_gender: string;
  product_price: string;
  store_address: string;
  siret: string;
  delivery_delay: string;
  return_policy_days: string;
  marketing_angles: string;
}

interface StoreConfigFormProps {
  themeName: string;
  onSubmit: (config: StoreConfig) => void;
  isGenerating: boolean;
}

export function StoreConfigForm({ themeName, onSubmit, isGenerating }: StoreConfigFormProps) {
  const [storeName, setStoreName] = useState("");
  const [storeEmail, setStoreEmail] = useState("");
  const [productInput, setProductInput] = useState("");
  const [productNames, setProductNames] = useState<string[]>([]);
  const [productDescription, setProductDescription] = useState("");
  const [productImages, setProductImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isDraggingImg, setIsDraggingImg] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [language, setLanguage] = useState("fr");
  const [langSearch, setLangSearch] = useState("");
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const [targetGender, setTargetGender] = useState("femme");
  const [productPrice, setProductPrice] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [siret, setSiret] = useState("");
  const [deliveryDelay, setDeliveryDelay] = useState("3-5 jours ouvrés");
  const [returnPolicyDays, setReturnPolicyDays] = useState("30");
  const [legalOpen, setLegalOpen] = useState(false);
  const [marketingAngles, setMarketingAngles] = useState("");

  const filteredLanguages = useMemo(() => {
    if (!langSearch.trim()) return LANGUAGES;
    const q = langSearch.toLowerCase();
    return LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nameEn.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q),
    );
  }, [langSearch]);

  const selectedLang = useMemo(
    () => LANGUAGES.find((l) => l.code === language),
    [language],
  );

  // Close language dropdown when clicking outside
  useEffect(() => {
    if (!langOpen) return;
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
        setLangSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [langOpen]);

  const addProduct = () => {
    const name = productInput.trim();
    if (name && !productNames.includes(name)) {
      setProductNames([...productNames, name]);
      setProductInput("");
    }
  };

  const removeProduct = (index: number) => {
    setProductNames(productNames.filter((_, i) => i !== index));
  };

  const handleProductKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addProduct();
    }
  };

  const handleImageAdd = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newImages = [...productImages, ...files];
    setProductImages(newImages);

    // Generate previews
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreviews((prev) => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input so the same file can be re-added
    e.target.value = "";
  }, [productImages]);

  const removeImage = (index: number) => {
    setProductImages(productImages.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName || !storeEmail || productNames.length === 0) return;

    onSubmit({
      store_name: storeName,
      store_email: storeEmail,
      product_names: productNames,
      product_description: productDescription || undefined as unknown as string,
      product_images: productImages,
      language,
      target_gender: targetGender,
      product_price: productPrice,
      store_address: storeAddress,
      siret,
      delivery_delay: deliveryDelay,
      return_policy_days: returnPolicyDays,
      marketing_angles: marketingAngles,
    });
  };

  const isValid = storeName.trim() && storeEmail.trim() && productNames.length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-xl border border-border/60 bg-foreground/[0.01] px-5 py-4">
        <p className="text-xs text-muted-foreground">Theme detecte</p>
        <p className="mt-0.5 text-sm font-medium">{themeName}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="store-name" className="text-sm font-medium flex items-center gap-1.5">
            <Store className="h-3.5 w-3.5 text-muted-foreground" />
            Nom de la boutique
          </Label>
          <Input
            id="store-name"
            placeholder="Ma Boutique"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            disabled={isGenerating}
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="store-email" className="text-sm font-medium flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            Email de la boutique
          </Label>
          <Input
            id="store-email"
            type="email"
            placeholder="contact@maboutique.fr"
            value={storeEmail}
            onChange={(e) => setStoreEmail(e.target.value)}
            disabled={isGenerating}
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            Produit(s)
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="Nom du produit"
              value={productInput}
              onChange={(e) => setProductInput(e.target.value)}
              onKeyDown={handleProductKeyDown}
              disabled={isGenerating}
              className="h-11"
            />
            <Button
              type="button"
              variant="outline"
              onClick={addProduct}
              disabled={!productInput.trim() || isGenerating}
              className="h-11 shrink-0 px-4"
            >
              Ajouter
            </Button>
          </div>
          {productNames.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {productNames.map((name, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="cursor-pointer gap-1.5 py-1 pl-2.5 pr-1.5 text-sm font-normal transition-colors hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => !isGenerating && removeProduct(i)}
                >
                  {name}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </Badge>
              ))}
            </div>
          )}
          {productNames.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Ajoutez au moins un produit (appuyez sur Entree)
            </p>
          )}
        </div>

        {/* Product Images */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Image className="h-3.5 w-3.5 text-muted-foreground" />
            Images du produit{" "}
            <span className="font-normal text-muted-foreground">(recommandé pour des textes précis)</span>
          </Label>

          <div
            style={{
              border: `2px dashed ${isDraggingImg ? "var(--primary)" : "oklch(0.85 0 0)"}`,
              borderRadius: 14,
              padding: "32px 20px",
              textAlign: "center",
              cursor: isGenerating ? "default" : "pointer",
              background: isDraggingImg ? "oklch(0.97 0.01 260)" : "oklch(0.99 0 0)",
              transition: "all 0.15s",
            }}
            onDragOver={(e) => { e.preventDefault(); if (!isGenerating) setIsDraggingImg(true); }}
            onDragLeave={() => setIsDraggingImg(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingImg(false);
              if (!isGenerating) {
                const fakeEvent = { target: { files: e.dataTransfer.files, value: "" } } as unknown as React.ChangeEvent<HTMLInputElement>;
                handleImageAdd(fakeEvent);
              }
            }}
            onClick={() => { if (!isGenerating) document.getElementById("product-images-input")?.click(); }}
          >
            <input
              id="product-images-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={handleImageAdd}
              disabled={isGenerating}
            />
            <div className="flex flex-col items-center gap-3">
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "oklch(0.95 0.01 260)", border: "1px solid oklch(0.88 0.02 260)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Upload size={22} style={{ color: "var(--primary)" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  Glissez vos images ici
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  ou{" "}
                  <span style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "underline" }}>
                    parcourez vos fichiers
                  </span>
                </p>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>JPG, PNG, WebP — plusieurs fichiers acceptés</p>
            </div>
          </div>

          {imagePreviews.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 pt-1">
                <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                  {imagePreviews.length} image{imagePreviews.length > 1 ? "s" : ""} sélectionnée{imagePreviews.length > 1 ? "s" : ""}
                </p>
                {!isGenerating && (
                  <button type="button" className="text-xs font-medium" style={{ color: "#EF4444" }} onClick={() => { setProductImages([]); setImagePreviews([]); }}>
                    Tout supprimer
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {imagePreviews.map((preview, i) => (
                  <div key={i} className="group relative aspect-square overflow-hidden rounded-xl" style={{ border: "1.5px solid oklch(0.9 0 0)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt={`Produit ${i + 1}`}
                      className="h-full w-full object-cover"
                      style={{ cursor: "zoom-in" }}
                      onClick={() => setLightboxIdx(i)}
                    />
                    {!isGenerating && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "#EF4444" }}
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence>
            {lightboxIdx !== null && (
              <ImageLightbox
                images={imagePreviews}
                currentIndex={lightboxIdx}
                onClose={() => setLightboxIdx(null)}
                onNavigate={setLightboxIdx}
              />
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-desc" className="text-sm font-medium">
            Description du produit{" "}
            <span className="font-normal text-muted-foreground">(optionnel)</span>
          </Label>
          <Textarea
            id="product-desc"
            placeholder="Decrivez brievement votre produit pour des textes plus pertinents..."
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            disabled={isGenerating}
            rows={3}
            className="resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="marketing-angles" className="text-sm font-medium">
            Angles marketing{" "}
            <span className="font-normal text-muted-foreground">(optionnel)</span>
          </Label>
          <Textarea
            id="marketing-angles"
            placeholder="Ex : Insistez sur la naturalité du produit · Ciblez les mamans actives 30-45 ans · Ton chaleureux et bienveillant · Valorisez la qualité artisanale · Mettez en avant la rapidité des résultats..."
            value={marketingAngles}
            onChange={(e) => setMarketingAngles(e.target.value)}
            disabled={isGenerating}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Décrivez vos angles marketing, votre ton, votre cible ou toute direction créative. L&apos;IA s&apos;appuiera sur ces indications pour générer des textes alignés avec votre vision.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            Genre cible
          </Label>
          <div className="flex rounded-lg border border-input overflow-hidden">
            {(["femme", "homme", "mixte"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => !isGenerating && setTargetGender(g)}
                disabled={isGenerating}
                className={`flex-1 py-2.5 text-sm transition-colors capitalize ${
                  targetGender === g
                    ? "bg-foreground text-background font-medium"
                    : "bg-background text-muted-foreground hover:bg-foreground/5"
                }`}
              >
                {g === "femme" ? "Femme" : g === "homme" ? "Homme" : "Mixte"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-price" className="text-sm font-medium">
            Prix du produit{" "}
            <span className="font-normal text-muted-foreground">(optionnel)</span>
          </Label>
          <Input
            id="product-price"
            placeholder="29.99"
            value={productPrice}
            onChange={(e) => setProductPrice(e.target.value)}
            disabled={isGenerating}
            className="h-11"
          />
        </div>

        {/* Legal info collapsible */}
        <div className="rounded-xl border border-border/60">
          <button
            type="button"
            onClick={() => setLegalOpen(!legalOpen)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
          >
            <span className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 text-muted-foreground" />
              Informations légales{" "}
              <span className="font-normal text-muted-foreground">(pages CGV, mentions)</span>
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`shrink-0 text-muted-foreground transition-transform ${legalOpen ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {legalOpen && (
            <div className="space-y-4 border-t border-border/60 px-4 pb-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="store-address" className="text-sm font-medium">
                  Adresse de la boutique
                </Label>
                <Textarea
                  id="store-address"
                  placeholder="12 rue de la Paix, 75001 Paris"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  disabled={isGenerating}
                  rows={2}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="siret" className="text-sm font-medium">
                  SIRET
                </Label>
                <Input
                  id="siret"
                  placeholder="123 456 789 00001"
                  value={siret}
                  onChange={(e) => setSiret(e.target.value)}
                  disabled={isGenerating}
                  className="h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="delivery-delay" className="text-sm font-medium">
                    Délai de livraison
                  </Label>
                  <Input
                    id="delivery-delay"
                    placeholder="3-5 jours ouvrés"
                    value={deliveryDelay}
                    onChange={(e) => setDeliveryDelay(e.target.value)}
                    disabled={isGenerating}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="return-days" className="text-sm font-medium">
                    Retour (jours)
                  </Label>
                  <Input
                    id="return-days"
                    placeholder="30"
                    value={returnPolicyDays}
                    onChange={(e) => setReturnPolicyDays(e.target.value)}
                    disabled={isGenerating}
                    className="h-11"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="relative space-y-2" ref={langRef}>
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            Langue des textes
          </Label>
          <button
            type="button"
            onClick={() => !isGenerating && setLangOpen(!langOpen)}
            disabled={isGenerating}
            className="flex h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span>
              {selectedLang
                ? `${selectedLang.name} — ${selectedLang.nameEn}`
                : "Selectionnez une langue"}
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`shrink-0 text-muted-foreground transition-transform ${langOpen ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {langOpen && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-background shadow-lg">
              <div className="border-b border-border p-2">
                <Input
                  placeholder="Rechercher une langue..."
                  value={langSearch}
                  onChange={(e) => setLangSearch(e.target.value)}
                  className="h-9"
                  autoFocus
                />
              </div>
              <div className="max-h-56 overflow-y-auto p-1">
                {filteredLanguages.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    Aucune langue trouvee
                  </p>
                ) : (
                  filteredLanguages.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        setLanguage(lang.code);
                        setLangOpen(false);
                        setLangSearch("");
                      }}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-foreground/5 ${
                        language === lang.code ? "bg-foreground/[0.03] font-medium" : ""
                      }`}
                    >
                      <span className="flex-1">
                        {lang.name}
                        <span className="ml-2 text-muted-foreground">
                          {lang.nameEn}
                        </span>
                      </span>
                      {language === lang.code && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cost estimation */}
      {productNames.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "oklch(0.97 0.01 260)", border: "1px solid oklch(0.91 0.02 260)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {(() => {
              const baseInput = 8000;
              const baseOutput = 4000;
              const perProduct = 1500;
              const perImage = 800;
              const inputTokens = baseInput + productNames.length * perProduct + productImages.length * perImage;
              const outputTokens = baseOutput;
              // Gemini 2.0 Flash pricing: $0.10/MTok input, $0.40/MTok output
              const inputCostMin = (inputTokens / 1_000_000) * 0.10;
              const outputCostMin = (outputTokens / 1_000_000) * 0.40;
              const totalMin = inputCostMin + outputCostMin;
              const totalMax = totalMin * 1.4;
              return `Coût estimé : ~$${totalMin.toFixed(3)} – $${totalMax.toFixed(3)} (gemini-2.0-flash)`;
            })()}
          </span>
        </div>
      )}

      <Button
        type="submit"
        disabled={!isValid || isGenerating}
        className="h-12 w-full rounded-xl text-sm font-medium"
      >
        {isGenerating ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            Generation en cours...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Generer mon theme
          </span>
        )}
      </Button>
    </form>
  );
}
