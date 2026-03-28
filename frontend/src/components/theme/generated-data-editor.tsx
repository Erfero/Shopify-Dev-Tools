"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { HexColorPicker } from "react-colorful";
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

// ── Tailwind colour palette ────────────────────────────────────────────────────
const TAILWIND_SHADES = ["50","100","200","300","400","500","600","700","800","900","950"];
const TAILWIND_FAMILIES: [string, string[]][] = [
  ["slate",   ["#F8FAFC","#F1F5F9","#E2E8F0","#CBD5E1","#94A3B8","#64748B","#475569","#334155","#1E293B","#0F172A","#020617"]],
  ["gray",    ["#F9FAFB","#F3F4F6","#E5E7EB","#D1D5DB","#9CA3AF","#6B7280","#4B5563","#374151","#1F2937","#111827","#030712"]],
  ["zinc",    ["#FAFAFA","#F4F4F5","#E4E4E7","#D4D4D8","#A1A1AA","#71717A","#52525B","#3F3F46","#27272A","#18181B","#09090B"]],
  ["neutral", ["#FAFAFA","#F5F5F5","#E5E5E5","#D4D4D4","#A3A3A3","#737373","#525252","#404040","#262626","#171717","#0A0A0A"]],
  ["stone",   ["#FAFAF9","#F5F5F4","#E7E5E4","#D6D3D1","#A8A29E","#78716C","#57534E","#44403C","#292524","#1C1917","#0C0A09"]],
  ["red",     ["#FEF2F2","#FEE2E2","#FECACA","#FCA5A5","#F87171","#EF4444","#DC2626","#B91C1C","#991B1B","#7F1D1D","#450A0A"]],
  ["orange",  ["#FFF7ED","#FFEDD5","#FED7AA","#FDBA74","#FB923C","#F97316","#EA580C","#C2410C","#9A3412","#7C2D12","#431407"]],
  ["amber",   ["#FFFBEB","#FEF3C7","#FDE68A","#FCD34D","#FBBF24","#F59E0B","#D97706","#B45309","#92400E","#78350F","#451A03"]],
  ["yellow",  ["#FEFCE8","#FEF9C3","#FEF08A","#FDE047","#FACC15","#EAB308","#CA8A04","#A16207","#854D0E","#713F12","#422006"]],
  ["lime",    ["#F7FEE7","#ECFCCB","#D9F99D","#BEF264","#A3E635","#84CC16","#65A30D","#4D7C0F","#3F6212","#365314","#1A2E05"]],
  ["green",   ["#F0FDF4","#DCFCE7","#BBF7D0","#86EFAC","#4ADE80","#22C55E","#16A34A","#15803D","#166534","#14532D","#052E16"]],
  ["emerald", ["#ECFDF5","#D1FAE5","#A7F3D0","#6EE7B7","#34D399","#10B981","#059669","#047857","#065F46","#064E3B","#022C22"]],
  ["teal",    ["#F0FDFA","#CCFBF1","#99F6E4","#5EEAD4","#2DD4BF","#14B8A6","#0D9488","#0F766E","#115E59","#134E4A","#042F2E"]],
  ["cyan",    ["#ECFEFF","#CFFAFE","#A5F3FC","#67E8F9","#22D3EE","#06B6D4","#0891B2","#0E7490","#155E75","#164E63","#083344"]],
  ["sky",     ["#F0F9FF","#E0F2FE","#BAE6FD","#7DD3FC","#38BDF8","#0EA5E9","#0284C7","#0369A1","#075985","#0C4A6E","#082F49"]],
  ["blue",    ["#EFF6FF","#DBEAFE","#BFDBFE","#93C5FD","#60A5FA","#3B82F6","#2563EB","#1D4ED8","#1E40AF","#1E3A8A","#172554"]],
  ["indigo",  ["#EEF2FF","#E0E7FF","#C7D2FE","#A5B4FC","#818CF8","#6366F1","#4F46E5","#4338CA","#3730A3","#312E81","#1E1B4B"]],
  ["violet",  ["#F5F3FF","#EDE9FE","#DDD6FE","#C4B5FD","#A78BFA","#8B5CF6","#7C3AED","#6D28D9","#5B21B6","#4C1D95","#2E1065"]],
  ["purple",  ["#FAF5FF","#F3E8FF","#E9D5FF","#D8B4FE","#C084FC","#A855F7","#9333EA","#7E22CE","#6B21A8","#581C87","#3B0764"]],
  ["fuchsia", ["#FDF4FF","#FAE8FF","#F5D0FE","#F0ABFC","#E879F9","#D946EF","#C026D3","#A21CAF","#86198F","#701A75","#4A044E"]],
  ["pink",    ["#FDF2F8","#FCE7F3","#FBCFE8","#F9A8D4","#F472B6","#EC4899","#DB2777","#BE185D","#9D174D","#831843","#500724"]],
  ["rose",    ["#FFF1F2","#FFE4E6","#FECDD3","#FDA4AF","#FB7185","#F43F5E","#E11D48","#BE123C","#9F1239","#881337","#4C0519"]],
];
const TAILWIND_COLORS = TAILWIND_FAMILIES.flatMap(([family, hexes]) =>
  hexes.map((hex, i) => ({ name: `${family}-${TAILWIND_SHADES[i]}`, hex }))
);

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

