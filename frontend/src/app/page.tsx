import Link from "next/link";
import { Layers, ArrowRight, Star, Paintbrush } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mb-5 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground/[0.05] border border-border/60">
              <Layers className="h-7 w-7 text-foreground/70" />
            </div>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Shopify Dev Tools
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Outils IA pour optimiser votre boutique Shopify
          </p>
        </div>

        {/* Tool cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Loox Review Generator */}
          <Link
            href="/reviews"
            className="group flex flex-col rounded-2xl border border-border/60 bg-foreground/[0.01] p-6 transition-all hover:border-foreground/20 hover:bg-foreground/[0.03] hover:shadow-sm"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/[0.05]">
              <Star className="h-5 w-5 text-foreground/70" />
            </div>
            <h2 className="text-base font-semibold">Loox Review Generator</h2>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              Générez des centaines d&apos;avis clients authentiques avec réponses boutique.
              Export CSV prêt à importer dans Loox.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {["100 langues", "Vision IA", "Format Loox"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-foreground/[0.04] px-2.5 py-0.5 text-xs text-foreground/60 border border-border/40"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-auto pt-5 flex items-center gap-1 text-xs font-medium text-foreground/50 group-hover:text-foreground/70 transition-colors">
              Ouvrir
              <ArrowRight className="h-3 w-3" />
            </div>
          </Link>

          {/* Theme Customizer */}
          <Link
            href="/theme"
            className="group flex flex-col rounded-2xl border border-border/60 bg-foreground/[0.01] p-6 transition-all hover:border-foreground/20 hover:bg-foreground/[0.03] hover:shadow-sm"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/[0.05]">
              <Paintbrush className="h-5 w-5 text-foreground/70" />
            </div>
            <h2 className="text-base font-semibold">Theme Customizer</h2>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              Personnalisez automatiquement votre thème Shopify avec l&apos;IA.
              Textes, couleurs, pages légales — tout en quelques minutes.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {["Multi-langue", "Pages légales", "Export ZIP"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-foreground/[0.04] px-2.5 py-0.5 text-xs text-foreground/60 border border-border/40"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-auto pt-5 flex items-center gap-1 text-xs font-medium text-foreground/50 group-hover:text-foreground/70 transition-colors">
              Ouvrir
              <ArrowRight className="h-3 w-3" />
            </div>
          </Link>
        </div>

        {/* Footer */}
        <p className="mt-12 text-center text-xs text-muted-foreground/40">
          Propulsé par OpenRouter AI
        </p>
      </div>
    </div>
  );
}
