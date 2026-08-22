"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listWeeklyReviews,
  saveWeeklyReview,
  type WeeklyReview,
} from "../lib/api";
import { FocusHero } from "./focus-hero";
import { CapacityRing } from "./capacity-ring";

type Props = {
  householdId: string;
  completedActions: number;
  totalActions: number;
  plannedHours: number;
  availableHours: number;
  onError: (message: string | null) => void;
};

function mondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getUTCDay();
  now.setUTCDate(now.getUTCDate() - (day === 0 ? 6 : day - 1));
  return now.toISOString().slice(0, 10);
}

function ReviewSummary({ review }: { review: WeeklyReview }) {
  return (
    <article className="space-y-2 rounded-2xl border border-[#dde2dd] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
            Week of {review.weekStart}
          </p>
          <h3 className="font-serif text-xl">
            {review.results.completedActions}/{review.results.totalActions} actions
            completed
          </h3>
        </div>
        <button
          type="button"
          className="print-hidden rounded-xl border border-[#dde2dd] px-3 py-2 text-xs font-bold"
          onClick={() => window.open(`/reviews/${review.id}`, "_blank", "noopener")}
        >
          Print / PDF
        </button>
      </div>
      {review.results.highlights ? (
        <p className="text-sm text-[#14241f]">{review.results.highlights}</p>
      ) : null}
      <p className="text-sm text-[#6c7771]">
        Capacity {review.capacity.plannedHours}h / {review.capacity.availableHours}h
      </p>
      {review.bottlenecks ? (
        <p className="text-sm">
          <strong>Bottlenecks:</strong> {review.bottlenecks}
        </p>
      ) : null}
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <p>
          <strong>Start:</strong> {review.startDoing || "—"}
        </p>
        <p>
          <strong>Stop:</strong> {review.stopDoing || "—"}
        </p>
        <p>
          <strong>Continue:</strong> {review.continueDoing || "—"}
        </p>
      </div>
      {review.nextWeekPriorities.length ? (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
            Next-week priorities
          </p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
            {review.nextWeekPriorities.map((priority) => (
              <li key={priority}>{priority}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </article>
  );
}

export function WeeklyReviewPanel({
  householdId,
  completedActions,
  totalActions,
  plannedHours,
  availableHours,
  onError,
}: Props) {
  const [history, setHistory] = useState<WeeklyReview[]>([]);
  const [highlights, setHighlights] = useState("");
  const [bottlenecks, setBottlenecks] = useState("");
  const [startDoing, setStartDoing] = useState("");
  const [stopDoing, setStopDoing] = useState("");
  const [continueDoing, setContinueDoing] = useState("");
  const [priorities, setPriorities] = useState(["", "", ""]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setHistory(await listWeeklyReviews());
  }, []);

  useEffect(() => {
    void load().catch((error) =>
      onError(error instanceof Error ? error.message : "Could not load review history."),
    );
  }, [load, onError]);

  async function save() {
    setBusy(true);
    onError(null);
    try {
      const review = await saveWeeklyReview({
        schemaVersion: 1,
        householdId,
        weekStart: mondayOfCurrentWeek(),
        results: {
          completedActions,
          totalActions,
          completionRate:
            totalActions === 0 ? 0 : Math.round((completedActions / totalActions) * 100),
          highlights,
        },
        capacity: { plannedHours, availableHours },
        bottlenecks,
        startDoing,
        stopDoing,
        continueDoing,
        nextWeekPriorities: priorities.map((value) => value.trim()).filter(Boolean),
      });
      await load();
      window.open(`/reviews/${review.id}`, "_blank", "noopener");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save weekly review.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <FocusHero
        accentDot
        eyebrow={`Results · week of ${mondayOfCurrentWeek()}`}
        meta={`${totalActions === 0 ? 0 : Math.round((completedActions / totalActions) * 100)}% complete · ${plannedHours.toFixed(1)}h planned / ${availableHours}h available`}
        subtitle="Guided CEO-style check-in"
        title={`${completedActions} completed · ${Math.max(0, totalActions - completedActions)} open`}
      />

      <article className="flex items-center gap-4 rounded-2xl border border-[#dde2dd] bg-white p-5">
        <CapacityRing
          planned={plannedHours}
          available={availableHours}
          label="Weekly review planned capacity"
        />
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
            Capacity ring
          </p>
          <h2 className="mt-2 font-serif text-xl">
            {plannedHours.toFixed(1)}h planned / {availableHours}h available
          </h2>
          <p className="text-sm text-[#6c7771]">
            Completion{" "}
            {totalActions === 0
              ? 0
              : Math.round((completedActions / totalActions) * 100)}
            % · planned {plannedHours.toFixed(1)}h / {availableHours}h
          </p>
        </div>
      </article>

      <article className="space-y-4 rounded-2xl border border-[#dde2dd] bg-white p-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
            Guided review · week of {mondayOfCurrentWeek()}
          </p>
          <h2 className="font-serif text-2xl">Reflect, adjust, then choose the week.</h2>
        </div>
        {[
          ["Results & wins", highlights, setHighlights, "What moved forward?"],
          ["Bottlenecks", bottlenecks, setBottlenecks, "What slowed or blocked you?"],
          ["Start", startDoing, setStartDoing, "What will you start doing?"],
          ["Stop", stopDoing, setStopDoing, "What will you stop doing?"],
          ["Continue", continueDoing, setContinueDoing, "What is working?"],
        ].map(([label, value, setter, placeholder]) => (
          <label key={label as string} className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
              {label as string}
            </span>
            <textarea
              className="min-h-20 w-full rounded-xl border border-[#dde2dd] px-3 py-3"
              value={value as string}
              placeholder={placeholder as string}
              onChange={(event) =>
                (setter as React.Dispatch<React.SetStateAction<string>>)(
                  event.target.value,
                )
              }
            />
          </label>
        ))}
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
            Next-week priorities · up to five
          </p>
          {priorities.map((priority, index) => (
            <input
              key={index}
              className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
              value={priority}
              placeholder={`Priority ${index + 1}`}
              onChange={(event) =>
                setPriorities((current) =>
                  current.map((value, itemIndex) =>
                    itemIndex === index ? event.target.value : value,
                  ),
                )
              }
            />
          ))}
          {priorities.length < 5 ? (
            <button
              type="button"
              className="rounded-xl border border-[#dde2dd] px-3 py-2 text-xs font-bold"
              onClick={() => setPriorities((current) => [...current, ""])}
            >
              Add priority
            </button>
          ) : null}
        </div>
        <button
          type="button"
          disabled={busy}
          className="rounded-xl bg-[#14241f] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save review & open print view"}
        </button>
      </article>

      <div className="space-y-3">
        <h2 className="font-serif text-2xl">Review history</h2>
        {history.length ? (
          history.map((review) => <ReviewSummary key={review.id} review={review} />)
        ) : (
          <p className="rounded-2xl border border-[#dde2dd] bg-white p-5 text-sm text-[#6c7771]">
            Your completed weekly reviews will appear here.
          </p>
        )}
      </div>
    </section>
  );
}
