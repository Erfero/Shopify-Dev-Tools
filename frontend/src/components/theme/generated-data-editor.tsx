"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
import { regenerateSection } from "@/lib/api-theme";

interface GeneratedDataEditorProps {
  data: Record<string, unknown>;
  onValidate: (data: Record<string, unknown>) => void;
  isApplying: boolean;
  applyError: string | null;
  sessionId?: string;
  onSectionRegenerated?: (section: string, newData: unknown) => void;
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
  const [fmt, setFmt] = useState({ bold: false, italic: false, underline: false, ul: false, ol: false });
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
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      ul: document.queryCommandState("insertUnorderedList"),
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      ol: document.queryCommandState("insertOrderedList"),
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
          <button type="button" className={`${baseBtn} ${fmt.ul ? activeBtn : ""}`}
            onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }} title="Liste à puces">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
          </button>
          <button type="button" className={`${baseBtn} ${fmt.ol ? activeBtn : ""}`}
            onMouseDown={(e) => { e.preventDefault(); exec("insertOrderedList"); }} title="Liste numérotée">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="2" y="8" fontSize="7" fontWeight="bold" stroke="none" fill="currentColor">1.</text><text x="2" y="14" fontSize="7" fontWeight="bold" stroke="none" fill="currentColor">2.</text><text x="2" y="20" fontSize="7" fontWeight="bold" stroke="none" fill="currentColor">3.</text></svg>
          </button>
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
            className="min-h-[80px] p-2 text-sm outline-none [&_strong]:font-bold [&_b]:font-bold [&_em]:italic [&_i]:italic [&_u]:underline [&_p]:mb-1 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_li]:mb-0.5"
          />
        )}
      </div>
    </div>
  );
}

// ── CSS named colours ──────────────────────────────────────────────────────────

