"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { GenerationStep } from "@/lib/api-theme";

const SECTION_LABELS: Record<string, string> = {
  colors: "Palette de couleurs",
  homepage: "Page d'accueil",
  product_page: "Page produit",
  faq: "Questions frequentes",
  reviews: "Avis clients",
  legal_pages: "Pages legales",
  story_page: "Notre histoire",
  global_texts: "Textes globaux",
};

interface TextPreviewProps {
  steps: GenerationStep[];
}

/** Count the number of leaf string fields in a nested object */
function countFields(obj: unknown, depth = 0): number {
  if (depth > 4 || obj === null || obj === undefined) return 0;
  if (typeof obj === "string") return 1;
  if (Array.isArray(obj)) return (obj as unknown[]).reduce<number>((sum, item) => sum + countFields(item, depth + 1), 0);
  if (typeof obj === "object") {
    return Object.values(obj as Record<string, unknown>).reduce<number>(
      (sum, v) => sum + countFields(v, depth + 1),
      0,
    );
  }
  return 0;
}

/** Extract the most prominent preview snippet for a section */
function getHighlight(sectionKey: string, data: Record<string, unknown>): string | null {
  try {
    if (sectionKey === "homepage") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      return d.slogan || d.welcome?.title || null;
    }
    if (sectionKey === "faq") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = (data as any)?.faq?.items;
      if (Array.isArray(items) && items.length > 0) return items[0].question || null;
    }
    if (sectionKey === "product_page") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      return d.product_description?.heading || d.product_benefits?.[0]?.short_title || null;
    }
    if (sectionKey === "story_page") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      return d.page_heading || null;
    }
    if (sectionKey === "reviews") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reviews = (data as any)?.reviews;
      if (Array.isArray(reviews) && reviews.length > 0) return reviews[0].title || reviews[0].name || null;
    }
    if (sectionKey === "global_texts") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      return d.header?.announcement_timer || d.footer?.brand_text?.slice(0, 80) || null;
    }
    if (sectionKey === "legal_pages") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      const first = Object.values(d)[0];
      if (typeof first === "string") return first.slice(0, 80);
    }
  } catch {
    // ignore
  }
  return null;
}

export function TextPreview({ steps }: TextPreviewProps) {
  const completedSteps = steps.filter(
    (s) => s.status === "done" && s.data && s.step !== "complete" && s.step !== "export",
  );

  if (completedSteps.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Apercu des textes generes</h3>

      <Accordion type="multiple" className="space-y-2">
        {completedSteps.map((step) => {
          const fieldCount = countFields(step.data);
          const highlight = step.step !== "colors" ? getHighlight(step.step, step.data!) : null;
          return (
            <AccordionItem
              key={step.step}
              value={step.step}
              className="rounded-xl border border-border/60 px-4 data-[state=open]:bg-foreground/[0.01]"
            >
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex flex-col items-start gap-0.5 text-left">
                  <span className="text-sm font-medium">
                    {SECTION_LABELS[step.step] || step.step}
                    {fieldCount > 0 && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        — {fieldCount} texte{fieldCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </span>
                  {highlight && (
                    <span className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                      {highlight.replace(/<[^>]*>/g, "").slice(0, 80)}
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <PreviewData data={step.data!} sectionKey={step.step} />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

function PreviewData({
  data,
  sectionKey,
}: {
  data: Record<string, unknown>;
  sectionKey: string;
}) {
  if (sectionKey === "colors") {
    return <ColorsPreview data={data} />;
  }

  if (sectionKey === "reviews") {
    return <ReviewsPreview data={data} />;
  }

  return <GenericPreview data={data} depth={0} />;
}

function ColorsPreview({ data }: { data: Record<string, unknown> }) {
  // New format: { color_schemes: { "background-1": { settings: { background: "#...", ... } } } }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const colorSchemes = (data as any)?.color_schemes as Record<string, { settings?: Record<string, string> }> | undefined;

  if (colorSchemes && typeof colorSchemes === "object") {
    return (
      <div className="space-y-3">
        {Object.entries(colorSchemes).map(([key, scheme], idx) => {
          const settings = scheme?.settings || {};
          const colorEntries = Object.entries(settings).filter(([, v]) => typeof v === "string" && v.startsWith("#"));
          return (
            <div key={key} className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Nuance {idx + 1} <span className="opacity-50">({key})</span></p>
              <div className="flex flex-wrap gap-1.5">
                {colorEntries.map(([field, color]) => (
                  <div key={field} className="flex flex-col items-center gap-0.5">
                    <div className="h-7 w-7 rounded-lg border border-border/40" style={{ backgroundColor: color }} />
                    <span className="text-[9px] text-muted-foreground">{field.replace("background_secondary", "bg2").replace("background", "bg").replace("text_secondary", "txt2").replace("text", "txt")}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return <GenericPreview data={data} depth={0} />;
}

function ReviewsPreview({ data }: { data: Record<string, unknown> }) {
  const reviews = (data.reviews || []) as Array<Record<string, unknown>>;
  const shown = reviews.slice(0, 3);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{reviews.length} avis generes</p>
      {shown.map((review, i) => (
        <div key={i} className="rounded-lg border border-border/40 p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{review.name as string}</span>
            {review.age != null && (
              <span className="text-xs text-muted-foreground">{String(review.age)} ans</span>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {"★".repeat(Number(review.rating) || 5)}
            </span>
          </div>
          <p className="mt-1 text-xs font-medium">{review.title as string}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {review.text as string}
          </p>
        </div>
      ))}
      {reviews.length > 3 && (
        <p className="text-xs text-muted-foreground">
          + {reviews.length - 3} autres avis
        </p>
      )}
    </div>
  );
}

function GenericPreview({
  data,
  depth,
}: {
  data: Record<string, unknown>;
  depth: number;
}) {
  if (depth > 3) return null;

  return (
    <div className={`space-y-2 ${depth > 0 ? "ml-3 border-l border-border/40 pl-3" : ""}`}>
      {Object.entries(data).map(([key, value]) => {
        if (value === null || value === undefined) return null;

        if (typeof value === "string") {
          const displayValue = value.length > 200 ? value.slice(0, 200) + "..." : value;
          const cleanValue = displayValue.replace(/<[^>]*>/g, "");

          return (
            <div key={key} className="space-y-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                {formatKey(key)}
              </p>
              <p className="text-xs text-foreground/80 leading-relaxed">{cleanValue}</p>
            </div>
          );
        }

        if (Array.isArray(value)) {
          return (
            <div key={key} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {formatKey(key)} ({value.length})
              </p>
              {value.slice(0, 3).map((item, i) => {
                if (typeof item === "string") {
                  return (
                    <p key={i} className="text-xs text-foreground/80">
                      {item.length > 100 ? item.slice(0, 100) + "..." : item}
                    </p>
                  );
                }
                if (typeof item === "object" && item) {
                  return (
                    <GenericPreview
                      key={i}
                      data={item as Record<string, unknown>}
                      depth={depth + 1}
                    />
                  );
                }
                return null;
              })}
              {value.length > 3 && (
                <p className="text-xs text-muted-foreground">+ {value.length - 3} de plus</p>
              )}
            </div>
          );
        }

        if (typeof value === "object") {
          return (
            <div key={key} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {formatKey(key)}
              </p>
              <GenericPreview
                data={value as Record<string, unknown>}
                depth={depth + 1}
              />
            </div>
          );
        }

        return (
          <div key={key} className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground">{formatKey(key)}</p>
            <p className="text-xs text-foreground/80">{String(value)}</p>
          </div>
        );
      })}
    </div>
  );
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
