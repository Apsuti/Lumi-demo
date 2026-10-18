"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useState } from "react";

export type LumiMood = "idle" | "greet" | "curious" | "think" | "happy" | "celebrate";

type Props = {
  size?: number;
  mood?: LumiMood;
  talking?: boolean;
  float?: boolean;
  /** Change this number to replay the celebration burst. */
  burstKey?: number;
  className?: string;
};

const INK = "#23264F";

/**
 * Lumi – a small, softly glowing creature made of light.
 * Not a robot, not a human, not an animal: a calm learning companion.
 */
export default function LumiCharacter({
  size = 180,
  mood = "idle",
  talking = false,
  float = true,
  burstKey = 0,
  className = "",
}: Props) {
  const uid = useId().replace(/:/g, "");
  const reduce = useReducedMotion();
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 140);
        loop();
      }, 2400 + Math.random() * 2800);
    };
    loop();
    return () => clearTimeout(t);
  }, []);

  const happyEyes = mood === "happy" || mood === "celebrate";
  const tilt = mood === "curious" ? 8 : mood === "think" ? -6 : 0;
  const look =
    mood === "think" ? { x: 3, y: -4 } : mood === "curious" ? { x: -1.5, y: 1 } : { x: 0, y: 0 };
  const glowStrength = mood === "celebrate" ? 1 : mood === "happy" ? 0.8 : 0.55;

  return (
    <div
      className={`relative select-none ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* soft halo */}
      <motion.div
        className="absolute inset-[-18%] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 55%, rgba(167,139,250,0.55) 0%, rgba(127,166,255,0.35) 35%, rgba(255,255,255,0) 68%)",
          filter: "blur(6px)",
        }}
        animate={
          reduce
            ? { opacity: glowStrength }
            : { opacity: [glowStrength * 0.75, glowStrength, glowStrength * 0.75], scale: [0.96, 1.04, 0.96] }
        }
        transition={{ duration: mood === "celebrate" ? 1.6 : 4.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* celebration burst */}
      <AnimatePresence>
        {mood === "celebrate" && !reduce && (
          <Burst key={`burst-${burstKey}`} size={size} />
        )}
      </AnimatePresence>

      <motion.div
        className="absolute inset-0"
        animate={float && !reduce ? { y: [0, -size * 0.045, 0] } : { y: 0 }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.div
          className="h-full w-full"
          animate={{
            rotate: tilt,
            scale: mood === "celebrate" ? [1, 1.08, 1] : mood === "greet" ? [1, 1.04, 1] : 1,
          }}
          transition={{
            rotate: { type: "spring", stiffness: 120, damping: 12 },
            scale: { duration: 0.7, ease: "easeOut" },
          }}
          style={{ transformOrigin: "50% 70%" }}
        >
          <svg viewBox="0 0 200 200" width="100%" height="100%" overflow="visible">
            <defs>
              <radialGradient id={`body-${uid}`} cx="38%" cy="30%" r="78%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="34%" stopColor="#E7EEFF" />
                <stop offset="72%" stopColor="#B9CBFF" />
                <stop offset="100%" stopColor="#A08EF8" />
              </radialGradient>
              <radialGradient id={`rim-${uid}`} cx="50%" cy="85%" r="60%">
                <stop offset="0%" stopColor="#B49CFF" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#B49CFF" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`wisp-${uid}`} x1="0" y1="1" x2="0.4" y2="0">
                <stop offset="0%" stopColor="#C9D8FF" />
                <stop offset="100%" stopColor="#B59BFF" />
              </linearGradient>
              <radialGradient id={`spark-${uid}`}>
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="60%" stopColor="#E9E1FF" />
                <stop offset="100%" stopColor="#C4B3FF" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* light wisp on top */}
            <motion.g
              style={{ transformOrigin: "100px 44px" }}
              animate={reduce ? {} : { rotate: [-7, 7, -7] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <path
                d="M100 46 C 93 32, 101 22, 114 14 C 109 26, 117 33, 108 46 Z"
                fill={`url(#wisp-${uid})`}
              />
              <motion.circle
                cx="114"
                cy="14"
                r="7"
                fill={`url(#spark-${uid})`}
                animate={reduce ? {} : { opacity: [0.6, 1, 0.6], scale: [0.9, 1.15, 0.9] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                style={{ transformOrigin: "114px 14px" }}
              />
            </motion.g>

            {/* little light hands */}
            <ellipse cx="36" cy="128" rx="10" ry="13" fill={`url(#body-${uid})`} />
            <motion.ellipse
              cx="164"
              cy="128"
              rx="10"
              ry="13"
              fill={`url(#body-${uid})`}
              style={{ transformOrigin: "156px 136px" }}
              animate={
                mood === "greet" && !reduce
                  ? { rotate: [0, -38, -8, -38, -8, 0], y: [0, -14, -12, -14, -12, 0] }
                  : mood === "celebrate" && !reduce
                    ? { rotate: [0, -30, 0], y: [0, -12, 0] }
                    : { rotate: 0, y: 0 }
              }
              transition={{ duration: mood === "greet" ? 1.8 : 0.8, ease: "easeInOut" }}
            />

            {/* body */}
            <path
              d="M100 40 C 141 40, 168 73, 168 113 C 168 151, 138 173, 100 173 C 62 173, 32 151, 32 113 C 32 73, 59 40, 100 40 Z"
              fill={`url(#body-${uid})`}
            />
            <path
              d="M100 40 C 141 40, 168 73, 168 113 C 168 151, 138 173, 100 173 C 62 173, 32 151, 32 113 C 32 73, 59 40, 100 40 Z"
              fill={`url(#rim-${uid})`}
            />
            {/* glossy highlight */}
            <ellipse cx="74" cy="68" rx="19" ry="9" fill="#FFFFFF" opacity="0.75" transform="rotate(-28 74 68)" />
            <circle cx="98" cy="58" r="3" fill="#FFFFFF" opacity="0.7" />

            {/* cheeks */}
            <motion.ellipse
              cx="62"
              cy="130"
              rx="10"
              ry="5.5"
              fill="#FFB0C6"
              animate={{ opacity: happyEyes ? 0.8 : 0.5 }}
            />
            <motion.ellipse
              cx="138"
              cy="130"
              rx="10"
              ry="5.5"
              fill="#FFB0C6"
              animate={{ opacity: happyEyes ? 0.8 : 0.5 }}
            />

            {/* eyes */}
            {happyEyes ? (
              <g stroke={INK} strokeWidth="5.5" strokeLinecap="round" fill="none">
                <path d="M66 113 Q78 99 90 113" />
                <path d="M110 113 Q122 99 134 113" />
              </g>
            ) : (
              <motion.g animate={{ x: look.x, y: look.y }} transition={{ type: "spring", stiffness: 140, damping: 14 }}>
                {[78, 122].map((cx) => (
                  <motion.g
                    key={cx}
                    style={{ transformOrigin: `${cx}px 110px` }}
                    animate={{ scaleY: blink ? 0.1 : 1 }}
                    transition={{ duration: 0.08 }}
                  >
                    <ellipse cx={cx} cy="110" rx="11.5" ry="14.5" fill={INK} />
                    <circle cx={cx + 4} cy="104" r="4.4" fill="#FFFFFF" />
                    <circle cx={cx - 3.5} cy="116" r="2" fill="#FFFFFF" opacity="0.75" />
                  </motion.g>
                ))}
              </motion.g>
            )}

            {/* mouth */}
            <Mouth mood={mood} talking={talking && !reduce} />
          </svg>
        </motion.div>
      </motion.div>

      {/* orbiting motes of light */}
      {!reduce && (
        <>
          <Mote size={size} delay={0} radius={0.56} dur={9} />
          <Mote size={size} delay={3} radius={0.5} dur={12} small />
        </>
      )}
    </div>
  );
}

function Mouth({ mood, talking }: { mood: LumiMood; talking: boolean }) {
  if (mood === "celebrate" || mood === "greet") {
    return (
      <motion.path
        d="M88 132 Q100 150 112 132 Z"
        fill={INK}
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
        initial={{ scaleY: 0.6 }}
        animate={{ scaleY: 1 }}
        style={{ transformOrigin: "100px 132px" }}
      />
    );
  }
  if (mood === "think") {
    return <circle cx="104" cy="136" r="4" fill={INK} />;
  }
  return (
    <motion.path
      d="M90 133 Q100 143 110 133"
      stroke={INK}
      strokeWidth="4.5"
      strokeLinecap="round"
      fill="none"
      style={{ transformOrigin: "100px 136px" }}
      animate={talking ? { scaleY: [1, 1.9, 1, 1.6, 1] } : { scaleY: 1 }}
      transition={talking ? { duration: 0.9, repeat: Infinity } : { duration: 0.2 }}
    />
  );
}

function Mote({ size, delay, radius, dur, small }: { size: number; delay: number; radius: number; dur: number; small?: boolean }) {
  const r = size * radius;
  const d = small ? 5 : 7;
  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{ width: 0, height: 0 }}
      animate={{ rotate: 360 }}
      transition={{ duration: dur, repeat: Infinity, ease: "linear", delay }}
    >
      <motion.span
        className="absolute block rounded-full bg-white"
        style={{
          width: d,
          height: d,
          left: r,
          top: -d / 2,
          boxShadow: "0 0 10px 3px rgba(167,139,250,0.7)",
        }}
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{ duration: dur / 3, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
}

const BURST_COLORS = ["#A78BFA", "#7FA6FF", "#FFD27A", "#FFB0C6", "#5CC9A0"];

function Burst({ size }: { size: number }) {
  const n = 14;
  return (
    <div className="pointer-events-none absolute inset-0">
      {Array.from({ length: n }).map((_, i) => {
        const a = (i / n) * Math.PI * 2;
        const dist = size * (0.62 + (i % 3) * 0.08);
        const s = 5 + (i % 3) * 2;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 block rounded-full"
            style={{
              width: s,
              height: s,
              marginLeft: -s / 2,
              marginTop: -s / 2,
              background: BURST_COLORS[i % BURST_COLORS.length],
              boxShadow: `0 0 8px ${BURST_COLORS[i % BURST_COLORS.length]}`,
            }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
            animate={{
              x: Math.cos(a) * dist,
              y: Math.sin(a) * dist,
              opacity: [0, 1, 0],
              scale: [0.4, 1, 0.6],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeOut", delay: (i % 4) * 0.04 }}
          />
        );
      })}
    </div>
  );
}
