import { notFound } from "next/navigation";
import { StudyModuleActions } from "@/components/study-module-actions";
import { Panel, SectionTitle, Tag } from "@/components/ui";
import { getTopic } from "@/data/blueprint";

export default async function StudyTopicPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  const topic = getTopic(topicId);
  if (!topic) notFound();

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow={`${topic.code} · ${topic.weightPercent}% of exam`}
        title={topic.title}
        subtitle={topic.summary}
      />

      <StudyModuleActions topicId={topic.id} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <Tag>Key points</Tag>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-navy/75">
            {topic.keyPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </Panel>
        <Panel className="ecg-grid">
          <Tag>Study tactics</Tag>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-navy/75">
            {topic.studyTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
