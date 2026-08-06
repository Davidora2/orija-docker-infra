"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDialect } from "@/data/curriculum";
import { LearningPath } from "@/components/learning-path";
import { useProgress } from "@/components/progress-provider";

export default function DialectLearnPage({
  params,
}: {
  params: Promise<{ dialect: string }>;
}) {
  const { dialect: dialectId } = use(params);
  const dialect = getDialect(dialectId);
  const { selectDialect, ready } = useProgress();

  useEffect(() => {
    if (dialect) selectDialect(dialect.id);
  }, [dialect, selectDialect]);

  if (!dialect) notFound();

  return (
    <div>
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 pt-4 sm:px-6">
        <Link
          href="/dialects"
          className="text-sm font-bold text-[var(--lagoon)] hover:underline"
        >
          ← Switch dialect
        </Link>
        {!ready && (
          <span className="text-xs text-[var(--ink)]/40">Syncing…</span>
        )}
      </div>
      <LearningPath dialect={dialect} />
    </div>
  );
}
