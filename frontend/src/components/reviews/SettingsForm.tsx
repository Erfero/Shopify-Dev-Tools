"use client";

import { useState } from "react";
import { Settings2, Users, Globe, Hash, Search, Check } from "lucide-react";
import { LANGUAGES } from "@/lib/languages";

const GENDERS = [
  { id: "femmes", emoji: "👩", label: "Femmes", desc: "Noms féminins français" },
  { id: "hommes", emoji: "👨", label: "Hommes", desc: "Noms masculins français" },
  { id: "mixte",  emoji: "👥", label: "Les Deux", desc: "Mélange homme / femme" },
];

interface SettingsFormProps {
  targetGender: string;
  language: string;
  reviewCount: number;
  onChange: (field: string, value: string | number) => void;
}

export function SettingsForm({ targetGender, language, reviewCount, onChange }: SettingsFormProps) {
  const [langOpen, setLangOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = LANGUAGES.find((l) => l.name === language) ?? LANGUAGES[0];
  const filtered = LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.nativeName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-up">
      <div className="flex items-start gap-4 mb-8 pb-6" style={{ borderBottom: "1px solid oklch(0.922 0 0)" }}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "oklch(0.97 0 0)", border: "1px solid oklch(0.922 0 0)" }}
        >
          <Settings2 size={22} style={{ color: "var(--primary)" }} />
        </div>
        <div>
          <h2 className="font-bold text-xl" style={{ color: "var(--text)" }}>Paramètres de Génération</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Configurez le genre, la langue et le nombre d&apos;avis
          </p>
        </div>
      </div>

      <div className="space-y-7">
        {/* Gender */}
        <div>
          <label className="label">
            <Users size={13} style={{ color: "var(--primary)" }} />
            Public cible <span style={{ color: "#EF4444" }}>*</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {GENDERS.map((g) => {
              const active = targetGender === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onChange("targetGender", g.id)}
                  className="p-4 rounded-2xl text-center transition-all duration-200"
                  style={{
                    background: active ? "oklch(0.97 0 0)" : "oklch(1 0 0)",
                    border: active ? "2px solid oklch(0.708 0 0)" : "1.5px solid var(--border)",
                    boxShadow: active ? "0 0 0 3px rgba(0,0,0,0.06)" : "var(--shadow-sm)",
                    cursor: "pointer",
                  }}
                >
                  <div className="text-2xl mb-1.5">{g.emoji}</div>
                  <div
                    className="font-semibold text-sm"
                    style={{ color: active ? "var(--primary)" : "var(--text)" }}
                  >
                    {g.label}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {g.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Language */}
        <div>
          <label className="label">
            <Globe size={13} style={{ color: "var(--primary)" }} />
            Langue des avis <span style={{ color: "#EF4444" }}>*</span>
          </label>
          <div className="relative">
            <button
              type="button"
              className="input flex items-center justify-between"
              style={{ textAlign: "left" }}
              onClick={() => setLangOpen(!langOpen)}
            >
              <span>
                <span className="font-medium" style={{ color: "var(--text)" }}>{selected.name}</span>
                <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>{selected.nativeName}</span>
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>▾</span>
            </button>

            {langOpen && (
              <div
                className="absolute z-50 w-full mt-1 rounded-2xl overflow-hidden"
                style={{
                  background: "white",
                  border: "1.5px solid oklch(0.922 0 0)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
                }}
              >
                <div className="p-2" style={{ borderBottom: "1px solid oklch(0.922 0 0)" }}>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "oklch(0.97 0 0)" }}>
                    <Search size={14} style={{ color: "var(--text-muted)" }} />
                    <input
                      className="bg-transparent outline-none text-sm w-full"
                      style={{ color: "var(--text)" }}
                      placeholder="Rechercher une langue..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {filtered.map((lang) => {
                    const isSelected = lang.code === selected.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        className="w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors"
                        style={{
                          background: isSelected ? "oklch(0.97 0 0)" : "transparent",
                          color: isSelected ? "var(--primary)" : "var(--text)",
                          fontSize: 14,
                        }}
                        onClick={() => { onChange("language", lang.name); setLangOpen(false); setSearch(""); }}
                      >
                        <span className="font-medium">{lang.name}</span>
                        <div className="flex items-center gap-2">
                          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{lang.nativeName}</span>
                          {isSelected && <Check size={13} style={{ color: "var(--primary)" }} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Review count */}
        <div>
          <label className="label" style={{ marginBottom: 10 }}>
            <Hash size={13} style={{ color: "var(--primary)" }} />
            Nombre d&apos;avis
            <span
              className="ml-auto font-bold text-base px-3 py-0.5 rounded-lg"
              style={{ background: "var(--gradient)", color: "white", fontSize: 15 }}
            >
              {reviewCount}
            </span>
          </label>
          <input
            type="range" min={10} max={200} step={10}
            value={reviewCount}
            onChange={(e) => onChange("reviewCount", parseInt(e.target.value))}
            className="w-full"
            style={{ accentColor: "var(--primary)", height: 4 }}
          />
          <div className="flex justify-between mt-1" style={{ fontSize: 12, color: "var(--text-muted)" }}>
            <span>10</span>
            <span>200 avis</span>
          </div>
          <div
            className="text-center text-xs mt-3 py-2 rounded-xl"
            style={{ background: "oklch(0.985 0 0)", color: "var(--text-secondary)", border: "1px solid oklch(0.922 0 0)" }}
          >
            Durée estimée :{" "}
            <strong style={{ color: "var(--primary)" }}>~{Math.ceil((reviewCount / 10) * 15)}s</strong>
            {" "}&middot;{" "}
            Coût estimé :{" "}
            <strong style={{ color: "#15803D" }}>~${((reviewCount / 100) * 0.034).toFixed(3)}</strong>
          </div>
        </div>

        {/* Info */}
        <div className="info-box text-sm">
          <p className="font-semibold mb-1">ℹ️ Format des noms générés</p>
          <p>
            Chaque avis sera attribué à un nom au format{" "}
            <strong>Prénom L. - XX ans</strong> (ex: Marie P. - 28 ans), adapté au genre et à la langue choisis.
          </p>
        </div>
      </div>
    </div>
  );
}
