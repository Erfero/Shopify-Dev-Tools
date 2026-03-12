"use client";

import { useState, useEffect } from "react";
import { Download, FileText, FileSpreadsheet, RotateCcw, Star, MessageSquare, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { getDownloadUrl, getPreview } from "@/lib/api-reviews";
import { markAsDownloaded } from "@/lib/csvHistory";

interface ReviewPreview { author: string; review: string; reply: string; }

function buildFilename(brandName: string, reviewCount: number, suffix: string): string {
  const safe = brandName.trim().replace(/[^a-zA-Z0-9À-ÿ _-]/g, "").replace(/\s+/g, "_") || "Boutique";
  return `Loox_${safe}_${reviewCount}${suffix}.csv`;
}

async function triggerDownload(url: string, filename: string, onDone: () => void) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Erreur serveur");
    const blob = await resp.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
    onDone();
  } catch (e) {
    alert("Erreur lors du téléchargement : " + (e instanceof Error ? e.message : "inconnue"));
  }
}

export function DownloadSection({
  sessionId, reviewCount, brandName, onReset, onDownloaded,
}: { sessionId: string; reviewCount: number; brandName: string; onReset: () => void; onDownloaded: () => void }) {
  const [previews, setPreviews] = useState<ReviewPreview[]>([]);
  const [expanded, setExpanded] = useState<number | null>(0);

  useEffect(() => {
    getPreview(sessionId).then((d) => setPreviews(d.reviews)).catch(() => {});
  }, [sessionId]);

  return (
    <div className="animate-fade-up">
      <div className="flex items-start gap-4 mb-8 pb-6" style={{ borderBottom: "1px solid oklch(0.922 0 0)" }}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #DCFCE7, #BBF7D0)" }}
        >
          <CheckCircle2 size={22} style={{ color: "#15803D" }} />
        </div>
        <div>
          <h2 className="font-bold text-xl" style={{ color: "var(--text)" }}>Téléchargez vos Avis</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {reviewCount} avis prêts — choisissez le format d&apos;import Loox
          </p>
        </div>
      </div>

      {/* Download buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Import simple */}
        {/* Import simple */}
        <button
          type="button"
          onClick={() => triggerDownload(getDownloadUrl(sessionId, "import"), buildFilename(brandName, reviewCount, ""), () => { markAsDownloaded(sessionId); onDownloaded(); })}
          className="block p-5 rounded-2xl transition-all hover:shadow-lg group"
          style={{
            background: "white",
            border: "1.5px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
            textAlign: "left",
            width: "100%",
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "oklch(0.97 0 0)" }}
            >
              <FileText size={18} style={{ color: "var(--primary)" }} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>CSV Import Loox</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>8 colonnes — format officiel</p>
            </div>
            <Download size={16} className="opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: "var(--primary)" }} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["handle", "rating", "author", "body", "photo_url"].map((f) => (
              <span key={f}
                className="text-xs px-2 py-0.5 rounded-lg font-medium"
                style={{ background: "oklch(0.97 0 0)", color: "var(--primary)" }}>
                {f}
              </span>
            ))}
          </div>
          <p className="text-xs mt-2.5" style={{ color: "#D97706" }}>
            ⚠ Sans réponses boutique
          </p>
        </button>

        {/* Full format */}
        <button
          type="button"
          onClick={() => triggerDownload(getDownloadUrl(sessionId, "full"), buildFilename(brandName, reviewCount, "_complet"), () => { markAsDownloaded(sessionId); onDownloaded(); })}
          className="block p-5 rounded-2xl transition-all hover:shadow-lg group"
          style={{
            background: "white",
            border: "2px solid #BBF7D0",
            boxShadow: "var(--shadow-sm)",
            textAlign: "left",
            width: "100%",
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "#F0FDF4" }}
            >
              <FileSpreadsheet size={18} style={{ color: "#15803D" }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>CSV Complet</p>
                <span
                  className="text-xs px-2 py-0.5 rounded-lg font-semibold"
                  style={{ background: "#DCFCE7", color: "#15803D" }}
                >
                  Recommandé
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>18 colonnes — avec réponses</p>
            </div>
            <Download size={16} className="opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: "#15803D" }} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["reply", "replied_at", "nickname", "img"].map((f) => (
              <span key={f}
                className="text-xs px-2 py-0.5 rounded-lg font-medium"
                style={{ background: "#DCFCE7", color: "#15803D" }}>
                {f}
              </span>
            ))}
          </div>
          <p className="text-xs mt-2.5" style={{ color: "#15803D" }}>
            ✓ Inclut les réponses de la boutique
          </p>
        </button>
      </div>

      {/* Instructions */}
      <div className="info-box mb-6">
        <p className="font-semibold mb-2">📋 Importer dans Loox</p>
        <ol className="text-xs space-y-1 list-decimal list-inside" style={{ color: "var(--text-secondary)" }}>
          <li>Shopify Admin → Applications → Loox</li>
          <li>Reviews → <strong>Import Reviews</strong></li>
          <li>Uploadez le fichier CSV téléchargé</li>
          <li>Vérifiez les avis importés dans votre tableau de bord</li>
        </ol>
        <p className="text-xs mt-2 opacity-75">
          💡 Utilisez toujours le &quot;CSV Import Loox&quot; pour importer dans Loox
        </p>
      </div>

      {/* Preview */}
      {previews.length > 0 && (
        <div className="mb-6">
          <p className="font-semibold text-sm mb-3" style={{ color: "var(--text)" }}>
            Aperçu des premiers avis générés
          </p>
          <div className="space-y-2">
            {previews.map((r, i) => (
              <div key={i} className="card overflow-hidden">
                <button
                  type="button"
                  className="w-full p-4 text-left flex items-start justify-between gap-3"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white"
                      style={{ background: "var(--gradient)" }}
                    >
                      {r.author.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{r.author}</span>
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map((s) => (
                            <Star key={s} size={11} style={{ color: "#F59E0B", fill: "#F59E0B" }} />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs mt-0.5 line-clamp-1 overflow-hidden"
                        style={{ color: "var(--text-secondary)", display: "-webkit-box",
                          WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {r.review}
                      </p>
                    </div>
                  </div>
                  {expanded === i ? <ChevronUp size={15} className="shrink-0" style={{ color: "var(--text-muted)" }} />
                    : <ChevronDown size={15} className="shrink-0" style={{ color: "var(--text-muted)" }} />}
                </button>
                {expanded === i && (
                  <div className="px-4 pb-4 pt-3 space-y-3" style={{ borderTop: "1px solid oklch(0.922 0 0)" }}>
                    <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>{r.review}</p>
                    {r.reply && (
                      <div className="rounded-xl p-3 flex gap-2"
                        style={{ background: "oklch(0.97 0 0)", border: "1px solid oklch(0.922 0 0)" }}>
                        <MessageSquare size={14} className="shrink-0 mt-0.5" style={{ color: "var(--primary)" }} />
                        <div>
                          <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--primary)" }}>
                            Réponse boutique
                          </p>
                          <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>{r.reply}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <button type="button" onClick={onReset} className="btn-secondary">
          <RotateCcw size={15} /> Nouvelle génération
        </button>
      </div>
    </div>
  );
}
