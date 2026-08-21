import {
  PRIORITY_MATRIX_ORDER,
  PRIORITY_QUADRANT_META,
  actionPriorityQuadrant,
  type PriorityQuadrant,
} from "../lib/priority-matrix";
import type { LifeItem } from "../lib/api";
import { useState } from "react";

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

function hoursOf(action: LifeItem) {
  const value = action.body.hours;
  return typeof value === "number" ? value : 1;
}

export function PriorityMatrixPanel({
  actions,
  projects,
  busy,
  onMove,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const projectById = new Map(projects.map((project) => [project.id, project]));

  return (
    <article className="space-y-4 rounded-2xl border border-[#dde2dd] bg-white p-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
          Priority matrix
        </p>
        <h2 className="mt-1 font-serif text-2xl">Actions by focus</h2>
        <p className="mt-1 text-sm text-[#6c7771]">
          {selectedId
            ? "Click a quadrant to place the selected action."
            : "Select an action, then click a quadrant to move it. No dropdowns."}
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
          const hours = quadrantActions.reduce(
            (sum, action) => sum + hoursOf(action),
            0,
          );
          return (
            <div
              key={id}
              role={selectedId ? "button" : undefined}
              tabIndex={selectedId ? 0 : undefined}
              onClick={() => {
                if (!selectedId || busy) return;
                const action = actions.find((item) => item.id === selectedId);
                if (!action) return;
                onMove(action, id);
                setSelectedId(null);
              }}
              onKeyDown={(event) => {
                if (!selectedId || busy) return;
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                const action = actions.find((item) => item.id === selectedId);
                if (!action) return;
                onMove(action, id);
                setSelectedId(null);
              }}
              className={`rounded-2xl border p-4 text-left transition ${QUADRANT_TONE[id]} ${
                selectedId
                  ? "cursor-pointer ring-1 ring-[#14241f]/15 hover:ring-[#14241f]/35"
                  : ""
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#14241f]/70">
                {meta.subtitle}
              </p>
              <h3 className="mt-1 font-serif text-xl text-[#14241f]">
                {meta.title}
              </h3>
              <p className="mt-1 text-xs font-bold text-[#617a57]">
                {quadrantActions.length} actions · {hours.toFixed(1)}h
              </p>
              <p className="mt-1 text-sm text-[#6c7771]">{meta.description}</p>
              <div className="mt-3 space-y-2">
                {quadrantActions.length === 0 ? (
                  <p className="text-sm text-[#6c7771]/80">No actions here.</p>
                ) : (
                  quadrantActions.map((action) => {
                    const project = projectById.get(action.parentId ?? "");
                    const selected = selectedId === action.id;
                    return (
                      <div
                        key={action.id}
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedId((current) =>
                            current === action.id ? null : action.id,
                          );
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            setSelectedId((current) =>
                              current === action.id ? null : action.id,
                            );
                          }
                        }}
                        className={`rounded-xl border bg-white/90 px-3 py-2 ${
                          selected
                            ? "border-[#14241f] ring-2 ring-[#14241f]/20"
                            : "border-[#dde2dd]/80"
                        }`}
                      >
                        <p className="font-semibold text-[#14241f]">
                          {action.title}
                        </p>
                        <p className="text-xs text-[#6c7771]">
                          {hoursOf(action)}h
                          {project ? ` · ${project.title}` : ""}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}
