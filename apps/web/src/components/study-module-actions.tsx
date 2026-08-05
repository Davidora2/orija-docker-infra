"use client";

import { useEffect, useState } from "react";
import { loadProgress, markModuleComplete } from "@/lib/progress";
import { GhostLink, PrimaryLink } from "@/components/ui";

export function StudyModuleActions({ topicId }: { topicId: string }) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const p = loadProgress();
    setDone(p.modulesCompleted.includes(topicId));
  }, [topicId]);

  return (
    <div className="flex flex-wrap gap-2">
      <PrimaryLink href={`/app/quiz/${topicId}`}>Practice this topic</PrimaryLink>
      <button
        type="button"
        onClick={() => {
          markModuleComplete(topicId);
          setDone(true);
        }}
        className="rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm font-semibold text-navy"
      >
        {done ? "Marked reviewed ✓" : "Mark as reviewed"}
      </button>
      <GhostLink href="/app/study">Back to path</GhostLink>
    </div>
  );
}
