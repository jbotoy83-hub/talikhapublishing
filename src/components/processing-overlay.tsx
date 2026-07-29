"use client";

import { AnimatePresence, motion } from "framer-motion";

export type ProcessingPhase = "idle" | "working" | "succeeded" | "failed";
export type ProcessingStep = "preparing" | "uploading" | "verifying" | "finalizing";

const PROCESSING_STEPS: { id: ProcessingStep; title: string; description: string }[] = [
  { id: "preparing", title: "Preparing submission", description: "Checking your manuscript, author details, and payment proof." },
  { id: "uploading", title: "Uploading protected files", description: "Sending your manuscript and proof of payment to private storage." },
  { id: "verifying", title: "Verifying payment details", description: "Confirming the transaction information and uploaded files." },
  { id: "finalizing", title: "Issuing tracking reference", description: "Creating your submission record and unique tracking number." },
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
  step: ProcessingStep;
  attempt: number;
  totalAttempts: number;
  reference: string;
  serverSubmitted: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  onBack?: () => void;
};

export function SubmissionProcessing({ phase, step, attempt, totalAttempts, reference, errorMessage, onRetry, onBack }: Props) {
  const active = phase === "working";
  const retrying = active && attempt > 1;
  const activeStepIndex = PROCESSING_STEPS.findIndex((item) => item.id === step);
  const activeStep = PROCESSING_STEPS[activeStepIndex] || PROCESSING_STEPS[0];

  return (
    <motion.div
      className="flex items-center justify-center overflow-hidden px-6"
      style={{ position: "fixed", inset: 0, zIndex: 120, backgroundColor: "#1a1613" }}
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
              <motion.div key={activeStep.id} className="text-center" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.32, ease: EASE }}>
                <p className="text-base font-medium text-white">{activeStep.title}</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-400">{activeStep.description}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {active && (
          <div className="mt-8 w-full max-w-sm rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Submission progress</p>
              <p className="text-xs text-zinc-500">Usually 10–30 seconds</p>
            </div>
            <ol className="mt-3 space-y-3" aria-label="Submission processing stages">
              {PROCESSING_STEPS.map((item, index) => {
                const complete = index < activeStepIndex;
                const current = index === activeStepIndex;
                return (
                  <li key={item.id} className={`flex items-start gap-3 ${current ? "text-white" : complete ? "text-zinc-400" : "text-zinc-600"}`}>
                    <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${complete ? "border-white/40 bg-white/15" : current ? "border-white/70" : "border-white/10"}`} aria-hidden="true">{complete ? "✓" : index + 1}</span>
                    <span className="min-w-0"><strong className="block text-sm font-medium">{item.title}</strong><span className="mt-0.5 block text-xs leading-5 text-zinc-500">{current ? item.description : complete ? "Complete" : "Up next"}</span></span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

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
