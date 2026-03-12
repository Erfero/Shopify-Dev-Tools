"use client";

import { useState, useRef, useEffect } from "react";
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

// ── Plain text field ───────────────────────────────────────────────────────────

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
          className="min-h-[80px] text-sm"
          rows={3}
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

// ── Rich text field (HTML) ─────────────────────────────────────────────────────

function RichTextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showSource, setShowSource] = useState(false);
  const [fmt, setFmt] = useState({ bold: false, italic: false, underline: false });
  // Flag to sync innerHTML after switching back from source mode
  const pendingSync = useRef(false);

  // Init on mount
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After every render: apply pending sync (source → rich transition)
  useEffect(() => {
    if (pendingSync.current && editorRef.current) {
      editorRef.current.innerHTML = value;
      pendingSync.current = false;
    }
  });

  const updateFmt = () => {
    setFmt({
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      bold: document.queryCommandState("bold"),
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      italic: document.queryCommandState("italic"),
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      underline: document.queryCommandState("underline"),
    });
  };

  const exec = (command: string) => {
    editorRef.current?.focus();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand(command, false);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
    updateFmt();
  };

  const toggleSource = () => {
    if (!showSource) {
      // Going TO source — save current innerHTML
      if (editorRef.current) onChange(editorRef.current.innerHTML);
    } else {
      // Coming BACK to rich — schedule sync after re-render
      pendingSync.current = true;
    }
    setShowSource((s) => !s);
  };

  const activeBtn = "bg-foreground/10 border-foreground/30 text-foreground";
  const baseBtn = "px-2 py-0.5 rounded text-xs hover:bg-muted transition-colors border border-transparent hover:border-border";

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="rounded-md border overflow-hidden focus-within:ring-1 focus-within:ring-ring">
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 border-b bg-muted/40 px-2 py-1">
          <button type="button" className={`${baseBtn} font-bold ${fmt.bold ? activeBtn : ""}`}
            onMouseDown={(e) => { e.preventDefault(); exec("bold"); }} title="Gras (Ctrl+B)">B</button>
          <button type="button" className={`${baseBtn} italic ${fmt.italic ? activeBtn : ""}`}
            onMouseDown={(e) => { e.preventDefault(); exec("italic"); }} title="Italique (Ctrl+I)">I</button>
          <button type="button" className={`${baseBtn} underline ${fmt.underline ? activeBtn : ""}`}
            onMouseDown={(e) => { e.preventDefault(); exec("underline"); }} title="Souligné (Ctrl+U)">S</button>
          <div className="mx-1 h-4 w-px bg-border" />
          <button type="button"
            className={`${baseBtn} text-muted-foreground ${showSource ? activeBtn : ""}`}
            onClick={toggleSource} title="HTML source"
          >&lt;/&gt;</button>
        </div>

        {/* Source mode */}
        {showSource ? (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="rounded-none border-0 font-mono text-xs min-h-[80px] focus-visible:ring-0"
            rows={4}
          />
        ) : (
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onKeyUp={updateFmt}
            onMouseUp={updateFmt}
            onSelect={updateFmt}
            onBlur={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); }}
            onInput={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); }}
            className="min-h-[80px] p-2 text-sm outline-none [&_strong]:font-bold [&_b]:font-bold [&_em]:italic [&_i]:italic [&_u]:underline [&_p]:mb-1 [&_p:last-child]:mb-0"
          />
        )}
      </div>
    </div>
  );
}

// ── Color palette card ────────────────────────────────────────────────────────

