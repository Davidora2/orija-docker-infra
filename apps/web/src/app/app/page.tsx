import Link from "next/link";
import { ProgressSummary } from "@/components/progress-summary";
import { GhostLink, Panel, PrimaryLink, SectionTitle, WeightBar } from "@/components/ui";
import { topicsByPriority } from "@/data/blueprint";
import { examMeta, getNextSitting } from "@/data/exam-meta";
import { daysUntil } from "@/lib/utils";

export default function DashboardPage() {
  const next = getNextSitting();
  const days = next ? daysUntil(next.examStartIso) : null;
  const top = topicsByPriority().slice(0, 4);

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Study hub"
        title="Your CSCT prep command center"
        subtitle="Prioritize high-weight blueprint topics, drill official guideline numbers, and keep exam dates current."
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel className="hero-wash relative overflow-hidden text-white">
          <div className="absolute inset-0 opacity-20 ecg-grid" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              Next sitting
            </p>
            <h2 className="mt-2 font-display text-3xl">{next?.label ?? "CSCT Exam"}</h2>
            <p className="mt-2 text-white/80">{next?.examDates}</p>
            <p className="mt-4 text-4xl font-semibold text-[#9be7d8]">
              {days !== null && days > 0 ? `${days} days` : "Check dates"}
            </p>
            <p className="mt-2 text-sm text-white/70">
              Fee ${next?.feeCad ?? 600} · Pass mark {examMeta.passMark}% · {examMeta.delivery}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/app/exam-info"
                className="rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white"
              >
                Exam intel
              </Link>
              <Link
                href="/app/study"
                className="rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold"
              >
                Open study path
              </Link>
            </div>
          </div>
        </Panel>

        <Panel>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-navy/50">
            Today&apos;s focus
          </p>
          <h3 className="mt-2 font-display text-2xl text-navy">Highest-yield first</h3>
          <div className="mt-4 space-y-4">
            {top.map((topic) => (
              <Link key={topic.id} href={`/app/study/${topic.id}`} className="block">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-navy">
                    {topic.code} {topic.title}
                  </span>
                  <span className="text-navy/50">{topic.weightPercent}%</span>
                </div>
                <div className="mt-1">
                  <WeightBar percent={topic.weightPercent} />
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <ProgressSummary />

      <div className="flex flex-wrap gap-2">
        <PrimaryLink href="/app/quiz/ecg">Drill ECG quiz (30%)</PrimaryLink>
        <GhostLink href="/app/flashcards?deck=exam-guidelines">Guideline flashcards</GhostLink>
        <GhostLink href="/app/rhythms">Rhythm checklist</GhostLink>
        <GhostLink href="/app/reading">Reading list</GhostLink>
      </div>
    </div>
  );
}
