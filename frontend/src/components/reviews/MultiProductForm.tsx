"use client";

import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Package,
  CheckCircle2,
  AlertCircle,
  Upload,
} from "lucide-react";
import { LANGUAGES } from "@/lib/languages";

function FileThumbnail({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return (
    <div style={{ position: "relative", width: 60, height: 60, flexShrink: 0 }}>
      {url && (
        <img
          src={url}
          alt={file.name}
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10, border: "1.5px solid oklch(0.922 0 0)", display: "block" }}
        />
      )}
      <button
        type="button"
        onClick={onRemove}
        title="Supprimer"
        style={{
          position: "absolute", top: -6, right: -6,
          width: 18, height: 18, borderRadius: "50%",
          background: "#EF4444", color: "white",
          border: "2px solid white", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 700, lineHeight: 1,
        }}
      >×</button>
    </div>
  );
}

export interface MultiProductConfig {
  id: string;
  productName: string;
  brandName: string;
  productDescription: string;
  productHandle: string;
  targetGender: string;
  language: string;
  reviewCount: number;
  imageUrls: string[];       // user review photo URLs → CSV (computed from reviewImageFiles)
  reviewImageFiles: File[];  // user review photo files → uploaded → URLs → CSV
  productImages: File[];     // product photos → AI vision analysis
}

