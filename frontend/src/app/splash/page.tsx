"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Layers, ArrowRight, Paintbrush, Star, Zap } from "lucide-react";
import { getUser } from "@/lib/auth";

const FEATURES = [
  { icon: <Paintbrush className="h-3.5 w-3.5" />, label: "Thème Shopify" },
  { icon: <Star className="h-3.5 w-3.5" />,      label: "Avis clients CSV" },
  { icon: <Zap className="h-3.5 w-3.5" />,        label: "IA générative" },
];

const TITLE = ["Shopify", "Dev", "Tools"];

export default function SplashPage() {
  const router = useRouter();
  const [phase, setPhase] = useState(0);
  // 0 → 1 icon | 2 title | 3 subtitle | 4 features | 5 cta

  useEffect(() => {
    if (getUser()) { router.replace("/"); return; }
    const t = [
      setTimeout(() => setPhase(1), 120),
      setTimeout(() => setPhase(2), 520),
      setTimeout(() => setPhase(3), 1100),
      setTimeout(() => setPhase(4), 1600),
      setTimeout(() => setPhase(5), 2300),
    ];
    return () => t.forEach(clearTimeout);
  }, [router]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background">

      {/* ── Ambient orbs ─────────────────────────────────────────────────── */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/3 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500 blur-[160px]"
        animate={{ opacity: [0.07, 0.13, 0.07], scale: [1, 1.12, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute bottom-1/4 right-1/3 h-[320px] w-[320px] rounded-full bg-violet-500 blur-[120px]"
        animate={{ opacity: [0.04, 0.09, 0.04], scale: [1, 1.1, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />

      {/* ── Subtle grid ──────────────────────────────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center">

        {/* Logo icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.55, y: 8 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ type: "spring", stiffness: 360, damping: 20 }}
          className="mb-9"
        >
          <div className="relative flex h-[60px] w-[60px] items-center justify-center rounded-[18px] border border-border/60 bg-foreground/[0.05]">
            <Layers className="h-7 w-7 text-foreground/75" />
            <motion.div
              className="absolute inset-[-1px] rounded-[18px]"
              animate={{
                boxShadow: [
                  "0 0 0 0 rgba(99,102,241,0)",
                  "0 0 0 10px rgba(99,102,241,0.1)",
                  "0 0 0 0 rgba(99,102,241,0)",
                ],
              }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeOut", delay: 1 }}
            />
          </div>
        </motion.div>

        {/* Title — word by word */}
        <div className="mb-5 flex flex-wrap items-baseline justify-center gap-x-4 gap-y-1">
          {TITLE.map((word, i) => (
            <motion.span
              key={word}
              initial={{ opacity: 0, y: 24 }}
              animate={phase >= 2 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: i * 0.09 }}
              className="text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl"
            >
              {word}
            </motion.span>
          ))}
        </div>

        {/* Divider */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={phase >= 3 ? { scaleX: 1, opacity: 1 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-5 h-px w-32 origin-center bg-gradient-to-r from-transparent via-border to-transparent"
        />

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="mb-10 max-w-sm text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          Automatisez et optimisez votre boutique avec la puissance de l&apos;IA.
        </motion.p>

        {/* Feature pills */}
        <div className="mb-12 flex flex-wrap justify-center gap-2.5">
          {FEATURES.map((f, i) => (
            <motion.span
              key={f.label}
              initial={{ opacity: 0, scale: 0.8, y: 6 }}
              animate={phase >= 4 ? { opacity: 1, scale: 1, y: 0 } : {}}
              transition={{ type: "spring", stiffness: 380, damping: 22, delay: i * 0.08 }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-foreground/[0.03] px-4 py-1.5 text-xs text-muted-foreground"
            >
              {f.icon}
              {f.label}
            </motion.span>
          ))}
        </div>

        {/* CTA button */}
        <motion.button
          initial={{ opacity: 0, y: 18, scale: 0.95 }}
          animate={phase >= 5 ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push("/login")}
          className="group relative flex items-center gap-2 rounded-2xl bg-foreground px-8 py-3.5 text-sm font-semibold text-background shadow-xl"
        >
          {/* Shimmer sweep */}
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-2xl"
            animate={{
              background: [
                "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)",
                "linear-gradient(105deg, transparent 80%, rgba(255,255,255,0.08) 90%, transparent 100%)",
              ],
            }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "linear", delay: 3.2 }}
          />
          Commencer
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </motion.button>

        {/* Login link */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={phase >= 5 ? { opacity: 1 } : {}}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-5 text-xs text-muted-foreground/50"
        >
          Déjà un compte ?{" "}
          <button
            onClick={() => router.push("/login")}
            className="text-muted-foreground underline-offset-2 hover:underline"
          >
            Se connecter
          </button>
        </motion.p>
      </div>
    </div>
  );
}
