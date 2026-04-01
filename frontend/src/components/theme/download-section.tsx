"use client";

import { Button } from "@/components/ui/button";
import { downloadTheme } from "@/lib/api-theme";
import { Download, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface DownloadSectionProps {
  sessionId: string;
  onReset: () => void;
}

export function DownloadSection({ sessionId, onReset }: DownloadSectionProps) {
  const handleDownload = () => {
    downloadTheme(sessionId).catch(() => toast.error("Erreur lors du téléchargement. Veuillez réessayer."));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-foreground/[0.01] p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground/[0.04]">
          <CheckCircle2 className="h-6 w-6 text-foreground" />
        </div>

        <div>
          <h3 className="text-base font-semibold">Theme pret</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Votre theme personnalise est pret a etre telecharge et importe dans Shopify.
          </p>
        </div>

        <Button
          onClick={handleDownload}
          className="h-12 w-full max-w-xs rounded-xl text-sm font-medium"
        >
          <Download className="h-4 w-4 mr-2" />
          Telecharger le theme (.zip)
        </Button>
      </div>

      <div className="flex justify-center">
        <Button
          variant="ghost"
          onClick={onReset}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Personnaliser un autre theme
        </Button>
      </div>
    </div>
  );
}
