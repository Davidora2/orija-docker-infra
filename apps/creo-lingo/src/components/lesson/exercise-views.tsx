"use client";

import { useMemo, useState } from "react";
import type {
  FillBlankExercise,
  MatchPairsExercise,
  MultipleChoiceExercise,
  TranslateExercise,
} from "@/lib/types";

function OptionButton({
  label,
  selected,
  status,
  onClick,
  disabled,
}: {
  label: string;
  selected?: boolean;
  status?: "idle" | "correct" | "wrong";
  onClick: () => void;
  disabled?: boolean;
}) {
  const tone =
    status === "correct"
      ? "border-[var(--palm)] bg-[var(--palm)]/15 text-[var(--ink)]"
      : status === "wrong"
        ? "border-[var(--hibiscus)] bg-[var(--hibiscus)]/10 text-[var(--ink)]"
        : selected
          ? "border-[var(--lagoon)] bg-[var(--lagoon)]/10 text-[var(--ink)]"
          : "border-[var(--ink)]/12 bg-white hover:border-[var(--lagoon)]/50";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-2xl border-2 px-4 py-3.5 text-left text-base font-semibold shadow-[0_2px_0_rgba(18,40,36,0.08)] transition-all active:translate-y-[1px] active:shadow-none disabled:opacity-60 ${tone}`}
    >
      {label}
    </button>
  );
}

export function MultipleChoiceView({
  exercise,
  locked,
  onAnswer,
}: {
  exercise: MultipleChoiceExercise;
  locked: boolean;
  onAnswer: (correct: boolean, value: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--lagoon)]">
          Choose the meaning
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">
          {exercise.prompt}
        </h2>
        {exercise.promptDialect && (
          <p className="mt-3 font-display text-xl text-[var(--lagoon)]">
            {exercise.promptDialect}
          </p>
        )}
      </div>
      <div className="grid gap-3">
        {exercise.options.map((option) => {
          let status: "idle" | "correct" | "wrong" = "idle";
          if (locked && picked === option) {
            status = option === exercise.answer ? "correct" : "wrong";
          } else if (locked && option === exercise.answer) {
            status = "correct";
          }
          return (
            <OptionButton
              key={option}
              label={option}
              selected={picked === option}
              status={status}
              disabled={locked}
              onClick={() => {
                setPicked(option);
                onAnswer(option === exercise.answer, option);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function TranslateView({
  exercise,
  locked,
  onAnswer,
}: {
  exercise: TranslateExercise;
  locked: boolean;
  onAnswer: (correct: boolean, value: string) => void;
}) {
  const [value, setValue] = useState("");

  const check = () => {
    const normalized = value.trim().toLowerCase();
    const accepted = [
      exercise.answer,
      ...(exercise.acceptedAnswers ?? []),
    ].map((a) => a.toLowerCase());
    onAnswer(accepted.includes(normalized), value.trim());
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--lagoon)]">
          {exercise.direction === "to_dialect"
            ? "Translate to dialect"
            : "Translate to English"}
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">
          {exercise.prompt}
        </h2>
      </div>
      <div className="space-y-3">
        <input
          value={value}
          disabled={locked}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim() && !locked) check();
          }}
          placeholder="Type your answer…"
          className="w-full rounded-2xl border-2 border-[var(--ink)]/12 bg-white px-4 py-4 text-lg font-semibold text-[var(--ink)] outline-none transition focus:border-[var(--lagoon)]"
        />
        {!locked && (
          <button
            type="button"
            disabled={!value.trim()}
            onClick={check}
            className="btn-primary w-full sm:w-auto"
          >
            Check
          </button>
        )}
      </div>
    </div>
  );
}

export function FillBlankView({
  exercise,
  locked,
  onAnswer,
}: {
  exercise: FillBlankExercise;
  locked: boolean;
  onAnswer: (correct: boolean, value: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const parts = exercise.sentence.split("___");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--lagoon)]">
          Fill the blank
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">
          {exercise.prompt}
        </h2>
        <p className="mt-4 rounded-2xl bg-white/70 px-4 py-4 font-display text-xl font-semibold text-[var(--ink)]">
          {parts[0]}
          <span className="mx-1 inline-block min-w-20 border-b-2 border-dashed border-[var(--lagoon)] text-center text-[var(--lagoon)]">
            {picked ?? "…"}
          </span>
          {parts[1]}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {exercise.options.map((option) => {
          let status: "idle" | "correct" | "wrong" = "idle";
          if (locked && picked === option) {
            status = option === exercise.blank ? "correct" : "wrong";
          } else if (locked && option === exercise.blank) {
            status = "correct";
          }
          return (
            <button
              key={option}
              type="button"
              disabled={locked}
              onClick={() => {
                setPicked(option);
                onAnswer(option === exercise.blank, option);
              }}
              className={`rounded-2xl border-2 px-4 py-3 text-base font-semibold transition ${
                status === "correct"
                  ? "border-[var(--palm)] bg-[var(--palm)]/15"
                  : status === "wrong"
                    ? "border-[var(--hibiscus)] bg-[var(--hibiscus)]/10"
                    : picked === option
                      ? "border-[var(--lagoon)] bg-[var(--lagoon)]/10"
                      : "border-[var(--ink)]/12 bg-white hover:border-[var(--lagoon)]/50"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MatchPairsView({
  exercise,
  locked,
  onAnswer,
}: {
  exercise: MatchPairsExercise;
  locked: boolean;
  onAnswer: (correct: boolean, value: string) => void;
}) {
  const leftItems = useMemo(
    () => exercise.pairs.map((p) => p.left),
    [exercise.pairs],
  );
  const rightItems = useMemo(() => {
    const rights = exercise.pairs.map((p) => p.right);
    return [...rights].sort((a, b) => a.localeCompare(b));
  }, [exercise.pairs]);

  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<Record<string, string>>({});
  const [wrongPair, setWrongPair] = useState<[string, string] | null>(null);

  const map = useMemo(() => {
    const m = new Map<string, string>();
    exercise.pairs.forEach((p) => m.set(p.left, p.right));
    return m;
  }, [exercise.pairs]);

  const tryMatch = (right: string) => {
    if (!selectedLeft || locked) return;
    const expected = map.get(selectedLeft);
    if (expected === right) {
      const next = { ...matched, [selectedLeft]: right };
      setMatched(next);
      setSelectedLeft(null);
      setWrongPair(null);
      if (Object.keys(next).length === exercise.pairs.length) {
        onAnswer(true, "matched");
      }
    } else {
      setWrongPair([selectedLeft, right]);
      setTimeout(() => {
        setWrongPair(null);
        setSelectedLeft(null);
      }, 500);
      onAnswer(false, right);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--lagoon)]">
          Match pairs
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">
          {exercise.prompt}
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-3">
          {leftItems.map((item) => {
            const done = Boolean(matched[item]);
            const selected = selectedLeft === item;
            const wrong = wrongPair?.[0] === item;
            return (
              <button
                key={item}
                type="button"
                disabled={done || locked}
                onClick={() => setSelectedLeft(item)}
                className={`w-full rounded-2xl border-2 px-3 py-3 text-sm font-semibold sm:text-base ${
                  done
                    ? "border-[var(--palm)] bg-[var(--palm)]/15 opacity-70"
                    : wrong
                      ? "border-[var(--hibiscus)] bg-[var(--hibiscus)]/10"
                      : selected
                        ? "border-[var(--lagoon)] bg-[var(--lagoon)]/10"
                        : "border-[var(--ink)]/12 bg-white"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
        <div className="space-y-3">
          {rightItems.map((item) => {
            const done = Object.values(matched).includes(item);
            const wrong = wrongPair?.[1] === item;
            return (
              <button
                key={item}
                type="button"
                disabled={done || locked || !selectedLeft}
                onClick={() => tryMatch(item)}
                className={`w-full rounded-2xl border-2 px-3 py-3 text-sm font-semibold sm:text-base ${
                  done
                    ? "border-[var(--palm)] bg-[var(--palm)]/15 opacity-70"
                    : wrong
                      ? "border-[var(--hibiscus)] bg-[var(--hibiscus)]/10"
                      : "border-[var(--ink)]/12 bg-white disabled:opacity-40"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
