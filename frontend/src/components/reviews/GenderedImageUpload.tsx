"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, Loader2, Users, User } from "lucide-react";
import { uploadImages } from "@/lib/api-reviews";
import { AnimatePresence } from "framer-motion";
import { ImageLightbox } from "@/components/shared/ImageLightbox";

interface GenderedImageUploadProps {
  femaleImageUrls: string[];
  maleImageUrls: string[];
  onFemaleUrlsChange: (urls: string[]) => void;
  onMaleUrlsChange: (urls: string[]) => void;
}

function ImagePool({
  label,
  icon,
  accentColor,
  imageUrls,
  onUrlsChange,
}: {
  label: string;
  icon: React.ReactNode;
  accentColor: string;
  imageUrls: string[];
  onUrlsChange: (urls: string[]) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (!images.length) { setError("Sélectionnez uniquement des images."); return; }
      setIsUploading(true); setError(null);
      try {
        const urls = await uploadImages(images);
        onUrlsChange([...imageUrls, ...urls]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de l'upload.");
      } finally {
        setIsUploading(false);
      }
    },
    [imageUrls, onUrlsChange]
  );

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: accentColor + "18", border: `1.5px solid ${accentColor}30` }}
        >
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
        <div>
          <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{label}</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {imageUrls.length > 0 ? `${imageUrls.length} image${imageUrls.length > 1 ? "s" : ""}` : "Aucune image"}
          </p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        style={{
          border: `2px dashed ${isDragging ? accentColor : "var(--border)"}`,
          borderRadius: 12,
          padding: "16px 12px",
          textAlign: "center",
          cursor: isUploading ? "default" : "pointer",
          background: isDragging ? accentColor + "08" : "var(--bg-subtle, oklch(0.99 0 0))",
          transition: "all 0.15s",
        }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handle(e.dataTransfer.files); }}
        onClick={() => !isUploading && ref.current?.click()}
      >
        <input ref={ref} type="file" multiple accept="image/*" className="hidden"
          onChange={(e) => { handle(e.target.files); e.target.value = ""; }} />
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={20} className="animate-spin" style={{ color: accentColor }} />
            <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Upload...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Upload size={18} style={{ color: accentColor }} />
            <p style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
              Glisser ou{" "}
              <span style={{ color: accentColor, textDecoration: "underline" }}>parcourir</span>
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg text-xs" style={{ background: "#FEF2F2", color: "#DC2626" }}>
          <span>⚠</span> {error}
          <button className="ml-auto" onClick={() => setError(null)}><X size={12} /></button>
        </div>
      )}

      {/* Preview grid */}
      {imageUrls.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>
              Cycle sur {imageUrls.length} image{imageUrls.length > 1 ? "s" : ""}
            </p>
            <button
              type="button"
              style={{ fontSize: 11, color: "#EF4444", fontWeight: 500 }}
              onClick={() => onUrlsChange([])}
            >
              Tout supprimer
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {imageUrls.map((url, i) => (
              <div key={i} className="relative group">
                <div
                  className="aspect-square rounded-lg overflow-hidden"
                  style={{ border: `1.5px solid ${accentColor}30`, cursor: "zoom-in" }}
                  onClick={() => setLightboxIdx(i)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`${label} ${i + 1}`} className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onUrlsChange(imageUrls.filter((_, idx) => idx !== i)); }}
                  className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "#EF4444" }}
                >
                  <X size={8} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {lightboxIdx !== null && (
          <ImageLightbox
            images={imageUrls}
            currentIndex={lightboxIdx}
            onClose={() => setLightboxIdx(null)}
            onNavigate={setLightboxIdx}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export function GenderedImageUpload({
  femaleImageUrls,
  maleImageUrls,
  onFemaleUrlsChange,
  onMaleUrlsChange,
}: GenderedImageUploadProps) {
  return (
    <div className="animate-fade-up">
      <div className="flex items-start gap-4 mb-6 pb-5" style={{ borderBottom: "1px solid oklch(0.922 0 0)" }}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "oklch(0.97 0 0)", border: "1px solid oklch(0.922 0 0)" }}
        >
          <Users size={22} style={{ color: "var(--primary)" }} />
        </div>
        <div>
          <h2 className="font-bold text-xl" style={{ color: "var(--text)" }}>Images des Avis</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Produit mixte — ajoutez des images séparément pour les avis femmes et hommes
          </p>
        </div>
      </div>

      <div className="flex gap-4" style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <ImagePool
          label="Images Femmes"
          icon={<User size={15} />}
          accentColor="#EC4899"
          imageUrls={femaleImageUrls}
          onUrlsChange={onFemaleUrlsChange}
        />
        <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch", flexShrink: 0 }} />
        <ImagePool
          label="Images Hommes"
          icon={<User size={15} />}
          accentColor="#3B82F6"
          imageUrls={maleImageUrls}
          onUrlsChange={onMaleUrlsChange}
        />
      </div>

      <div className="mt-5 px-4 py-3 rounded-xl text-xs" style={{ background: "oklch(0.97 0 0)", border: "1px solid oklch(0.922 0 0)", color: "var(--text-secondary)" }}>
        <p className="font-semibold mb-1" style={{ color: "var(--text)" }}>Comment ça fonctionne ?</p>
        <ul className="space-y-0.5">
          <li>• Les images femmes sont attribuées uniquement aux avis avec des prénoms féminins</li>
          <li>• Les images hommes sont attribuées uniquement aux avis avec des prénoms masculins</li>
          <li>• Si vous avez moins d'images que d'avis, elles sont réutilisées en cycle</li>
        </ul>
      </div>
    </div>
  );
}
