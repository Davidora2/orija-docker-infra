import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EcgTrace } from "@/components/ecg-trace";
import { examMeta, getNextSitting } from "@/data/exam-meta";
import { daysUntil } from "@/lib/utils";

export default function LandingPage() {
  const next = getNextSitting();
  const days = next ? daysUntil(next.examStartIso) : null;

  return (
    <div className="min-h-screen">
      <section className="hero-wash relative min-h-[100svh] overflow-hidden text-white">
        <div className="absolute inset-0 opacity-30 ecg-grid" />
        <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col px-6 pb-10 pt-6">
          <header className="fade-up flex items-center justify-between">
            <div>
              <p className="font-display text-3xl tracking-tight sm:text-4xl">TraceReady</p>
            </div>
            <Link
              href="/app"
              className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium backdrop-blur transition hover:bg-white/20"
            >
              Open study hub
            </Link>
          </header>

          <div className="mt-auto max-w-2xl pb-8 pt-24">
            <h1 className="fade-up font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
              Pass the CSCT certification exam.
            </h1>
            <p className="fade-up-delay mt-5 max-w-xl text-lg text-white/80">
              Blueprint-weighted study paths, official guideline flashcards, rhythm drills, and
              live exam dates from csct.ca — built for Registered Cardiology Technologist
              candidates.
            </p>
            <div className="fade-up-delay-2 mt-8 flex flex-wrap gap-3">
              <Link
                href="/app"
                className="inline-flex items-center gap-2 rounded-xl bg-teal px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-deep"
              >
                Start studying <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/app/exam-info"
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold backdrop-blur transition hover:bg-white/20"
              >
                {next
                  ? `${next.label} · ${days !== null && days > 0 ? `${days} days` : next.examDates}`
                  : "Exam intel"}
              </Link>
            </div>
          </div>

          <div className="fade-up-delay-2 mt-4">
            <EcgTrace className="w-full opacity-90" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-deep">
          How TraceReady helps
        </p>
        <h2 className="mt-2 max-w-xl font-display text-3xl text-navy">
          Study the way the exam is weighted.
        </h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {[
            {
              title: "Blueprint first",
              body: "ECG analysis is 30%, ETT 18%, foundational science 25% — your path follows the official CSCT blueprint.",
            },
            {
              title: "Official numbers",
              body: "Flashcards and quizzes lock in CSCT Exam Guideline values for PR, QRS, QTc, axis, EF, and ETT rules.",
            },
            {
              title: "Latest exam intel",
              body: `Next sitting targets ${examMeta.sittings.find((s) => s.status === "upcoming")?.examDates ?? "the CSCT calendar"} with registration deadlines you can refresh from the source.`,
            },
          ].map((item) => (
            <div key={item.title} className="border-t border-navy/15 pt-5">
              <h3 className="font-display text-xl text-navy">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy/65">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
