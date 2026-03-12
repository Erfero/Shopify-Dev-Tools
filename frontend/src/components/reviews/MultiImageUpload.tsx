"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, X, Package, CheckCircle2, Upload, Users } from "lucide-react";
import { MultiProductConfig } from "./MultiProductForm";

function FileThumbnail({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return (
    <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
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
          width: 20, height: 20, borderRadius: "50%",
          background: "#EF4444", color: "white",
          border: "2px solid white", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, lineHeight: 1,
        }}
      >×</button>
    </div>
  );
}

function GenderPool({
  label,
  accentColor,
  files,
  onAdd,
  onRemove,
}: {
  label: string;
  accentColor: string;
  files: File[];
  onAdd: (newFiles: File[]) => void;
  onRemove: (idx: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="flex items-center gap-2 mb-2">
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentColor, flexShrink: 0 }} />
        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{label}</p>
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
          {files.length > 0 ? `${files.length} photo${files.length > 1 ? "s" : ""}` : "Aucune"}
        </span>
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {files.map((file, i) => (
            <div key={i} style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
              <FileThumbnail file={file} onRemove={() => onRemove(i)} />
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (!e.target.files) return;
          const newFiles = Array.from(e.target.files).filter((f) => f.type.startsWith("image/"));
          if (newFiles.length) onAdd(newFiles);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all"
        style={{
          border: `2px dashed ${accentColor}50`,
          background: accentColor + "08",
          color: accentColor,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = accentColor; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = accentColor + "50"; }}
      >
        <Upload size={13} />
        {files.length > 0 ? "Ajouter" : "Ajouter des photos"}
      </button>
    </div>
  );
}

interface Props {
  products: MultiProductConfig[];
  onChange: (products: MultiProductConfig[]) => void;
}

export function MultiImageUpload({ products, onChange }: Props) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileSelect = (productId: string, files: FileList | null) => {
    if (!files) return;
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const newFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (newFiles.length === 0) return;
    onChange(products.map((p) =>
      p.id === productId
        ? { ...p, reviewImageFiles: [...p.reviewImageFiles, ...newFiles] }
        : p
    ));
  };

  const removeFile = (productId: string, idx: number) => {
    onChange(products.map((p) =>
      p.id === productId
        ? { ...p, reviewImageFiles: p.reviewImageFiles.filter((_, i) => i !== idx) }
        : p
    ));
  };

  const totalImages = products.reduce((s, p) => {
    if (p.targetGender === "mixte") {
      return s + p.femaleReviewImageFiles.length + p.maleReviewImageFiles.length;
    }
    return s + p.reviewImageFiles.length;
  }, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-4 mb-6 pb-5" style={{ borderBottom: "1px solid oklch(0.922 0 0)" }}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "oklch(0.97 0 0)", border: "1px solid oklch(0.922 0 0)" }}
        >
          <Camera size={22} style={{ color: "var(--primary)" }} />
        </div>
        <div>
          <h2 className="font-bold text-xl" style={{ color: "var(--text)" }}>
            Photos d&apos;utilisateurs
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {totalImages} photo(s) ajoutée(s) — optionnel
          </p>
        </div>
      </div>

      {/* Info */}
      <div className="info-box mb-6">
        <p className="font-semibold text-xs mb-1">📸 Photos d&apos;utilisateurs</p>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Pour les produits <strong>Mixte</strong>, ajoutez des photos séparément pour les femmes et les hommes.
          Elles seront attribuées automatiquement selon le genre de chaque avis.
        </p>
      </div>

      {/* Per-product cards */}
      <div className="space-y-4">
        {products.map((product, idx) => {
          const isMixte = product.targetGender === "mixte";
          const hasImages = isMixte
            ? product.femaleReviewImageFiles.length > 0 || product.maleReviewImageFiles.length > 0
            : product.reviewImageFiles.length > 0;

          return (
            <div
              key={product.id}
              style={{
                border: `1.5px solid ${hasImages ? "#BBF7D0" : "var(--border)"}`,
                borderRadius: 16,
                background: "white",
                boxShadow: "var(--shadow-sm)",
                overflow: "hidden",
              }}
            >
              {/* Product header */}
              <div
                className="flex items-center gap-3"
                style={{
                  padding: "12px 16px",
                  background: hasImages ? "#F0FDF4" : "oklch(0.985 0 0)",
                  borderBottom: "1px solid oklch(0.922 0 0)",
                }}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: hasImages ? "#DCFCE7" : "oklch(0.97 0 0)", color: hasImages ? "#15803D" : "var(--primary)" }}
                >
                  {hasImages ? <CheckCircle2 size={15} /> : isMixte ? <Users size={15} /> : <Package size={15} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>
                    {product.productName || `Produit ${idx + 1}`}
                  </p>
                  <p className="text-xs" style={{ color: hasImages ? "#15803D" : "var(--text-muted)", fontWeight: hasImages ? 600 : 400 }}>
                    {isMixte
                      ? hasImages
                        ? `${product.femaleReviewImageFiles.length}♀ + ${product.maleReviewImageFiles.length}♂ photo(s)`
                        : "Mixte — photos femmes & hommes séparées"
                      : hasImages
                        ? `${product.reviewImageFiles.length} photo(s) ajoutée(s)`
                        : "Aucune photo — optionnel"}
                  </p>
                </div>
              </div>

              <div style={{ padding: "16px" }}>
                {isMixte ? (
                  /* Mixte: two gender pools side by side */
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <GenderPool
                      label="Femmes"
                      accentColor="#EC4899"
                      files={product.femaleReviewImageFiles}
                      onAdd={(newFiles) => onChange(products.map((p) =>
                        p.id === product.id
                          ? { ...p, femaleReviewImageFiles: [...p.femaleReviewImageFiles, ...newFiles] }
                          : p
                      ))}
                      onRemove={(i) => onChange(products.map((p) =>
                        p.id === product.id
                          ? { ...p, femaleReviewImageFiles: p.femaleReviewImageFiles.filter((_, idx2) => idx2 !== i) }
                          : p
                      ))}
                    />
                    <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch", flexShrink: 0 }} />
                    <GenderPool
                      label="Hommes"
                      accentColor="#3B82F6"
                      files={product.maleReviewImageFiles}
                      onAdd={(newFiles) => onChange(products.map((p) =>
                        p.id === product.id
                          ? { ...p, maleReviewImageFiles: [...p.maleReviewImageFiles, ...newFiles] }
                          : p
                      ))}
                      onRemove={(i) => onChange(products.map((p) =>
                        p.id === product.id
                          ? { ...p, maleReviewImageFiles: p.maleReviewImageFiles.filter((_, idx2) => idx2 !== i) }
                          : p
                      ))}
                    />
                  </div>
                ) : (
                  /* Non-mixte: single pool */
                  <>
                    {hasImages && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {product.reviewImageFiles.map((file, i) => (
                          <FileThumbnail
                            key={`${product.id}-review-${i}`}
                            file={file}
                            onRemove={() => removeFile(product.id, i)}
                          />
                        ))}
                      </div>
                    )}
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
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all"
                      style={{
                        border: "2px dashed oklch(0.85 0 0)",
                        background: "oklch(0.97 0 0)",
                        color: "var(--primary)",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "oklch(0.85 0 0)"; }}
                    >
                      <Upload size={15} />
                      {hasImages ? "Ajouter d'autres photos" : "Ajouter des photos"}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
