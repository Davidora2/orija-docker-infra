import {
  PRIORITY_MATRIX_ORDER,
  PRIORITY_QUADRANT_META,
  type PriorityQuadrant,
  projectPriorityQuadrant,
} from "../lib/priority-matrix";
import type { LifeItem } from "../lib/api";

type Props = {
  projects: LifeItem[];
  busy: boolean;
  onMove: (project: LifeItem, quadrant: PriorityQuadrant) => void;
};

const QUADRANT_TONE: Record<PriorityQuadrant, string> = {
  DO_FIRST: "border-[#c9634f]/30 bg-[#f8e4df]/40",
  SCHEDULE: "border-[#617a57]/35 bg-[#eef3ea]",
  DELEGATE: "border-[#b08a3c]/40 bg-[#f7f1e4]",
  ELIMINATE: "border-[#dde2dd] bg-[#f7f8f5]",
};

export function PriorityMatrixPanel({ projects, busy, onMove }: Props) {
  return (
    <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-4">
      <div>
        <h2 className="font-serif text-2xl">Priority matrix</h2>
        <p className="mt-1 text-sm text-[#6c7771]">
          Sort projects by urgency and importance (Eisenhower). Move items between
          quadrants as priorities change.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PRIORITY_MATRIX_ORDER.map((id) => {
          const meta = PRIORITY_QUADRANT_META[id];
          const quadrantProjects = projects.filter(
            (project) => projectPriorityQuadrant(project.body) === id,
          );
          return (
            <div
              key={id}
              className={`rounded-2xl border p-4 ${QUADRANT_TONE[id]}`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#14241f]/70">
                {meta.subtitle}
              </p>
              <h3 className="mt-1 font-serif text-xl text-[#14241f]">
                {meta.title}
              </h3>
              <p className="mt-1 text-sm text-[#6c7771]">{meta.description}</p>
              <div className="mt-3 space-y-2">
                {quadrantProjects.length === 0 ? (
                  <p className="text-sm text-[#6c7771]/80">No projects here.</p>
                ) : (
                  quadrantProjects.map((project) => (
                    <div
                      key={project.id}
                      className="rounded-xl border border-[#dde2dd]/80 bg-white/90 px-3 py-2"
                    >
                      <p className="font-semibold text-[#14241f]">
                        {project.title}
                      </p>
                      <label className="mt-2 block text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
                        Move to
                        <select
                          className="mt-1 w-full rounded-lg border border-[#dde2dd] bg-white px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-[#14241f]"
                          value={id}
                          disabled={busy}
                          onChange={(e) =>
                            onMove(project, e.target.value as PriorityQuadrant)
                          }
                        >
                          {PRIORITY_MATRIX_ORDER.map((option) => (
                            <option key={option} value={option}>
                              {PRIORITY_QUADRANT_META[option].title}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}
