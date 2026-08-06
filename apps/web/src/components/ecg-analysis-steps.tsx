import { Panel, Tag } from "@/components/ui";
import { ecgAnalysisSteps } from "@/data/reading-list";

export function EcgAnalysisSteps() {
  return (
    <Panel className="ecg-grid">
      <Tag>CSCT ECG Analysis Study Guide</Tag>
      <h2 className="mt-3 font-display text-2xl text-navy">Systematic read every tracing</h2>
      <p className="mt-2 text-sm text-navy/65">
        Before naming a rhythm, complete this checklist from the official study guide.
      </p>
      <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ecgAnalysisSteps.map((step, i) => (
          <li
            key={step.id}
            className="rounded-xl border border-[var(--line)] bg-white/80 px-3 py-3"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-deep">
              {i + 1}. {step.label}
            </p>
            <p className="mt-1 text-sm text-navy/70">{step.tip}</p>
          </li>
        ))}
      </ol>
      <a
        href="https://www.csct.ca/ECG-Analysis-Study-Guide"
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex text-sm font-semibold text-teal-deep hover:underline"
      >
        Open official ECG Analysis Study Guide ↗
      </a>
    </Panel>
  );
}
