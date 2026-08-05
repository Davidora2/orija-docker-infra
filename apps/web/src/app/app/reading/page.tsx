import { Panel, SectionTitle, Tag } from "@/components/ui";
import { readingList } from "@/data/reading-list";

export default function ReadingListPage() {
  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Recommended reading"
        title="CSCT certification reading list"
        subtitle="Official recommended references for ECG, Holter, ETT, and EP — use these alongside the blueprint-weighted study path."
      />

      <a
        href="https://www.csct.ca/reading-list"
        target="_blank"
        rel="noreferrer"
        className="inline-flex text-sm font-semibold text-teal-deep hover:underline"
      >
        View on csct.ca ↗
      </a>

      <div className="space-y-6">
        {readingList.map((section) => (
          <Panel key={section.id}>
            <div className="flex flex-wrap items-center gap-2">
              <Tag>{section.title}</Tag>
              <span className="text-xs text-navy/45">
                Supports: {section.topicIds.join(", ")}
              </span>
            </div>
            <h2 className="mt-3 font-display text-2xl text-navy">{section.title}</h2>
            <p className="mt-2 text-sm text-navy/65">{section.description}</p>
            <ul className="mt-5 space-y-4">
              {section.items.map((item) => (
                <li
                  key={item.id}
                  className="border-t border-[var(--line)] pt-4 first:border-t-0 first:pt-0"
                >
                  <p className="font-semibold text-navy">{item.title}</p>
                  <p className="mt-1 text-sm text-navy/70">{item.citation}</p>
                  {item.note ? (
                    <p className="mt-1 text-xs text-navy/50">{item.note}</p>
                  ) : null}
                  {item.href ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-sm font-semibold text-teal-deep hover:underline"
                    >
                      Open resource ↗
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </div>
  );
}
