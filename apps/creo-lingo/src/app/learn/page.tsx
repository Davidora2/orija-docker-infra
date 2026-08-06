"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { dialects } from "@/data/curriculum";
import { useProgress } from "@/components/progress-provider";

export default function LearnIndexPage() {
  const router = useRouter();
  const { progress, ready } = useProgress();

  useEffect(() => {
    if (!ready) return;
    if (progress.activeDialectId) {
      router.replace(`/learn/${progress.activeDialectId}`);
    }
  }, [ready, progress.activeDialectId, router]);

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-[var(--ink)]/50">
        Loading your path…
      </div>
    );
  }

  if (progress.activeDialectId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-[var(--ink)]/50">
        Opening your path…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <h1 className="font-display text-4xl font-bold text-[var(--ink)]">
        Where should we begin?
      </h1>
      <p className="mt-3 text-lg text-[var(--ink)]/70">
        Choose a dialect to unlock your first lesson path.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {dialects.slice(0, 3).map((d) => (
          <Link
            key={d.id}
            href={`/learn/${d.id}`}
            className="btn-ghost"
          >
            {d.flagEmoji} {d.nativeName}
          </Link>
        ))}
      </div>
      <Link href="/dialects" className="btn-primary mt-6 inline-flex">
        See all dialects
      </Link>
    </div>
  );
}