// ── Traductions françaises des couleurs CSS ───────────────────────────────────

const CSS_FR_NAMES: Record<string, string> = {
  aliceblue: "bleu alice", antiquewhite: "blanc antique", aqua: "aqua",
  aquamarine: "aigue-marine", azure: "azur", beige: "beige", bisque: "bisque",
  black: "noir", blanchedalmond: "blanc amande", blue: "bleu",
  blueviolet: "bleu violet", brown: "brun", burlywood: "bois flotté",
  cadetblue: "bleu cadet", chartreuse: "chartreuse", chocolate: "chocolat",
  coral: "corail", cornflowerblue: "bleuet", cornsilk: "soie de maïs",
  crimson: "cramoisi", cyan: "cyan", darkblue: "bleu foncé",
  darkcyan: "cyan foncé", darkgoldenrod: "verge d'or foncé",
  darkgray: "gris foncé", darkgreen: "vert foncé", darkkhaki: "kaki foncé",
  darkmagenta: "magenta foncé", darkolivegreen: "vert olive foncé",
  darkorange: "orange foncé", darkorchid: "orchidée foncé",
  darkred: "rouge foncé", darksalmon: "saumon foncé",
  darkseagreen: "vert mer foncé", darkslateblue: "bleu ardoise foncé",
  darkslategray: "gris ardoise foncé", darkturquoise: "turquoise foncé",
  darkviolet: "violet foncé", deeppink: "rose vif", deepskyblue: "bleu ciel vif",
  dimgray: "gris terne", dodgerblue: "bleu dodger", firebrick: "brique",
  floralwhite: "blanc floral", forestgreen: "vert forêt", fuchsia: "fuchsia",
  gainsboro: "gainsboro", ghostwhite: "blanc fantôme", gold: "or",
  goldenrod: "verge d'or", gray: "gris", green: "vert",
  greenyellow: "vert jaune", honeydew: "miel", hotpink: "rose chaud",
  indianred: "rouge indien", indigo: "indigo", ivory: "ivoire",
  khaki: "kaki", lavender: "lavande", lavenderblush: "lavande rosée",
  lawngreen: "vert pelouse", lemonchiffon: "mousseline citron",
  lightblue: "bleu clair", lightcoral: "corail clair", lightcyan: "cyan clair",
  lightgoldenrodyellow: "jaune doré clair", lightgray: "gris clair",
  lightgreen: "vert clair", lightpink: "rose clair", lightsalmon: "saumon clair",
  lightseagreen: "vert mer clair", lightskyblue: "bleu ciel clair",
  lightslategray: "gris ardoise clair", lightsteelblue: "bleu acier clair",
  lightyellow: "jaune clair", lime: "vert lime", limegreen: "vert citron",
  linen: "lin", magenta: "magenta", maroon: "bordeaux",
  mediumaquamarine: "aigue-marine moyen", mediumblue: "bleu moyen",
  mediumorchid: "orchidée moyen", mediumpurple: "pourpre moyen",
  mediumseagreen: "vert mer moyen", mediumslateblue: "bleu ardoise moyen",
  mediumspringgreen: "vert printemps moyen", mediumturquoise: "turquoise moyen",
  mediumvioletred: "rouge violet moyen", midnightblue: "bleu nuit",
  mintcream: "crème menthe", mistyrose: "rose brumeux", moccasin: "mocassin",
  navajowhite: "blanc navajo", navy: "bleu marine", oldlace: "dentelle ancienne",
  olive: "olive", olivedrab: "vert olive terne", orange: "orange",
  orangered: "rouge orangé", orchid: "orchidée", palegoldenrod: "verge d'or pâle",
  palegreen: "vert pâle", paleturquoise: "turquoise pâle",
  palevioletred: "rouge violet pâle", papayawhip: "papaye",
  peachpuff: "pêche", peru: "pérou", pink: "rose", plum: "prune",
  powderblue: "bleu poudre", purple: "pourpre", red: "rouge",
  rosybrown: "brun rosé", royalblue: "bleu royal", saddlebrown: "brun selle",
  salmon: "saumon", sandybrown: "brun sable", seagreen: "vert mer",
  seashell: "coquillage", sienna: "terre de sienne", silver: "argent",
  skyblue: "bleu ciel", slateblue: "bleu ardoise", slategray: "gris ardoise",
  snow: "neige", springgreen: "vert printemps", steelblue: "bleu acier",
  tan: "beige bronzé", teal: "sarcelle", thistle: "chardon",
  tomato: "tomate", turquoise: "turquoise", violet: "violet",
  wheat: "blé", white: "blanc", whitesmoke: "blanc fumée",
  yellow: "jaune", yellowgreen: "jaune vert",
};

