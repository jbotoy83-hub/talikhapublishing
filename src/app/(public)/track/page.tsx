import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { FileCheck2, FileText, PenLine, Sparkles } from "lucide-react";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Track your submission", description: `Securely check the progress of a submission to ${SITE_NAME}.`, robots: { index: false, follow: false } };

const LocalTrackingForm = dynamic(() => import("@/components/local-tracking-form").then((mod) => ({ default: mod.LocalTrackingForm })));

const PROCESS_STEPS = [
  { icon: FileCheck2, step: "01", title: "Submission received", description: "Your manuscript is logged and confirmed. You receive a unique reference number to track progress." },
  { icon: PenLine, step: "02", title: "Editorial review", description: "Our editorial board evaluates your work for scope, originality, and quality. Peer reviewers may be consulted." },
  { icon: Sparkles, step: "03", title: "Revision & proofing", description: "Accepted manuscripts go through revision rounds, copy editing, and final proofing before publication." },
  { icon: FileText, step: "04", title: "Publication", description: "Your work is assigned to a journal issue, formatted, and published for readers worldwide." },
];

export default function TrackPage() {
  return (
    <main id="main-content" className="track-page">
      {/* Header */}
      <div className="track-header">
        <p className="track-eyebrow">Author tracking</p>
        <h1 className="track-heading">Follow your submission <br />with confidence</h1>
        <p className="track-heading-desc">Enter the reference number you received when you submitted. It opens the matching submission and shows its editorial progress.</p>
      </div>

      {/* How it works */}
      <section className="track-how-it-works">
        <div className="track-how-grid">
          {PROCESS_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.step} className="track-how-card">
                <div className="track-how-icon">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="track-how-body">
                  <span className="track-how-step">{step.step}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
                {i < PROCESS_STEPS.length - 1 && <span className="track-how-arrow" aria-hidden="true">→</span>}
              </div>
            );
          })}
        </div>
      </section>

      {/* Tracking form */}
      <section className="track-form-section">
        <LocalTrackingForm />
      </section>
    </main>
  );
}
