"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface GeneratedDataEditorProps {
  data: Record<string, unknown>;
  onValidate: (data: Record<string, unknown>) => void;
  isApplying: boolean;
  applyError: string | null;
}

// ── Deep clone + path-based update ────────────────────────────────────────────

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function setPath(
  obj: Record<string, unknown>,
  path: (string | number)[],
  value: string,
): Record<string, unknown> {
  const result = deepClone(obj);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = result;
  for (let i = 0; i < path.length - 1; i++) {
    current = current[path[i]];
  }
  current[path[path.length - 1]] = value;
  return result;
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  multiline = false,
  onChange,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[80px] font-mono text-xs"
          rows={4}
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm"
        />
      )}
    </div>
  );
}

// ── Color palette card ────────────────────────────────────────────────────────

function ColorCard({
  palette,
  selected,
  onSelect,
}: {
  palette: {
    name: string;
    description: string;
    colors: Record<string, string>;
  };
  selected: boolean;
  onSelect: () => void;
}) {
  const swatches = Object.values(palette.colors).slice(0, 4);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition-all ${
        selected
          ? "border-foreground bg-foreground/5"
          : "border-border hover:border-foreground/30"
      }`}
    >
      <div className="mb-2 flex gap-1.5">
        {swatches.map((color, i) => (
          <span
            key={i}
            className="h-5 w-5 flex-shrink-0 rounded-full border border-black/10"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <p className="text-xs font-medium leading-tight">{palette.name}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{palette.description}</p>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GeneratedDataEditor({
  data,
  onValidate,
  isApplying,
  applyError,
}: GeneratedDataEditorProps) {
  const [editData, setEditData] = useState<Record<string, unknown>>(deepClone(data));
  const [selectedPalette, setSelectedPalette] = useState(0);

  function update(path: (string | number)[], value: string) {
    setEditData((prev) => setPath(prev, path, value));
  }

  // ── Typed getters ──────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hp = (editData.homepage || {}) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pp = (editData.product_page || {}) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faq = ((editData.faq as any)?.faq || {}) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const story = (editData.story_page || {}) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gt = (editData.global_texts || {}) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const palettes = ((editData.colors as any)?.palettes || []) as any[];

  function handleValidate() {
    onValidate(editData);
  }

  return (
    <div className="space-y-6">
      <Accordion type="multiple" className="w-full space-y-2">

        {/* ── Colors ────────────────────────────────────────────────────── */}
        {palettes.length > 0 && (
          <AccordionItem value="colors" className="rounded-lg border px-4">
            <AccordionTrigger className="text-sm font-medium">
              Palettes de couleurs
              <Badge variant="secondary" className="ml-auto mr-2 text-xs">Prévisualisation</Badge>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-3 pb-2 sm:grid-cols-3">
                {palettes.map((p, i) => (
                  <ColorCard
                    key={i}
                    palette={p}
                    selected={selectedPalette === i}
                    onSelect={() => setSelectedPalette(i)}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                La sélection de palette sera bientôt appliquée automatiquement.
              </p>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ── Homepage ──────────────────────────────────────────────────── */}
        {hp && (
          <AccordionItem value="homepage" className="rounded-lg border px-4">
            <AccordionTrigger className="text-sm font-medium">
              Page d&apos;accueil
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <Field
                label="Slogan bannière"
                value={hp.slogan || ""}
                onChange={(v) => update(["homepage", "slogan"], v)}
              />

              <div className="rounded-md bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bienvenue</p>
                <Field
                  label="Titre"
                  value={hp.welcome?.title || ""}
                  onChange={(v) => update(["homepage", "welcome", "title"], v)}
                />
                <Field
                  label="Texte (HTML)"
                  value={hp.welcome?.text || ""}
                  multiline
                  onChange={(v) => update(["homepage", "welcome", "text"], v)}
                />
              </div>

              <div className="rounded-md bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bénéfices (3 icônes)</p>
                {(hp.benefits || []).map((b: { title: string; text: string }, i: number) => (
                  <div key={i} className="space-y-2 border-b pb-2 last:border-0 last:pb-0">
                    <Field
                      label={`Icône ${i + 1} — Titre`}
                      value={b.title || ""}
                      onChange={(v) => update(["homepage", "benefits", i, "title"], v)}
                    />
                    <Field
                      label={`Icône ${i + 1} — Description`}
                      value={b.text || ""}
                      onChange={(v) => update(["homepage", "benefits", i, "text"], v)}
                    />
                  </div>
                ))}
              </div>

              <div className="rounded-md bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avantages (images avec texte)</p>
                {(hp.advantages || []).slice(0, 4).map((a: { title: string; text: string }, i: number) => (
                  <div key={i} className="space-y-2 border-b pb-2 last:border-0 last:pb-0">
                    <Field
                      label={`Avantage ${i + 1} — Titre`}
                      value={a.title || ""}
                      onChange={(v) => update(["homepage", "advantages", i, "title"], v)}
                    />
                    <Field
                      label={`Avantage ${i + 1} — Texte (HTML)`}
                      value={a.text || ""}
                      multiline
                      onChange={(v) => update(["homepage", "advantages", i, "text"], v)}
                    />
                  </div>
                ))}
              </div>

              <div className="rounded-md bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comparaison</p>
                <Field
                  label="Titre"
                  value={hp.comparison?.title || ""}
                  onChange={(v) => update(["homepage", "comparison", "title"], v)}
                />
                <Field
                  label="Description"
                  value={hp.comparison?.description || ""}
                  onChange={(v) => update(["homepage", "comparison", "description"], v)}
                />
              </div>

              <div className="rounded-md bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Spécifications</p>
                <Field
                  label="Titre de la section"
                  value={hp.specs?.title || ""}
                  onChange={(v) => update(["homepage", "specs", "title"], v)}
                />
                {(hp.specs?.items || []).map((s: { title: string; description: string }, i: number) => (
                  <div key={i} className="space-y-2 border-b pb-2 last:border-0 last:pb-0">
                    <Field
                      label={`Spec ${i + 1} — Titre`}
                      value={s.title || ""}
                      onChange={(v) => update(["homepage", "specs", "items", i, "title"], v)}
                    />
                    <Field
                      label={`Spec ${i + 1} — Description`}
                      value={s.description || ""}
                      onChange={(v) => update(["homepage", "specs", "items", i, "description"], v)}
                    />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ── Product page ──────────────────────────────────────────────── */}
        {pp && (
          <AccordionItem value="product" className="rounded-lg border px-4">
            <AccordionTrigger className="text-sm font-medium">
              Page produit
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="rounded-md bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Icônes produit (4)</p>
                {(pp.product_benefits || []).slice(0, 4).map((b: { short_title: string }, i: number) => (
                  <Field
                    key={i}
                    label={`Icône ${i + 1}`}
                    value={b.short_title || ""}
                    onChange={(v) => update(["product_page", "product_benefits", i, "short_title"], v)}
                  />
                ))}
              </div>

              <div className="rounded-md bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description produit</p>
                <Field
                  label="Titre"
                  value={pp.product_description?.heading || ""}
                  onChange={(v) => update(["product_page", "product_description", "heading"], v)}
                />
                <Field
                  label="Texte (HTML)"
                  value={pp.product_description?.text || ""}
                  multiline
                  onChange={(v) => update(["product_page", "product_description", "text"], v)}
                />
              </div>

              <div className="rounded-md bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comment ça marche</p>
                <Field
                  label="Titre"
                  value={pp.how_it_works?.heading || ""}
                  onChange={(v) => update(["product_page", "how_it_works", "heading"], v)}
                />
                <Field
                  label="Texte (HTML)"
                  value={pp.how_it_works?.text || ""}
                  multiline
                  onChange={(v) => update(["product_page", "how_it_works", "text"], v)}
                />
              </div>

              <div className="rounded-md bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Adoption</p>
                <Field
                  label="Titre (ex: +9860 personnes l'ont adopté)"
                  value={pp.adoption?.heading || ""}
                  onChange={(v) => update(["product_page", "adoption", "heading"], v)}
                />
                <Field
                  label="Texte (HTML)"
                  value={pp.adoption?.text || ""}
                  multiline
                  onChange={(v) => update(["product_page", "adoption", "text"], v)}
                />
              </div>

              <div className="rounded-md bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mini-avis produit (3)</p>
                {(pp.mini_reviews || []).map((r: { name: string; text: string }, i: number) => (
                  <div key={i} className="space-y-2 border-b pb-2 last:border-0 last:pb-0">
                    <Field
                      label={`Avis ${i + 1} — Nom`}
                      value={r.name || ""}
                      onChange={(v) => update(["product_page", "mini_reviews", i, "name"], v)}
                    />
                    <Field
                      label={`Avis ${i + 1} — Texte`}
                      value={r.text || ""}
                      multiline
                      onChange={(v) => update(["product_page", "mini_reviews", i, "text"], v)}
                    />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ── FAQ ───────────────────────────────────────────────────────── */}
        {faq && (
          <AccordionItem value="faq" className="rounded-lg border px-4">
            <AccordionTrigger className="text-sm font-medium">FAQ</AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <Field
                label="Titre de la section"
                value={faq.title || ""}
                onChange={(v) => update(["faq", "faq", "title"], v)}
              />
              {(faq.items || []).map((item: { question: string; answer: string }, i: number) => (
                <div key={i} className="rounded-md bg-muted/30 p-3 space-y-2">
                  <Field
                    label={`Question ${i + 1}`}
                    value={item.question || ""}
                    onChange={(v) => update(["faq", "faq", "items", i, "question"], v)}
                  />
                  <Field
                    label={`Réponse ${i + 1} (HTML)`}
                    value={item.answer || ""}
                    multiline
                    onChange={(v) => update(["faq", "faq", "items", i, "answer"], v)}
                  />
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ── Story page ────────────────────────────────────────────────── */}
        {story && (
          <AccordionItem value="story" className="rounded-lg border px-4">
            <AccordionTrigger className="text-sm font-medium">
              Page Notre Histoire
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <Field
                label="Titre de la page"
                value={story.page_heading || ""}
                onChange={(v) => update(["story_page", "page_heading"], v)}
              />
              <Field
                label="Sous-titre"
                value={story.page_subheading || ""}
                multiline
                onChange={(v) => update(["story_page", "page_subheading"], v)}
              />
              {(story.timeline_events || []).map(
                (ev: { year: string; heading: string; text: string }, i: number) => (
                  <div key={i} className="rounded-md bg-muted/30 p-3 space-y-2">
                    <div className="flex gap-2">
                      <div className="w-20 flex-shrink-0">
                        <Field
                          label="Année"
                          value={ev.year || ""}
                          onChange={(v) => update(["story_page", "timeline_events", i, "year"], v)}
                        />
                      </div>
                      <div className="flex-1">
                        <Field
                          label="Titre"
                          value={ev.heading || ""}
                          onChange={(v) => update(["story_page", "timeline_events", i, "heading"], v)}
                        />
                      </div>
                    </div>
                    <Field
                      label="Texte"
                      value={ev.text || ""}
                      multiline
                      onChange={(v) => update(["story_page", "timeline_events", i, "text"], v)}
                    />
                  </div>
                ),
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ── Global texts ──────────────────────────────────────────────── */}
        {gt && (
          <AccordionItem value="global" className="rounded-lg border px-4">
            <AccordionTrigger className="text-sm font-medium">
              Textes globaux (barre d&apos;annonce &amp; pied de page)
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              {(gt.header?.announcement_timer || gt.header?.announcement_marquee) && (
                <div className="rounded-md bg-muted/30 p-3 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Barre d&apos;annonce</p>
                  {gt.header?.announcement_timer !== undefined && (
                    <Field
                      label="Texte timer"
                      value={gt.header.announcement_timer || ""}
                      onChange={(v) => update(["global_texts", "header", "announcement_timer"], v)}
                    />
                  )}
                  {gt.header?.announcement_marquee !== undefined && (
                    <Field
                      label="Texte défilant"
                      value={gt.header.announcement_marquee || ""}
                      onChange={(v) => update(["global_texts", "header", "announcement_marquee"], v)}
                    />
                  )}
                </div>
              )}

              <div className="rounded-md bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pied de page — À propos</p>
                <Field
                  label="Texte (HTML)"
                  value={gt.footer?.brand_text || ""}
                  multiline
                  onChange={(v) => update(["global_texts", "footer", "brand_text"], v)}
                />
              </div>

              {(gt.footer?.trust_badges || []).length > 0 && (
                <div className="rounded-md bg-muted/30 p-3 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Badges de confiance</p>
                  {gt.footer.trust_badges.map(
                    (b: { heading: string; description: string }, i: number) => (
                      <div key={i} className="space-y-2 border-b pb-2 last:border-0 last:pb-0">
                        <Field
                          label={`Badge ${i + 1} — Titre`}
                          value={b.heading || ""}
                          onChange={(v) => update(["global_texts", "footer", "trust_badges", i, "heading"], v)}
                        />
                        <Field
                          label={`Badge ${i + 1} — Description`}
                          value={b.description || ""}
                          onChange={(v) => update(["global_texts", "footer", "trust_badges", i, "description"], v)}
                        />
                      </div>
                    ),
                  )}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

      </Accordion>

      {/* ── Validate button ───────────────────────────────────────────────── */}
      {applyError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {applyError}
        </p>
      )}

      <Button
        className="w-full"
        size="lg"
        onClick={handleValidate}
        disabled={isApplying}
      >
        {isApplying ? (
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Génération en cours…
          </span>
        ) : (
          "Valider et générer mon thème"
        )}
      </Button>
    </div>
  );
}
