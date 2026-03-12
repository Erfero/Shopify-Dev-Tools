"use client";

import { useRef, useState } from "react";
import { Package, Store, FileText, Link2, Camera, X, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

interface ProductFormProps {
  productName: string;
  brandName: string;
  productDescription: string;
  productHandle: string;
  productImages: File[];
  onChange: (field: string, value: string) => void;
  onProductImagesChange: (files: File[]) => void;
}

export function ProductForm({
  productName,
  brandName,
  productDescription,
  productHandle,
  productImages,
  onChange,
  onProductImagesChange,
}: ProductFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPhotos, setShowPhotos] = useState(false);

  const handleHandleChange = (value: string) => {
    const formatted = value
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-™©®]/g, "");
    onChange("productHandle", formatted);
  };

  const handleImageFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, 3);
    onProductImagesChange([...productImages, ...arr].slice(0, 3));
  };

  const removeImage = (i: number) => {
    onProductImagesChange(productImages.filter((_, idx) => idx !== i));
  };

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-start gap-4 mb-8 pb-6" style={{ borderBottom: "1px solid oklch(0.922 0 0)" }}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "oklch(0.97 0 0)", border: "1px solid oklch(0.922 0 0)" }}
        >
          <Package size={22} style={{ color: "var(--primary)" }} />
        </div>
        <div>
          <h2 className="font-bold text-xl" style={{ color: "var(--text)" }}>
            Informations du Produit
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Ces infos permettront à l&apos;IA de générer des avis précis et pertinents
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">
              <Package size={13} style={{ color: "var(--primary)" }} />
              Nom du produit <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <input
              className="input"
              value={productName}
              onChange={(e) => onChange("productName", e.target.value)}
              placeholder="Ex: Mitaine de dentition"
            />
          </div>
          <div>
            <label className="label">
              <Store size={13} style={{ color: "var(--primary)" }} />
              Nom de la boutique / marque <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <input
              className="input"
              value={brandName}
              onChange={(e) => onChange("brandName", e.target.value)}
              placeholder="Ex: Bébé Zen"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="label">
            <FileText size={13} style={{ color: "var(--primary)" }} />
            Description du produit <span style={{ color: "#EF4444" }}>*</span>
          </label>
          <textarea
            className="input textarea"
            value={productDescription}
            onChange={(e) => onChange("productDescription", e.target.value)}
            placeholder="Décrivez votre produit en détail : matériaux, bénéfices, usage, public cible, caractéristiques uniques... Plus c'est précis, meilleurs seront vos avis."
            rows={4}
          />
        </div>

        {/* Handle */}
        <div>
          <label className="label">
            <Link2 size={13} style={{ color: "var(--primary)" }} />
            Handle Shopify du produit <span style={{ color: "#EF4444" }}>*</span>
          </label>
          <input
            className="input"
            value={productHandle}
            onChange={(e) => handleHandleChange(e.target.value)}
            placeholder="Ex: mitaines-de-dentition-bebe-zen"
          />
          <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
            Trouvez le handle dans Shopify Admin → Produits → URL du produit
          </p>
        </div>

        {/* Product images for AI analysis — collapsible optional section */}
        <div
          className="rounded-2xl"
          style={{ border: "1px solid oklch(0.922 0 0)", overflow: "hidden" }}
        >
          {/* Toggle header */}
          <button
            type="button"
            onClick={() => setShowPhotos((v) => !v)}
            className="w-full flex items-center gap-3 px-5 py-4 transition-all"
            style={{
              background: showPhotos ? "oklch(0.97 0 0)" : "oklch(0.985 0 0)",
              border: "none",
              textAlign: "left",
            }}
          >
            <Sparkles size={15} style={{ color: "var(--primary)", flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm" style={{ color: "var(--primary)" }}>
                Photos produit pour l&apos;analyse IA{" "}
                <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 12 }}>— optionnel</span>
              </p>
              {!showPhotos && (
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {productImages.length > 0
                    ? `${productImages.length} photo(s) ajoutée(s) — cliquez pour modifier`
                    : "Cliquez pour ajouter des photos et améliorer la précision des avis"}
                </p>
              )}
            </div>
            {productImages.length > 0 && !showPhotos && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                style={{ background: "oklch(0.97 0 0)", color: "var(--primary)", border: "1px solid oklch(0.922 0 0)" }}
              >
                {productImages.length}/3
              </span>
            )}
            {showPhotos ? (
              <ChevronUp size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            ) : (
              <ChevronDown size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            )}
          </button>

          {/* Expanded content */}
          {showPhotos && (
            <div className="px-5 pb-5 pt-1" style={{ background: "oklch(0.97 0 0)" }}>
              <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                Uploadez 1 à 3 photos — l&apos;IA les analysera pour générer des avis ultra précis
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleImageFiles(e.target.files)}
              />

              {productImages.length < 3 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: "var(--bg-card)",
                    border: "1.5px solid oklch(0.922 0 0)",
                    color: "var(--primary)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <Camera size={15} />
                  Ajouter des photos ({productImages.length}/3)
                </button>
              )}

              {productImages.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-3">
                  {productImages.map((file, i) => (
                    <div key={i} className="relative group">
                      <div className="w-20 h-20 rounded-xl overflow-hidden" style={{ border: "2px solid oklch(0.922 0 0)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={URL.createObjectURL(file)} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                      <div
                        className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: "var(--primary)" }}
                      >
                        {i + 1}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "#EF4444" }}
                      >
                        <X size={11} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
