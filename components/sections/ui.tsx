"use client";

import { motion } from "framer-motion";

export function Reveal({
  children,
  delay = 0,
  className = "",
  y = 18,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function SectionHead({
  eyebrow,
  title,
  lead,
  center = true,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  center?: boolean;
}) {
  return (
    <Reveal className={center ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="h-section mt-5">{title}</h2>
      {lead && <p className="lead mt-4">{lead}</p>}
    </Reveal>
  );
}
