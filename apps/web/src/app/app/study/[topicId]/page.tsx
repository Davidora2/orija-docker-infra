import { notFound } from "next/navigation";
import { StudyModuleActions } from "@/components/study-module-actions";
import { Panel, SectionTitle, Tag } from "@/components/ui";
import { getTopic } from "@/data/blueprint";
import { readingForTopic } from "@/data/reading-list";

export default async function StudyTopicPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  const topic = getTopic(topicId);
  if (!topic) notFound();
  const readings = readingForTopic(topic.id);

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

      {readings.length > 0 ? (
        <Panel>
          <Tag>Recommended reading</Tag>
          <h3 className="mt-3 font-display text-xl text-navy">From the CSCT reading list</h3>
          <div className="mt-4 space-y-4">
            {readings.flatMap((section) =>
              section.items.map((item) => (
                <div key={`${section.id}-${item.id}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-deep">
                    {section.title}
                  </p>
                  <p className="mt-1 font-semibold text-navy">{item.title}</p>
                  <p className="mt-1 text-sm text-navy/70">{item.citation}</p>
                  {item.href ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex text-sm font-semibold text-teal-deep hover:underline"
                    >
                      Open resource ↗
                    </a>
                  ) : null}
                </div>
              )),
            )}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