const CSS_NAMED_COLORS: { name: string; hex: string }[] = [
  { name: "aliceblue", hex: "#F0F8FF" }, { name: "antiquewhite", hex: "#FAEBD7" },
  { name: "aqua", hex: "#00FFFF" }, { name: "aquamarine", hex: "#7FFFD4" },
  { name: "azure", hex: "#F0FFFF" }, { name: "beige", hex: "#F5F5DC" },
  { name: "bisque", hex: "#FFE4C4" }, { name: "black", hex: "#000000" },
  { name: "blanchedalmond", hex: "#FFEBCD" }, { name: "blue", hex: "#0000FF" },
  { name: "blueviolet", hex: "#8A2BE2" }, { name: "brown", hex: "#A52A2A" },
  { name: "burlywood", hex: "#DEB887" }, { name: "cadetblue", hex: "#5F9EA0" },
  { name: "chartreuse", hex: "#7FFF00" }, { name: "chocolate", hex: "#D2691E" },
  { name: "coral", hex: "#FF7F50" }, { name: "cornflowerblue", hex: "#6495ED" },
  { name: "cornsilk", hex: "#FFF8DC" }, { name: "crimson", hex: "#DC143C" },
  { name: "cyan", hex: "#00FFFF" }, { name: "darkblue", hex: "#00008B" },
  { name: "darkcyan", hex: "#008B8B" }, { name: "darkgoldenrod", hex: "#B8860B" },
  { name: "darkgray", hex: "#A9A9A9" }, { name: "darkgreen", hex: "#006400" },
  { name: "darkkhaki", hex: "#BDB76B" }, { name: "darkmagenta", hex: "#8B008B" },
  { name: "darkolivegreen", hex: "#556B2F" }, { name: "darkorange", hex: "#FF8C00" },
  { name: "darkorchid", hex: "#9932CC" }, { name: "darkred", hex: "#8B0000" },
  { name: "darksalmon", hex: "#E9967A" }, { name: "darkseagreen", hex: "#8FBC8F" },
  { name: "darkslateblue", hex: "#483D8B" }, { name: "darkslategray", hex: "#2F4F4F" },
  { name: "darkturquoise", hex: "#00CED1" }, { name: "darkviolet", hex: "#9400D3" },
  { name: "deeppink", hex: "#FF1493" }, { name: "deepskyblue", hex: "#00BFFF" },
  { name: "dimgray", hex: "#696969" }, { name: "dodgerblue", hex: "#1E90FF" },
  { name: "firebrick", hex: "#B22222" }, { name: "floralwhite", hex: "#FFFAF0" },
  { name: "forestgreen", hex: "#228B22" }, { name: "fuchsia", hex: "#FF00FF" },
  { name: "gainsboro", hex: "#DCDCDC" }, { name: "ghostwhite", hex: "#F8F8FF" },
  { name: "gold", hex: "#FFD700" }, { name: "goldenrod", hex: "#DAA520" },
  { name: "gray", hex: "#808080" }, { name: "green", hex: "#008000" },
  { name: "greenyellow", hex: "#ADFF2F" }, { name: "honeydew", hex: "#F0FFF0" },
  { name: "hotpink", hex: "#FF69B4" }, { name: "indianred", hex: "#CD5C5C" },
  { name: "indigo", hex: "#4B0082" }, { name: "ivory", hex: "#FFFFF0" },
  { name: "khaki", hex: "#F0E68C" }, { name: "lavender", hex: "#E6E6FA" },
  { name: "lavenderblush", hex: "#FFF0F5" }, { name: "lawngreen", hex: "#7CFC00" },
  { name: "lemonchiffon", hex: "#FFFACD" }, { name: "lightblue", hex: "#ADD8E6" },
  { name: "lightcoral", hex: "#F08080" }, { name: "lightcyan", hex: "#E0FFFF" },
  { name: "lightgoldenrodyellow", hex: "#FAFAD2" }, { name: "lightgray", hex: "#D3D3D3" },
  { name: "lightgreen", hex: "#90EE90" }, { name: "lightpink", hex: "#FFB6C1" },
  { name: "lightsalmon", hex: "#FFA07A" }, { name: "lightseagreen", hex: "#20B2AA" },
  { name: "lightskyblue", hex: "#87CEFA" }, { name: "lightslategray", hex: "#778899" },
  { name: "lightsteelblue", hex: "#B0C4DE" }, { name: "lightyellow", hex: "#FFFFE0" },
  { name: "lime", hex: "#00FF00" }, { name: "limegreen", hex: "#32CD32" },
  { name: "linen", hex: "#FAF0E6" }, { name: "magenta", hex: "#FF00FF" },
  { name: "maroon", hex: "#800000" }, { name: "mediumaquamarine", hex: "#66CDAA" },
  { name: "mediumblue", hex: "#0000CD" }, { name: "mediumorchid", hex: "#BA55D3" },
  { name: "mediumpurple", hex: "#9370DB" }, { name: "mediumseagreen", hex: "#3CB371" },
  { name: "mediumslateblue", hex: "#7B68EE" }, { name: "mediumspringgreen", hex: "#00FA9A" },
  { name: "mediumturquoise", hex: "#48D1CC" }, { name: "mediumvioletred", hex: "#C71585" },
  { name: "midnightblue", hex: "#191970" }, { name: "mintcream", hex: "#F5FFFA" },
  { name: "mistyrose", hex: "#FFE4E1" }, { name: "moccasin", hex: "#FFE4B5" },
  { name: "navajowhite", hex: "#FFDEAD" }, { name: "navy", hex: "#000080" },
  { name: "oldlace", hex: "#FDF5E6" }, { name: "olive", hex: "#808000" },
  { name: "olivedrab", hex: "#6B8E23" }, { name: "orange", hex: "#FFA500" },
  { name: "orangered", hex: "#FF4500" }, { name: "orchid", hex: "#DA70D6" },
  { name: "palegoldenrod", hex: "#EEE8AA" }, { name: "palegreen", hex: "#98FB98" },
  { name: "paleturquoise", hex: "#AFEEEE" }, { name: "palevioletred", hex: "#DB7093" },
  { name: "papayawhip", hex: "#FFEFD5" }, { name: "peachpuff", hex: "#FFDAB9" },
  { name: "peru", hex: "#CD853F" }, { name: "pink", hex: "#FFC0CB" },
  { name: "plum", hex: "#DDA0DD" }, { name: "powderblue", hex: "#B0E0E6" },
  { name: "purple", hex: "#800080" }, { name: "red", hex: "#FF0000" },
  { name: "rosybrown", hex: "#BC8F8F" }, { name: "royalblue", hex: "#4169E1" },
  { name: "saddlebrown", hex: "#8B4513" }, { name: "salmon", hex: "#FA8072" },
  { name: "sandybrown", hex: "#F4A460" }, { name: "seagreen", hex: "#2E8B57" },
  { name: "seashell", hex: "#FFF5EE" }, { name: "sienna", hex: "#A0522D" },
  { name: "silver", hex: "#C0C0C0" }, { name: "skyblue", hex: "#87CEEB" },
  { name: "slateblue", hex: "#6A5ACD" }, { name: "slategray", hex: "#708090" },
  { name: "snow", hex: "#FFFAFA" }, { name: "springgreen", hex: "#00FF7F" },
  { name: "steelblue", hex: "#4682B4" }, { name: "tan", hex: "#D2B48C" },
  { name: "teal", hex: "#008080" }, { name: "thistle", hex: "#D8BFD8" },
  { name: "tomato", hex: "#FF6347" }, { name: "turquoise", hex: "#40E0D0" },
  { name: "violet", hex: "#EE82EE" }, { name: "wheat", hex: "#F5DEB3" },
  { name: "white", hex: "#FFFFFF" }, { name: "whitesmoke", hex: "#F5F5F5" },
  { name: "yellow", hex: "#FFFF00" }, { name: "yellowgreen", hex: "#9ACD32" },
];

