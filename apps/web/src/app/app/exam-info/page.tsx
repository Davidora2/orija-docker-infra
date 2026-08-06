import { ExamIntelRefresh } from "@/components/exam-intel-client";
import { Panel, SectionTitle } from "@/components/ui";
import { examMeta } from "@/data/exam-meta";

export default function ExamInfoPage() {
  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Exam intel"
        title="Latest CSCT certification details"
        subtitle="Curated from the official CSCT Exam Candidate page and Candidate Guide. Refresh to pull the newest public dates."
      />

      <ExamIntelRefresh initial={examMeta} />

      <Panel>
        <h3 className="font-display text-xl text-navy">Rewrite policy snapshot</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-navy/75">
          <li>Maximum 4 attempts (1 initial + 3 rewrites).</li>
          <li>All attempts must be completed within 2 years of the first attempt.</li>
          <li>
            After exhausting attempts or the two-year window, a new diploma from an accredited
            program is required to re-qualify.
          </li>
        </ul>
      </Panel>
    </div>
  );
}
