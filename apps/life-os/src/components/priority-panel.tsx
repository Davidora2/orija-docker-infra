"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { LifeItem } from "../lib/api";
import { PriorityMatrixPanel } from "./priority-matrix-panel";
import {
  PRIORITY_MATRIX_ORDER,
  PRIORITY_QUADRANT_META,
  actionPriorityQuadrant,
  type PriorityQuadrant,
} from "../lib/priority-matrix";

const TIP_STORAGE_KEY = "life-os-priority-tip-dismissed";

const ACCORDION_COPY: Record<
  PriorityQuadrant,
  { title: string; subtitle: string; empty?: string }
> = {
  DO_FIRST: {
    title: "DO NOW",
    subtitle: "Urgent & important",
    empty: "Nothing needs immediate attention.",
  },
  SCHEDULE: {
    title: "SCHEDULE",
    subtitle: "Important, not urgent",
  },
  DELEGATE: {
    title: "DELEGATE",
    subtitle: "Urgent, less important",
  },
  ELIMINATE: {
    title: "DELETE",
    subtitle: "Neither urgent nor important",
  },
};

const AREA_ICONS = ["🌿", "💪", "💼", "🏠", "🎯", "📚", "💚", "✨"];

function hoursOf(action: LifeItem) {
  const value = action.body.hours;
  return typeof value === "number" ? value : 1;
}

function str(item: LifeItem, key: string, fallback = "") {
  const value = item.body[key];
  return typeof value === "string" ? value : fallback;
}

function isThisWeek(action: LifeItem) {
  const day = str(action, "day");
  if (!day) return true;
  return day !== "Later" && day !== "Someday";
}

type Props = {
  pillars: LifeItem[];
  projects: LifeItem[];
  openActions: LifeItem[];
  availableHours: number;
  busy: boolean;
  onMoveAction: (action: LifeItem, quadrant: PriorityQuadrant) => void;
  onCompleteAction: (action: LifeItem) => void;
  onMoveProjectToIdea?: (project: LifeItem) => void;
  onParkAction?: (action: LifeItem) => void;
  preferMatrix?: boolean;
};

