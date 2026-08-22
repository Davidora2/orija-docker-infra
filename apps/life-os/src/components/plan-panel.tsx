"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { LifeItem } from "../lib/api";
import { PriorityMatrixPanel } from "./priority-matrix-panel";
import {
  PRIORITY_LEVELS,
  PRIORITY_LEVEL_META,
  PRIORITY_QUADRANT_META,
  PROJECT_PRIORITIES,
  PROJECT_PRIORITY_META,
  actionImportanceLevel,
  actionPriorityQuadrant,
  actionUrgencyLevel,
  isProjectDeadlineOverdue,
  projectPriorityLevel,
  projectPriorityRank,
  projectTargetDate,
  type PriorityLevel,
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

/** Plan UX project statuses: Active / Paused / Done (DONE maps to Completed). */
export type ProjectLifecycleStatus = "ACTIVE" | "PAUSED" | "DONE";

function projectStatusLabel(status: string): string {
  if (status === "DONE") return "Done";
  if (status === "PAUSED") return "Paused";
  return "Active";
}

function projectStatusRank(status: string): number {
  if (status === "DONE") return 2;
  if (status === "PAUSED") return 1;
  return 0;
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
  onEvaluateIdea: (
    idea: LifeItem,
    scores: {
      impact: number;
      effort: number;
      alignment: number;
      timing: number;
      notes: string;
    },
  ) => void;
  projectTitle: string;
  projectOutcome: string;
  projectPillarId: string;
  projectPriority: ProjectPriority;
  projectTargetDate: string;
  actionTitle: string;
  actionHours: string;
  actionImportance: PriorityLevel;
  actionUrgency: PriorityLevel;
  onProjectTitleChange: (value: string) => void;
  onProjectOutcomeChange: (value: string) => void;
  onProjectPillarIdChange: (value: string) => void;
  onProjectPriorityChange: (value: ProjectPriority) => void;
  onProjectTargetDateChange: (value: string) => void;
  onActionTitleChange: (value: string) => void;
  onActionHoursChange: (value: string) => void;
  onActionImportanceChange: (value: PriorityLevel) => void;
  onActionUrgencyChange: (value: PriorityLevel) => void;
  onSaveProject: () => void;
  onMoveProjectPriority: (project: LifeItem, priority: ProjectPriority) => void;
  onMoveAction: (action: LifeItem, quadrant: PriorityQuadrant) => void;
  onCompleteAction: (action: LifeItem) => void;
  onSetProjectStatus: (
    project: LifeItem,
    status: ProjectLifecycleStatus,
  ) => void;
  onSetProjectDeadline: (
    project: LifeItem,
    targetDate: string | null,
  ) => void;
  onQuickAddAction: (
    projectId: string,
    title: string,
    hours: number,
    importance: PriorityLevel,
    urgency: PriorityLevel,
    when?: string,
  ) => void;
  onOpenProjectsMatrix: () => void;
  onUpdateActionLevels?: (
    action: LifeItem,
    importance: PriorityLevel,
    urgency: PriorityLevel,
  ) => void;
};

const AREA_ICONS = ["🌿", "💪", "💼", "🏠", "🎯", "📚", "💚", "✨"];

function areaIcon(pillar: LifeItem, index: number) {
  const icon = str(pillar, "icon");
  if (icon && !icon.includes("outline") && icon.length <= 3) return icon;
  return AREA_ICONS[index % AREA_ICONS.length];
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function LevelChips({
  value,
  onChange,
  label,
}: {
  value: PriorityLevel;
  onChange: (value: PriorityLevel) => void;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {PRIORITY_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              value === level
                ? "bg-[#14241f] text-[#f4f5f0]"
                : "border border-[#dde2dd] bg-white text-[#14241f]"
            }`}
            onClick={() => onChange(level)}
          >
            {PRIORITY_LEVEL_META[level].title}
          </button>
        ))}
      </div>
    </div>
  );
}

function HillsHero() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#dde2dd] bg-gradient-to-br from-[#eef3ea] via-[#f7f5ef] to-[#e8eef6] px-5 py-6">
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full opacity-70"
        viewBox="0 0 600 120"
        preserveAspectRatio="none"
      >
        <path
          d="M0 80 C120 40 180 100 300 70 C420 40 480 90 600 55 L600 120 L0 120 Z"
          fill="#c9d6c4"
        />
        <path
          d="M0 95 C140 70 220 110 340 85 C460 60 520 100 600 78 L600 120 L0 120 Z"
          fill="#a8bfa0"
        />
        <path
          d="M0 40 C80 20 110 55 160 35"
          fill="none"
          stroke="#617a57"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
      <div className="relative max-w-xl space-y-2">
        <h1 className="font-serif text-4xl text-[#14241f]">Plan</h1>
        <p className="text-lg font-medium text-[#24362f]">
          Decide what exists and what matters.
        </p>
        <p className="text-sm leading-relaxed text-[#6c7771]">
          Shape Areas, commit Projects, and park Ideas until they earn a place
          in the week — then let Today execute.
        </p>
      </div>
    </div>
  );
}

function ProgressBar({ value, tone = "sage" }: { value: number; tone?: "sage" | "warn" }) {
  const clamped = Math.max(0, Math.min(value, 100));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#dde2dd]">
      <div
        className={`h-full ${tone === "warn" ? "bg-[#c9634f]" : "bg-[#617a57]"}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

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
          <div>
            <h3 className="font-serif text-2xl text-[#14241f]">{title}</h3>
            {subtitle ? (
              <p className="mt-1 text-sm text-[#6c7771]">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded-full border border-[#dde2dd] bg-white px-3 py-1 text-xs font-bold"
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

function sortedProjects(projects: LifeItem[]) {
  return [...projects].sort((a, b) => {
    const statusDelta =
      projectStatusRank(a.status) - projectStatusRank(b.status);
    if (statusDelta !== 0) return statusDelta;
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

function nextAction(items: LifeItem[], projectId: string) {
  return (
    items.find(
      (item) =>
        item.kind === "ACTION" && item.parentId === projectId && open(item),
    ) ?? null
  );
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
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const [areaTab, setAreaTab] = useState<"overview" | "projects">("overview");
  const [projectTab, setProjectTab] = useState<
    "actions" | "notes" | "files" | "details"
  >("actions");
  const [composerOpen, setComposerOpen] = useState(false);
  const [addActionOpen, setAddActionOpen] = useState(false);
  const [actionDetailsOpen, setActionDetailsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [evaluateOpen, setEvaluateOpen] = useState(false);
  const [convertStep, setConvertStep] = useState<0 | 1 | 2 | 3>(0);

  const [search, setSearch] = useState("");
  const [filterAreaId, setFilterAreaId] = useState("");
  const [filterPriority, setFilterPriority] = useState<ProjectPriority | "">("");
  const [filterStatus, setFilterStatus] = useState<"ACTIVE" | "DONE" | "">(
    "ACTIVE",
  );
  const [sortBy, setSortBy] = useState<"priority" | "title" | "hours">("priority");

  const [quickTitle, setQuickTitle] = useState("");
  const [quickHours, setQuickHours] = useState("0.5");
  const [quickWhen, setQuickWhen] = useState<"Today" | "This week" | "Later">(
    "This week",
  );
  const [quickImportance, setQuickImportance] = useState<PriorityLevel>("HIGH");
  const [quickUrgency, setQuickUrgency] = useState<PriorityLevel>("LOW");

  const [evalImpact, setEvalImpact] = useState(7);
  const [evalEffort, setEvalEffort] = useState(4);
  const [evalAlignment, setEvalAlignment] = useState(8);
  const [evalTiming, setEvalTiming] = useState(6);
  const [evalNotes, setEvalNotes] = useState("");

  useEffect(() => {
    if (props.projectTitle.trim()) {
      setComposerOpen(true);
      setProjectsView("list");
    }
  }, [props.projectTitle]);

  useEffect(() => {
    // When parent forces Projects for matrix deep-link
    if (planSegment === "projects") {
      /* keep current projectsView */
    } else {
      setSelectedProjectId(null);
    }
  }, [planSegment]);

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
  const evaluatedIdeas = allIdeas.filter((idea) => idea.status === "EVALUATED");

  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? null;
  const selectedArea =
    pillars.find((pillar) => pillar.id === selectedAreaId) ?? null;
  const selectedIdea =
    allIdeas.find((idea) => idea.id === selectedIdeaId) ?? null;

  const plannedHours = openActions.reduce(
    (sum, action) => sum + num(action, "hours", 1),
    0,
  );
  const capacityPct =
    availableHours > 0 ? Math.round((plannedHours / availableHours) * 100) : 0;

  const filteredProjects = useMemo(() => {
    let list = [...projects];
    if (filterAreaId) list = list.filter((p) => p.parentId === filterAreaId);
    if (filterPriority) {
      list = list.filter(
        (p) => projectPriorityLevel(p.body) === filterPriority,
      );
    }
    if (filterStatus === "ACTIVE") list = list.filter((p) => open(p));
    if (filterStatus === "DONE") list = list.filter((p) => p.status === "DONE");
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          str(p, "outcome").toLowerCase().includes(q),
      );
    }
    list = sortedProjects(list);
    if (sortBy === "title") {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "hours") {
      list = [...list].sort(
        (a, b) => projectHours(items, b.id) - projectHours(items, a.id),
      );
    }
    return list;
  }, [
    projects,
    filterAreaId,
    filterPriority,
    filterStatus,
    search,
    sortBy,
    items,
  ]);

  const activeFilterChips: { id: string; label: string; clear: () => void }[] =
    [];
  if (filterAreaId) {
    const area = pillars.find((p) => p.id === filterAreaId);
    activeFilterChips.push({
      id: "area",
      label: area?.title ?? "Area",
      clear: () => setFilterAreaId(""),
    });
  }
  if (filterPriority) {
    activeFilterChips.push({
      id: "priority",
      label: PROJECT_PRIORITY_META[filterPriority].title,
      clear: () => setFilterPriority(""),
    });
  }
  if (filterStatus) {
    activeFilterChips.push({
      id: "status",
      label: filterStatus === "DONE" ? "Done" : "Active",
      clear: () => setFilterStatus(""),
    });
  }

  function openMatrix() {
    setSelectedProjectId(null);
    setSelectedAreaId(null);
    setProjectsView("matrix");
    props.onOpenProjectsMatrix();
  }

  function submitQuickAction(projectId: string) {
    if (!quickTitle.trim()) return;
    const hours = Number(quickHours);
    props.onQuickAddAction(
      projectId,
      quickTitle.trim(),
      Number.isFinite(hours) && hours > 0 ? hours : 0.5,
      quickImportance,
      quickUrgency,
      quickWhen,
    );
    setQuickTitle("");
    setQuickHours("0.5");
    setQuickWhen("This week");
    setQuickImportance("HIGH");
    setQuickUrgency("LOW");
    setAddActionOpen(false);
    setActionDetailsOpen(false);
  }

  // ——— Ideas ———
  if (planSegment === "ideas") {
    if (convertStep > 0 && selectedIdea) {
      return (
        <section className="space-y-4">
          <button
            type="button"
            className="text-sm font-bold text-[#617a57]"
            onClick={() => setConvertStep(0)}
          >
            ← Idea
          </button>
          <h2 className="font-serif text-2xl">Turn into project</h2>
          <p className="text-sm text-[#6c7771]">
            Step {convertStep} of 3 — from idea to committed outcome.
          </p>
          <div className="flex gap-2">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`h-1.5 flex-1 rounded-full ${
                  convertStep >= step ? "bg-[#617a57]" : "bg-[#dde2dd]"
                }`}
              />
            ))}
          </div>

          {convertStep === 1 ? (
            <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
                Project
              </p>
              <input
                className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                value={props.projectTitle}
                onChange={(e) => props.onProjectTitleChange(e.target.value)}
                placeholder="Project title"
              />
              <textarea
                className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                value={props.projectOutcome}
                onChange={(e) => props.onProjectOutcomeChange(e.target.value)}
                placeholder="Outcome"
              />
              <select
                className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                value={props.projectPillarId}
                onChange={(e) => props.onProjectPillarIdChange(e.target.value)}
              >
                <option value="">Select area</option>
                {pillars.map((pillar) => (
                  <option key={pillar.id} value={pillar.id}>
                    {pillar.title}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-3 gap-2">
                {PROJECT_PRIORITIES.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-xs font-bold ${
                      props.projectPriority === id
                        ? "border-[#14241f] bg-[#14241f] text-white"
                        : "border-[#dde2dd] bg-white"
                    }`}
                    onClick={() => props.onProjectPriorityChange(id)}
                  >
                    {PROJECT_PRIORITY_META[id].title}
                  </button>
                ))}
              </div>
              <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
                  Deadline (optional)
                </span>
                <input
                  type="date"
                  className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                  value={props.projectTargetDate}
                  onChange={(e) =>
                    props.onProjectTargetDateChange(e.target.value)
                  }
                />
              </label>
              <button
                type="button"
                className="rounded-xl bg-[#14241f] px-4 py-3 text-xs font-bold text-white"
                onClick={() => setConvertStep(2)}
              >
                Continue to first action
              </button>
            </article>
          ) : null}

          {convertStep === 2 ? (
            <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
                First action
              </p>
              <input
                className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                value={props.actionTitle}
                onChange={(e) => props.onActionTitleChange(e.target.value)}
                placeholder="What needs to happen?"
              />
              <input
                className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                value={props.actionHours}
                onChange={(e) => props.onActionHoursChange(e.target.value)}
                placeholder="Estimate hours"
              />
              <LevelChips
                label="Importance"
                value={props.actionImportance}
                onChange={props.onActionImportanceChange}
              />
              <LevelChips
                label="Urgency"
                value={props.actionUrgency}
                onChange={props.onActionUrgencyChange}
              />
              <div className="rounded-xl border border-[#dde2dd] bg-[#f7f8f5] p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
                  Preview · Next action
                </p>
                <p className="mt-1 font-semibold">{props.actionTitle || "—"}</p>
                <p className="text-xs text-[#6c7771]">
                  {props.actionHours || "?"}h ·{" "}
                  {
                    PRIORITY_QUADRANT_META[
                      actionPriorityQuadrant({
                        importance: props.actionImportance,
                        urgency: props.actionUrgency,
                      })
                    ].label
                  }
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-[#dde2dd] px-4 py-3 text-xs font-bold"
                  onClick={() => setConvertStep(1)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-[#14241f] px-4 py-3 text-xs font-bold text-white"
                  onClick={() => setConvertStep(3)}
                >
                  Review
                </button>
              </div>
            </article>
          ) : null}

          {convertStep === 3 ? (
            <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
                Review
              </p>
              <p className="font-serif text-xl">{props.projectTitle}</p>
              <p className="text-sm text-[#6c7771]">{props.projectOutcome}</p>
              <p className="text-sm">
                Next: {props.actionTitle} · {props.actionHours}h
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-[#dde2dd] px-4 py-3 text-xs font-bold"
                  onClick={() => setConvertStep(2)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-[#14241f] px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
                  disabled={busy}
                  onClick={() => {
                    props.onSaveProject();
                    setConvertStep(0);
                    setSelectedIdeaId(null);
                  }}
                >
                  Create project
                </button>
              </div>
            </article>
          ) : null}
        </section>
      );
    }

    if (selectedIdea) {
      const area = pillars.find((p) => p.id === selectedIdea.parentId);
      const overall =
        (num(selectedIdea, "impact", 0) +
          num(selectedIdea, "alignment", 0) +
          num(selectedIdea, "timing", 0) +
          (10 - num(selectedIdea, "effort", 0))) /
        4;
      return (
        <section className="space-y-4">
          <button
            type="button"
            className="text-sm font-bold text-[#617a57]"
            onClick={() => setSelectedIdeaId(null)}
          >
            ← Ideas
          </button>
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#dbe8d7] text-2xl">
              💡
            </div>
            <div>
              <h2 className="font-serif text-2xl">{selectedIdea.title}</h2>
              <p className="text-sm text-[#6c7771]">
                {area?.title ?? "No area"} ·{" "}
                {relativeTime(selectedIdea.updatedAt || selectedIdea.createdAt)}
              </p>
            </div>
          </div>
          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
              Why this idea?
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#14241f]">
              {str(selectedIdea, "note") ||
                "Capture the spark. Clarify why it matters when you evaluate."}
            </p>
          </article>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="rounded-xl border border-[#dde2dd] bg-white px-4 py-3 text-sm font-bold"
              disabled={busy}
              onClick={() => {
                setEvalImpact(num(selectedIdea, "impact", 7) || 7);
                setEvalEffort(num(selectedIdea, "effort", 4) || 4);
                setEvalAlignment(num(selectedIdea, "alignment", 8) || 8);
                setEvalTiming(num(selectedIdea, "timing", 6) || 6);
                setEvalNotes(str(selectedIdea, "evalNotes"));
                setEvaluateOpen(true);
              }}
            >
              Evaluate
            </button>
            <button
              type="button"
              className="rounded-xl bg-[#14241f] px-4 py-3 text-sm font-bold text-white"
              onClick={() => {
                props.onConvertIdea(selectedIdea);
                setConvertStep(1);
              }}
            >
              Turn into project
            </button>
          </div>
          <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5 text-sm">
            {(
              [
                ["Area", area?.title ?? "—"],
                ["Related project", "—"],
                ["Status", selectedIdea.status === "EVALUATED" ? "Evaluated" : "Inbox"],
                ["Captured", relativeTime(selectedIdea.createdAt)],
                ["Notes", str(selectedIdea, "note") || "—"],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="flex items-start justify-between gap-3 border-t border-[#dde2dd] pt-3 first:border-t-0 first:pt-0"
              >
                <span className="text-[#6c7771]">{label}</span>
                <span className="text-right font-medium text-[#14241f]">
                  {value}
                </span>
              </div>
            ))}
          </article>
          {selectedIdea.status === "EVALUATED" ? (
            <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
                Overall /10
              </p>
              <p className="mt-1 font-serif text-3xl">
                {overall.toFixed(1)}
              </p>
              <p className="text-sm text-[#6c7771]">
                {overall >= 7
                  ? "Strong candidate — consider turning into a project."
                  : overall >= 5
                    ? "Promising — refine or park for later."
                    : "Light signal — keep in inbox or discard."}
              </p>
            </article>
          ) : null}
          <article className="rounded-2xl border border-[#dde2dd] bg-[#eef3ea] p-4 text-sm text-[#24362f]">
            Next step suggestions: define the outcome, pick an area, then write
            one concrete first action.
          </article>

          {evaluateOpen ? (
            <Sheet
              title="Evaluate idea"
              subtitle="Score Impact, Effort, Alignment, and Timing (1–10)."
              onClose={() => setEvaluateOpen(false)}
            >
              {(
                [
                  ["Impact", evalImpact, setEvalImpact],
                  ["Effort", evalEffort, setEvalEffort],
                  ["Alignment", evalAlignment, setEvalAlignment],
                  ["Timing", evalTiming, setEvalTiming],
                ] as const
              ).map(([label, value, setter]) => (
                <label key={label} className="mb-4 block space-y-2">
                  <div className="flex justify-between text-sm font-bold">
                    <span>{label}</span>
                    <span>{value}/10</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={value}
                    onChange={(e) => setter(Number(e.target.value))}
                    className="w-full"
                  />
                </label>
              ))}
              <div className="mb-4 rounded-2xl border border-[#dde2dd] bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
                  Overall
                </p>
                <p className="font-serif text-3xl">
                  {(
                    (evalImpact + evalAlignment + evalTiming + (10 - evalEffort)) /
                    4
                  ).toFixed(1)}
                  <span className="text-base text-[#6c7771]"> /10</span>
                </p>
                <p className="mt-1 text-sm text-[#6c7771]">
                  Impact + Alignment + Timing − Effort, scaled to /10.
                </p>
              </div>
              <textarea
                className="mb-4 w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                placeholder="Notes"
                value={evalNotes}
                onChange={(e) => setEvalNotes(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-[#14241f] px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
                  disabled={busy}
                  onClick={() => {
                    props.onEvaluateIdea(selectedIdea, {
                      impact: evalImpact,
                      effort: evalEffort,
                      alignment: evalAlignment,
                      timing: evalTiming,
                      notes: evalNotes,
                    });
                    setEvaluateOpen(false);
                  }}
                >
                  Save evaluation
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-[#dde2dd] bg-white px-4 py-3 text-xs font-bold"
                  onClick={() => {
                    props.onEvaluateIdea(selectedIdea, {
                      impact: evalImpact,
                      effort: evalEffort,
                      alignment: evalAlignment,
                      timing: evalTiming,
                      notes: evalNotes,
                    });
                    props.onConvertIdea(selectedIdea);
                    setEvaluateOpen(false);
                    setConvertStep(1);
                  }}
                >
                  Turn into project
                </button>
              </div>
            </Sheet>
          ) : null}
        </section>
      );
    }

    const list = ideasTab === "inbox" ? inboxIdeas : evaluatedIdeas;
    return (
      <section className="space-y-4">
        <HillsHero />
        <div>
          <h2 className="font-serif text-3xl text-[#14241f]">Ideas</h2>
          <p className="text-sm text-[#6c7771]">Capture now. Clarify later.</p>
        </div>
        <div className="flex gap-2">
          {(
            [
              ["inbox", `Inbox (${inboxIdeas.length})`],
              ["evaluated", `Evaluated (${evaluatedIdeas.length})`],
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

        <div className="flex gap-2 rounded-2xl border border-[#dde2dd] bg-white p-2">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#14241f] text-xl text-white"
            aria-label="Capture idea"
            disabled={busy}
            onClick={props.onSaveIdea}
          >
            +
          </button>
          <input
            className="flex-1 rounded-xl px-2 py-2 outline-none"
            placeholder="Capture an idea…"
            value={props.ideaTitle}
            onChange={(e) => props.onIdeaTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") props.onSaveIdea();
            }}
          />
          <button
            type="button"
            className="rounded-xl border border-[#dde2dd] px-3 text-xs font-bold text-[#6c7771]"
            title="Voice capture coming soon"
          >
            Mic
          </button>
        </div>

        {list.length === 0 ? (
          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
            <p className="font-serif text-xl text-[#14241f]">
              {ideasTab === "inbox" ? "Inbox is clear" : "Nothing evaluated yet"}
            </p>
            <p className="mt-1 text-sm text-[#6c7771]">
              Rough captures land here until you evaluate or convert them.
            </p>
          </article>
        ) : (
          list.map((idea, index) => {
            const area = pillars.find((p) => p.id === idea.parentId);
            return (
              <button
                key={idea.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl border border-[#dde2dd] bg-white p-4 text-left"
                onClick={() => setSelectedIdeaId(idea.id)}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef3ea] text-lg">
                  {AREA_ICONS[index % AREA_ICONS.length]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[#14241f]">
                    {idea.title}
                  </p>
                  <p className="text-xs text-[#6c7771]">
                    {area ? (
                      <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#617a57]" />
                    ) : null}
                    {area?.title ?? "Unassigned"} ·{" "}
                    {relativeTime(idea.updatedAt || idea.createdAt)}
                  </p>
                </div>
                <span className="text-[#6c7771]">›</span>
              </button>
            );
          })
        )}

        <article className="rounded-2xl border border-[#dde2dd] bg-[#eef3ea] p-4 text-sm text-[#24362f]">
          Tip: capture freely. Evaluation and project conversion are separate
          steps — do not force classification up front.
        </article>
      </section>
    );
  }

  // ——— Areas ———
  if (planSegment === "areas") {
    if (selectedProject) {
      return (
        <ProjectDetailView
          project={selectedProject}
          pillars={pillars}
          items={items}
          busy={busy}
          projectTab={projectTab}
          setProjectTab={setProjectTab}
          onBack={() => setSelectedProjectId(null)}
          onMovePriority={props.onMoveProjectPriority}
          onCompleteAction={props.onCompleteAction}
          onSetProjectStatus={props.onSetProjectStatus}
          onSetProjectDeadline={props.onSetProjectDeadline}
          onShowMatrix={openMatrix}
          onOpenAddAction={() => setAddActionOpen(true)}
        />
      );
    }

    if (selectedArea) {
      const areaProjects = sortedProjects(
        projects.filter(
          (project) => project.parentId === selectedArea.id && open(project),
        ),
      );
      const hours = areaProjects.reduce(
        (sum, project) => sum + projectHours(items, project.id),
        0,
      );
      const pct =
        availableHours > 0 ? Math.round((hours / availableHours) * 100) : 0;
      const openActionCount = items.filter(
        (item) =>
          item.kind === "ACTION" &&
          open(item) &&
          areaProjects.some((p) => p.id === item.parentId),
      ).length;
      const index = pillars.findIndex((p) => p.id === selectedArea.id);

      return (
        <section className="space-y-4">
          <button
            type="button"
            className="text-sm font-bold text-[#617a57]"
            onClick={() => setSelectedAreaId(null)}
          >
            ← Areas
          </button>
          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dbe8d7] text-3xl">
              {areaIcon(selectedArea, Math.max(index, 0))}
            </div>
            <div>
              <h2 className="font-serif text-3xl">{selectedArea.title}</h2>
              <p className="text-sm text-[#6c7771]">
                {str(selectedArea, "tagline") ||
                  "Projects and capacity for this life domain."}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {(
              [
                ["overview", "Overview"],
                ["projects", `Projects (${areaProjects.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  areaTab === id
                    ? "bg-[#617a57] text-white"
                    : "border border-[#dde2dd] bg-white"
                }`}
                onClick={() => setAreaTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {areaTab === "overview" ? (
            <>
              <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
                  Weekly capacity
                </p>
                <div className="mt-3 flex items-center gap-4">
                  <div
                    className="relative flex h-24 w-24 items-center justify-center rounded-full"
                    style={{
                      background: `conic-gradient(#617a57 ${Math.min(pct, 100)}%, #dde2dd 0)`,
                    }}
                  >
                    <div className="flex h-[4.5rem] w-[4.5rem] flex-col items-center justify-center rounded-full bg-white">
                      <span className="font-serif text-xl">{pct}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-serif text-2xl text-[#14241f]">
                      {hours.toFixed(1)}h of {availableHours}h
                    </p>
                    <p className="text-sm text-[#6c7771]">Committed this week</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-[#f7f8f5] p-3">
                    <p className="font-serif text-xl">{hours.toFixed(0)}</p>
                    <p className="text-[11px] text-[#6c7771]">Hours</p>
                  </div>
                  <div className="rounded-xl bg-[#f7f8f5] p-3">
                    <p className="font-serif text-xl">{areaProjects.length}</p>
                    <p className="text-[11px] text-[#6c7771]">Projects</p>
                  </div>
                  <div className="rounded-xl bg-[#f7f8f5] p-3">
                    <p className="font-serif text-xl">{openActionCount}</p>
                    <p className="text-[11px] text-[#6c7771]">Open actions</p>
                  </div>
                </div>
              </article>
              {pct > 85 ? (
                <article className="rounded-2xl border border-[#c9634f]/30 bg-[#f8e4df]/50 p-4 text-sm text-[#14241f]">
                  Focus: this area is near capacity — protect Do Now work and
                  defer low-leverage actions.
                </article>
              ) : null}
            </>
          ) : null}

          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
              Active projects
            </p>
            {areaProjects.length === 0 ? (
              <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 text-sm text-[#6c7771]">
                No active projects in this area yet.
              </article>
            ) : (
              areaProjects.map((project) => {
                const next = nextAction(items, project.id);
                const level = projectPriorityLevel(project.body);
                const h = projectHours(items, project.id);
                const deadline = projectTargetDate(project.body);
                const overdue = isProjectDeadlineOverdue(
                  project.body,
                  project.status,
                );
                return (
                  <button
                    key={project.id}
                    type="button"
                    className={`block w-full rounded-2xl border p-4 text-left ${
                      overdue
                        ? "border-[#e7b7ad] bg-[#fdf4f1]"
                        : "border-[#dde2dd] bg-white"
                    }`}
                    onClick={() => setSelectedProjectId(project.id)}
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
                    <p className="mt-2 text-sm text-[#14241f]">
                      ○ Next: {next ? next.title : "Define next action"}
                    </p>
                    <p
                      className={`mt-1 text-xs ${
                        overdue
                          ? "font-bold text-[#c9634f]"
                          : "text-[#6c7771]"
                      }`}
                    >
                      {h.toFixed(1)}h this week
                      {deadline
                        ? ` · ${overdue ? "Overdue" : "Due"} ${deadline}`
                        : ""}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </section>
      );
    }

    return (
      <section className="space-y-4">
        <HillsHero />
        <div className="space-y-3">
          {pillars.map((pillar, index) => {
            const pillarProjects = projects.filter(
              (project) => project.parentId === pillar.id && open(project),
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
                className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-[#dde2dd] bg-white p-4 text-left"
                onClick={() => {
                  setSelectedAreaId(pillar.id);
                  setAreaTab("overview");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedAreaId(pillar.id);
                    setAreaTab("overview");
                  }
                }}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef3ea] text-2xl">
                  {areaIcon(pillar, index)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif text-xl text-[#14241f]">
                      {pillar.title}
                    </h3>
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
                  <p className="mt-1 text-sm text-[#14241f]">
                    {pillarProjects.length} active project
                    {pillarProjects.length === 1 ? "" : "s"}
                  </p>
                  <p className="text-sm text-[#6c7771]">
                    {hours.toFixed(1)}h this week · {pct}% capacity
                  </p>
                  <div className="mt-2">
                    <ProgressBar value={pct} tone={pct > 100 ? "warn" : "sage"} />
                  </div>
                </div>
                <span className="text-lg text-[#6c7771]">›</span>
              </div>
            );
          })}
        </div>
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

  // ——— Projects ———
  if (selectedProject) {
    return (
      <>
        <ProjectDetailView
          project={selectedProject}
          pillars={pillars}
          items={items}
          busy={busy}
          projectTab={projectTab}
          setProjectTab={setProjectTab}
          onBack={() => setSelectedProjectId(null)}
          onMovePriority={props.onMoveProjectPriority}
          onCompleteAction={props.onCompleteAction}
          onSetProjectStatus={props.onSetProjectStatus}
          onSetProjectDeadline={props.onSetProjectDeadline}
          onShowMatrix={openMatrix}
          onOpenAddAction={() => setAddActionOpen(true)}
        />
        {addActionOpen ? (
          <AddActionSheet
            busy={busy}
            title={quickTitle}
            hours={quickHours}
            when={quickWhen}
            importance={quickImportance}
            urgency={quickUrgency}
            projects={projects.filter(
              (project) =>
                project.status !== "DONE" &&
                project.status !== "ARCHIVED" &&
                project.status !== "CONVERTED",
            )}
            projectId={selectedProject.id}
            detailsOpen={actionDetailsOpen}
            onTitle={setQuickTitle}
            onHours={setQuickHours}
            onWhen={setQuickWhen}
            onImportance={setQuickImportance}
            onUrgency={setQuickUrgency}
            onOpenDetails={() => setActionDetailsOpen(true)}
            onClose={() => {
              setAddActionOpen(false);
              setActionDetailsOpen(false);
            }}
            onSave={() => submitQuickAction(selectedProject.id)}
          />
        ) : null}
      </>
    );
  }

  return (
    <section className="space-y-4">
      {projectsView === "list" ? <HillsHero /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl text-[#14241f]">Projects</h2>
          <p className="text-sm text-[#6c7771]">
            Outcomes across areas — High / Med / Low, not Eisenhower.
          </p>
        </div>
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
            onClick={() => setComposerOpen((openState) => !openState)}
          >
            + Add project
          </button>
        </div>
      </div>

      {projectsView === "matrix" ? (
        <PriorityMatrixPanel
          actions={openActions}
          projects={projects}
          areas={pillars}
          busy={busy}
          onMove={props.onMoveAction}
          onViewList={() => setProjectsView("list")}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <input
              className="min-w-[12rem] flex-1 rounded-full border border-[#dde2dd] bg-white px-4 py-2 text-sm"
              placeholder="Search projects"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              className="rounded-full border border-[#dde2dd] bg-white px-3 py-2 text-xs font-bold"
              onClick={() => setFilterOpen(true)}
            >
              Filter
            </button>
            <select
              className="rounded-full border border-[#dde2dd] bg-white px-3 py-2 text-xs font-bold"
              value={filterAreaId}
              onChange={(e) => setFilterAreaId(e.target.value)}
            >
              <option value="">All areas</option>
              {pillars.map((pillar) => (
                <option key={pillar.id} value={pillar.id}>
                  {pillar.title}
                </option>
              ))}
            </select>
            <select
              className="rounded-full border border-[#dde2dd] bg-white px-3 py-2 text-xs font-bold"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "priority" | "title" | "hours")
              }
            >
              <option value="priority">Sort: Priority</option>
              <option value="title">Sort: Title</option>
              <option value="hours">Sort: Hours</option>
            </select>
          </div>

          {activeFilterChips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  className="rounded-full bg-[#dbe8d7] px-3 py-1 text-xs font-bold text-[#617a57]"
                  onClick={chip.clear}
                >
                  {chip.label} ×
                </button>
              ))}
              <button
                type="button"
                className="text-xs font-bold text-[#6c7771]"
                onClick={() => {
                  setFilterAreaId("");
                  setFilterPriority("");
                  setFilterStatus("ACTIVE");
                }}
              >
                Clear all
              </button>
            </div>
          ) : null}

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
              <div className="grid grid-cols-3 gap-2">
                {PROJECT_PRIORITIES.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-xs font-bold ${
                      props.projectPriority === id
                        ? "border-[#14241f] bg-[#14241f] text-white"
                        : "border-[#dde2dd] bg-white"
                    }`}
                    onClick={() => props.onProjectPriorityChange(id)}
                  >
                    {PROJECT_PRIORITY_META[id].title}
                  </button>
                ))}
              </div>
              <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
                  Deadline (optional)
                </span>
                <input
                  type="date"
                  className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                  value={props.projectTargetDate}
                  onChange={(e) =>
                    props.onProjectTargetDateChange(e.target.value)
                  }
                />
              </label>
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
              <LevelChips
                label="Importance"
                value={props.actionImportance}
                onChange={props.onActionImportanceChange}
              />
              <LevelChips
                label="Urgency"
                value={props.actionUrgency}
                onChange={props.onActionUrgencyChange}
              />
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

          <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
            {filterStatus === "DONE"
              ? "Done projects"
              : filterStatus === "ACTIVE"
                ? "Active projects"
                : "Projects"}{" "}
            · {filteredProjects.length}
          </p>

          {filteredProjects.length === 0 ? (
            <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
              <p className="font-serif text-xl">No projects yet</p>
              <p className="mt-1 text-sm text-[#6c7771]">
                Create a project with a first next action, or turn an idea into
                a project.
              </p>
            </article>
          ) : (
            filteredProjects.map((project, index) => {
              const next = nextAction(items, project.id);
              const level = projectPriorityLevel(project.body);
              const area = pillars.find((pillar) => pillar.id === project.parentId);
              const hours = projectHours(items, project.id);
              const deadline = projectTargetDate(project.body);
              const overdue = isProjectDeadlineOverdue(
                project.body,
                project.status,
              );
              return (
                <button
                  key={project.id}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${
                    overdue
                      ? "border-[#e7b7ad] bg-[#fdf4f1]"
                      : "border-[#dde2dd] bg-white"
                  }`}
                  onClick={() => {
                    setSelectedProjectId(project.id);
                    setProjectTab("actions");
                  }}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef3ea] text-lg">
                    {AREA_ICONS[index % AREA_ICONS.length]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-serif text-xl text-[#14241f]">
                        {project.title}
                      </h3>
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
                      {projectStatusLabel(project.status)} ·{" "}
                      {area?.title ?? "Unassigned"}
                    </p>
                    <p className="mt-1 text-sm font-medium text-[#14241f]">
                      ○ Next: {next ? next.title : "Define next action"}
                    </p>
                    <p
                      className={`mt-1 text-xs ${
                        overdue
                          ? "font-bold text-[#c9634f]"
                          : "text-[#6c7771]"
                      }`}
                    >
                      {hours.toFixed(1)}h this week
                      {deadline
                        ? ` · ${overdue ? "Overdue" : "Due"} ${deadline}`
                        : ""}
                    </p>
                  </div>
                  <span className="text-[#6c7771]">›</span>
                </button>
              );
            })
          )}

          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
              Capacity this week
            </p>
            <p className="mt-1 font-serif text-2xl text-[#14241f]">
              Total planned {plannedHours.toFixed(1)} of {availableHours} capacity
            </p>
            <p className="text-sm text-[#6c7771]">{capacityPct}% used</p>
            <div className="mt-3">
              <ProgressBar
                value={capacityPct}
                tone={capacityPct > 100 ? "warn" : "sage"}
              />
            </div>
          </article>
        </>
      )}

      {filterOpen ? (
        <Sheet
          title="Filter & sort"
          subtitle="Narrow projects, then apply."
          onClose={() => setFilterOpen(false)}
        >
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
            Area
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <Chip
              active={!filterAreaId}
              onClick={() => setFilterAreaId("")}
              label="All"
            />
            {pillars.map((pillar) => (
              <Chip
                key={pillar.id}
                active={filterAreaId === pillar.id}
                onClick={() => setFilterAreaId(pillar.id)}
                label={pillar.title}
              />
            ))}
          </div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
            Priority
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <Chip
              active={!filterPriority}
              onClick={() => setFilterPriority("")}
              label="Any"
            />
            {PROJECT_PRIORITIES.map((id) => (
              <Chip
                key={id}
                active={filterPriority === id}
                onClick={() => setFilterPriority(id)}
                label={PROJECT_PRIORITY_META[id].title}
              />
            ))}
          </div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
            Status
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <Chip
              active={filterStatus === "ACTIVE"}
              onClick={() => setFilterStatus("ACTIVE")}
              label="Active"
            />
            <Chip
              active={filterStatus === "DONE"}
              onClick={() => setFilterStatus("DONE")}
              label="Done"
            />
            <Chip
              active={filterStatus === ""}
              onClick={() => setFilterStatus("")}
              label="Any"
            />
          </div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
            Sort by
          </p>
          <div className="mb-4 space-y-2">
            {(
              [
                ["priority", "Priority"],
                ["title", "Title"],
                ["hours", "Hours this week"],
              ] as const
            ).map(([id, label]) => (
              <label key={id} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={sortBy === id}
                  onChange={() => setSortBy(id)}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="mb-4 rounded-xl border border-[#dde2dd] bg-white p-3 text-sm">
            Preview: {filteredProjects.length} projects match
          </div>
          <button
            type="button"
            className="w-full rounded-xl bg-[#14241f] px-4 py-3 text-xs font-bold text-white"
            onClick={() => setFilterOpen(false)}
          >
            Apply filters
            {activeFilterChips.length
              ? ` (${activeFilterChips.length})`
              : ""}
          </button>
        </Sheet>
      ) : null}
    </section>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`rounded-full px-3 py-1.5 text-xs font-bold ${
        active
          ? "bg-[#617a57] text-white"
          : "border border-[#dde2dd] bg-white text-[#14241f]"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function AddActionSheet({
  busy,
  title,
  hours,
  when,
  importance,
  urgency,
  projects,
  projectId,
  detailsOpen,
  onTitle,
  onHours,
  onWhen,
  onImportance,
  onUrgency,
  onOpenDetails,
  onClose,
  onSave,
}: {
  busy: boolean;
  title: string;
  hours: string;
  when: "Today" | "This week" | "Later";
  importance: PriorityLevel;
  urgency: PriorityLevel;
  projects: LifeItem[];
  projectId: string;
  detailsOpen: boolean;
  onTitle: (value: string) => void;
  onHours: (value: string) => void;
  onWhen: (value: "Today" | "This week" | "Later") => void;
  onImportance: (value: PriorityLevel) => void;
  onUrgency: (value: PriorityLevel) => void;
  onOpenDetails: () => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const project = projects.find((p) => p.id === projectId);
  const estimatePresets = [
    ["0.25", "15m"],
    ["0.5", "30m"],
    ["1", "1h"],
    ["2", "2h"],
  ] as const;
  const quadrant =
    PRIORITY_QUADRANT_META[
      actionPriorityQuadrant({ importance, urgency })
    ].label;

  return (
    <Sheet
      title={detailsOpen ? "Action details" : "Add action"}
      subtitle={
        detailsOpen
          ? "Importance and Urgency are Low / Medium / High — not yes/no."
          : "Capture one actionable step"
      }
      onClose={onClose}
    >
      <label className="mb-3 block space-y-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
          What needs to happen?
        </span>
        <input
          className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder="Concrete next move"
        />
      </label>
      <div className="mb-3 rounded-xl border border-[#dde2dd] bg-white px-3 py-3 text-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
          Project
        </p>
        <p className="font-semibold">{project?.title ?? "—"}</p>
      </div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
        Estimate
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {estimatePresets.map(([value, label]) => (
          <Chip
            key={value}
            active={hours === value}
            onClick={() => onHours(value)}
            label={label}
          />
        ))}
        <input
          className="w-20 rounded-full border border-[#dde2dd] px-3 py-1.5 text-xs"
          value={hours}
          onChange={(e) => onHours(e.target.value)}
          placeholder="Custom"
        />
      </div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
        When
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {(["Today", "This week", "Later"] as const).map((option) => (
          <Chip
            key={option}
            active={when === option}
            onClick={() => onWhen(option)}
            label={option}
          />
        ))}
      </div>

      {detailsOpen ? (
        <>
          <LevelChips label="Importance" value={importance} onChange={onImportance} />
          <div className="h-3" />
          <LevelChips label="Urgency" value={urgency} onChange={onUrgency} />
          <div className="my-4 rounded-xl border border-[#dde2dd] bg-white p-3 text-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
              Preview
            </p>
            <p className="font-semibold">{title || "—"}</p>
            <p className="text-xs text-[#6c7771]">
              {hours || "?"}h · {when} · {quadrant}
            </p>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="mb-4 text-left text-sm font-bold text-[#617a57]"
          onClick={onOpenDetails}
        >
          Tip: set Importance × Urgency for matrix placement → More options
        </button>
      )}

      <button
        type="button"
        className="w-full rounded-xl bg-[#14241f] px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
        disabled={busy || !title.trim()}
        onClick={onSave}
      >
        {detailsOpen ? "Save" : "Add action"}
      </button>
    </Sheet>
  );
}

function ProjectDetailView({
  project,
  pillars,
  items,
  busy,
  projectTab,
  setProjectTab,
  onBack,
  onMovePriority,
  onCompleteAction,
  onSetProjectStatus,
  onSetProjectDeadline,
  onShowMatrix,
  onOpenAddAction,
}: {
  project: LifeItem;
  pillars: LifeItem[];
  items: LifeItem[];
  busy: boolean;
  projectTab: "actions" | "notes" | "files" | "details";
  setProjectTab: (tab: "actions" | "notes" | "files" | "details") => void;
  onBack: () => void;
  onMovePriority: (project: LifeItem, priority: ProjectPriority) => void;
  onCompleteAction: (action: LifeItem) => void;
  onSetProjectStatus: (
    project: LifeItem,
    status: ProjectLifecycleStatus,
  ) => void;
  onSetProjectDeadline: (
    project: LifeItem,
    targetDate: string | null,
  ) => void;
  onShowMatrix: () => void;
  onOpenAddAction: () => void;
}) {
  const area = pillars.find((pillar) => pillar.id === project.parentId);
  const level = projectPriorityLevel(project.body);
  const statusLabel = projectStatusLabel(project.status);
  const isDone = project.status === "DONE";
  const deadline = projectTargetDate(project.body);
  const overdue = isProjectDeadlineOverdue(project.body, project.status);
  const [deadlineDraft, setDeadlineDraft] = useState(deadline ?? "");
  useEffect(() => {
    setDeadlineDraft(deadline ?? "");
  }, [project.id, deadline]);
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

  const groups: { id: string; title: string; actions: LifeItem[] }[] = [
    { id: "next", title: "Next action", actions: next ? [next] : [] },
    {
      id: "week",
      title: "This week",
      actions: openActions.filter(
        (action) =>
          action.id !== next?.id &&
          (str(action, "day") === "Today" ||
            str(action, "day") === "This week" ||
            !str(action, "day")),
      ),
    },
    {
      id: "later",
      title: "Later",
      actions: openActions.filter(
        (action) =>
          action.id !== next?.id && str(action, "day") === "Later",
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <button
        type="button"
        className="text-sm font-bold text-[#617a57]"
        onClick={onBack}
      >
        ← Projects
      </button>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#dbe8d7] text-2xl">
          🎯
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-3xl text-[#14241f]">{project.title}</h2>
          <p className="text-sm text-[#6c7771]">
            {statusLabel} · {area?.title ?? "Unassigned"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PROJECT_PRIORITIES.map((id) => (
              <button
                key={id}
                type="button"
                disabled={busy || isDone}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  level === id
                    ? "bg-[#14241f] text-white"
                    : "border border-[#dde2dd] bg-white"
                }`}
                onClick={() => onMovePriority(project, id)}
              >
                {PROJECT_PRIORITY_META[id].title}
                {id === "HIGH" ? " priority" : ""}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {isDone ? (
              <button
                type="button"
                disabled={busy}
                className="rounded-xl bg-[#14241f] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                onClick={() => onSetProjectStatus(project, "ACTIVE")}
              >
                Reopen project
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                className="rounded-xl border border-[#dde2dd] bg-white px-3 py-2 text-xs font-bold text-[#14241f] disabled:opacity-50"
                onClick={() => onSetProjectStatus(project, "DONE")}
              >
                Mark done
              </button>
            )}
          </div>
        </div>
      </div>

      <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
          Outcome
        </p>
        <p className="mt-2 font-serif text-xl leading-relaxed text-[#14241f]">
          {outcome || "Add an outcome so this project has a clear finish line."}
        </p>
      </article>

      <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
          Next action
        </p>
        {next ? (
          <div className="flex items-start gap-3">
            <button
              type="button"
              className="mt-1 flex h-5 w-5 items-center justify-center rounded-full border border-[#617a57] text-[10px]"
              disabled={busy || isDone}
              onClick={() => onCompleteAction(next)}
              aria-label="Complete next action"
            >
              ○
            </button>
            <div>
              <h3 className="font-serif text-2xl">{next.title}</h3>
              <p className="text-sm text-[#6c7771]">
                {num(next, "hours", 1)}h
                {str(next, "day") ? ` · ${str(next, "day")}` : ""} ·{" "}
                {
                  PRIORITY_QUADRANT_META[
                    actionPriorityQuadrant(next.body, project.body)
                  ].label
                }
              </p>
            </div>
          </div>
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
        <p className="font-serif text-2xl">
          {doneActions.length} of {total || "—"}
        </p>
        <ProgressBar value={progress} />
        <p
          className={`text-sm ${
            overdue ? "font-bold text-[#c9634f]" : "text-[#6c7771]"
          }`}
        >
          {hours.toFixed(1)}h planned
          {deadline
            ? ` · ${overdue ? "Overdue" : "Due"} ${deadline}`
            : " · No deadline"}
        </p>
      </article>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["actions", "Actions"],
            ["notes", "Notes"],
            ["files", "Files"],
            ["details", "Details"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              projectTab === id
                ? "bg-[#617a57] text-white"
                : "border border-[#dde2dd] bg-white"
            }`}
            onClick={() => setProjectTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {projectTab === "actions" ? (
        <div className="space-y-4">
          {groups.map((group) =>
            group.actions.length === 0 && group.id !== "next" ? null : (
              <div key={group.id} className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
                  {group.title}
                </p>
                {group.actions.length === 0 ? (
                  <p className="text-sm text-[#6c7771]">None yet.</p>
                ) : (
                  group.actions.map((action) => (
                    <div
                      key={action.id}
                      className="rounded-2xl border border-[#dde2dd] bg-white px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">{action.title}</p>
                        <span className="rounded-full bg-[#eef3ea] px-2 py-0.5 text-[10px] font-bold text-[#617a57]">
                          {
                            PRIORITY_QUADRANT_META[
                              actionPriorityQuadrant(action.body, project.body)
                            ].label
                          }
                        </span>
                      </div>
                      <p className="text-xs text-[#6c7771]">
                        {num(action, "hours", 1)}h
                        {str(action, "day") ? ` · ${str(action, "day")}` : ""}
                      </p>
                    </div>
                  ))
                )}
              </div>
            ),
          )}
          {!isDone ? (
            <button
              type="button"
              className="w-full rounded-xl bg-[#14241f] px-4 py-3 text-xs font-bold text-white"
              onClick={onOpenAddAction}
            >
              + Add action
            </button>
          ) : null}
          <button
            type="button"
            className="text-sm font-bold text-[#617a57]"
            onClick={onShowMatrix}
          >
            Tip: place these actions in the matrix → View in Matrix
          </button>
        </div>
      ) : null}

      {projectTab === "notes" ? (
        <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 text-sm text-[#6c7771]">
          Notes stub — rich notes land in a later pass.
        </article>
      ) : null}
      {projectTab === "files" ? (
        <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 text-sm text-[#6c7771]">
          Files stub — attachments come later.
        </article>
      ) : null}
      {projectTab === "details" ? (
        <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5 text-sm">
          <p>
            <span className="text-[#6c7771]">Area · </span>
            {area?.title ?? "—"}
          </p>
          <p>
            <span className="text-[#6c7771]">Priority · </span>
            {PROJECT_PRIORITY_META[level].title}
          </p>
          <p>
            <span className="text-[#6c7771]">Status · </span>
            {statusLabel}
          </p>
          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
              Deadline
            </span>
            <input
              type="date"
              className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
              value={deadlineDraft}
              disabled={busy || isDone}
              onChange={(e) => setDeadlineDraft(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || isDone || deadlineDraft === (deadline ?? "")}
              className="rounded-xl bg-[#14241f] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              onClick={() =>
                onSetProjectDeadline(project, deadlineDraft || null)
              }
            >
              Save deadline
            </button>
            <button
              type="button"
              disabled={busy || isDone || !deadline}
              className="rounded-xl border border-[#dde2dd] bg-white px-3 py-2 text-xs font-bold disabled:opacity-50"
              onClick={() => {
                setDeadlineDraft("");
                onSetProjectDeadline(project, null);
              }}
            >
              Clear deadline
            </button>
          </div>
          {overdue ? (
            <p className="text-xs font-bold text-[#c9634f]">
              This project is past its deadline.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-2">
            {isDone ? (
              <button
                type="button"
                disabled={busy}
                className="rounded-xl bg-[#14241f] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                onClick={() => onSetProjectStatus(project, "ACTIVE")}
              >
                Reopen project
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                className="rounded-xl border border-[#dde2dd] bg-white px-3 py-2 text-xs font-bold disabled:opacity-50"
                onClick={() => onSetProjectStatus(project, "DONE")}
              >
                Mark done
              </button>
            )}
          </div>
        </article>
      ) : null}
    </section>
  );
}
