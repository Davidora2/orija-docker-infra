import Link from "next/link";
import { Panel, SectionTitle, Tag, WeightBar } from "@/components/ui";
import { blueprintAreas, topicsByPriority } from "@/data/blueprint";

export default function StudyPathPage() {
  const topics = topicsByPriority();

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Study path"
        title="Follow the exam blueprint"
        subtitle="Weights come from the CSCT National Certification Exam Blueprint (2014 NOCP revisions), ±2%."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {blueprintAreas.map((area) => (
          <Panel key={area.id}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-navy/50">
              {area.title}
            </p>
            <p className="mt-2 font-display text-3xl text-navy">{area.weightPercent}%</p>
            {"note" in area && area.note ? (
              <p className="mt-2 text-xs text-navy/55">{area.note}</p>
            ) : null}
          </Panel>
        ))}
      </div>

      <div className="space-y-3">
        {topics.map((topic, i) => (
          <Link key={topic.id} href={`/app/study/${topic.id}`}>
            <Panel className="transition hover:border-teal/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag>
                      #{i + 1} · {topic.code}
                    </Tag>
                    <span className="text-xs font-semibold text-navy/45">
                      {topic.weightPercent}% of exam
                    </span>
                  </div>
                  <h2 className="mt-2 font-display text-2xl text-navy">{topic.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm text-navy/65">{topic.summary}</p>
                </div>
                <div className="w-full max-w-[180px]">
                  <WeightBar percent={topic.weightPercent} label="Blueprint weight" />
                </div>
              </div>
            </Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}
