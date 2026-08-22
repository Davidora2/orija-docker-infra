"use client";

import { useMemo, useState } from "react";
import type { LifeItem } from "../lib/api";
import {
  PRIORITY_MATRIX_ORDER,
  PRIORITY_QUADRANT_META,
  actionPriorityQuadrant,
  type PriorityQuadrant,
} from "../lib/priority-matrix";

type Props = {
  actions: LifeItem[];
  projects: LifeItem[];
  busy: boolean;
  onMove: (action: LifeItem, quadrant: PriorityQuadrant) => void;
  onViewList?: () => void;
};

const QUADRANT_TONE: Record<PriorityQuadrant, string> = {
  DO_FIRST: "border-[#c9634f]/35 bg-[#f8e4df]/50",
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
  onViewList,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const filtered = actions;

  const totalHours = filtered.reduce((sum, action) => sum + hoursOf(action), 0);
  const selected = selectedId
    ? (filtered.find((action) => action.id === selectedId) ?? null)
    : null;

  return (
    <article className="space-y-4">
      <header className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#617a57]">
          Priority matrix
        </p>
        <h2 className="font-serif text-3xl text-[#14241f]">Decide where work lives</h2>
        <p className="max-w-xl text-sm text-[#6c7771]">
          True 2×2 of open actions. Axes are Urgency and Importance — select an
          action, then tap a quadrant to place it.
        </p>
      </header>

      {onViewList ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full border border-[#dde2dd] bg-white px-3 py-1.5 text-xs font-bold"
            onClick={onViewList}
          >
            View list
          </button>
        </div>
      ) : null}

      <div className="rounded-2xl border border-[#dde2dd] bg-white p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.12em] text-[#6c7771]">
          <span className="pl-8">← Not urgent</span>
          <span>Urgent →</span>
        </div>

        <div className="flex gap-2 sm:gap-3">
          <div className="flex w-6 shrink-0 flex-col justify-between py-8 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6c7771] sm:w-8">
            <span
              className="origin-center -rotate-180 whitespace-nowrap"
              style={{ writingMode: "vertical-rl" }}
            >
              Important
            </span>
            <span
              className="origin-center -rotate-180 whitespace-nowrap"
              style={{ writingMode: "vertical-rl" }}
            >
              Not important
            </span>
          </div>

          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:gap-3">
            {PRIORITY_MATRIX_ORDER.map((id) => {
              const meta = PRIORITY_QUADRANT_META[id];
              const quadrantActions = filtered.filter(
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
                <button
                  key={id}
                  type="button"
                  disabled={!selected || busy}
                  onClick={() => {
                    if (!selected || busy) return;
                    onMove(selected, id);
                    setSelectedId(null);
                  }}
                  className={`min-h-[11rem] rounded-2xl border p-3 text-left transition sm:p-4 ${QUADRANT_TONE[id]} ${
                    selected
                      ? "cursor-pointer ring-1 ring-[#14241f]/15 hover:ring-[#14241f]/40"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#14241f]/55">
                        {meta.number}. {meta.subtitle}
                      </p>
                      <h3 className="mt-0.5 font-serif text-xl text-[#14241f]">
                        {meta.label}
                      </h3>
                    </div>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-[#617a57]">
                      {meta.impact}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-[#617a57]">
                    {quadrantActions.length} actions · {hours.toFixed(1)}h
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {quadrantActions.length === 0 ? (
                      <p className="text-sm text-[#6c7771]/80">No actions here.</p>
                    ) : (
                      quadrantActions.slice(0, 3).map((action) => {
                        const project = projectById.get(action.parentId ?? "");
                        const isSelected = selectedId === action.id;
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
                            className={`rounded-xl border bg-white/95 px-2.5 py-1.5 ${
                              isSelected
                                ? "border-[#14241f] ring-2 ring-[#14241f]/20"
                                : "border-[#dde2dd]/80"
                            }`}
                          >
                            <p className="truncate text-sm font-semibold text-[#14241f]">
                              {action.title}
                            </p>
                            <p className="truncate text-[11px] text-[#6c7771]">
                              {hoursOf(action)}h
                              {project ? ` · ${project.title}` : ""}
                            </p>
                          </div>
                        );
                      })
                    )}
                    {quadrantActions.length > 3 ? (
                      <p className="text-[11px] font-bold text-[#617a57]">
                        View all ({quadrantActions.length})
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-[#dde2dd] bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
            Planned this week
          </p>
          <p className="mt-1 font-serif text-2xl text-[#14241f]">
            {totalHours.toFixed(1)}h
          </p>
          <p className="text-xs text-[#6c7771]">{filtered.length} open actions</p>
        </article>
        <article className="rounded-2xl border border-[#dde2dd] bg-white p-4 sm:col-span-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
            Focus tip
          </p>
          <p className="mt-1 text-sm text-[#14241f]">
            {selected
              ? `Place "${selected.title}" into the quadrant that matches Importance × Urgency.`
              : "Protect Do Now for high-importance, high-urgency work. Schedule the rest of what matters."}
          </p>
        </article>
      </div>
    </article>
  );
}