// ── Traductions françaises des familles Tailwind ──────────────────────────────

const TAILWIND_FR_FAMILIES: Record<string, string> = {
  slate: "ardoise", gray: "gris", zinc: "zinc", neutral: "neutre",
  stone: "pierre", red: "rouge", orange: "orange", amber: "ambre",
  yellow: "jaune", lime: "citron vert", green: "vert", emerald: "émeraude",
  teal: "sarcelle", cyan: "cyan", sky: "ciel", blue: "bleu",
  indigo: "indigo", violet: "violet", purple: "pourpre", fuchsia: "fuchsia",
  pink: "rose", rose: "rose pâle",
};

// ── Color name search ─────────────────────────────────────────────────────────

// Build a unified searchable list with French display names
const ALL_COLORS_FR = [
  ...CSS_NAMED_COLORS.map((c) => ({
    hex: c.hex,
    display: CSS_FR_NAMES[c.name] || c.name,
  })),
  ...TAILWIND_COLORS.map((c) => {
    const [family, shade] = c.name.split("-");
    const frFamily = TAILWIND_FR_FAMILIES[family] || family;
    return { hex: c.hex, display: `${frFamily}-${shade}` };
  }),
];

function ColorSearch() {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const results = q.length >= 2
    ? ALL_COLORS_FR.filter((c) => c.display.toLowerCase().includes(q)).slice(0, 36)
    : [];

  const copy = (hex: string) => {
    navigator.clipboard.writeText(hex).catch(() => {});
    setCopied(hex);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Rechercher une couleur en français</Label>
      <Input
        placeholder="ex: rouge, bleu marine, corail, ardoise-500…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="text-sm"
      />
      {results.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-0.5">
          {results.map(({ display, hex }) => (
            <button
              key={`${display}-${hex}`}
              type="button"
              onClick={() => copy(hex)}
              title={`Copier ${hex}`}
              className="flex items-center gap-2 rounded border px-2 py-1.5 text-left hover:bg-muted transition-colors"
            >
              <span className="h-4 w-4 flex-shrink-0 rounded border border-black/10" style={{ backgroundColor: hex }} />
              <span className="font-mono text-xs">{hex}</span>
              <span className="truncate text-xs text-muted-foreground">{display}</span>
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

// ── Color picker popover (Shopify-style) ──────────────────────────────────────

function ColorPickerPopover({
  value,
  onChange,
  currentlyUsed = [],
}: {
  value: string;
  onChange: (v: string) => void;
  currentlyUsed?: string[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const safe = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : "#000000";

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const uniqueUsed = [...new Set(currentlyUsed.filter((c) => /^#[0-9A-Fa-f]{6}$/i.test(c)))].slice(0, 18);

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-7 w-7 rounded border border-border shadow-sm transition-all hover:scale-110 hover:shadow-md cursor-pointer"
        style={{ backgroundColor: safe }}
        title="Choisir une couleur"
      />
      {open && (
        <div className="absolute z-50 top-9 left-0 w-60 rounded-xl border bg-white shadow-2xl p-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <HexColorPicker color={safe} onChange={onChange} style={{ width: "100%", height: 160 }} />
          <div className="flex items-center gap-2 rounded-md border px-2 py-1">
            <span className="text-xs font-mono text-muted-foreground">#</span>
            <input
              type="text"
              value={value.replace(/^#/, "")}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9A-Fa-f]/g, "").slice(0, 6);
                onChange(`#${v}`);
              }}
              className="flex-1 font-mono text-xs uppercase outline-none bg-transparent"
              placeholder="000000"
              maxLength={6}
            />
          </div>
          {uniqueUsed.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Couleurs utilisées</p>
              <div className="flex flex-wrap gap-1.5">
                {uniqueUsed.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChange(c)}
                    className="h-5 w-5 rounded border border-black/10 transition-transform hover:scale-125 cursor-pointer"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const DEFAULT_SCHEME_SETTINGS = {
  background: "#FFFFFF",
  background_secondary: "#F5F5F5",
  text: "#111111",
  text_secondary: "#666666",
  "accent-1": "#CC6600",
  "accent-2": "#222222",
};

function NuancierEditor({
  colorSchemes,
  onChange,
  onAdd,
  onDelete,
}: {
  colorSchemes: Record<string, { settings?: Record<string, string> }>;
  onChange: (schemeKey: string, field: string, value: string) => void;
  onAdd: (key: string) => void;
  onDelete: (key: string) => void;
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState("");

  const allUsedColors = Object.values(colorSchemes)
    .flatMap((s) => Object.values(s?.settings || {}))
    .filter((v): v is string => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/i.test(v));

  const entries = Object.entries(colorSchemes);

  const safeHex = (v: string | undefined, fallback: string) =>
    v && /^#[0-9A-Fa-f]{6}$/i.test(v) ? v : fallback;

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!key) { setNameError("Nom invalide"); return; }
    if (colorSchemes[key]) { setNameError("Ce nom existe déjà"); return; }
    onAdd(key);
    setActiveKey(key);
    setShowAddForm(false);
    setNewName("");
    setNameError("");
  };

  return (
    <div className="space-y-4">
      {/* ── Card grid ── */}
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {entries.map(([key, scheme], idx) => {
          const s = scheme?.settings || {};
          const bg   = safeHex(s.background, "#FFFFFF");
          const txt  = safeHex(s.text, "#000000");
          const txt2 = safeHex(s.text_secondary, "#888888");
          const acc1 = safeHex(s["accent-1"], "#333333");
          const acc2 = safeHex(s["accent-2"], "#666666");
          const isActive = activeKey === key;
          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => { setActiveKey(isActive ? null : key); setShowAddForm(false); }}
              onKeyDown={(e) => e.key === "Enter" && setActiveKey(isActive ? null : key)}
              className={`cursor-pointer select-none rounded-xl border-2 p-3 text-center transition-all duration-200 ${
                isActive
                  ? "border-blue-500 shadow-md scale-[1.03]"
                  : "border-border hover:border-foreground/30 hover:shadow-sm"
              }`}
              style={{ backgroundColor: bg }}
            >
              <p className="text-xl font-bold leading-none" style={{ color: txt }}>Aa</p>
              <div className="flex justify-center gap-1 mt-2 mb-1.5">
                <div className="h-1.5 w-6 rounded-full" style={{ backgroundColor: acc1 }} />
                <div className="h-1.5 w-6 rounded-full" style={{ backgroundColor: acc2 }} />
              </div>
              <p className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: txt2 }}>
                Nuance {idx + 1}
              </p>
            </div>
          );
        })}

        {/* ── Add card ── */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => { setShowAddForm(true); setActiveKey(null); }}
          onKeyDown={(e) => e.key === "Enter" && setShowAddForm(true)}
          className="cursor-pointer select-none rounded-xl border-2 border-dashed border-blue-300 p-3 text-center hover:border-blue-500 hover:bg-blue-50/50 transition-all duration-200"
        >
          <p className="text-2xl leading-none text-blue-400">+</p>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-blue-500 mt-2.5">Ajouter</p>
        </div>
      </div>

      {/* ── Selected scheme editor ── */}
      {activeKey && colorSchemes[activeKey] && (
        <div className="rounded-xl border bg-muted/20 p-4 space-y-2.5 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nuance {entries.findIndex(([k]) => k === activeKey) + 1}
              <span className="ml-1.5 font-normal normal-case opacity-50">({activeKey})</span>
            </p>
            <button
              type="button"
              onClick={() => { onDelete(activeKey); setActiveKey(null); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              </svg>
              Supprimer
            </button>
          </div>
          <div className="space-y-2">
            {EDITABLE_FIELDS.map((field) => {
              const val = colorSchemes[activeKey]?.settings?.[field] || "#000000";
              return (
                <div key={field} className="flex items-center gap-2">
                  <ColorPickerPopover
                    value={val}
                    onChange={(v) => onChange(activeKey, field, v)}
                    currentlyUsed={allUsedColors}
                  />
                  <Input
                    value={val}
                    onChange={(e) => onChange(activeKey, field, e.target.value)}
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
      )}

      {/* ── Add form ── */}
      {showAddForm && (
        <div className="rounded-xl border bg-muted/20 p-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nouveau nuancier</p>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setNameError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="ex: rose-elegance"
              className="text-sm flex-1"
              autoFocus
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium border border-border bg-background hover:bg-muted transition-colors disabled:opacity-40"
            >
              Créer
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setNewName(""); setNameError(""); }}
              className="rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              ✕
            </button>
          </div>
          {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          <p className="text-xs text-muted-foreground">Espaces → tirets, minuscules uniquement.</p>
        </div>
      )}
    </div>
  );
}

// ── Collapsible sub-section ────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        <svg
          className={`h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="p-3 space-y-3">
          {children}
        </div>
      )}
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rv = ((editData.reviews as any)?.reviews || []) as any[];

  return (
    <div className="space-y-6">
      <Accordion type="single" collapsible className="w-full space-y-2">

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
                onAdd={(key) => {
                  setEditData((prev) => {
                    const clone = deepClone(prev);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const colors = ((clone.colors as any) || {}) as Record<string, unknown>;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const cs = (colors.color_schemes as any) || {};
                    cs[key] = { settings: { ...DEFAULT_SCHEME_SETTINGS } };
                    colors.color_schemes = cs;
                    clone.colors = colors;
                    return clone;
                  });
                }}
                onDelete={(key) => {
                  setEditData((prev) => {
                    const clone = deepClone(prev);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const cs = (clone.colors as any)?.color_schemes as Record<string, unknown> | undefined;
                    if (cs) delete cs[key];
                    return clone;
                  });
                }}
              />
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ── Reviews ────────────────────────────────────────────────────── */}
        {rv.length > 0 && (
          <AccordionItem value="reviews" className="rounded-lg border px-4">
            <AccordionTrigger className="text-sm font-medium">
              Avis clients
              <Badge variant="secondary" className="ml-auto mr-2 text-xs">{rv.length} avis</Badge>
              {sessionId && (
                <button type="button" onClick={(e) => { e.stopPropagation(); handleRegenerate("reviews"); }} disabled={!!regeneratingSection} className="ml-1 mr-1 flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium border border-border/60 bg-background hover:bg-muted transition-colors disabled:opacity-50">
                  {regeneratingSection === "reviews" ? <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> : <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>}
                  Régénérer
                </button>
              )}
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              {rv.map((r: { name: string; age: string; rating: number; title: string; text: string; response?: string }, i: number) => (
                <div key={i} className="rounded-md border p-3 space-y-2 transition-shadow hover:shadow-sm">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Avis {i + 1}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Nom" value={r.name || ""} onChange={(v) => update(["reviews", "reviews", i, "name"], v)} />
                    <Field label="Âge" value={r.age || ""} onChange={(v) => update(["reviews", "reviews", i, "age"], v)} />
                  </div>
                  <Field label="Titre" value={r.title || ""} onChange={(v) => update(["reviews", "reviews", i, "title"], v)} />
                  <Field label="Texte" value={r.text || ""} multiline onChange={(v) => update(["reviews", "reviews", i, "text"], v)} />
                  {r.response !== undefined && (
                    <Field label="Réponse boutique" value={r.response || ""} multiline onChange={(v) => update(["reviews", "reviews", i, "response"], v)} />
                  )}
                </div>
              ))}
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