function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#14241f]/35 p-3 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-[#f4f5f0] p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-serif text-2xl text-[#14241f]">
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-1 text-sm text-[#6c7771]">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="shrink-0 rounded-full border border-[#dde2dd] bg-white px-3 py-1 text-xs font-bold"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PriorityPanel({
  pillars,
  projects,
  openActions,
  availableHours,
  busy,
  onMoveAction,
  onCompleteAction,
  onMoveProjectToIdea,
  onParkAction,
  preferMatrix = false,
}: Props) {
  const [view, setView] = useState<"list" | "matrix">(
    preferMatrix ? "matrix" : "list",
  );
  const [areaFilter, setAreaFilter] = useState("");
  const [windowFilter, setWindowFilter] = useState<"week" | "all">("week");
  const [filterOpen, setFilterOpen] = useState(false);
  const [quadrantFilter, setQuadrantFilter] = useState<PriorityQuadrant | "">(
    "",
  );
  const [expanded, setExpanded] = useState<Record<PriorityQuadrant, boolean>>({
    DO_FIRST: true,
    SCHEDULE: true,
    DELEGATE: false,
    ELIMINATE: false,
  });
  const [tipDismissed, setTipDismissed] = useState(false);
  const [rebalanceOpen, setRebalanceOpen] = useState(false);

  useEffect(() => {
    try {
      setTipDismissed(localStorage.getItem(TIP_STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (preferMatrix) setView("matrix");
  }, [preferMatrix]);

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const filteredActions = useMemo(() => {
    return openActions.filter((action) => {
      const project = projectById.get(action.parentId ?? "");
      if (areaFilter && project?.parentId !== areaFilter) return false;
      if (windowFilter === "week" && !isThisWeek(action)) return false;
      if (quadrantFilter) {
        const q = actionPriorityQuadrant(action.body, project?.body);
        if (q !== quadrantFilter) return false;
      }
      return true;
    });
  }, [openActions, areaFilter, windowFilter, quadrantFilter, projectById]);

  const plannedHours = filteredActions.reduce(
    (sum, action) => sum + hoursOf(action),
    0,
  );
  const overHours = Math.max(0, plannedHours - availableHours);
  const overCapacity = overHours > 0.05;

  const byQuadrant = useMemo(() => {
    const groups: Record<PriorityQuadrant, LifeItem[]> = {
      DO_FIRST: [],
      SCHEDULE: [],
      DELEGATE: [],
      ELIMINATE: [],
    };
    for (const action of filteredActions) {
      const project = projectById.get(action.parentId ?? "");
      const q = actionPriorityQuadrant(action.body, project?.body);
      groups[q].push(action);
    }
    return groups;
  }, [filteredActions, projectById]);

  const heavyProjects = useMemo(() => {
    const hoursByProject = new Map<string, number>();
    for (const action of filteredActions) {
      if (!action.parentId) continue;
      hoursByProject.set(
        action.parentId,
        (hoursByProject.get(action.parentId) ?? 0) + hoursOf(action),
      );
    }
    return [...hoursByProject.entries()]
      .map(([id, hours]) => ({
        project: projectById.get(id),
        hours,
      }))
      .filter(
        (row): row is { project: LifeItem; hours: number } =>
          Boolean(row.project) && row.hours >= 2,
      )
      .sort((a, b) => b.hours - a.hours);
  }, [filteredActions, projectById]);

  const rankedActions = useMemo(
    () =>
      [...filteredActions].sort((a, b) => hoursOf(b) - hoursOf(a) || a.title.localeCompare(b.title)),
    [filteredActions],
  );

  function dismissTip() {
    setTipDismissed(true);
    try {
      localStorage.setItem(TIP_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function toggle(q: PriorityQuadrant) {
    setExpanded((current) => ({ ...current, [q]: !current[q] }));
  }

  if (view === "matrix") {
    return (
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            className="text-sm font-bold text-[#617a57]"
            onClick={() => setView("list")}
          >
            ← Priority
          </button>
        </div>
        <PriorityMatrixPanel
          actions={openActions}
          projects={projects}
          areas={pillars}
          busy={busy}
          onMove={onMoveAction}
          onViewList={() => setView("list")}
        />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-4xl text-[#14241f]">Priority</h1>
          <p className="mt-1 text-sm leading-snug text-[#6c7771]">
            Focus on what deserves your attention.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-full border border-[#dde2dd] bg-white px-3.5 py-2 text-xs font-bold text-[#14241f]"
          onClick={() => setView("matrix")}
        >
          Matrix
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        <select
          className="max-w-[42%] truncate rounded-full border border-[#dde2dd] bg-white px-3 py-1.5 text-xs font-bold"
          value={areaFilter}
          onChange={(event) => setAreaFilter(event.target.value)}
          aria-label="Filter by area"
        >
          <option value="">All areas</option>
          {pillars.map((pillar) => (
            <option key={pillar.id} value={pillar.id}>
              {pillar.title}
            </option>
          ))}
        </select>
        <select
          className="rounded-full border border-[#dde2dd] bg-white px-3 py-1.5 text-xs font-bold"
          value={windowFilter}
          onChange={(event) =>
            setWindowFilter(event.target.value === "all" ? "all" : "week")
          }
          aria-label="Time window"
        >
          <option value="week">This week</option>
          <option value="all">All time</option>
        </select>
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-xs font-bold ${
            quadrantFilter || filterOpen
              ? "bg-[#617a57] text-white"
              : "border border-[#dde2dd] bg-white text-[#14241f]"
          }`}
          onClick={() => setFilterOpen(true)}
        >
          Filters
        </button>
      </div>

      <article className="overflow-hidden rounded-2xl border border-[#dde2dd] bg-white p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="min-w-0">
            <p className="truncate font-serif text-2xl text-[#14241f]">
              {plannedHours.toFixed(plannedHours % 1 === 0 ? 0 : 1)}h
            </p>
            <p className="truncate text-[11px] text-[#6c7771]">Planned</p>
          </div>
          <div className="min-w-0">
            <p className="truncate font-serif text-2xl text-[#14241f]">
              {availableHours}h
            </p>
            <p className="truncate text-[11px] text-[#6c7771]">Capacity</p>
          </div>
          <div className="min-w-0">
            <p
              className={`truncate font-serif text-2xl ${
                overCapacity ? "text-[#c9634f]" : "text-[#617a57]"
              }`}
            >
              {overCapacity
                ? `${overHours.toFixed(overHours % 1 === 0 ? 0 : 1)}h over`
                : "On track"}
            </p>
            <p className="truncate text-[11px] text-[#6c7771]">
              {overCapacity ? "Over" : "Balance"}
            </p>
          </div>
        </div>
        {overCapacity ? (
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl bg-[#fdf4f1] px-3 py-2.5 text-left text-sm font-bold text-[#c9634f]"
            onClick={() => setRebalanceOpen(true)}
          >
            <span className="min-w-0 truncate">Rebalance your week</span>
            <span className="shrink-0">›</span>
          </button>
        ) : null}
      </article>

      <div className="space-y-3">
        {PRIORITY_MATRIX_ORDER.map((quadrant) => {
          const copy = ACCORDION_COPY[quadrant];
          const actions = byQuadrant[quadrant];
          const hours = actions.reduce((sum, a) => sum + hoursOf(a), 0);
          const open = expanded[quadrant];
          return (
            <article
              key={quadrant}
              className="overflow-hidden rounded-2xl border border-[#dde2dd] bg-white"
            >
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left"
                onClick={() => toggle(quadrant)}
                aria-expanded={open}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#617a57]">
                    {copy.title}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-[#6c7771]">
                    {copy.subtitle}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#14241f]">
                    {actions.length} action{actions.length === 1 ? "" : "s"} ·{" "}
                    {hours.toFixed(hours % 1 === 0 ? 0 : 1)}h
                  </p>
                </div>
                <span className="mt-1 shrink-0 text-[#6c7771]">
                  {open ? "▾" : "▸"}
                </span>
              </button>
              {open ? (
                <div className="border-t border-[#dde2dd] px-3 pb-3 pt-2">
                  {actions.length === 0 ? (
                    <p className="px-1 py-3 text-sm text-[#6c7771]">
                      {copy.empty ?? "No actions here."}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {actions.map((action, index) => {
                        const project = projectById.get(action.parentId ?? "");
                        const area = pillars.find(
                          (p) => p.id === project?.parentId,
                        );
                        const icon =
                          (area && str(area, "icon")) ||
                          AREA_ICONS[index % AREA_ICONS.length];
                        return (
                          <li
                            key={action.id}
                            className="flex min-w-0 items-center gap-3 rounded-xl bg-[#f7f8f5] px-3 py-2.5"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-lg">
                              {icon.length <= 3 ? icon : "📌"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-[#14241f]">
                                {action.title}
                              </p>
                              <p className="truncate text-[11px] text-[#6c7771]">
                                {area?.title ?? "Unassigned"}
                                {project ? ` · ${project.title}` : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className="text-xs font-bold text-[#14241f]">
                                {hoursOf(action)}h
                              </span>
                              <button
                                type="button"
                                className="text-[10px] font-bold text-[#617a57]"
                                disabled={busy}
                                onClick={() => onCompleteAction(action)}
                              >
                                Done
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {!tipDismissed ? (
        <article className="relative overflow-hidden rounded-2xl border border-[#c9d6c4] bg-[#eef3ea] p-4 pr-10">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
            Tip
          </p>
          <p className="mt-1 text-sm leading-snug text-[#24362f]">
            Protect Do Now for high-importance, high-urgency work. Schedule what
            matters; park or delete the rest when capacity is tight.
          </p>
          <button
            type="button"
            className="absolute right-2 top-2 rounded-full px-2 py-1 text-sm font-bold text-[#6c7771]"
            aria-label="Dismiss tip"
            onClick={dismissTip}
          >
            ×
          </button>
        </article>
      ) : null}

      {filterOpen ? (
        <Sheet
          title="Filters"
          subtitle="Narrow actions on Priority."
          onClose={() => setFilterOpen(false)}
        >
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
            Quadrant
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                !quadrantFilter
                  ? "bg-[#14241f] text-[#f4f5f0]"
                  : "border border-[#dde2dd] bg-white"
              }`}
              onClick={() => setQuadrantFilter("")}
            >
              Any
            </button>
            {PRIORITY_MATRIX_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  quadrantFilter === id
                    ? "bg-[#14241f] text-[#f4f5f0]"
                    : "border border-[#dde2dd] bg-white"
                }`}
                onClick={() => setQuadrantFilter(id)}
              >
                {PRIORITY_QUADRANT_META[id].label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="w-full rounded-xl bg-[#14241f] px-4 py-2.5 text-xs font-bold text-[#f4f5f0]"
            onClick={() => setFilterOpen(false)}
          >
            Apply
          </button>
        </Sheet>
      ) : null}

      {rebalanceOpen ? (
        <Sheet
          title="Rebalance your week"
          subtitle={`${overHours.toFixed(1)}h over capacity — park heavy work or move projects to Ideas.`}
          onClose={() => setRebalanceOpen(false)}
        >
          {heavyProjects.length > 0 && onMoveProjectToIdea ? (
            <div className="mb-4 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
                Move to Ideas
              </p>
              {heavyProjects.slice(0, 5).map(({ project, hours }) => (
                <div
                  key={project.id}
                  className="flex min-w-0 items-center gap-2 rounded-xl border border-[#dde2dd] bg-white px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#14241f]">
                      {project.title}
                    </p>
                    <p className="truncate text-[11px] text-[#6c7771]">
                      {hours.toFixed(1)}h across open actions
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-full border border-[#dde2dd] px-3 py-1 text-[11px] font-bold text-[#617a57]"
                    disabled={busy}
                    onClick={() => {
                      onMoveProjectToIdea(project);
                      setRebalanceOpen(false);
                    }}
                  >
                    Park
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
            Actions by hours
          </p>
          <div className="space-y-2">
            {rankedActions.length === 0 ? (
              <p className="text-sm text-[#6c7771]">No open actions to trim.</p>
            ) : (
              rankedActions.map((action) => {
                const project = projectById.get(action.parentId ?? "");
                return (
                  <div
                    key={action.id}
                    className="flex min-w-0 items-center gap-2 rounded-xl border border-[#dde2dd] bg-white px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#14241f]">
                        {action.title}
                      </p>
                      <p className="truncate text-[11px] text-[#6c7771]">
                        {hoursOf(action)}h
                        {project ? ` · ${project.title}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {onParkAction ? (
                        <button
                          type="button"
                          className="rounded-full border border-[#dde2dd] px-2.5 py-1 text-[10px] font-bold"
                          disabled={busy}
                          onClick={() => onParkAction(action)}
                        >
                          Later
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="rounded-full border border-[#dde2dd] px-2.5 py-1 text-[10px] font-bold text-[#617a57]"
                        disabled={busy}
                        onClick={() => onMoveAction(action, "ELIMINATE")}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Sheet>
      ) : null}
    </section>
  );
}
