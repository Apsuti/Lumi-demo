"use client";

import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import LumiCharacter from "../LumiCharacter";

const LINKS = [
  { href: "#ongelma", label: "Ongelma" },
  { href: "#ratkaisu", label: "Ratkaisu" },
  { href: "#demo", label: "Demo" },
  { href: "#hahmo", label: "Lumi" },
  { href: "#kumppaneille", label: "Kumppaneille" },
];

export default function Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 12));

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5"
    >
      <nav
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-full px-3 py-2 transition-all duration-500 sm:px-4 ${
          scrolled ? "border border-ink/[0.06] bg-white/75 shadow-soft backdrop-blur-xl" : "border border-transparent"
        }`}
      >
        <a href="#top" className="flex items-center gap-2 pl-1" aria-label="Lumi – etusivu">
          <LumiCharacter size={34} float={false} />
          <span className="font-display text-xl font-extrabold tracking-tight">Lumi</span>
        </a>
        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-3.5 py-2 text-sm font-semibold text-ink-soft transition hover:bg-ink/[0.04] hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </div>
        <a href="#demo" className="btn-primary !px-4 !py-2.5 text-sm">
          Kokeile demoa
        </a>
      </nav>
    </motion.header>
  );
}
