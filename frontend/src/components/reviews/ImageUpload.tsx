"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, ImageIcon, Loader2, Info } from "lucide-react";
import { uploadImages } from "@/lib/api-reviews";
import { AnimatePresence } from "framer-motion";
import { ImageLightbox } from "@/components/shared/ImageLightbox";

interface ImageUploadProps {
  imageUrls: string[];
  onUrlsChange: (urls: string[]) => void;
}

export function ImageUpload({ imageUrls, onUrlsChange }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (!images.length) { setError("Veuillez sélectionner uniquement des images."); return; }
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
    <div className="animate-fade-up">
      <div className="flex items-start gap-4 mb-8 pb-6" style={{ borderBottom: "1px solid oklch(0.922 0 0)" }}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "oklch(0.97 0 0)", border: "1px solid oklch(0.922 0 0)" }}
        >
          <ImageIcon size={22} style={{ color: "var(--primary)" }} />
        </div>
        <div>
          <h2 className="font-bold text-xl" style={{ color: "var(--text)" }}>Images des Avis</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Optionnel — images attribuées séquentiellement à vos avis
          </p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`drop-zone ${isDragging ? "drag-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handle(e.dataTransfer.files); }}
        onClick={() => !isUploading && ref.current?.click()}
      >
        <input ref={ref} type="file" multiple accept="image/*" className="hidden"
          onChange={(e) => { handle(e.target.files); e.target.value = ""; }} />
        {isUploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin" style={{ color: "var(--primary)" }} />
            <p className="font-medium text-sm" style={{ color: "var(--text-secondary)" }}>Upload en cours...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "oklch(0.97 0 0)", border: "1px solid oklch(0.922 0 0)" }}
            >
              <Upload size={24} style={{ color: "var(--primary)" }} />
            </div>
            <div>
              <p className="font-semibold text-base" style={{ color: "var(--text)" }}>
                Glissez vos images ici
              </p>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                ou{" "}
                <span style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}>
                  parcourez vos fichiers
                </span>
              </p>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>PNG, JPG, WEBP — plusieurs fichiers acceptés</p>
          </div>
        )}
      </div>

      {error && (
        <div className="error-banner mt-3">
          <span>⚠</span> {error}
          <button className="ml-auto" onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {/* Preview grid */}
      {imageUrls.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
              {imageUrls.length} image{imageUrls.length > 1 ? "s" : ""} ajoutée{imageUrls.length > 1 ? "s" : ""}
            </p>
            <button
              type="button"
              className="text-xs font-medium"
              style={{ color: "#EF4444" }}
              onClick={() => onUrlsChange([])}
            >
              Tout supprimer
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {imageUrls.map((url, i) => (
              <div key={i} className="relative group">
                <div
                  className="aspect-square rounded-xl overflow-hidden"
                  style={{ border: "1.5px solid var(--border)", cursor: "zoom-in" }}
                  onClick={() => setLightboxIdx(i)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Image ${i + 1}`} className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
                <div
                  className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: "var(--gradient)", fontSize: 10 }}
                >
                  {i + 1}
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onUrlsChange(imageUrls.filter((_, idx) => idx !== i)); }}
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "#EF4444" }}
                >
                  <X size={10} className="text-white" />
                </button>
                <p className="text-center mt-1" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  Avis #{i + 1}
                </p>
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

      {/* Info */}
      <div className="info-box flex gap-3 mt-5">
        <Info size={15} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-1">Ces images seront attribuées à vos avis</p>
          <ul className="space-y-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            <li>• Image 1 → Avis 1, Image 2 → Avis 2, etc. — chaque image utilisée une seule fois</li>
            <li>• Les avis au-delà du nombre d'images n'auront pas de photo</li>
            <li>• Ajoutez une clé <strong>imgbb</strong> dans .env pour des URLs publiques</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
