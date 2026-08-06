import { notFound } from "next/navigation";
import { QuizEngine } from "@/components/quiz-engine";
import { SectionTitle } from "@/components/ui";
import { getTopic } from "@/data/blueprint";
import { questionsForTopic } from "@/data/questions";

export default async function QuizTopicPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  const topic = getTopic(topicId);
  if (!topic) notFound();
  const items = questionsForTopic(topicId);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <SectionTitle
        eyebrow={`Practice · ${topic.code}`}
        title={topic.title}
        subtitle={`${items.length} questions · shuffled each session`}
      />
      <QuizEngine topicId={topic.id} title={topic.title} items={items} />
    </div>
  );
}
