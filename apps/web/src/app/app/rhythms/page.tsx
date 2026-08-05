import { EcgAnalysisSteps } from "@/components/ecg-analysis-steps";
import { RhythmChecklist } from "@/components/rhythm-checklist";
import { SectionTitle } from "@/components/ui";

export default function RhythmsPage() {
  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="ECG analysis"
        title="Rhythm & pattern checklist"
        subtitle="Complete identify-list from the CSCT ECG Analysis Study Guide — mark each topic as you can identify it cold."
      />
      <EcgAnalysisSteps />
      <RhythmChecklist />
    </div>
  );
}
