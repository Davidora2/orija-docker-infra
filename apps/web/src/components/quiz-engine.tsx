"use client";

import { useMemo, useRef, useState } from "react";
import type { Question } from "@/data/questions";
import { saveQuizScore } from "@/lib/progress";
import { cn, shuffle } from "@/lib/utils";
import { Panel } from "@/components/ui";

function isCorrect(question: Question, selected: number[]) {
  return (
    selected.length === question.correct.length &&
    selected.every((s) => question.correct.includes(s))
  );
}

export function QuizEngine({
  topicId,
  title,
  items,
}: {
  topicId: string;
  title: string;
  items: Question[];
}) {
  const questions = useMemo(() => shuffle(items), [items]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState(false);
  const [finalCorrect, setFinalCorrect] = useState(0);
  const scoreRef = useRef(0);

  if (questions.length === 0) {
    return <Panel>No questions for this topic yet.</Panel>;
  }

  const q = questions[index];
  const isMulti = q.type === "multi";
  const isLast = index + 1 >= questions.length;

  function toggleChoice(i: number) {
    if (checked) return;
    if (isMulti) {
      setSelected((prev) =>
        prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
      );
    } else {
      setSelected([i]);
    }
  }

  function checkAnswer() {
    if (selected.length === 0 || checked) return;
    if (isCorrect(q, selected)) {
      scoreRef.current += 1;
    }
    setChecked(true);
  }

  function goNext() {
    if (isLast) {
      const total = scoreRef.current;
      setFinalCorrect(total);
      saveQuizScore(topicId, total, questions.length);
      setDone(true);
      return;
    }
    setIndex((i) => i + 1);
    setSelected([]);
    setChecked(false);
  }

  if (done) {
    const pct = Math.round((finalCorrect / questions.length) * 100);
    return (
      <Panel className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-deep">
          Session complete
        </p>
        <h2 className="mt-2 font-display text-3xl text-navy">{title}</h2>
        <p className="mt-4 text-5xl font-semibold text-coral">{pct}%</p>
        <p className="mt-2 text-navy/65">
          {finalCorrect} of {questions.length} correct
        </p>
        <p className="mt-4 text-sm text-navy/55">
          CSCT pass mark is 65%. Focus weak topics from your Study Path next.
        </p>
        <button
          type="button"
          onClick={() => {
            scoreRef.current = 0;
            setIndex(0);
            setSelected([]);
            setChecked(false);
            setFinalCorrect(0);
            setDone(false);
          }}
          className="mt-6 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white"
        >
          Retry shuffled set
        </button>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-navy/60">
        <span>
          Question {index + 1} / {questions.length}
        </span>
        <span>{isMulti ? "Choose all that apply" : "Single answer"}</span>
      </div>
      <Panel>
        <h2 className="font-display text-2xl text-navy">{q.stem}</h2>
        <div className="mt-5 space-y-2">
          {q.choices.map((choice, i) => {
            const isSelected = selected.includes(i);
            const isCorrectChoice = q.correct.includes(i);
            return (
              <button
                key={choice}
                type="button"
                onClick={() => toggleChoice(i)}
                className={cn(
                  "w-full rounded-xl border px-4 py-3 text-left text-sm transition",
                  !checked && isSelected && "border-teal bg-mist",
                  !checked && !isSelected && "border-[var(--line)] hover:border-teal/50",
                  checked && isCorrectChoice && "border-teal-deep bg-mist",
                  checked && isSelected && !isCorrectChoice && "border-coral bg-[#fceee6]",
                  checked && !isSelected && !isCorrectChoice && "border-[var(--line)] opacity-70",
                )}
              >
                {choice}
              </button>
            );
          })}
        </div>
        {checked ? (
          <div className="mt-5 rounded-xl bg-sand px-4 py-3 text-sm text-navy/80">
            <p className="font-semibold text-navy">Explanation</p>
            <p className="mt-1">{q.explanation}</p>
            {q.source ? (
              <p className="mt-2 text-xs text-navy/50">Source: {q.source}</p>
            ) : null}
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          {!checked ? (
            <button
              type="button"
              onClick={checkAnswer}
              disabled={selected.length === 0}
              className="rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Check
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white"
            >
              {isLast ? "See results" : "Next"}
            </button>
          )}
        </div>
      </Panel>
    </div>
  );
}
