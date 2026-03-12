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

export function TextPreview({ steps }: TextPreviewProps) {
  const completedSteps = steps.filter(
    (s) => s.status === "done" && s.data && s.step !== "complete" && s.step !== "export",
  );

  if (completedSteps.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Apercu des textes generes</h3>

      <Accordion type="multiple" className="space-y-2">
        {completedSteps.map((step) => (
          <AccordionItem
            key={step.step}
            value={step.step}
            className="rounded-xl border border-border/60 px-4 data-[state=open]:bg-foreground/[0.01]"
          >
            <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
              {SECTION_LABELS[step.step] || step.step}
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <PreviewData data={step.data!} sectionKey={step.step} />
            </AccordionContent>
          </AccordionItem>
        ))}
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
  const palettes = (data.palettes || data.palette) as Array<Record<string, unknown>> | Record<string, unknown> | undefined;

  if (!palettes) return <GenericPreview data={data} depth={0} />;

  const paletteArray = Array.isArray(palettes) ? palettes : [palettes];

  return (
    <div className="space-y-4">
      {paletteArray.map((palette, i) => {
        const colors = (palette.colors || palette) as Record<string, string>;
        return (
          <div key={i} className="space-y-2">
            {typeof palette.name === "string" && (
              <p className="text-xs font-medium text-muted-foreground">
                {palette.name}
              </p>
            )}
            <div className="flex gap-2">
              {Object.entries(colors)
                .filter(([, v]) => typeof v === "string" && v.startsWith("#"))
                .map(([key, color]) => (
                  <div key={key} className="flex flex-col items-center gap-1">
                    <div
                      className="h-8 w-8 rounded-lg border border-border/40"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[10px] text-muted-foreground">{key}</span>
                  </div>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
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
              <p className="text-xs font-medium text-muted-foreground">
                {formatKey(key)}
              </p>
              <p className="text-xs text-foreground/80">{cleanValue}</p>
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
