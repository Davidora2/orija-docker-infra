import { Panel, SectionTitle } from "@/components/ui";
import { examMeta } from "@/data/exam-meta";

export default function ResourcesPage() {
  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Resources"
        title="Official CSCT links"
        subtitle="Always verify against csct.ca — TraceReady organizes the material; CSCT publishes the source of truth."
      />
      <div className="grid gap-3">
        {examMeta.officialLinks.map((link) => (
          <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
            <Panel className="transition hover:border-teal/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl text-navy">{link.label}</h2>
                  {link.note ? (
                    <p className="mt-1 text-sm text-navy/60">{link.note}</p>
                  ) : null}
                </div>
                <span className="text-sm text-teal-deep">Open ↗</span>
              </div>
            </Panel>
          </a>
        ))}
      </div>
    </div>
  );
}
