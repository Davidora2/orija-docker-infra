"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { dialects } from "@/data/curriculum";
import { useProgress } from "@/components/progress-provider";

export default function DialectsPage() {
  const router = useRouter();
  const { progress, selectDialect, ready } = useProgress();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--lagoon)]">
        Choose your tongue
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold text-[var(--ink)]">
        Dialects of home
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-[var(--ink)]/70">
        Pick a Creole or Pidgin to begin. Your progress stays on this device —
        switch anytime.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {dialects.map((dialect, i) => {
          const xp = progress.dialects[dialect.id]?.xp ?? 0;
          const active = progress.activeDialectId === dialect.id;
          return (
            <button
              key={dialect.id}
              type="button"
              onClick={() => {
                selectDialect(dialect.id);
                router.push(`/learn/${dialect.id}`);
              }}
              className="group animate-rise rounded-[1.75rem] border-2 border-[var(--ink)]/8 bg-white/70 p-5 text-left shadow-[0_10px_30px_rgba(20,40,36,0.06)] transition hover:-translate-y-0.5 hover:border-[var(--lagoon)]/40 hover:bg-white"
              style={{
                animationDelay: `${i * 60}ms`,
                borderColor: active ? dialect.accent : undefined,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-3xl" aria-hidden>
                    {dialect.flagEmoji}
                  </p>
                  <h2 className="mt-3 font-display text-2xl font-bold text-[var(--ink)]">
                    {dialect.name}
                  </h2>
                  <p className="font-semibold" style={{ color: dialect.accent }}>
                    {dialect.nativeName}
                  </p>
                </div>
                {active && (
                  <span className="rounded-full bg-[var(--lagoon)] px-2.5 py-1 text-xs font-bold text-white">
                    Active
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm text-[var(--ink)]/65">{dialect.blurb}</p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-wide text-[var(--ink)]/45">
                <span>{dialect.region}</span>
                <span>{dialect.learners}</span>
                <span>{ready ? `${xp} XP` : "— XP"}</span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-8 text-sm text-[var(--ink)]/50">
        Prefer to jump back in?{" "}
        <Link href="/learn" className="font-bold text-[var(--lagoon)] underline-offset-2 hover:underline">
          Go to your learning path
        </Link>
      </p>
    </div>
  );
}
