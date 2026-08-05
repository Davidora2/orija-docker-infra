"use client";

import { useEffect, useState } from "react";
import { blueprintTopics } from "@/data/blueprint";
import { flashcards } from "@/data/flashcards";
import { rhythmTopics } from "@/data/rhythms";
import { loadProgress, progressPercent, type ProgressState } from "@/lib/progress";
import { Panel, WeightBar } from "@/components/ui";

export function ProgressSummary() {
  const [progress, setProgress] = useState<ProgressState | null>(null);

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  if (!progress) {
    return <Panel className="h-40 animate-pulse bg-white/50" />;
  }

  const modulePct = progressPercent(progress, blueprintTopics.length);
  const rhythmPct = Math.round(
    (progress.rhythmsStudied.length / Math.max(1, rhythmTopics.length)) * 100,
  );
  const flips = Object.values(progress.flashcardsSeen).reduce((a, b) => a + b, 0);
  const quizAttempts = Object.keys(progress.quizScores).length;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Panel>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-navy/50">
          Modules reviewed
        </p>
        <p className="mt-3 font-display text-3xl text-navy">{modulePct}%</p>
        <div className="mt-3">
          <WeightBar percent={modulePct} />
        </div>
        <p className="mt-2 text-xs text-navy/55">
          {progress.modulesCompleted.length}/{blueprintTopics.length} topics
        </p>
      </Panel>
      <Panel>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-navy/50">
          Quiz topics attempted
        </p>
        <p className="mt-3 font-display text-3xl text-navy">{quizAttempts}</p>
        <p className="mt-2 text-xs text-navy/55">Best to cover all blueprint areas</p>
      </Panel>
      <Panel>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-navy/50">
          Rhythm checklist
        </p>
        <p className="mt-3 font-display text-3xl text-navy">{rhythmPct}%</p>
        <div className="mt-3">
          <WeightBar percent={rhythmPct} />
        </div>
        <p className="mt-2 text-xs text-navy/55">
          {progress.rhythmsStudied.length}/{rhythmTopics.length} studied
        </p>
      </Panel>
      <Panel>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-navy/50">
          Flashcard flips
        </p>
        <p className="mt-3 font-display text-3xl text-navy">{flips}</p>
        <p className="mt-2 text-xs text-navy/55">{flashcards.length} cards available</p>
      </Panel>
    </div>
  );
}