function toHandle(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isProductValid(p: MultiProductConfig): boolean {
  return !!(p.productName.trim() && p.brandName.trim() && p.productDescription.trim() && p.productHandle.trim());
}

function newProduct(): MultiProductConfig {
  return {
    id: crypto.randomUUID(),
    productName: "",
    brandName: "",
    productDescription: "",
    productHandle: "",
    targetGender: "femmes",
    language: "Français",
    reviewCount: 50,
    imageUrls: [],
    reviewImageFiles: [],
    productImages: [],
  };
}

interface Props {
  products: MultiProductConfig[];
  onChange: (products: MultiProductConfig[]) => void;
}

export function MultiProductForm({ products, onChange }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(products[0]?.id ?? null);
  const [showPhotosFor, setShowPhotosFor] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileSelect = (productId: string, files: FileList | null) => {
    if (!files) return;
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const remaining = 3 - product.productImages.length;
    if (remaining <= 0) return;
    const newFiles = Array.from(files).slice(0, remaining);
    onChange(products.map((p) => p.id === productId ? { ...p, productImages: [...p.productImages, ...newFiles] } : p));
  };

  const removeProductImage = (productId: string, idx: number) => {
    onChange(products.map((p) => p.id === productId ? { ...p, productImages: p.productImages.filter((_, i) => i !== idx) } : p));
  };

  const updateProduct = (id: string, patch: Partial<MultiProductConfig>) => {
    onChange(products.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const addProduct = () => {
    const p = newProduct();
    onChange([...products, p]);
    setExpandedId(p.id);
  };

  const removeProduct = (id: string) => {
    const next = products.filter((p) => p.id !== id);
    onChange(next);
    if (expandedId === id) setExpandedId(next[next.length - 1]?.id ?? null);
  };

  const totalReviews = products.reduce((s, p) => s + p.reviewCount, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-4 mb-6 pb-5" style={{ borderBottom: "1px solid oklch(0.922 0 0)" }}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "oklch(0.97 0 0)", border: "1px solid oklch(0.922 0 0)" }}
        >
          <Package size={22} style={{ color: "var(--primary)" }} />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-xl" style={{ color: "var(--text)" }}>
            Vos Produits
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {products.length} produit{products.length > 1 ? "s" : ""} · {totalReviews} avis au total
          </p>
        </div>
      </div>

      {/* Product cards */}
      <div className="space-y-3 mb-4">
        {products.map((product, idx) => {
          const valid = isProductValid(product);
          const isOpen = expandedId === product.id;

          return (
            <div
              key={product.id}
              style={{
                border: `1.5px solid ${isOpen ? "var(--primary)" : valid ? "#BBF7D0" : "var(--border)"}`,
                borderRadius: 16,
                overflow: "hidden",
                background: "white",
                boxShadow: isOpen ? "0 0 0 3px rgba(0,0,0,0.06)" : "var(--shadow-sm)",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
            >
              {/* Card header (always visible) */}
              <div
                className="flex items-center gap-3 cursor-pointer"
                style={{ padding: "14px 16px" }}
                onClick={() => setExpandedId(isOpen ? null : product.id)}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold"
                  style={{
                    background: valid ? "#DCFCE7" : "oklch(0.97 0 0)",
                    color: valid ? "#15803D" : "var(--text-muted)",
                  }}
                >
                  {valid ? <CheckCircle2 size={15} /> : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>
                    {product.productName || `Produit ${idx + 1}`}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {product.brandName || "Marque non définie"} · {product.reviewCount} avis · {product.language}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {products.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeProduct(product.id); }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#EF4444",
                        padding: 4,
                        borderRadius: 8,
                        opacity: 0.5,
                        transition: "opacity 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}
                      title="Supprimer ce produit"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  {isOpen ? (
                    <ChevronUp size={16} style={{ color: "var(--text-muted)" }} />
                  ) : (
                    <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
                  )}
                </div>
              </div>

              {/* Expanded fields */}
              {isOpen && (
                <div style={{ padding: "0 16px 16px", borderTop: "1px solid oklch(0.922 0 0)" }}>
                  <div className="space-y-4 pt-4">
                    {/* Row 1: product name + brand */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="label">Nom du produit <span style={{ color: "#EF4444" }}>*</span></label>
                        <input
                          className="input"
                          placeholder="Ex: Crème hydratante visage"
                          value={product.productName}
                          onChange={(e) => {
                            const name = e.target.value;
                            const autoHandle = toHandle(name);
                            updateProduct(product.id, {
                              productName: name,
                              productHandle: product.productHandle === toHandle(product.productName)
                                ? autoHandle
                                : product.productHandle,
                            });
                          }}
                        />
                      </div>
                      <div>
                        <label className="label">Marque / Boutique <span style={{ color: "#EF4444" }}>*</span></label>
                        <input
                          className="input"
                          placeholder="Ex: BeautéPlus"
                          value={product.brandName}
                          onChange={(e) => updateProduct(product.id, { brandName: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Row 2: description */}
                    <div>
                      <label className="label">Description du produit <span style={{ color: "#EF4444" }}>*</span></label>
                      <textarea
                        className="input textarea"
                        placeholder="Décrivez votre produit, ses bénéfices, ses ingrédients clés..."
                        value={product.productDescription}
                        style={{ minHeight: 90 }}
                        onChange={(e) => updateProduct(product.id, { productDescription: e.target.value })}
                      />
                    </div>

                    {/* Row 3: handle + gender */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="label">Handle produit <span style={{ color: "#EF4444" }}>*</span></label>
                        <input
                          className="input"
                          placeholder="Ex: creme-hydratante-visage"
                          value={product.productHandle}
                          onChange={(e) => updateProduct(product.id, { productHandle: e.target.value })}
                        />
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                          Trouvez-le dans Shopify Admin → Produits → URL
                        </p>
                      </div>
                      <div>
                        <label className="label">Cible</label>
                        <select
                          className="input"
                          value={product.targetGender}
                          onChange={(e) => updateProduct(product.id, { targetGender: e.target.value })}
                        >
                          <option value="femmes">Femmes</option>
                          <option value="hommes">Hommes</option>
                          <option value="mixte">Mixte</option>
                          <option value="enfants">Enfants</option>
                          <option value="tous">Tous publics</option>
                        </select>
                      </div>
                    </div>

                    {/* Row 4: language + review count */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="label">Langue des avis</label>
                        <select
                          className="input"
                          value={product.language}
                          onChange={(e) => updateProduct(product.id, { language: e.target.value })}
                        >
                          {LANGUAGES.map((l) => (
                            <option key={l.code} value={l.name}>
                              {l.name} — {l.nativeName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Nombre d&apos;avis</label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateProduct(product.id, { reviewCount: Math.max(5, product.reviewCount - 5) })}
                            style={{
                              width: 36, height: 36, borderRadius: 10,
                              border: "1.5px solid var(--border)", background: "white",
                              cursor: "pointer", fontSize: 18, fontWeight: 600,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              color: "var(--text-secondary)", flexShrink: 0,
                            }}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            className="input"
                            min={5}
                            max={500}
                            value={product.reviewCount}
                            onChange={(e) => updateProduct(product.id, { reviewCount: Math.max(5, Math.min(500, Number(e.target.value))) })}
                            style={{ textAlign: "center", fontWeight: 700 }}
                          />
                          <button
                            type="button"
                            onClick={() => updateProduct(product.id, { reviewCount: Math.min(500, product.reviewCount + 5) })}
                            style={{
                              width: 36, height: 36, borderRadius: 10,
                              border: "1.5px solid var(--border)", background: "white",
                              cursor: "pointer", fontSize: 18, fontWeight: 600,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              color: "var(--text-secondary)", flexShrink: 0,
                            }}
                          >
                            +
                          </button>
                        </div>
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {[10, 25, 50, 100, 200].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => updateProduct(product.id, { reviewCount: n })}
                              style={{
                                padding: "2px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                                border: `1.5px solid ${product.reviewCount === n ? "var(--primary)" : "var(--border)"}`,
                                background: product.reviewCount === n ? "oklch(0.97 0 0)" : "oklch(1 0 0)",
                                color: product.reviewCount === n ? "var(--primary)" : "var(--text-muted)",
                                cursor: "pointer",
                              }}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* AI product photos — collapsible */}
                    <div style={{ border: "1px solid oklch(0.922 0 0)", borderRadius: 12, overflow: "hidden" }}>
                      <button
                        type="button"
                        onClick={() => setShowPhotosFor((prev) => ({ ...prev, [product.id]: !prev[product.id] }))}
                        className="w-full flex items-center gap-2 px-4 py-3 transition-all"
                        style={{
                          background: showPhotosFor[product.id] ? "oklch(0.97 0 0)" : "oklch(0.985 0 0)",
                          border: "none", textAlign: "left",
                        }}
                      >
                        <Upload size={13} style={{ color: "var(--primary)", flexShrink: 0 }} />
                        <span className="flex-1 text-xs font-semibold" style={{ color: "var(--primary)" }}>
                          Photos pour l&apos;IA{" "}
                          <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>— optionnel</span>
                        </span>
                        {product.productImages.length > 0 && !showPhotosFor[product.id] && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "oklch(0.97 0 0)", color: "var(--primary)", border: "1px solid oklch(0.922 0 0)" }}>
                            {product.productImages.length}/3
                          </span>
                        )}
                        {showPhotosFor[product.id]
                          ? <ChevronUp size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                          : <ChevronDown size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                        }
                      </button>

                      {showPhotosFor[product.id] && (
                        <div className="px-4 pb-4 pt-1" style={{ background: "oklch(0.97 0 0)" }}>
                          <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                            L&apos;IA analysera ces photos pour générer des avis plus précis.
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {product.productImages.map((file, i) => (
                              <FileThumbnail
                                key={`${product.id}-${i}`}
                                file={file}
                                onRemove={() => removeProductImage(product.id, i)}
                              />
                            ))}
                            {product.productImages.length < 3 && (
                              <>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  style={{ display: "none" }}
                                  ref={(el) => { fileInputRefs.current[product.id] = el; }}
                                  onChange={(e) => handleFileSelect(product.id, e.target.files)}
                                  onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
                                />
                                <button
                                  type="button"
                                  onClick={() => fileInputRefs.current[product.id]?.click()}
                                  style={{
                                    width: 60, height: 60, borderRadius: 10, flexShrink: 0,
                                    border: "2px dashed oklch(0.85 0 0)", background: "oklch(0.97 0 0)",
                                    cursor: "pointer", display: "flex", flexDirection: "column",
                                    alignItems: "center", justifyContent: "center", gap: 4,
                                    color: "var(--primary)", transition: "all 0.15s",
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.background = "oklch(0.97 0 0)"; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "oklch(0.85 0 0)"; e.currentTarget.style.background = "oklch(0.97 0 0)"; }}
                                >
                                  <Upload size={15} />
                                  <span style={{ fontSize: 9, fontWeight: 700 }}>
                                    {product.productImages.length === 0 ? "Ajouter" : "Encore"}
                                  </span>
                                </button>
                              </>
                            )}
                            {product.productImages.length === 3 && (
                              <span className="text-xs px-3 py-1 rounded-xl font-semibold" style={{ background: "#DCFCE7", color: "#15803D" }}>
                                ✓ 3/3
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Validation warning */}
                    {!valid && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: "#D97706" }}>
                        <AlertCircle size={13} />
                        Remplissez les champs obligatoires pour ce produit
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add product button */}
      <button
        type="button"
        onClick={addProduct}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl transition-all"
        style={{
          border: "2px dashed var(--border)",
          background: "transparent",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-muted)",
          fontFamily: "inherit",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--primary)";
          e.currentTarget.style.color = "var(--primary)";
          e.currentTarget.style.background = "oklch(0.97 0 0)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.color = "var(--text-muted)";
          e.currentTarget.style.background = "transparent";
        }}
      >
        <Plus size={16} />
        Ajouter un produit
      </button>

      {/* Summary */}
      {products.length > 1 && (
        <div className="info-box mt-4">
          <p className="font-semibold text-sm mb-1">Récapitulatif</p>
          <div className="space-y-0.5">
            {products.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
                <span>{p.productName || `Produit ${i + 1}`}</span>
                <span className="font-semibold">{p.reviewCount} avis</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs font-bold pt-1" style={{ borderTop: "1px solid oklch(0.922 0 0)", color: "var(--text)", marginTop: 4 }}>
              <span>Total</span>
              <span>{totalReviews} avis</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
