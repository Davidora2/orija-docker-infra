"use client";

import { useEffect, useMemo, useState } from "react";
import type { LifeItem } from "../lib/api";
import { PriorityMatrixPanel } from "./priority-matrix-panel";
import {
  PRIORITY_QUADRANT_META,
  PROJECT_PRIORITIES,
  PROJECT_PRIORITY_META,
  actionPriorityQuadrant,
  projectPriorityLevel,
  projectPriorityRank,
  type PriorityQuadrant,
  type ProjectPriority,
} from "../lib/priority-matrix";

function num(item: LifeItem, key: string, fallback = 0) {
  const value = item.body[key];
  return typeof value === "number" ? value : fallback;
}

function str(item: LifeItem, key: string, fallback = "") {
  const value = item.body[key];
  return typeof value === "string" ? value : fallback;
}

function open(item: LifeItem) {
  return (
    item.status !== "DONE" &&
    item.status !== "ARCHIVED" &&
    item.status !== "CONVERTED"
  );
}

type PlanSegment = "areas" | "projects" | "ideas";

type Props = {
  planSegment: PlanSegment;
  pillars: LifeItem[];
  projects: LifeItem[];
  items: LifeItem[];
  openActions: LifeItem[];
  availableHours: number;
  busy: boolean;
  areaTitle: string;
  onAreaTitleChange: (value: string) => void;
  onAddArea: () => void;
  onRemoveArea: (pillar: LifeItem) => void;
  ideaTitle: string;
  ideaNote: string;
  onIdeaTitleChange: (value: string) => void;
  onIdeaNoteChange: (value: string) => void;
  onSaveIdea: () => void;
  onConvertIdea: (idea: LifeItem) => void;
  onEvaluateIdea: (idea: LifeItem) => void;
  projectTitle: string;
  projectOutcome: string;
  projectPillarId: string;
  projectPriority: ProjectPriority;
  actionTitle: string;
  actionHours: string;
  actionImportantFlag: boolean;
  actionUrgentFlag: boolean;
  onProjectTitleChange: (value: string) => void;
  onProjectOutcomeChange: (value: string) => void;
  onProjectPillarIdChange: (value: string) => void;
  onProjectPriorityChange: (value: ProjectPriority) => void;
  onActionTitleChange: (value: string) => void;
  onActionHoursChange: (value: string) => void;
  onActionImportantChange: (value: boolean) => void;
  onActionUrgentChange: (value: boolean) => void;
  onSaveProject: () => void;
  onMoveProjectPriority: (project: LifeItem, priority: ProjectPriority) => void;
  onMoveAction: (action: LifeItem, quadrant: PriorityQuadrant) => void;
  onCompleteAction: (action: LifeItem) => void;
  onQuickAddAction: (projectId: string, title: string, hours: number) => void;
  onOpenProjectsMatrix: () => void;
};

function sortedProjects(projects: LifeItem[]) {
  return [...projects].sort((a, b) => {
    const aRank = projectPriorityRank(projectPriorityLevel(a.body));
    const bRank = projectPriorityRank(projectPriorityLevel(b.body));
    return aRank - bRank || a.title.localeCompare(b.title);
  });
}

function projectHours(items: LifeItem[], projectId: string) {
  return items
    .filter(
      (item) =>
        item.kind === "ACTION" && item.parentId === projectId && open(item),
    )
    .reduce((sum, action) => sum + num(action, "hours", 1), 0);
}

