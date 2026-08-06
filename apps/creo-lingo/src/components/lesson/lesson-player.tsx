"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Dialect, Exercise, Lesson } from "@/lib/types";
import { useProgress } from "../progress-provider";
import {
  FillBlankView,
  MatchPairsView,
  MultipleChoiceView,
  TranslateView,
} from "./exercise-views";

export function LessonPlayer({
  dialect,
  lesson,
  unitTitle,
}: {
  dialect: Dialect;
  lesson: Lesson;
  unitTitle: string;
}) {
  const { progress, finishLesson, missHeart, restoreHearts } = useProgress();
  const [index, setIndex] = useState(0);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);
  const [finalCorrect, setFinalCorrect] = useState(0);
  const [matchFailArmed, setMatchFailArmed] = useState(false);

  const exercise = lesson.exercises[index];
  const pct = useMemo(
    () => Math.round((index / lesson.exercises.length) * 100),
    [index, lesson.exercises.length],
  );

  const advance = (wasCorrect: boolean) => {
    const nextCorrect = correctCount + (wasCorrect ? 1 : 0);
    if (index >= lesson.exercises.length - 1) {
      setFinalCorrect(nextCorrect);
      finishLesson(dialect.id, lesson.id, lesson.xp);
      setDone(true);
      return;
    }
    setCorrectCount(nextCorrect);
    setIndex((i) => i + 1);
    setLocked(false);
    setFeedback(null);
    setMatchFailArmed(false);
  };

  const handleAnswer = (correct: boolean) => {
    if (exercise.type === "match_pairs") {
      if (correct) {
        setLocked(true);
        setFeedback("correct");
        return;
      }
      if (!matchFailArmed) {
        setMatchFailArmed(true);
        missHeart();
        setFeedback("wrong");
        window.setTimeout(() => setFeedback(null), 700);
      }
      return;
    }

    if (locked) return;
    setLocked(true);
    setFeedback(correct ? "correct" : "wrong");
    if (!correct) missHeart();
  };

  if (progress.hearts <= 0 && !done) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 text-center">
        <p className="font-display text-5xl">💔</p>
        <h1 className="mt-4 font-display text-3xl font-bold text-[var(--ink)]">
          Out of hearts
        </h1>
        <p className="mt-2 text-[var(--ink)]/70">
          Take a breath, refill, and keep the diaspora connection going.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn-primary" onClick={restoreHearts}>
            Refill hearts
          </button>
          <Link href={`/learn/${dialect.id}`} className="btn-ghost">
            Back to path
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    const accuracy = Math.round(
      (finalCorrect / lesson.exercises.length) * 100,
    );
    return (
      <div className="relative mx-auto flex min-h-[80vh] max-w-lg flex-col items-center justify-center px-4 text-center">
        <div className="celebrate-burst pointer-events-none absolute inset-0" />
        <p className="font-display text-5xl animate-pop">✨</p>
        <h1 className="mt-4 font-display text-4xl font-bold text-[var(--ink)]">
          Lesson complete
        </h1>
        <p className="mt-2 text-lg text-[var(--ink)]/70">
          +{lesson.xp} XP in {dialect.nativeName}
        </p>
        <div className="mt-8 grid w-full grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/80 px-4 py-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ink)]/50">
              Accuracy
            </p>
            <p className="mt-1 font-display text-3xl font-bold text-[var(--lagoon)]">
              {accuracy}%
            </p>
          </div>
          <div className="rounded-2xl bg-white/80 px-4 py-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ink)]/50">
              Streak
            </p>
            <p className="mt-1 font-display text-3xl font-bold text-[var(--flame)]">
              {progress.streak}🔥
            </p>
          </div>
        </div>
        {lesson.culturalNote && (
          <p className="mt-6 rounded-2xl border border-[var(--mango)]/30 bg-[var(--mango)]/10 px-4 py-3 text-left text-sm text-[var(--ink)]/80">
            <span className="font-bold text-[var(--mango)]">Culture note · </span>
            {lesson.culturalNote}
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={`/learn/${dialect.id}`} className="btn-primary">
            Continue path
          </Link>
          <Link href="/profile" className="btn-ghost">
            View profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-4 pb-8 pt-4 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/learn/${dialect.id}`}
          className="rounded-full px-2 py-1 text-xl text-[var(--ink)]/50 transition hover:bg-[var(--ink)]/5 hover:text-[var(--ink)]"
          aria-label="Close lesson"
        >
          ✕
        </Link>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--ink)]/10">
          <div
            className="h-full rounded-full bg-[var(--lagoon)] transition-all duration-500 ease-out"
            style={{
              width: `${feedback && index === lesson.exercises.length - 1 && locked ? 100 : pct}%`,
            }}
          />
        </div>
        <span className="text-sm font-bold text-[var(--hibiscus)]">
          ❤ {progress.hearts}
        </span>
      </div>

      <p className="text-sm font-semibold text-[var(--ink)]/50">
        {unitTitle} · {lesson.title}
      </p>

      <div className="mt-6 flex-1 animate-rise" key={exercise.id}>
        <ExerciseRouter
          exercise={exercise}
          locked={locked}
          onAnswer={handleAnswer}
        />
        {exercise.tip && !locked && (
          <p className="mt-6 text-sm text-[var(--ink)]/55">{exercise.tip}</p>
        )}
      </div>

      {feedback && (
        <div
          className={`mt-4 animate-rise rounded-2xl px-4 py-4 ${
            feedback === "correct"
              ? "bg-[var(--palm)]/15 text-[var(--palm)]"
              : "bg-[var(--hibiscus)]/10 text-[var(--hibiscus)]"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-xl font-bold">
              {feedback === "correct" ? "Nice!" : "Not quite"}
            </p>
            {exercise.type !== "match_pairs" || feedback === "correct" ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => advance(feedback === "correct")}
              >
                Continue
              </button>
            ) : null}
          </div>
          {feedback === "wrong" && exercise.type !== "match_pairs" && (
            <p className="mt-1 text-sm font-medium text-[var(--ink)]/70">
              Correct:{" "}
              <span className="font-bold text-[var(--ink)]">
                {"answer" in exercise
                  ? exercise.answer
                  : "blank" in exercise
                    ? exercise.blank
                    : ""}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ExerciseRouter({
  exercise,
  locked,
  onAnswer,
}: {
  exercise: Exercise;
  locked: boolean;
  onAnswer: (correct: boolean) => void;
}) {
  switch (exercise.type) {
    case "multiple_choice":
      return (
        <MultipleChoiceView
          exercise={exercise}
          locked={locked}
          onAnswer={(c) => onAnswer(c)}
        />
      );
    case "translate":
      return (
        <TranslateView
          exercise={exercise}
          locked={locked}
          onAnswer={(c) => onAnswer(c)}
        />
      );
    case "fill_blank":
      return (
        <FillBlankView
          exercise={exercise}
          locked={locked}
          onAnswer={(c) => onAnswer(c)}
        />
      );
    case "match_pairs":
      return (
        <MatchPairsView
          exercise={exercise}
          locked={locked}
          onAnswer={(c) => onAnswer(c)}
        />
      );
  }
}
