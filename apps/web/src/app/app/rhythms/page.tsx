import { RhythmChecklist } from "@/components/rhythm-checklist";
import { SectionTitle } from "@/components/ui";

export default function RhythmsPage() {
  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="ECG analysis"
        title="Rhythm & pattern checklist"
        subtitle="Mapped to the CSCT ECG Analysis Study Guide categories — mark each topic as you can identify it cold."
      />
      <RhythmChecklist />
    </div>
  );
}