function ColorCard({
  palette,
  selected,
  onSelect,
}: {
  palette: { name: string; description: string; colors: Record<string, string> };
  selected: boolean;
  onSelect: () => void;
}) {
  const swatches = Object.values(palette.colors).slice(0, 4);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition-all ${
        selected ? "border-foreground bg-foreground/5" : "border-border hover:border-foreground/30"
      }`}
    >
      <div className="mb-2 flex gap-1.5">
        {swatches.map((color, i) => (
          <span key={i} className="h-5 w-5 flex-shrink-0 rounded-full border border-black/10" style={{ backgroundColor: color }} />
        ))}
      </div>
      <p className="text-xs font-medium leading-tight">{palette.name}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{palette.description}</p>
    </button>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-muted/30 p-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
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

  return (
    <div className="space-y-6">
      <Accordion type="multiple" className="w-full space-y-2">

        {/* ── Colors ─────────────────────────────────────────────────────── */}
        {palettes.length > 0 && (
          <AccordionItem value="colors" className="rounded-lg border px-4">
            <AccordionTrigger className="text-sm font-medium">
              Palettes de couleurs
              <Badge variant="secondary" className="ml-auto mr-2 text-xs">Sélection</Badge>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-3 pb-2 sm:grid-cols-3">
                {palettes.map((p, i) => (
                  <ColorCard key={i} palette={p} selected={selectedPalette === i} onSelect={() => setSelectedPalette(i)} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ── Homepage ───────────────────────────────────────────────────── */}
        {hp && Object.keys(hp).length > 0 && (
          <AccordionItem value="homepage" className="rounded-lg border px-4">
            <AccordionTrigger className="text-sm font-medium">Page d&apos;accueil</AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">

              <Field label="Slogan bannière" value={hp.slogan || ""} onChange={(v) => update(["homepage", "slogan"], v)} />
              <Field label="Texte bouton CTA" value={hp.cta_button_text || ""} onChange={(v) => update(["homepage", "cta_button_text"], v)} />

              <Section title="Section Bienvenue">
                <Field label="Titre" value={hp.welcome?.title || ""} onChange={(v) => update(["homepage", "welcome", "title"], v)} />
                <RichTextField label="Texte (HTML)" value={hp.welcome?.text || ""} onChange={(v) => update(["homepage", "welcome", "text"], v)} />
              </Section>

              <Section title="Bénéfices (icônes)">
                {(hp.benefits || []).map((b: { title: string; text: string }, i: number) => (
                  <div key={i} className="space-y-2 border-b pb-2 last:border-0 last:pb-0">
                    <Field label={`Icône ${i + 1} — Titre`} value={b.title || ""} onChange={(v) => update(["homepage", "benefits", i, "title"], v)} />
                    <RichTextField label={`Icône ${i + 1} — Description`} value={b.text || ""} onChange={(v) => update(["homepage", "benefits", i, "text"], v)} />
                  </div>
                ))}
              </Section>

              <Section title="Avantages (images + texte)">
                {(hp.advantages || []).map((a: { title: string; text: string }, i: number) => (
                  <div key={i} className="space-y-2 border-b pb-2 last:border-0 last:pb-0">
                    <Field label={`Avantage ${i + 1} — Titre`} value={a.title || ""} onChange={(v) => update(["homepage", "advantages", i, "title"], v)} />
                    <RichTextField label={`Avantage ${i + 1} — Texte`} value={a.text || ""} onChange={(v) => update(["homepage", "advantages", i, "text"], v)} />
                  </div>
                ))}
              </Section>

              <Section title="Comparaison">
                <Field label="Titre" value={hp.comparison?.title || ""} onChange={(v) => update(["homepage", "comparison", "title"], v)} />
                <RichTextField label="Description" value={hp.comparison?.description || ""} onChange={(v) => update(["homepage", "comparison", "description"], v)} />
                {(hp.comparison?.items || []).map((item: { feature: string; tooltip: string }, i: number) => (
                  <div key={i} className="space-y-2 border-b pb-2 last:border-0 last:pb-0">
                    <Field label={`Avantage ${i + 1}`} value={item.feature || ""} onChange={(v) => update(["homepage", "comparison", "items", i, "feature"], v)} />
                    <RichTextField label={`Explication ${i + 1}`} value={item.tooltip || ""} onChange={(v) => update(["homepage", "comparison", "items", i, "tooltip"], v)} />
                  </div>
                ))}
              </Section>

              <Section title="Spécifications">
                <Field label="Titre de section" value={hp.specs?.title || ""} onChange={(v) => update(["homepage", "specs", "title"], v)} />
                {(hp.specs?.items || []).map((s: { title: string; description: string }, i: number) => (
                  <div key={i} className="space-y-2 border-b pb-2 last:border-0 last:pb-0">
                    <Field label={`Spec ${i + 1} — Titre`} value={s.title || ""} onChange={(v) => update(["homepage", "specs", "items", i, "title"], v)} />
                    <RichTextField label={`Spec ${i + 1} — Description`} value={s.description || ""} onChange={(v) => update(["homepage", "specs", "items", i, "description"], v)} />
                  </div>
                ))}
              </Section>

            </AccordionContent>
          </AccordionItem>
        )}

        {/* ── Product page ───────────────────────────────────────────────── */}
        {pp && Object.keys(pp).length > 0 && (
          <AccordionItem value="product" className="rounded-lg border px-4">
            <AccordionTrigger className="text-sm font-medium">Page produit</AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">

              <Section title="Icônes produit">
                {(pp.product_benefits || []).map((b: { short_title: string; description: string }, i: number) => (
                  <div key={i} className="space-y-2 border-b pb-2 last:border-0 last:pb-0">
                    <Field label={`Icône ${i + 1} — Titre court`} value={b.short_title || ""} onChange={(v) => update(["product_page", "product_benefits", i, "short_title"], v)} />
                    <Field label={`Icône ${i + 1} — Description`} value={b.description || ""} onChange={(v) => update(["product_page", "product_benefits", i, "description"], v)} />
                  </div>
                ))}
              </Section>

              <Section title="Description produit">
                <Field label="Titre" value={pp.product_description?.heading || ""} onChange={(v) => update(["product_page", "product_description", "heading"], v)} />
                <RichTextField label="Texte" value={pp.product_description?.text || ""} onChange={(v) => update(["product_page", "product_description", "text"], v)} />
              </Section>

              <Section title="Comment ça marche">
                <Field label="Titre" value={pp.how_it_works?.heading || ""} onChange={(v) => update(["product_page", "how_it_works", "heading"], v)} />
                <RichTextField label="Texte" value={pp.how_it_works?.text || ""} onChange={(v) => update(["product_page", "how_it_works", "text"], v)} />
              </Section>

              <Section title="Adoption (social proof)">
                <Field label="Titre (ex: +9860 personnes l'ont adopté)" value={pp.adoption?.heading || ""} onChange={(v) => update(["product_page", "adoption", "heading"], v)} />
                <RichTextField label="Texte" value={pp.adoption?.text || ""} onChange={(v) => update(["product_page", "adoption", "text"], v)} />
              </Section>

              <Section title="Mini-avis produit">
                {(pp.mini_reviews || []).map((r: { name: string; age: string; text: string }, i: number) => (
                  <div key={i} className="space-y-2 border-b pb-2 last:border-0 last:pb-0">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Field label={`Avis ${i + 1} — Nom`} value={r.name || ""} onChange={(v) => update(["product_page", "mini_reviews", i, "name"], v)} />
                      </div>
                      <div className="w-24">
                        <Field label="Âge" value={r.age || ""} onChange={(v) => update(["product_page", "mini_reviews", i, "age"], v)} />
                      </div>
                    </div>
                    <Field label={`Avis ${i + 1} — Texte`} value={r.text || ""} multiline onChange={(v) => update(["product_page", "mini_reviews", i, "text"], v)} />
                  </div>
                ))}
              </Section>

              <Section title="Spécifications produit">
                <Field label="Titre de section" value={pp.product_specs?.title || ""} onChange={(v) => update(["product_page", "product_specs", "title"], v)} />
                {(pp.product_specs?.items || []).map((s: { title: string; description: string }, i: number) => (
                  <div key={i} className="space-y-2 border-b pb-2 last:border-0 last:pb-0">
                    <Field label={`Spec ${i + 1} — Titre`} value={s.title || ""} onChange={(v) => update(["product_page", "product_specs", "items", i, "title"], v)} />
                    <RichTextField label={`Spec ${i + 1} — Description`} value={s.description || ""} onChange={(v) => update(["product_page", "product_specs", "items", i, "description"], v)} />
                  </div>
                ))}
              </Section>

            </AccordionContent>
          </AccordionItem>
        )}

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        {faq && Object.keys(faq).length > 0 && (
          <AccordionItem value="faq" className="rounded-lg border px-4">
            <AccordionTrigger className="text-sm font-medium">FAQ</AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <Field label="Titre de la section" value={faq.title || ""} onChange={(v) => update(["faq", "faq", "title"], v)} />
              {(faq.items || []).map((item: { question: string; answer: string }, i: number) => (
                <div key={i} className="rounded-md bg-muted/30 p-3 space-y-2">
                  <Field label={`Question ${i + 1}`} value={item.question || ""} onChange={(v) => update(["faq", "faq", "items", i, "question"], v)} />
                  <RichTextField label={`Réponse ${i + 1}`} value={item.answer || ""} onChange={(v) => update(["faq", "faq", "items", i, "answer"], v)} />
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ── Story page ─────────────────────────────────────────────────── */}
        {story && Object.keys(story).length > 0 && (
          <AccordionItem value="story" className="rounded-lg border px-4">
            <AccordionTrigger className="text-sm font-medium">Page Notre Histoire</AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <Field label="Titre de la page" value={story.page_heading || ""} onChange={(v) => update(["story_page", "page_heading"], v)} />
              <Field label="Sous-titre" value={story.page_subheading || ""} multiline onChange={(v) => update(["story_page", "page_subheading"], v)} />
              {(story.timeline_events || []).map((ev: { year: string; heading: string; text: string }, i: number) => (
                <div key={i} className="rounded-md bg-muted/30 p-3 space-y-2">
                  <div className="flex gap-2">
                    <div className="w-20 flex-shrink-0">
                      <Field label="Année" value={ev.year || ""} onChange={(v) => update(["story_page", "timeline_events", i, "year"], v)} />
                    </div>
                    <div className="flex-1">
                      <Field label="Titre" value={ev.heading || ""} onChange={(v) => update(["story_page", "timeline_events", i, "heading"], v)} />
                    </div>
                  </div>
                  <Field label="Texte" value={ev.text || ""} multiline onChange={(v) => update(["story_page", "timeline_events", i, "text"], v)} />
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ── Global texts ───────────────────────────────────────────────── */}
        {gt && Object.keys(gt).length > 0 && (
          <AccordionItem value="global" className="rounded-lg border px-4">
            <AccordionTrigger className="text-sm font-medium">Textes globaux</AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">

              {(gt.header?.announcement_timer || gt.header?.announcement_marquee) && (
                <Section title="Barre d'annonce">
                  {gt.header?.announcement_timer !== undefined && (
                    <Field label="Texte timer" value={gt.header.announcement_timer || ""} onChange={(v) => update(["global_texts", "header", "announcement_timer"], v)} />
                  )}
                  {gt.header?.announcement_marquee !== undefined && (
                    <Field label="Texte défilant" value={gt.header.announcement_marquee || ""} onChange={(v) => update(["global_texts", "header", "announcement_marquee"], v)} />
                  )}
                </Section>
              )}

              <Section title="Pied de page — À propos">
                <RichTextField label="Texte" value={gt.footer?.brand_text || ""} onChange={(v) => update(["global_texts", "footer", "brand_text"], v)} />
              </Section>

              {(gt.footer?.newsletter_heading || gt.footer?.newsletter_text) && (
                <Section title="Newsletter">
                  <Field label="Titre newsletter" value={gt.footer?.newsletter_heading || ""} onChange={(v) => update(["global_texts", "footer", "newsletter_heading"], v)} />
                  <RichTextField label="Texte newsletter" value={gt.footer?.newsletter_text || ""} onChange={(v) => update(["global_texts", "footer", "newsletter_text"], v)} />
                </Section>
              )}

              {(gt.footer?.trust_badges || []).length > 0 && (
                <Section title="Badges de confiance">
                  {gt.footer.trust_badges.map((b: { heading: string; description: string }, i: number) => (
                    <div key={i} className="space-y-2 border-b pb-2 last:border-0 last:pb-0">
                      <Field label={`Badge ${i + 1} — Titre`} value={b.heading || ""} onChange={(v) => update(["global_texts", "footer", "trust_badges", i, "heading"], v)} />
                      <RichTextField label={`Badge ${i + 1} — Description`} value={b.description || ""} onChange={(v) => update(["global_texts", "footer", "trust_badges", i, "description"], v)} />
                    </div>
                  ))}
                </Section>
              )}

              {gt.cart && (
                <Section title="Panier">
                  <Field label="Bouton commander" value={gt.cart?.button_text || ""} onChange={(v) => update(["global_texts", "cart", "button_text"], v)} />
                  <Field label="Titre upsell" value={gt.cart?.upsell_title || ""} onChange={(v) => update(["global_texts", "cart", "upsell_title"], v)} />
                  <Field label="Bouton upsell" value={gt.cart?.upsell_button_text || ""} onChange={(v) => update(["global_texts", "cart", "upsell_button_text"], v)} />
                  <Field label="Texte protection colis" value={gt.cart?.protection_text || ""} onChange={(v) => update(["global_texts", "cart", "protection_text"], v)} />
                  <Field label="Texte économies" value={gt.cart?.savings_text || ""} onChange={(v) => update(["global_texts", "cart", "savings_text"], v)} />
                  <Field label="Sous-total" value={gt.cart?.subtotal_text || ""} onChange={(v) => update(["global_texts", "cart", "subtotal_text"], v)} />
                  <Field label="Total" value={gt.cart?.total_text || ""} onChange={(v) => update(["global_texts", "cart", "total_text"], v)} />
                  <Field label="Texte bas de panier" value={gt.cart?.cart_footer_text || ""} onChange={(v) => update(["global_texts", "cart", "cart_footer_text"], v)} />
                </Section>
              )}

              {gt.delivery && (
                <Section title="Livraison (étapes)">
                  <Field label="Étape 1 — Commande" value={gt.delivery?.today_info || ""} onChange={(v) => update(["global_texts", "delivery", "today_info"], v)} />
                  <Field label="Étape 2 — Préparation" value={gt.delivery?.ready_info || ""} onChange={(v) => update(["global_texts", "delivery", "ready_info"], v)} />
                  <Field label="Étape 3 — Livraison" value={gt.delivery?.delivered_info || ""} onChange={(v) => update(["global_texts", "delivery", "delivered_info"], v)} />
                </Section>
              )}

              {gt.settings && (
                <Section title="Paramètres">
                  <Field label="Bouton carte produit" value={gt.settings?.product_card_button_text || ""} onChange={(v) => update(["global_texts", "settings", "product_card_button_text"], v)} />
                  <Field label="Texte timer expiré" value={gt.settings?.timer_timeout_text || ""} onChange={(v) => update(["global_texts", "settings", "timer_timeout_text"], v)} />
                </Section>
              )}

            </AccordionContent>
          </AccordionItem>
        )}

      </Accordion>

      {applyError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {applyError}
        </p>
      )}

      <Button className="w-full" size="lg" onClick={() => onValidate(editData)} disabled={isApplying}>
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
