"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, X, Package, CheckCircle2, Upload } from "lucide-react";
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

  const totalImages = products.reduce((s, p) => s + p.reviewImageFiles.length, 0);

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
          Ajoutez autant de photos que vous voulez pour chaque produit. Elles seront
          intégrées dans le CSV comme photos partagées par vos clients.
        </p>
      </div>

      {/* Per-product cards */}
      <div className="space-y-4">
        {products.map((product, idx) => {
          const hasImages = product.reviewImageFiles.length > 0;

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
                  {hasImages ? <CheckCircle2 size={15} /> : <Package size={15} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>
                    {product.productName || `Produit ${idx + 1}`}
                  </p>
                  <p className="text-xs" style={{ color: hasImages ? "#15803D" : "var(--text-muted)", fontWeight: hasImages ? 600 : 400 }}>
                    {hasImages
                      ? `${product.reviewImageFiles.length} photo(s) ajoutée(s)`
                      : "Aucune photo — optionnel"}
                  </p>
                </div>
              </div>

              <div style={{ padding: "16px" }}>
                {/* Thumbnails */}
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

                {/* Upload area */}
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
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.background = "oklch(0.97 0 0)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "oklch(0.85 0 0)"; e.currentTarget.style.background = "oklch(0.97 0 0)"; }}
                >
                  <Upload size={15} />
                  {hasImages ? "Ajouter d'autres photos" : "Ajouter des photos"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
