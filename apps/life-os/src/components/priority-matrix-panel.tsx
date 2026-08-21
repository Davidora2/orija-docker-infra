import {
  PRIORITY_MATRIX_ORDER,
  PRIORITY_QUADRANT_META,
  actionBodyWithFlags,
  actionPriorityQuadrant,
  flagsFromQuadrant,
  type PriorityQuadrant,
} from "../lib/priority-matrix";
import type { LifeItem } from "../lib/api";

type Props = {
  actions: LifeItem[];
  projects: LifeItem[];
  busy: boolean;
  onMove: (action: LifeItem, quadrant: PriorityQuadrant) => void;
};

const QUADRANT_TONE: Record<PriorityQuadrant, string> = {
  DO_FIRST: "border-[#c9634f]/30 bg-[#f8e4df]/40",
  SCHEDULE: "border-[#617a57]/35 bg-[#eef3ea]",
  DELEGATE: "border-[#b08a3c]/40 bg-[#f7f1e4]",
  ELIMINATE: "border-[#dde2dd] bg-[#f7f8f5]",
};

export function PriorityMatrixPanel({
  actions,
  projects,
  busy,
  onMove,
}: Props) {
  const projectById = new Map(projects.map((project) => [project.id, project]));

  return (
    <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-4">
      <div>
        <h2 className="font-serif text-2xl">Action matrix</h2>
        <p className="mt-1 text-sm text-[#6c7771]">
          Eisenhower view of open actions (Important × Urgent). Projects use
          High / Medium / Low only.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PRIORITY_MATRIX_ORDER.map((id) => {
          const meta = PRIORITY_QUADRANT_META[id];
          const quadrantActions = actions.filter(
            (action) =>
              actionPriorityQuadrant(
                action.body,
                projectById.get(action.parentId ?? "")?.body,
              ) === id,
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
                {quadrantActions.length === 0 ? (
                  <p className="text-sm text-[#6c7771]/80">No actions here.</p>
                ) : (
                  quadrantActions.map((action) => (
                    <div
                      key={action.id}
                      className="rounded-xl border border-[#dde2dd]/80 bg-white/90 px-3 py-2"
                    >
                      <p className="font-semibold text-[#14241f]">
                        {action.title}
                      </p>
                      <label className="mt-2 block text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
                        Move to
                        <select
                          className="mt-1 w-full rounded-lg border border-[#dde2dd] bg-white px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-[#14241f]"
                          value={id}
                          disabled={busy}
                          onChange={(e) =>
                            onMove(action, e.target.value as PriorityQuadrant)
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
