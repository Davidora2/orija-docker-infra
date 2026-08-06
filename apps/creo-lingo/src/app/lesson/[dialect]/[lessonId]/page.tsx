"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { getLesson } from "@/data/curriculum";
import { LessonPlayer } from "@/components/lesson/lesson-player";

export default function LessonPage({
  params,
}: {
  params: Promise<{ dialect: string; lessonId: string }>;
}) {
  const { dialect, lessonId } = use(params);
  const data = getLesson(dialect, lessonId);
  if (!data) notFound();

  return (
    <div className="min-h-[100dvh] bg-[linear-gradient(180deg,#f7fcfa_0%,#eef7f4_100%)]">
      <LessonPlayer
        dialect={data.dialect}
        lesson={data.lesson}
        unitTitle={data.unitTitle}
      />
    </div>
  );
}
