import Link from "next/link";
import { Panel, SectionTitle, Tag } from "@/components/ui";
import { blueprintTopics } from "@/data/blueprint";
import { questionsForTopic } from "@/data/questions";

export default function QuizIndexPage() {
  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Practice"
        title="Quiz by blueprint topic"
        subtitle="Includes single-answer and multiple-select items — the same formats used on the CSCT exam."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {blueprintTopics.map((topic) => {
          const count = questionsForTopic(topic.id).length;
          return (
            <Link key={topic.id} href={`/app/quiz/${topic.id}`}>
              <Panel className="h-full transition hover:border-teal/40">
                <div className="flex items-center justify-between gap-2">
                  <Tag>{topic.code}</Tag>
                  <span className="text-xs text-navy/50">{count} questions</span>
                </div>
                <h2 className="mt-3 font-display text-xl text-navy">{topic.title}</h2>
                <p className="mt-2 text-sm text-navy/60">{topic.weightPercent}% of exam weighting</p>
              </Panel>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