// ── Color name search ─────────────────────────────────────────────────────────

function ColorSearch() {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const results = query.trim().length >= 2
    ? CSS_NAMED_COLORS.filter((c) => c.name.includes(query.trim().toLowerCase())).slice(0, 24)
    : [];

  const copy = (hex: string) => {
    navigator.clipboard.writeText(hex).catch(() => {});
    setCopied(hex);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Recherche par nom (coral, navy, pink…)</Label>
      <Input
        placeholder="Tapez un nom de couleur en anglais…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="text-sm"
      />
      {results.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-0.5">
          {results.map(({ name, hex }) => (
            <button
              key={name}
              type="button"
              onClick={() => copy(hex)}
              title={`Copier ${hex}`}
              className="flex items-center gap-2 rounded border px-2 py-1.5 text-left hover:bg-muted transition-colors"
            >
              <span className="h-4 w-4 flex-shrink-0 rounded border border-black/10" style={{ backgroundColor: hex }} />
              <span className="font-mono text-xs">{hex}</span>
              <span className="truncate text-xs text-muted-foreground">{name}</span>
              {copied === hex && <span className="ml-auto text-xs text-green-600">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Nuancier editor ───────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  "background": "Fond principal",
  "background_secondary": "Fond secondaire",
  "text": "Texte principal",
  "text_secondary": "Texte secondaire",
  "accent-1": "Accent 1",
  "accent-2": "Accent 2",
};
const EDITABLE_FIELDS = ["background", "background_secondary", "text", "text_secondary", "accent-1", "accent-2"];

function NuancierEditor({
  colorSchemes,
  onChange,
}: {
  colorSchemes: Record<string, { settings?: Record<string, string> }>;
  onChange: (schemeKey: string, field: string, value: string) => void;
}) {
  const entries = Object.entries(colorSchemes);

  return (
    <div className="space-y-3">
      {entries.map(([key, scheme]) => {
        const settings = scheme?.settings || {};
        return (
          <div key={key} className="rounded-md border p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">{key}</p>
            <div className="space-y-2">
              {EDITABLE_FIELDS.map((field) => {
                const val = settings[field] || "#000000";
                const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(val);
                return (
                  <div key={field} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={isValidHex ? val : "#000000"}
                      onChange={(e) => onChange(key, field, e.target.value)}
                      className="h-7 w-7 flex-shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
                      title={FIELD_LABELS[field] || field}
                    />
                    <Input
                      value={val}
                      onChange={(e) => onChange(key, field, e.target.value)}
                      className="w-28 font-mono text-xs"
                      placeholder="#000000"
                      maxLength={7}
                    />
                    <span className="text-xs text-muted-foreground">{FIELD_LABELS[field] || field}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
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
  sessionId,
  onSectionRegenerated,
}: GeneratedDataEditorProps) {
  const [editData, setEditData] = useState<Record<string, unknown>>(deepClone(data));
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const regenAbortRef = useRef<AbortController | null>(null);

  function update(path: (string | number)[], value: string) {
    setEditData((prev) => setPath(prev, path, value));
  }

  const handleRegenerate = useCallback(async (section: string) => {
    if (!sessionId || regeneratingSection) return;
    regenAbortRef.current?.abort();
    const controller = new AbortController();
    regenAbortRef.current = controller;
    setRegeneratingSection(section);
    try {
      let newData: unknown = null;
      await regenerateSection(
        sessionId,
        section,
        (step) => {
          if (step.status === "done" && step.data) {
            newData = step.data;
          }
        },
        controller.signal,
      );
      if (newData !== null) {
        setEditData((prev) => ({ ...prev, [section]: newData }));
        onSectionRegenerated?.(section, newData);
      }
    } catch {
      // silently ignore abort errors
    } finally {
      if (regenAbortRef.current === controller) regenAbortRef.current = null;
      setRegeneratingSection(null);
    }
  }, [sessionId, regeneratingSection, onSectionRegenerated]);

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
  const colorSchemes = ((editData.colors as any)?.color_schemes || {}) as Record<string, { settings?: Record<string, string> }>;

  return (
    <div className="space-y-6">
      <Accordion type="multiple" className="w-full space-y-2">

        {/* ── Colors ─────────────────────────────────────────────────────── */}
        {Object.keys(colorSchemes).length > 0 && (
          <AccordionItem value="colors" className="rounded-lg border px-4">
            <AccordionTrigger className="text-sm font-medium">
              Nuanciers de couleurs
              <Badge variant="secondary" className="ml-auto mr-2 text-xs">{Object.keys(colorSchemes).length} nuanciers</Badge>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <ColorSearch />
              <NuancierEditor
                colorSchemes={colorSchemes}
                onChange={(schemeKey, field, value) =>
                  update(["colors", "color_schemes", schemeKey, "settings", field], value)
                }
              />
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ── Homepage ───────────────────────────────────────────────────── */}
        {hp && Object.keys(hp).length > 0 && (
          <AccordionItem value="homepage" className="rounded-lg border px-4">
            <AccordionTrigger className="text-sm font-medium">
              Page d&apos;accueil
              {sessionId && (
                <button type="button" onClick={(e) => { e.stopPropagation(); handleRegenerate("homepage"); }} disabled={!!regeneratingSection} className="ml-auto mr-1 flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium border border-border/60 bg-background hover:bg-muted transition-colors disabled:opacity-50">
                  {regeneratingSection === "homepage" ? <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> : <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>}
                  Régénérer
                </button>
              )}
            </AccordionTrigger>
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
            <AccordionTrigger className="text-sm font-medium">
              Page produit
              {sessionId && (
                <button type="button" onClick={(e) => { e.stopPropagation(); handleRegenerate("product_page"); }} disabled={!!regeneratingSection} className="ml-auto mr-1 flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium border border-border/60 bg-background hover:bg-muted transition-colors disabled:opacity-50">
                  {regeneratingSection === "product_page" ? <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> : <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>}
                  Régénérer
                </button>
              )}
            </AccordionTrigger>
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
            <AccordionTrigger className="text-sm font-medium">
              FAQ
              {sessionId && (
                <button type="button" onClick={(e) => { e.stopPropagation(); handleRegenerate("faq"); }} disabled={!!regeneratingSection} className="ml-auto mr-1 flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium border border-border/60 bg-background hover:bg-muted transition-colors disabled:opacity-50">
                  {regeneratingSection === "faq" ? <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> : <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>}
                  Régénérer
                </button>
              )}
            </AccordionTrigger>
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
            <AccordionTrigger className="text-sm font-medium">
              Page Notre Histoire
              {sessionId && (
                <button type="button" onClick={(e) => { e.stopPropagation(); handleRegenerate("story_page"); }} disabled={!!regeneratingSection} className="ml-auto mr-1 flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium border border-border/60 bg-background hover:bg-muted transition-colors disabled:opacity-50">
                  {regeneratingSection === "story_page" ? <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> : <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>}
                  Régénérer
                </button>
              )}
            </AccordionTrigger>
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
            <AccordionTrigger className="text-sm font-medium">
              Textes globaux
              {sessionId && (
                <button type="button" onClick={(e) => { e.stopPropagation(); handleRegenerate("global_texts"); }} disabled={!!regeneratingSection} className="ml-auto mr-1 flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium border border-border/60 bg-background hover:bg-muted transition-colors disabled:opacity-50">
                  {regeneratingSection === "global_texts" ? <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> : <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>}
                  Régénérer
                </button>
              )}
            </AccordionTrigger>
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

      <Button className="w-full" size="lg" onClick={() => onValidate(deepClone(editData))} disabled={isApplying}>
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
