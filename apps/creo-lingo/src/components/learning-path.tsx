"use client";

import Link from "next/link";
import type { Dialect } from "@/lib/types";
import { getAllLessons } from "@/data/curriculum";
import { useProgress } from "./progress-provider";

export function LearningPath({ dialect }: { dialect: Dialect }) {
  const { progress, ready } = useProgress();
  const dialectProgress = progress.dialects[dialect.id];
  const completed = new Set(dialectProgress?.completedLessons ?? []);
  const path = getAllLessons(dialect);

  let unlocked = true;

  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-6 sm:px-6">
      <div
        className="mb-8 overflow-hidden rounded-[2rem] p-6 text-white shadow-[0_20px_50px_rgba(11,122,117,0.25)]"
        style={{
          background: `linear-gradient(135deg, ${dialect.accent}, color-mix(in srgb, ${dialect.accent} 65%, #0b3d2e))`,
        }}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
          {dialect.region}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
          {dialect.nativeName}
        </h1>
        <p className="mt-2 max-w-md text-white/85">{dialect.blurb}</p>
        <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold">
          <span>⚡ {ready ? (dialectProgress?.xp ?? 0) : "—"} XP</span>
          <span>
            ✓ {ready ? completed.size : "—"}/{path.length} lessons
          </span>
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 rounded-full bg-[var(--lagoon)]/15" />
        <ol className="relative space-y-8">
          {path.map(({ lesson, unit, indexInPath }, i) => {
            const isDone = completed.has(lesson.id);
            const isCurrent = unlocked && !isDone;
            const isLocked = !unlocked;
            if (isDone) unlocked = true;
            else unlocked = false;

            const offset = i % 2 === 0 ? "-translate-x-10 sm:-translate-x-16" : "translate-x-10 sm:translate-x-16";

            return (
              <li key={lesson.id} className="relative flex justify-center">
                {i === 0 || path[i - 1]?.unit.id !== unit.id ? (
                  <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[var(--foam)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--lagoon)]">
                    {unit.title}
                  </div>
                ) : null}
                <div className={`relative mt-4 ${offset}`}>
                  {isLocked ? (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[var(--ink)]/10 bg-[var(--ink)]/5 text-2xl text-[var(--ink)]/30 shadow-inner">
                      🔒
                    </div>
                  ) : (
                    <Link
                      href={`/lesson/${dialect.id}/${lesson.id}`}
                      className={`group flex h-20 w-20 items-center justify-center rounded-full border-4 text-2xl font-bold shadow-[0_6px_0_rgba(18,40,36,0.15)] transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-none ${
                        isDone
                          ? "border-[var(--palm)] bg-[var(--palm)] text-white"
                          : "border-[var(--lagoon)] bg-[var(--lagoon)] text-white animate-soft-pulse"
                      }`}
                      style={
                        isCurrent
                          ? { boxShadow: `0 6px 0 rgba(18,40,36,0.15), 0 0 0 8px ${dialect.accent}22` }
                          : undefined
                      }
                      aria-label={`Start ${lesson.title}`}
                    >
                      {isDone ? "✓" : indexInPath + 1}
                    </Link>
                  )}
                  <div className="mt-3 w-36 text-center sm:w-44">
                    <p className="font-display text-base font-bold text-[var(--ink)]">
                      {lesson.title}
                    </p>
                    <p className="text-xs text-[var(--ink)]/55">
                      {lesson.xp} XP · {lesson.exercises.length} drills
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
