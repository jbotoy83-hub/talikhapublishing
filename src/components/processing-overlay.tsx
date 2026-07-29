"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export type ProcessingPhase = "idle" | "working" | "succeeded" | "failed";

const STATUS_MESSAGES = [
  "Preparing your manuscript",
  "Validating submission details",
  "Checking payment information",
  "Securing your files to protected storage",
  "Verifying document integrity",
  "Registering with the editorial desk",
  "Finalizing your submission",
];

const EASE = [0.16, 1, 0.3, 1] as const;

function TextShimmerWave({ label = "Processing" }: { label?: string }) {
  return (
    <div className="flex select-none font-medium text-2xl tracking-tight sm:text-3xl" aria-label={label}>
      {label.split("").map((char, i) => (
        <motion.span
          key={i}
          className="text-white"
          style={{ display: "inline-block", whiteSpace: char === " " ? "pre" : undefined }}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
        >
          {char}
        </motion.span>
      ))}
    </div>
  );
}

function FadeDots() {
  return (
    <div className="flex space-x-2" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="h-2.5 w-2.5 rounded-full bg-white"
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2, ease: "linear" }}
        />
      ))}
    </div>
  );
}

function CheckMark() {
  return (
    <motion.svg width="58" height="58" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <motion.circle
        cx="28" cy="28" r="25" stroke="rgba(255,255,255,0.85)" strokeWidth="2"
        initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE }}
      />
      <motion.path
        d="M18 28.5l7 7 13-14" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 0.45, delay: 0.45, ease: EASE }}
      />
    </motion.svg>
  );
}

function AlertMark() {
  return (
    <motion.svg width="58" height="58" viewBox="0 0 56 56" fill="none" aria-hidden="true"
      initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.4, ease: EASE }}>
      <circle cx="28" cy="28" r="25" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
      <path d="M28 17v14" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="28" cy="38" r="2.4" fill="#fff" />
    </motion.svg>
  );
}

type Props = {
  phase: ProcessingPhase;
  attempt: number;
  totalAttempts: number;
  reference: string;
  serverSubmitted: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  onBack?: () => void;
};

export function SubmissionProcessing({ phase, attempt, totalAttempts, reference, errorMessage, onRetry, onBack }: Props) {
  const [msgIndex, setMsgIndex] = useState(0);
  const active = phase === "working";

  useEffect(() => {
    if (!active) return;
    setMsgIndex(0);
    const id = window.setInterval(() => {
      setMsgIndex((i) => (i + 1) % STATUS_MESSAGES.length);
    }, 2100);
    return () => window.clearInterval(id);
  }, [active, phase]);

  const retrying = active && attempt > 1;
  const statusText = STATUS_MESSAGES[msgIndex];

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden px-6"
      style={{ backgroundColor: "#1a1613" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-label={phase === "failed" ? "Submission could not be completed" : "Processing your submission"}
    >
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 80% at 50% 12%, rgba(231,170,84,0.07), rgba(26,22,19,0) 60%)" }} />
      <div className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: "radial-gradient(1px 1px at 18% 28%, rgba(222,162,132,0.55), transparent), radial-gradient(1px 1px at 72% 62%, rgba(222,162,132,0.42), transparent), radial-gradient(1px 1px at 41% 82%, rgba(222,162,132,0.35), transparent), radial-gradient(1px 1px at 86% 22%, rgba(222,162,132,0.45), transparent), radial-gradient(1px 1px at 57% 44%, rgba(222,162,132,0.3), transparent), radial-gradient(1px 1px at 9% 71%, rgba(222,162,132,0.38), transparent), radial-gradient(1px 1px at 33% 14%, rgba(222,162,132,0.3), transparent), radial-gradient(1px 1px at 64% 88%, rgba(222,162,132,0.32), transparent)" }} />
      <motion.div className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full" style={{ background: "radial-gradient(circle, rgba(166,83,53,0.16), transparent 70%)", filter: "blur(10px)" }} animate={{ x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div className="pointer-events-none absolute -right-20 bottom-1/4 h-80 w-80 rounded-full" style={{ background: "radial-gradient(circle, rgba(120,72,40,0.14), transparent 70%)", filter: "blur(10px)" }} animate={{ x: [0, -26, 0], y: [0, 22, 0] }} transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }} />

      <motion.div className="relative flex w-full max-w-md flex-col items-center text-center" initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, ease: EASE }}>
        <motion.p className="mb-10 text-[11px] font-semibold uppercase tracking-[0.34em] text-zinc-500" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.5 }}>Talikha Publishing</motion.p>

        <AnimatePresence mode="wait">
          {phase === "failed" ? (
            <motion.div key="error-mark" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><AlertMark /></motion.div>
          ) : phase === "succeeded" ? (
            <motion.div key="success-mark" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><CheckMark /></motion.div>
          ) : (
            <motion.div key="wave" className="flex flex-col items-center gap-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
              <TextShimmerWave />
              <FadeDots />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-9 flex min-h-[52px] flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            {phase === "succeeded" ? (
              <motion.div key="success-text" className="flex flex-col items-center" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                <p className="text-base font-medium text-white">Submission received</p>
                {reference ? (
                  <motion.p key="ref" className="mt-2 font-mono text-sm tracking-wide text-zinc-300" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>{reference}</motion.p>
                ) : null}
                <motion.p className="mt-2 text-sm text-zinc-500" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>Opening your reference&hellip;</motion.p>
              </motion.div>
            ) : phase === "failed" ? (
              <motion.div key="error-text" className="flex flex-col items-center" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                <p className="text-base font-medium text-white">We couldn&rsquo;t complete your submission</p>
                {errorMessage ? <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-400">{errorMessage}</p> : null}
              </motion.div>
            ) : (
              <motion.p key={statusText} className="text-sm text-zinc-400" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.32, ease: EASE }}>{statusText}</motion.p>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {retrying && (
            <motion.p key="retry-note" className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              Reconnecting &mdash; attempt {attempt} of {totalAttempts}
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === "failed" && (
            <motion.div key="error-actions" className="mt-8 flex flex-wrap items-center justify-center gap-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.1, duration: 0.35 }}>
              <button type="button" onClick={onRetry} className="rounded-full bg-white px-6 py-3 text-sm font-bold text-zinc-900 transition-transform hover:scale-[1.03] active:scale-95">Try again</button>
              <button type="button" onClick={onBack} className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-zinc-300 transition-colors hover:bg-white/5">Go back</button>
            </motion.div>
          )}
        </AnimatePresence>

        {active && (
          <div className="mt-12 h-px w-44 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full w-1/3 rounded-full bg-white/60" animate={{ x: ["-120%", "320%"] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }} />
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
