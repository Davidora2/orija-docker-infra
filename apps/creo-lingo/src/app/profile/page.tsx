"use client";

import Link from "next/link";
import { dialects } from "@/data/curriculum";
import { useProgress } from "@/components/progress-provider";
import { BrandMark } from "@/components/brand-mark";

export default function ProfilePage() {
  const { progress, ready, restoreHearts } = useProgress();

  const active = dialects.find((d) => d.id === progress.activeDialectId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <BrandMark size="md" href="/learn" />
      <h1 className="mt-6 font-display text-4xl font-bold text-[var(--ink)]">
        Your journey
      </h1>
      <p className="mt-2 text-lg text-[var(--ink)]/70">
        Streaks, XP, and every dialect you&apos;ve touched.
      </p>

      <div className="mt-8 grid grid-cols-3 gap-3">
        {[
          {
            label: "Streak",
            value: ready ? `${progress.streak}` : "—",
            suffix: "days",
            color: "text-[var(--flame)]",
          },
          {
            label: "Total XP",
            value: ready ? `${progress.totalXp}` : "—",
            suffix: "points",
            color: "text-[var(--mango)]",
          },
          {
            label: "Hearts",
            value: ready ? `${progress.hearts}` : "—",
            suffix: "of 5",
            color: "text-[var(--hibiscus)]",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl bg-white/80 px-4 py-5 text-center shadow-[0_8px_24px_rgba(20,40,36,0.05)]"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink)]/45">
              {stat.label}
            </p>
            <p className={`mt-1 font-display text-3xl font-bold ${stat.color}`}>
              {stat.value}
            </p>
            <p className="text-xs text-[var(--ink)]/45">{stat.suffix}</p>
          </div>
        ))}
      </div>

      {progress.hearts < 5 && (
        <button
          type="button"
          onClick={restoreHearts}
          className="btn-ghost mt-4"
        >
          Refill hearts
        </button>
      )}

      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold text-[var(--ink)]">
          Dialects in progress
        </h2>
        <div className="mt-4 space-y-3">
          {dialects.map((dialect) => {
            const d = progress.dialects[dialect.id];
            const lessons = dialect.units.reduce(
              (n, u) => n + u.lessons.length,
              0,
            );
            const done = d?.completedLessons.length ?? 0;
            const pct = lessons ? Math.round((done / lessons) * 100) : 0;
            return (
              <Link
                key={dialect.id}
                href={`/learn/${dialect.id}`}
                className="block rounded-2xl border border-[var(--ink)]/8 bg-white/70 p-4 transition hover:border-[var(--lagoon)]/35"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-bold">
                      {dialect.flagEmoji} {dialect.nativeName}
                    </p>
                    <p className="text-sm text-[var(--ink)]/55">
                      {done}/{lessons} lessons · {d?.xp ?? 0} XP
                    </p>
                  </div>
                  {active?.id === dialect.id && (
                    <span className="text-xs font-bold uppercase text-[var(--lagoon)]">
                      Active
                    </span>
                  )}
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--ink)]/8">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: dialect.accent,
                    }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
