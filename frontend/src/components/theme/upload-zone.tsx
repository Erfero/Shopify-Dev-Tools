"use client";

import { useCallback, useState } from "react";
import { Card } from "@/components/ui/card";
import { Upload, FolderOpen, Loader2 } from "lucide-react";

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  isUploading: boolean;
  error?: string | null;
}

export function UploadZone({ onFileSelected, isUploading, error }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".zip")) {
        return;
      }
      setFileName(file.name);
      onFileSelected(file);
    },
    [onFileSelected],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="w-full">
      <Card
        className={`relative flex min-h-[320px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition-all duration-200 ${
          isDragging
            ? "border-foreground/40 bg-foreground/[0.02]"
            : "border-border hover:border-foreground/20 hover:bg-foreground/[0.01]"
        } ${isUploading ? "pointer-events-none opacity-60" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => {
          if (!isUploading) document.getElementById("theme-file-input")?.click();
        }}
      >
        <input
          id="theme-file-input"
          type="file"
          accept=".zip"
          className="hidden"
          onChange={handleInputChange}
          disabled={isUploading}
        />

        <div className="flex flex-col items-center gap-4">
          {isUploading ? (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground/[0.04]">
              <Loader2 className="h-6 w-6 animate-spin text-foreground/60" />
            </div>
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground/[0.04]">
              <Upload className="h-6 w-6 text-foreground/60" />
            </div>
          )}

          <div className="text-center">
            {fileName && !isUploading ? (
              <div className="flex items-center gap-2 justify-center">
                <FolderOpen className="h-4 w-4 text-foreground/60" />
                <p className="text-sm font-medium text-foreground">{fileName}</p>
              </div>
            ) : isUploading ? (
              <p className="text-sm font-medium text-foreground/60">Analyse du theme en cours...</p>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  Glissez votre theme Shopify ici
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  ou cliquez pour parcourir (fichier .zip)
                </p>
              </>
            )}
          </div>
        </div>
      </Card>

      {error && (
        <p className="mt-3 text-center text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
