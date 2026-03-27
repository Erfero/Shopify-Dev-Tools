"use client";

import { X } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const confirmBg =
    variant === "danger" ? "#DC2626" :
    variant === "warning" ? "#D97706" :
    "var(--primary)";

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300 }}
        onClick={onCancel}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 301,
          background: "white",
          borderRadius: 20,
          padding: "24px 28px",
          width: "min(440px, calc(100vw - 32px))",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <p style={{ fontWeight: 700, fontSize: 16, color: "var(--text, #111)" }}>{title}</p>
          <button
            onClick={onCancel}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted, #888)", padding: 2, marginLeft: 12, flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>
        {description && (
          <p style={{ fontSize: 14, color: "var(--text-secondary, #555)", marginBottom: 20, lineHeight: 1.6 }}>
            {description}
          </p>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "9px 18px",
              borderRadius: 10,
              border: "1.5px solid var(--border, #e5e7eb)",
              background: "white",
              color: "var(--text, #111)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "9px 18px",
              borderRadius: 10,
              border: "none",
              background: confirmBg,
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
