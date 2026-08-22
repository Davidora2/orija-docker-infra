"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getWeeklyReview, type WeeklyReview } from "../../../lib/api";

export default function PrintableWeeklyReviewPage() {
  const params = useParams<{ id: string }>();
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params.id) return;
    void getWeeklyReview(params.id)
      .then(setReview)
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Sign in on the web to print this private review.",
        ),
      );
  }, [params.id]);

  if (error) {
    return (
      <main className="mx-auto max-w-2xl p-8 text-[#14241f]">
        <h1 className="font-serif text-3xl">Private weekly review</h1>
        <p className="mt-3 text-[#8a3d30]">{error}</p>
        <a className="mt-4 inline-block font-bold underline" href="/">
          Sign in to Life OS
        </a>
      </main>
    );
  }

  if (!review) {
    return <main className="p-8 text-[#14241f]">Loading private review…</main>;
  }

  return (
    <main className="print-review mx-auto max-w-3xl space-y-6 bg-white p-8 text-[#14241f]">
      <header className="flex items-start justify-between gap-4 border-b border-[#dde2dd] pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#617a57]">
            Life OS · Weekly Review v{review.schemaVersion}
          </p>
          <h1 className="font-serif text-4xl">Week of {review.weekStart}</h1>
        </div>
        <button
          type="button"
          className="print-hidden rounded-xl bg-[#14241f] px-4 py-3 text-sm font-bold text-white"
          onClick={() => window.print()}
        >
          Print / Save PDF
        </button>
      </header>
      <section className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-[#dde2dd] p-5">
          <p className="text-xs font-bold uppercase text-[#617a57]">Results</p>
          <p className="mt-2 font-serif text-3xl">
            {review.results.completedActions}/{review.results.totalActions}
          </p>
          <p className="text-sm">{review.results.completionRate}% complete</p>
          <p className="mt-3 text-sm">{review.results.highlights || "No highlights added."}</p>
        </article>
        <article className="rounded-2xl border border-[#dde2dd] p-5">
          <p className="text-xs font-bold uppercase text-[#617a57]">Capacity</p>
          <p className="mt-2 font-serif text-3xl">
            {review.capacity.plannedHours}h / {review.capacity.availableHours}h
          </p>
          <p className="text-sm">planned / available</p>
          <p className="mt-3 text-sm">{review.bottlenecks || "No bottlenecks added."}</p>
        </article>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Start", review.startDoing],
          ["Stop", review.stopDoing],
          ["Continue", review.continueDoing],
        ].map(([label, value]) => (
          <article key={label} className="rounded-2xl border border-[#dde2dd] p-5">
            <p className="text-xs font-bold uppercase text-[#617a57]">{label}</p>
            <p className="mt-2 text-sm">{value || "—"}</p>
          </article>
        ))}
      </section>
      <section className="rounded-2xl border border-[#dde2dd] p-5">
        <p className="text-xs font-bold uppercase text-[#617a57]">
          Next-week priorities
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          {review.nextWeekPriorities.length ? (
            review.nextWeekPriorities.map((priority) => (
              <li key={priority}>{priority}</li>
            ))
          ) : (
            <li>No priorities added.</li>
          )}
        </ol>
      </section>
    </main>
  );
}
