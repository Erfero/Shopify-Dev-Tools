"use client";

import Link from "next/link";
import { Layers, ArrowRight, Star, Paintbrush, LogOut, ShieldCheck, BarChart2 } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, staggerItem, float } from "@/lib/motion";
import { getUser, logout } from "@/lib/auth";

export default function Home() {
  const user = getUser();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <motion.div
        className="w-full max-w-2xl"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        {/* Header */}
        <motion.div className="mb-12 text-center" variants={fadeUp} custom={0}>
          <div className="mb-5 flex justify-center">
            <Link href="/">
              <motion.div
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground/[0.05] border border-border/60 cursor-pointer"
                variants={float}
                animate="animate"
              >
                <Layers className="h-7 w-7 text-foreground/70" />
              </motion.div>
            </Link>
          </div>
          <motion.h1
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
            variants={fadeUp}
            custom={1}
          >
            Shopify Dev Tools
          </motion.h1>
          <motion.p
            className="mt-3 text-sm text-muted-foreground sm:text-base"
            variants={fadeUp}
            custom={2}
          >
            Outils IA pour optimiser votre boutique Shopify
          </motion.p>
        </motion.div>

        {/* Tool cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Shopify Theme Customizer */}
          <motion.div variants={staggerItem}>
            <Link
              href="/theme"
              className="group flex flex-col rounded-2xl border border-border/60 bg-foreground/[0.01] p-6 transition-all hover:border-foreground/20 hover:bg-foreground/[0.03] hover:shadow-sm"
            >
              <motion.div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/[0.05]"
                whileHover={{ scale: 1.08, rotate: -4 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Paintbrush className="h-5 w-5 text-foreground/70" />
              </motion.div>
              <h2 className="text-base font-semibold">Shopify Theme Customizer</h2>
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
                <motion.span
                  className="inline-flex"
                  initial={{ x: 0 }}
                  whileHover={{ x: 3 }}
                  transition={{ duration: 0.2 }}
                >
                  <ArrowRight className="h-3 w-3" />
                </motion.span>
              </div>
            </Link>
          </motion.div>

          {/* Loox Review Generator */}
          <motion.div variants={staggerItem}>
            <Link
              href="/reviews"
              className="group flex flex-col rounded-2xl border border-border/60 bg-foreground/[0.01] p-6 transition-all hover:border-foreground/20 hover:bg-foreground/[0.03] hover:shadow-sm"
            >
              <motion.div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/[0.05]"
                whileHover={{ scale: 1.08, rotate: 4 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Star className="h-5 w-5 text-foreground/70" />
              </motion.div>
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
                <motion.span
                  className="inline-flex"
                  initial={{ x: 0 }}
                  whileHover={{ x: 3 }}
                  transition={{ duration: 0.2 }}
                >
                  <ArrowRight className="h-3 w-3" />
                </motion.span>
              </div>
            </Link>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          variants={fadeUp}
          custom={5}
        >
          <span className="hidden sm:block text-xs text-muted-foreground/40">Propulsé par OpenRouter AI</span>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold shadow-sm transition hover:bg-muted"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mon </span>Historique
            </Link>
            {user?.is_admin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 rounded-xl bg-foreground px-3.5 py-2 text-xs font-semibold text-background shadow-sm transition hover:opacity-80"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Gérer les accès</span>
                <span className="sm:hidden">Admin</span>
              </Link>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold shadow-sm transition hover:bg-muted"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