export function PlanPanel(props: Props) {
  const {
    planSegment,
    pillars,
    projects,
    items,
    openActions,
    availableHours,
    busy,
  } = props;

  const [projectsView, setProjectsView] = useState<"list" | "matrix">("list");
  const [ideasTab, setIdeasTab] = useState<"inbox" | "evaluated">("inbox");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickHours, setQuickHours] = useState("1");
  const [quickMore, setQuickMore] = useState(false);

  useEffect(() => {
    if (props.projectTitle.trim()) setComposerOpen(true);
  }, [props.projectTitle]);

  const allIdeas = useMemo(
    () => items.filter((item) => item.kind === "IDEA"),
    [items],
  );
  const inboxIdeas = allIdeas.filter(
    (idea) =>
      idea.status !== "EVALUATED" &&
      idea.status !== "CONVERTED" &&
      idea.status !== "ARCHIVED" &&
      idea.status !== "DONE",
  );
  const evaluatedIdeas = allIdeas.filter(
    (idea) => idea.status === "EVALUATED",
  );

  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? null;
  const selectedArea =
    pillars.find((pillar) => pillar.id === selectedAreaId) ?? null;

  if (planSegment === "ideas") {
    const list = ideasTab === "inbox" ? inboxIdeas : evaluatedIdeas;
    return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-2xl text-[#14241f]">Ideas</h2>
          <div className="flex gap-2">
            {(
              [
                ["inbox", "Inbox"],
                ["evaluated", "Evaluated"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  ideasTab === id
                    ? "bg-[#617a57] text-white"
                    : "border border-[#dde2dd] bg-white text-[#14241f]"
                }`}
                onClick={() => setIdeasTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
            Quick capture
          </p>
          <input
            className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
            placeholder="Title"
            value={props.ideaTitle}
            onChange={(e) => props.onIdeaTitleChange(e.target.value)}
          />
          <textarea
            className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
            placeholder="Note (optional)"
            value={props.ideaNote}
            onChange={(e) => props.onIdeaNoteChange(e.target.value)}
          />
          <button
            className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
            type="button"
            disabled={busy}
            onClick={props.onSaveIdea}
          >
            Save idea
          </button>
        </article>

        {list.length === 0 ? (
          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
            <p className="font-serif text-xl text-[#14241f]">
              {ideasTab === "inbox" ? "Inbox is clear" : "Nothing evaluated yet"}
            </p>
            <p className="mt-1 text-sm text-[#6c7771]">
              {ideasTab === "inbox"
                ? "Capture something rough, then evaluate or convert."
                : "Evaluate an idea from Inbox to move it here."}
            </p>
          </article>
        ) : (
          list.map((idea) => (
            <article
              key={idea.id}
              className="rounded-2xl border border-[#dde2dd] bg-white p-5"
            >
              <h3 className="font-serif text-xl">{idea.title}</h3>
              {str(idea, "note") ? (
                <p className="mt-1 text-sm text-[#6c7771]">{str(idea, "note")}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {ideasTab === "inbox" ? (
                  <button
                    className="rounded-xl border border-[#dde2dd] px-3 py-2 text-xs font-bold"
                    type="button"
                    disabled={busy}
                    onClick={() => props.onEvaluateIdea(idea)}
                  >
                    Evaluate
                  </button>
                ) : null}
                <button
                  className="rounded-xl bg-[#14241f] px-3 py-2 text-xs font-bold text-[#f4f5f0]"
                  type="button"
                  disabled={busy}
                  onClick={() => props.onConvertIdea(idea)}
                >
                  Turn into project
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    );
  }

  if (planSegment === "areas") {
    if (selectedProject) {
      return (
        <ProjectDetailView
          project={selectedProject}
          pillars={pillars}
          items={items}
          busy={busy}
          detailsOpen={detailsOpen}
          setDetailsOpen={setDetailsOpen}
          onBack={() => setSelectedProjectId(null)}
          onMovePriority={props.onMoveProjectPriority}
          onCompleteAction={props.onCompleteAction}
          onShowMatrix={() => {
            setSelectedProjectId(null);
            setSelectedAreaId(null);
            setProjectsView("matrix");
            props.onOpenProjectsMatrix();
          }}
          quickTitle={quickTitle}
          quickHours={quickHours}
          quickMore={quickMore}
          setQuickTitle={setQuickTitle}
          setQuickHours={setQuickHours}
          setQuickMore={setQuickMore}
          onQuickAdd={() => {
            const hours = Number(quickHours);
            if (!quickTitle.trim()) return;
            props.onQuickAddAction(
              selectedProject.id,
              quickTitle.trim(),
              Number.isFinite(hours) && hours > 0 ? hours : 1,
            );
            setQuickTitle("");
            setQuickHours("1");
            setQuickMore(false);
          }}
        />
      );
    }

    if (selectedArea) {
      const areaProjects = sortedProjects(
        projects.filter((project) => project.parentId === selectedArea.id),
      );
      const hours = areaProjects.reduce(
        (sum, project) => sum + projectHours(items, project.id),
        0,
      );
      return (
        <section className="space-y-4">
          <button
            type="button"
            className="text-sm font-bold text-[#617a57]"
            onClick={() => setSelectedAreaId(null)}
          >
            ← Areas
          </button>
          <h2 className="font-serif text-2xl">{selectedArea.title}</h2>
          <p className="text-sm text-[#6c7771]">
            {areaProjects.length} active project
            {areaProjects.length === 1 ? "" : "s"} · {hours.toFixed(1)}h this
            week
          </p>
          {areaProjects.map((project) => {
            const next = items.find(
              (item) =>
                item.kind === "ACTION" &&
                item.parentId === project.id &&
                open(item),
            );
            const level = projectPriorityLevel(project.body);
            return (
              <button
                key={project.id}
                type="button"
                className="block w-full rounded-2xl border border-[#dde2dd] bg-white p-5 text-left"
                onClick={() => setSelectedProjectId(project.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-serif text-xl">{project.title}</h3>
                  <span className="rounded-full bg-[#dbe8d7] px-2.5 py-1 text-[11px] font-bold text-[#617a57]">
                    {PROJECT_PRIORITY_META[level].title}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#6c7771]">
                  Next:{" "}
                  {next
                    ? `${next.title} (${num(next, "hours", 1)}h)`
                    : "Define next action"}
                </p>
              </button>
            );
          })}
        </section>
      );
    }

    return (
      <section className="space-y-4">
        <h2 className="font-serif text-2xl">Areas</h2>
        <p className="text-sm text-[#6c7771]">
          Life domains with active load. Tap an area to see its projects.
        </p>
        {pillars.map((pillar) => {
          const pillarProjects = projects.filter(
            (project) => project.parentId === pillar.id,
          );
          const hours = pillarProjects.reduce(
            (sum, project) => sum + projectHours(items, project.id),
            0,
          );
          const pct =
            availableHours > 0
              ? Math.round((hours / availableHours) * 100)
              : 0;
          return (
            <div
              key={pillar.id}
              role="button"
              tabIndex={0}
              className="block w-full cursor-pointer rounded-2xl border border-[#dde2dd] bg-white p-5 text-left"
              onClick={() => setSelectedAreaId(pillar.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedAreaId(pillar.id);
                }
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-serif text-xl">{pillar.title}</h3>
                <button
                  type="button"
                  className="text-xs font-bold text-[#c9634f]"
                  disabled={busy}
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onRemoveArea(pillar);
                  }}
                >
                  Remove
                </button>
              </div>
              <p className="mt-2 text-sm text-[#14241f]">
                {pillarProjects.length} active project
                {pillarProjects.length === 1 ? "" : "s"}
              </p>
              <p className="text-sm text-[#6c7771]">
                {hours.toFixed(1)}h this week · {pct}% of capacity
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#dde2dd]">
                <div
                  className="h-full bg-[#617a57]"
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
        <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
            Add area
          </p>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-[#dde2dd] px-3 py-3"
              placeholder="e.g. Fitness, Side project"
              value={props.areaTitle}
              onChange={(e) => props.onAreaTitleChange(e.target.value)}
            />
            <button
              className="rounded-xl bg-[#14241f] px-4 py-3 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
              type="button"
              disabled={busy}
              onClick={props.onAddArea}
            >
              Add
            </button>
          </div>
        </article>
      </section>
    );
  }

  // Projects
  if (selectedProject) {
    return (
      <ProjectDetailView
        project={selectedProject}
        pillars={pillars}
        items={items}
        busy={busy}
        detailsOpen={detailsOpen}
        setDetailsOpen={setDetailsOpen}
        onBack={() => setSelectedProjectId(null)}
        onMovePriority={props.onMoveProjectPriority}
        onCompleteAction={props.onCompleteAction}
        onShowMatrix={() => {
          setSelectedProjectId(null);
          setProjectsView("matrix");
        }}
        quickTitle={quickTitle}
        quickHours={quickHours}
        quickMore={quickMore}
        setQuickTitle={setQuickTitle}
        setQuickHours={setQuickHours}
        setQuickMore={setQuickMore}
        onQuickAdd={() => {
          const hours = Number(quickHours);
          if (!quickTitle.trim()) return;
          props.onQuickAddAction(
            selectedProject.id,
            quickTitle.trim(),
            Number.isFinite(hours) && hours > 0 ? hours : 1,
          );
          setQuickTitle("");
          setQuickHours("1");
          setQuickMore(false);
        }}
      />
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Projects</h2>
        <div className="flex gap-2">
          {(
            [
              ["list", "List"],
              ["matrix", "Matrix"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                projectsView === id
                  ? "bg-[#617a57] text-white"
                  : "border border-[#dde2dd] bg-white text-[#14241f]"
              }`}
              onClick={() => setProjectsView(id)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className="rounded-xl bg-[#14241f] px-3 py-1.5 text-xs font-bold text-[#f4f5f0]"
            onClick={() => setComposerOpen((open) => !open)}
          >
            {composerOpen ? "Hide form" : "New"}
          </button>
        </div>
      </div>

      {projectsView === "matrix" ? (
        <PriorityMatrixPanel
          actions={openActions}
          projects={projects}
          busy={busy}
          onMove={props.onMoveAction}
        />
      ) : (
        <>
          {composerOpen ? (
            <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
                New project
              </p>
              <input
                className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                placeholder="Project title"
                value={props.projectTitle}
                onChange={(e) => props.onProjectTitleChange(e.target.value)}
              />
              <textarea
                className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                placeholder="Outcome"
                value={props.projectOutcome}
                onChange={(e) => props.onProjectOutcomeChange(e.target.value)}
              />
              <select
                className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                value={props.projectPillarId}
                onChange={(e) => props.onProjectPillarIdChange(e.target.value)}
              >
                <option value="">Select life area</option>
                {pillars.map((pillar) => (
                  <option key={pillar.id} value={pillar.id}>
                    {pillar.title}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                value={props.projectPriority}
                onChange={(e) =>
                  props.onProjectPriorityChange(
                    e.target.value as ProjectPriority,
                  )
                }
              >
                {PROJECT_PRIORITIES.map((id) => (
                  <option key={id} value={id}>
                    {PROJECT_PRIORITY_META[id].title}
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                placeholder="First next action"
                value={props.actionTitle}
                onChange={(e) => props.onActionTitleChange(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                placeholder="Hours"
                value={props.actionHours}
                onChange={(e) => props.onActionHoursChange(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1 text-sm">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
                    Important
                  </span>
                  <select
                    className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                    value={props.actionImportantFlag ? "yes" : "no"}
                    onChange={(e) =>
                      props.onActionImportantChange(e.target.value === "yes")
                    }
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
                    Urgent
                  </span>
                  <select
                    className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                    value={props.actionUrgentFlag ? "yes" : "no"}
                    onChange={(e) =>
                      props.onActionUrgentChange(e.target.value === "yes")
                    }
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
              </div>
              <button
                className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
                type="button"
                disabled={busy}
                onClick={props.onSaveProject}
              >
                Save project
              </button>
            </article>
          ) : null}

          {projects.length === 0 ? (
            <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
              <p className="font-serif text-xl">No projects yet</p>
              <p className="mt-1 text-sm text-[#6c7771]">
                Create a project with a first next action, or turn an idea into
                a project.
              </p>
            </article>
          ) : (
            sortedProjects(projects).map((project) => {
              const next = items.find(
                (item) =>
                  item.kind === "ACTION" &&
                  item.parentId === project.id &&
                  open(item),
              );
              const level = projectPriorityLevel(project.body);
              const area = pillars.find(
                (pillar) => pillar.id === project.parentId,
              );
              const hours = projectHours(items, project.id);
              return (
                <button
                  key={project.id}
                  type="button"
                  className="block w-full rounded-2xl border border-[#dde2dd] bg-white p-5 text-left"
                  onClick={() => {
                    setSelectedProjectId(project.id);
                    setDetailsOpen(false);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-serif text-xl">{project.title}</h3>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        level === "HIGH"
                          ? "bg-[#f8e4df] text-[#c9634f]"
                          : level === "MEDIUM"
                            ? "bg-[#fff3e8] text-[#8a5a16]"
                            : "bg-[#dbe8d7] text-[#617a57]"
                      }`}
                    >
                      {PROJECT_PRIORITY_META[level].title}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#6c7771]">
                    {area?.title ?? "Unassigned"}
                  </p>
                  <p className="mt-2 text-sm font-medium text-[#14241f]">
                    {next ? `Next: ${next.title}` : "Define next action"}
                  </p>
                  <p className="mt-1 text-xs text-[#6c7771]">
                    {hours.toFixed(1)}h this week
                    {next ? ` · ${num(next, "hours", 1)}h next` : ""}
                  </p>
                </button>
              );
            })
          )}
        </>
      )}
    </section>
  );
}

function ProjectDetailView({
  project,
  pillars,
  items,
  busy,
  detailsOpen,
  setDetailsOpen,
  onBack,
  onMovePriority,
  onCompleteAction,
  onShowMatrix,
  quickTitle,
  quickHours,
  quickMore,
  setQuickTitle,
  setQuickHours,
  setQuickMore,
  onQuickAdd,
}: {
  project: LifeItem;
  pillars: LifeItem[];
  items: LifeItem[];
  busy: boolean;
  detailsOpen: boolean;
  setDetailsOpen: (open: boolean) => void;
  onBack: () => void;
  onMovePriority: (project: LifeItem, priority: ProjectPriority) => void;
  onCompleteAction: (action: LifeItem) => void;
  onShowMatrix: () => void;
  quickTitle: string;
  quickHours: string;
  quickMore: boolean;
  setQuickTitle: (value: string) => void;
  setQuickHours: (value: string) => void;
  setQuickMore: (value: boolean) => void;
  onQuickAdd: () => void;
}) {
  const area = pillars.find((pillar) => pillar.id === project.parentId);
  const level = projectPriorityLevel(project.body);
  const openActions = items.filter(
    (item) =>
      item.kind === "ACTION" && item.parentId === project.id && open(item),
  );
  const doneActions = items.filter(
    (item) =>
      item.kind === "ACTION" &&
      item.parentId === project.id &&
      item.status === "DONE",
  );
  const next = openActions[0] ?? null;
  const total = openActions.length + doneActions.length;
  const progress =
    total === 0 ? 0 : Math.round((doneActions.length / total) * 100);
  const hours = openActions.reduce(
    (sum, action) => sum + num(action, "hours", 1),
    0,
  );
  const outcome = str(project, "outcome");

  return (
    <section className="space-y-4">
      <button
        type="button"
        className="text-sm font-bold text-[#617a57]"
        onClick={onBack}
      >
        ← Projects
      </button>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-2xl">{project.title}</h2>
        <span className="rounded-full bg-[#dbe8d7] px-2.5 py-1 text-[11px] font-bold text-[#617a57]">
          {PROJECT_PRIORITY_META[level].title}
        </span>
      </div>
      <p className="text-sm text-[#6c7771]">
        {area?.title ?? "Unassigned"} · Active
      </p>

      <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
          Outcome
        </p>
        <p className="mt-2 font-serif text-xl leading-relaxed text-[#14241f]">
          {outcome ||
            "Add an outcome so this project has a clear finish line."}
        </p>
      </article>

      <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
          Next action
        </p>
        {next ? (
          <>
            <h3 className="font-serif text-2xl">{next.title}</h3>
            <p className="text-sm text-[#6c7771]">
              {num(next, "hours", 1)}h
              {str(next, "day") ? ` · ${str(next, "day")}` : ""} ·{" "}
              {
                PRIORITY_QUADRANT_META[
                  actionPriorityQuadrant(next.body, project.body)
                ].title
              }
            </p>
            <button
              type="button"
              className="rounded-xl border border-[#dde2dd] px-3 py-2 text-xs font-bold"
              disabled={busy}
              onClick={() => onCompleteAction(next)}
            >
              Complete
            </button>
          </>
        ) : (
          <p className="text-sm text-[#6c7771]">
            Active projects need a concrete next move — add one below.
          </p>
        )}
      </article>

      <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
          Progress
        </p>
        <p className="font-serif text-2xl">{progress}%</p>
        <div className="h-2 overflow-hidden rounded-full bg-[#dde2dd]">
          <div
            className="h-full bg-[#617a57]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-[#6c7771]">
          {doneActions.length} done · {openActions.length} open ·{" "}
          {hours.toFixed(1)}h remaining
        </p>
      </article>

      <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
            Actions
          </p>
          <button
            type="button"
            className="text-xs font-bold text-[#617a57]"
            onClick={onShowMatrix}
          >
            Matrix view
          </button>
        </div>
        {openActions.slice(0, 5).map((action) => (
          <div
            key={action.id}
            className="border-t border-[#dde2dd] pt-3 first:border-t-0 first:pt-0"
          >
            <p className="font-semibold">{action.title}</p>
            <p className="text-xs text-[#6c7771]">
              {num(action, "hours", 1)}h ·{" "}
              {
                PRIORITY_QUADRANT_META[
                  actionPriorityQuadrant(action.body, project.body)
                ].title
              }
            </p>
          </div>
        ))}

        <div className="space-y-2 border-t border-[#dde2dd] pt-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
            Quick add action
          </p>
          <input
            className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
            placeholder="What will you do?"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
            placeholder="Hours"
            value={quickHours}
            onChange={(e) => setQuickHours(e.target.value)}
          />
          <button
            type="button"
            className="text-xs font-bold text-[#6c7771]"
            onClick={() => setQuickMore(!quickMore)}
          >
            {quickMore ? "Hide options" : "More options"}
          </button>
          {quickMore ? (
            <p className="text-sm text-[#6c7771]">
              Defaults to Schedule (Important, not Urgent). Adjust in Matrix
              after saving.
            </p>
          ) : null}
          <button
            type="button"
            className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
            disabled={busy}
            onClick={onQuickAdd}
          >
            Save action
          </button>
        </div>
      </article>

      <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
        <button
          type="button"
          className="flex w-full items-center justify-between"
          onClick={() => setDetailsOpen(!detailsOpen)}
        >
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
            Details
          </p>
          <span className="text-xs text-[#6c7771]">
            {detailsOpen ? "Hide" : "Show"}
          </span>
        </button>
        {detailsOpen ? (
          <div className="mt-3 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
              Priority
            </p>
            <div className="flex flex-wrap gap-2">
              {PROJECT_PRIORITIES.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={busy}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                    level === option
                      ? "bg-[#14241f] text-white"
                      : "border border-[#dde2dd] bg-white text-[#14241f]"
                  }`}
                  onClick={() => onMovePriority(project, option)}
                >
                  {PROJECT_PRIORITY_META[option].title}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </article>
    </section>
  );
}
