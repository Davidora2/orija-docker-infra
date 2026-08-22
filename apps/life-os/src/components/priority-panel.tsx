"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_PRIORITY_FILTERS,
  filterPriorityActions,
  isValidDateOnly,
  resetPriorityFilters,
  type PriorityFilters,
} from "@life-os/plan-domain";
import type { LifeItem } from "../lib/api";
import { DatePickerField } from "./date-picker-field";
import { LandscapeHero } from "./landscape-hero";
import { LifeIcon, lifeIconFromLegacy } from "./life-icon";
import { PriorityMatrixPanel } from "./priority-matrix-panel";
import {
  PRIORITY_MATRIX_ORDER,
  PRIORITY_QUADRANT_META,
  actionPriorityQuadrant,
  actionScheduledDate,
  quadrantRequiresScheduledDate,
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

function hoursOf(action: LifeItem) {
  const value = action.body.hours;
  return typeof value === "number" ? value : 1;
}

function str(item: LifeItem, key: string, fallback = "") {
  const value = item.body[key];
  return typeof value === "string" ? value : fallback;
}

type DateEditState = {
  action: LifeItem;
  draft: string;
  completeAfter: boolean;
};

type Props = {
  pillars: LifeItem[];
  projects: LifeItem[];
  actions: LifeItem[];
  availableHours: number;
  busy: boolean;
  onMoveAction: (action: LifeItem, quadrant: PriorityQuadrant) => void;
  onCompleteAction: (action: LifeItem) => void;
  onSetScheduledDate?: (action: LifeItem, date: string) => void;
  onOpenProject?: (project: LifeItem) => void;
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
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-[#14241f]/35 p-3 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-[#f4f5f0] p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
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
  actions,
  availableHours,
  busy,
  onMoveAction,
  onCompleteAction,
  onSetScheduledDate,
  onOpenProject,
  onMoveProjectToIdea,
  onParkAction,
  preferMatrix = false,
}: Props) {
  const [view, setView] = useState<"list" | "matrix">(
    preferMatrix ? "matrix" : "list",
  );
  const [filters, setFilters] = useState<PriorityFilters>(() =>
    resetPriorityFilters(),
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<PriorityQuadrant, boolean>>({
    DO_FIRST: true,
    SCHEDULE: true,
    DELEGATE: false,
    ELIMINATE: false,
  });
  const [tipDismissed, setTipDismissed] = useState(false);
  const [rebalanceOpen, setRebalanceOpen] = useState(false);
  const [dateEdit, setDateEdit] = useState<DateEditState | null>(null);

  function openScheduleDateEditor(
    action: LifeItem,
    options?: { completeAfter?: boolean },
  ) {
    setDateEdit({
      action,
      draft: actionScheduledDate(action.body) ?? "",
      completeAfter: Boolean(options?.completeAfter),
    });
  }

  function handleCompleteAction(action: LifeItem, quadrant: PriorityQuadrant) {
    if (
      action.status !== "DONE" &&
      quadrantRequiresScheduledDate(quadrant) &&
      !actionScheduledDate(action.body) &&
      onSetScheduledDate
    ) {
      openScheduleDateEditor(action, { completeAfter: true });
      return;
    }
    onCompleteAction(action);
  }

  function saveScheduleDate() {
    if (!dateEdit || !onSetScheduledDate) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateEdit.draft)) return;
    const { action, draft, completeAfter } = dateEdit;
    onSetScheduledDate(action, draft);
    setDateEdit(null);
    if (completeAfter) {
      onCompleteAction(action);
    }
  }

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
    return filterPriorityActions(actions, projects, filters);
  }, [actions, projects, filters]);

  const activeFilterCount = useMemo(
    () =>
      Object.entries(filters).filter(
        ([key, value]) =>
          value !== DEFAULT_PRIORITY_FILTERS[key as keyof PriorityFilters],
      ).length,
    [filters],
  );

  const plannedHours = filteredActions
    .filter((action) => action.status !== "DONE")
    .reduce((sum, action) => sum + hoursOf(action), 0);
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
      if (!action.parentId || action.status === "DONE") continue;
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

  return (
    <section className="space-y-4">
      <LandscapeHero
        detail="Shape Areas, commit Projects, and protect the actions that deserve this week."
        eyebrow="Life OS · Plan"
        subtitle="Decide what exists and what matters."
        title="Plan"
      />

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-2xl text-[#14241f]">Priority</h1>
          <p className="mt-1 text-sm leading-snug text-[#6c7771]">
            Focus on what deserves your attention.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-full border border-[#dde2dd] bg-white px-3.5 py-2 text-xs font-bold text-[#14241f]"
          onClick={() => setView((current) => (current === "list" ? "matrix" : "list"))}
        >
          {view === "list" ? "Matrix" : "List"}
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        <input
          className="min-w-[12rem] flex-1 rounded-full border border-[#dde2dd] bg-white px-4 py-2 text-sm"
          placeholder="Search action titles"
          value={filters.query}
          onChange={(event) =>
            setFilters((current) => ({ ...current, query: event.target.value }))
          }
          aria-label="Search action titles"
        />
        <select
          className="max-w-[42%] truncate rounded-full border border-[#dde2dd] bg-white px-3 py-1.5 text-xs font-bold"
          value={filters.areaId}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              areaId: event.target.value,
              projectId: "",
            }))
          }
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
          value={filters.window}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              window: event.target.value as PriorityFilters["window"],
            }))
          }
          aria-label="Time window"
        >
          <option value="THIS_WEEK">This week</option>
          <option value="TODAY">Today</option>
          <option value="NEXT_7_DAYS">Next 7 days</option>
          <option value="OVERDUE">Overdue</option>
          <option value="UNSCHEDULED">Unscheduled</option>
          <option value="ALL">All time</option>
        </select>
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-xs font-bold ${
            activeFilterCount || filterOpen
              ? "bg-[#617a57] text-white"
              : "border border-[#dde2dd] bg-white text-[#14241f]"
          }`}
          onClick={() => setFilterOpen(true)}
        >
          Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
        </button>
        {activeFilterCount ? (
          <button
            type="button"
            className="rounded-full px-3 py-1.5 text-xs font-bold text-[#6c7771]"
            onClick={() => setFilters(resetPriorityFilters())}
          >
            Clear
          </button>
        ) : null}
      </div>

      {view === "matrix" ? (
        <PriorityMatrixPanel
          actions={filteredActions}
          projects={projects}
          busy={busy}
          onMove={onMoveAction}
          onViewList={() => setView("list")}
        />
      ) : null}

      {view === "list" ? <article className="overflow-hidden rounded-2xl border border-[#dde2dd] bg-white p-4">
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
            <LifeIcon
              className="shrink-0"
              name="chevron-right"
              size={14}
              color="currentColor"
            />
          </button>
        ) : null}
      </article> : null}

      {view === "list" ? <div className="space-y-3">
        {PRIORITY_MATRIX_ORDER.map((quadrant) => {
          const copy = ACCORDION_COPY[quadrant];
          const actions = byQuadrant[quadrant];
          const openCount = actions.filter((a) => a.status !== "DONE").length;
          const hours = actions
            .filter((a) => a.status !== "DONE")
            .reduce((sum, a) => sum + hoursOf(a), 0);
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
                    {openCount} action{openCount === 1 ? "" : "s"} ·{" "}
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
                        const icon = lifeIconFromLegacy(
                          area && str(area, "icon"),
                          index,
                        );
                        const scheduled =
                          quadrant === "SCHEDULE"
                            ? actionScheduledDate(action.body)
                            : null;
                        const metaLabel = `${area?.title ?? "Unassigned"}${
                          project ? ` · ${project.title}` : ""
                        }`;
                        return (
                          <li
                            key={action.id}
                            className={`flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 ${
                              action.status === "DONE"
                                ? "bg-[#eef0ed]"
                                : "bg-[#f7f8f5]"
                            }`}
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-lg">
                              <LifeIcon name={icon} size={19} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p
                                className={`truncate text-sm font-semibold ${
                                  action.status === "DONE"
                                    ? "text-[#6c7771] line-through"
                                    : "text-[#14241f]"
                                }`}
                              >
                                {action.title}
                              </p>
                              {project && onOpenProject ? (
                                <button
                                  type="button"
                                  className="mt-0.5 block max-w-full truncate text-left text-[11px] text-[#6c7771] underline-offset-2 hover:underline"
                                  onClick={() => onOpenProject(project)}
                                >
                                  {metaLabel}
                                </button>
                              ) : (
                                <p className="truncate text-[11px] text-[#6c7771]">
                                  {metaLabel}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className="text-xs font-bold text-[#14241f]">
                                {hoursOf(action)}h
                              </span>
                              {quadrant === "SCHEDULE" && onSetScheduledDate ? (
                                <button
                                  type="button"
                                  className={`inline-flex max-w-[8.5rem] items-center gap-1 truncate rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                    scheduled
                                      ? "border-[#c9d6c4] bg-white text-[#617a57]"
                                      : "border-[#c9634f]/40 bg-[#fdf4f1] text-[#c9634f]"
                                  }`}
                                  disabled={busy}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openScheduleDateEditor(action);
                                  }}
                                  aria-label={
                                    scheduled
                                      ? `Edit schedule date ${scheduled}`
                                      : "Set schedule date"
                                  }
                                >
                                  <LifeIcon
                                    name="calendar-edit"
                                    size={11}
                                    color="currentColor"
                                  />
                                  {scheduled ?? "Set date"}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="flex h-5 w-5 items-center justify-center rounded-full border border-[#617a57] text-[10px] text-[#617a57]"
                                disabled={busy}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleCompleteAction(action, quadrant);
                                }}
                                aria-label={
                                  action.status === "DONE"
                                    ? "Mark action open"
                                    : "Mark action done"
                                }
                              >
                                <LifeIcon
                                  name="done"
                                  size={14}
                                  weight={
                                    action.status === "DONE" ? "fill" : "regular"
                                  }
                                />
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
      </div> : null}

      {view === "list" && !tipDismissed ? (
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
          <label className="mb-4 block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
              Project
            </span>
            <select
              className="w-full rounded-xl border border-[#dde2dd] bg-white px-3 py-3"
              value={filters.projectId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  projectId: event.target.value,
                }))
              }
            >
              <option value="">All projects</option>
              {projects
                .filter(
                  (project) =>
                    !filters.areaId || project.parentId === filters.areaId,
                )
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
            </select>
          </label>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
            Project priority
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            {(["", "HIGH", "MEDIUM", "LOW"] as const).map((priority) => (
              <button
                key={priority || "any"}
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  filters.projectPriority === priority
                    ? "bg-[#14241f] text-[#f4f5f0]"
                    : "border border-[#dde2dd] bg-white"
                }`}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    projectPriority: priority,
                  }))
                }
              >
                {priority || "Any"}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
            Action status
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            {(["OPEN", "DONE", "ANY"] as const).map((status) => (
              <button
                key={status}
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  filters.actionStatus === status
                    ? "bg-[#14241f] text-[#f4f5f0]"
                    : "border border-[#dde2dd] bg-white"
                }`}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    actionStatus: status,
                  }))
                }
              >
                {status === "ANY" ? "Any" : status === "DONE" ? "Done" : "Open"}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
            Quadrant
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                !filters.quadrant
                  ? "bg-[#14241f] text-[#f4f5f0]"
                  : "border border-[#dde2dd] bg-white"
              }`}
              onClick={() =>
                setFilters((current) => ({ ...current, quadrant: "" }))
              }
            >
              Any
            </button>
            {PRIORITY_MATRIX_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  filters.quadrant === id
                    ? "bg-[#14241f] text-[#f4f5f0]"
                    : "border border-[#dde2dd] bg-white"
                }`}
                onClick={() =>
                  setFilters((current) => ({ ...current, quadrant: id }))
                }
              >
                {PRIORITY_QUADRANT_META[id].label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-xl border border-[#dde2dd] bg-white px-4 py-2.5 text-xs font-bold"
              onClick={() => setFilters(resetPriorityFilters())}
            >
              Reset
            </button>
            <button
              type="button"
              className="flex-1 rounded-xl bg-[#14241f] px-4 py-2.5 text-xs font-bold text-[#f4f5f0]"
              onClick={() => setFilterOpen(false)}
            >
              Apply · {filteredActions.length}
            </button>
          </div>
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

      {dateEdit ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="priority-schedule-date-title"
            className="w-full max-w-md rounded-2xl border border-[#dde2dd] bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
              Schedule
            </p>
            <h3
              id="priority-schedule-date-title"
              className="mt-1 font-serif text-2xl text-[#14241f]"
            >
              {dateEdit.completeAfter ? "Date before done" : "Pick a date"}
            </h3>
            <p className="mt-1 text-sm text-[#6c7771]">
              &ldquo;{dateEdit.action.title}&rdquo; is in Schedule — set a
              calendar date
              {dateEdit.completeAfter ? " before marking it done" : ""}.
            </p>
            <div className="mt-4">
              <DatePickerField
                error={
                  dateEdit.draft && !isValidDateOnly(dateEdit.draft)
                    ? "Choose a date for Schedule"
                    : undefined
                }
                label="Date"
                onChange={(value) =>
                  setDateEdit((current) =>
                    current ? { ...current, draft: value } : current,
                  )
                }
                required
                value={dateEdit.draft}
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border border-[#dde2dd] px-4 py-3 text-xs font-bold"
                onClick={() => setDateEdit(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-[#14241f] px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
                disabled={
                  busy || !isValidDateOnly(dateEdit.draft)
                }
                onClick={saveScheduleDate}
              >
                {dateEdit.completeAfter ? "Save & complete" : "Save date"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
