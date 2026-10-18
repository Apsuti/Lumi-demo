"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import LumiCharacter, { type LumiMood } from "../LumiCharacter";

export default function Hero() {
  const [mood, setMood] = useState<LumiMood>("greet");
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const ts = [
      setTimeout(() => setStage(1), 900),
      setTimeout(() => setMood("idle"), 2200),
      setTimeout(() => setStage(2), 2000),
      setTimeout(() => {
        setStage(3);
        setMood("curious");
      }, 3300),
    ];
    return () => ts.forEach(clearTimeout);
  }, []);

  return (
    <section id="top" className="relative overflow-hidden pb-20 pt-28 sm:pb-28 sm:pt-36">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-sky-200/60 blur-[100px]" />
        <div className="absolute -right-32 top-20 h-[460px] w-[460px] rounded-full bg-lilac-200/70 blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 h-[300px] w-[500px] rounded-full bg-sky-100/80 blur-[90px]" />
        <div className="bg-dots absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      </div>

      <div className="container-lumi relative grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <div className="text-center lg:text-left">
          <div className="mb-4 flex justify-center lg:hidden">
            <LumiCharacter size={128} mood={mood} />
          </div>
          <motion.span
            className="eyebrow"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Sparkles className="h-3.5 w-3.5" /> Oppimiskaveri, ei chatbot
          </motion.span>

          <motion.h1
            className="mt-6 font-display text-[5.5rem] font-black leading-[0.9] tracking-[-0.045em] sm:text-[7.5rem] lg:text-[9rem]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="bg-gradient-to-br from-sky-500 via-[#6E7CF2] to-lilac-500 bg-clip-text text-transparent">Lumi</span>
          </motion.h1>

          <motion.p
            className="mt-4 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7 }}
          >
            Tekoälypohjainen oppimiskaveri
          </motion.p>

          <motion.p
            className="lead mx-auto mt-4 max-w-md lg:mx-0"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.7 }}
          >
            Lumi auttaa lapsia ajattelemaan, oivaltamaan ja oppimaan itse.
          </motion.p>

          <motion.div
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.7 }}
          >
            <a href="#demo" className="btn-primary w-full sm:w-auto">
              Kokeile demoa <ArrowRight className="h-4 w-4" />
            </a>
            <a href="#erilainen" className="btn-ghost w-full sm:w-auto">
              Miten Lumi eroaa?
            </a>
          </motion.div>

          <motion.div
            className="mx-auto mt-10 grid max-w-md grid-cols-2 gap-px overflow-hidden rounded-3xl border border-ink/[0.06] bg-ink/[0.06] text-left shadow-soft lg:mx-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <div className="bg-white/90 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-mute">Tavallinen tekoäly</div>
              <div className="mt-1 text-sm font-semibold text-ink-soft">antaa vastauksia.</div>
            </div>
            <div className="bg-gradient-to-br from-white to-lilac-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-lilac-600">Lumi</div>
              <div className="mt-1 text-sm font-semibold text-ink">auttaa löytämään ne itse.</div>
            </div>
          </motion.div>
        </div>

        {/* character + live mini-comparison */}
        <div className="relative mx-auto w-full max-w-[460px]">
          <div className="relative hidden justify-center lg:flex">
            <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}>
              <LumiCharacter size={260} mood={mood} />
            </motion.div>
            <motion.div
              className="absolute right-0 top-2 rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm font-bold text-ink shadow-lift sm:-right-4"
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={stage >= 1 ? { opacity: 1, scale: 1, y: 0 } : {}}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
            >
              Hei! Mietitäänkö yhdessä? 👋
            </motion.div>
          </div>

          <div className="relative mt-6 space-y-3">
            <motion.div
              className="flex justify-end"
              initial={{ opacity: 0, y: 10 }}
              animate={stage >= 1 ? { opacity: 1, y: 0 } : {}}
            >
              <div className="rounded-[1.3rem] rounded-br-md bg-gradient-to-br from-sky-500 to-sky-600 px-4 py-2.5 text-[15px] font-medium text-white shadow-soft">
                En osaa laskea 36 ÷ 4
              </div>
            </motion.div>

            <motion.div
              className="rounded-2xl border border-ink/[0.06] bg-white/70 px-4 py-3 backdrop-blur"
              initial={{ opacity: 0, y: 10 }}
              animate={stage >= 2 ? { opacity: stage >= 3 ? 0.55 : 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-mute">
                <Zap className="h-3.5 w-3.5" /> Tavallinen tekoäly
              </div>
              <div className="relative mt-1 inline-block text-[15px] text-ink-soft">
                Vastaus on 9.
                <motion.span
                  className="absolute left-0 top-1/2 h-[1.5px] bg-ink/40"
                  initial={{ width: 0 }}
                  animate={stage >= 3 ? { width: "100%" } : {}}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </motion.div>

            <motion.div
              className="relative rounded-2xl bg-gradient-to-br from-sky-400 to-lilac-500 p-[1.5px] shadow-glow"
              initial={{ opacity: 0, y: 14 }}
              animate={stage >= 3 ? { opacity: 1, y: 0 } : {}}
              transition={{ type: "spring", stiffness: 160, damping: 20 }}
            >
              <div className="rounded-[calc(1rem-1.5px)] bg-white px-4 py-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-lilac-600">
                  <Sparkles className="h-3.5 w-3.5" /> Lumi
                </div>
                <p className="mt-1 text-[15px] leading-relaxed text-ink">
                  Mietitään yhdessä. Kuinka monta kertaa nelonen mahtuu lukuun 36? Tuleeko mieleesi kertolasku, jonka tulos on 36?
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
