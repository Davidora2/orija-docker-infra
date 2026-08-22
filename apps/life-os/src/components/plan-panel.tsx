"use client";

import { areaHealth } from "@life-os/shared";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ideaOverallScore,
  ideaScoreNarrative,
  isValidDateOnly,
  type IdeaLifecycleAction,
} from "@life-os/plan-domain";
import type { LifeItem } from "../lib/api";
import { CapacityRing } from "./capacity-ring";
import { EditorialState } from "./editorial-state";
import { EvaluationRadar } from "./evaluation-radar";
import { LandscapeHero } from "./landscape-hero";
import { LifeIcon, lifeIconFromLegacy } from "./life-icon";
import { NotesEditor } from "./notes-editor";
import { DatePickerField } from "./date-picker-field";
import { PriorityMatrixPanel } from "./priority-matrix-panel";
import { PriorityPanel } from "./priority-panel";
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
  quadrantFromLevels,
  quadrantRequiresScheduledDate,
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

type PlanSegment = "priority" | "areas" | "projects" | "ideas";

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
  onCancelIdeaConversion: () => void;
  onIdeaLifecycle: (
    idea: LifeItem,
    action: Exclude<IdeaLifecycleAction, "CONVERT">,
  ) => void;
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
  projectTargetDate: string;
  actionTitle: string;
  actionHours: string;
  actionImportance: PriorityLevel;
  actionUrgency: PriorityLevel;
  actionScheduleDate: string;
  onProjectTitleChange: (value: string) => void;
  onProjectOutcomeChange: (value: string) => void;
  onProjectPillarIdChange: (value: string) => void;
  onProjectTargetDateChange: (value: string) => void;
  onActionTitleChange: (value: string) => void;
  onActionHoursChange: (value: string) => void;
  onActionImportanceChange: (value: PriorityLevel) => void;
  onActionUrgencyChange: (value: PriorityLevel) => void;
  onActionScheduleDateChange: (value: string) => void;
  onSaveProject: () => void | Promise<void>;
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
  onMoveProjectToIdea?: (project: LifeItem) => void;
  onParkAction?: (action: LifeItem) => void;
  onSetScheduledDate?: (action: LifeItem, date: string) => void;
  onSaveNotes: (
    item: LifeItem,
    body: Record<string, unknown>,
  ) => Promise<LifeItem | void>;
  onRequestPlanSegment?: (segment: PlanSegment) => void;
  preferPriorityMatrix?: boolean;
};

function areaIconName(pillar: LifeItem, index: number) {
  return lifeIconFromLegacy(str(pillar, "icon"), index);
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
  const [ideasTab, setIdeasTab] = useState<"inbox" | "evaluated" | "parked">(
    "inbox",
  );
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
  const [discardIdeaId, setDiscardIdeaId] = useState<string | null>(null);

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
  const [quickScheduledDate, setQuickScheduledDate] = useState("");

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
      idea.status !== "PARKED" &&
      idea.status !== "CONVERTED" &&
      idea.status !== "ARCHIVED" &&
      idea.status !== "DONE",
  );
  const evaluatedIdeas = allIdeas.filter((idea) => idea.status === "EVALUATED");
  const parkedIdeas = allIdeas.filter((idea) => idea.status === "PARKED");

  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? null;
  const selectedArea =
    pillars.find((pillar) => pillar.id === selectedAreaId) ?? null;
  const selectedIdea =
    allIdeas.find((idea) => idea.id === selectedIdeaId) ?? null;

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
    const quadrant = quadrantFromLevels(quickImportance, quickUrgency);
    if (
      quadrantRequiresScheduledDate(quadrant) &&
      !isValidDateOnly(quickScheduledDate)
    ) {
      return;
    }
    props.onQuickAddAction(
      projectId,
      quickTitle.trim(),
      Number.isFinite(hours) && hours > 0 ? hours : 0.5,
      quickImportance,
      quickUrgency,
      quadrantRequiresScheduledDate(quadrant) ? quickScheduledDate : quickWhen,
    );
    setQuickTitle("");
    setQuickHours("0.5");
    setQuickWhen("This week");
    setQuickImportance("HIGH");
    setQuickUrgency("LOW");
    setQuickScheduledDate("");
    setAddActionOpen(false);
    setActionDetailsOpen(false);
  }

  // ——— Priority (default Plan landing) ———
  if (planSegment === "priority") {
    return (
      <PriorityPanel
        pillars={pillars}
        projects={projects}
        actions={items.filter(
          (item) =>
            item.kind === "ACTION" &&
            item.status !== "ARCHIVED" &&
            item.status !== "CONVERTED",
        )}
        availableHours={availableHours}
        busy={busy}
        onMoveAction={props.onMoveAction}
        onCompleteAction={props.onCompleteAction}
        onSetScheduledDate={props.onSetScheduledDate}
        onOpenProject={(project) => {
          setSelectedProjectId(project.id);
          props.onRequestPlanSegment?.("projects");
        }}
        onMoveProjectToIdea={props.onMoveProjectToIdea}
        onParkAction={props.onParkAction}
        preferMatrix={props.preferPriorityMatrix}
      />
    );
  }

  // ——— Ideas ———
  if (planSegment === "ideas") {
    if (convertStep > 0 && selectedIdea) {
      return (
        <section className="space-y-4">
          <button
            type="button"
            className="text-sm font-bold text-[#617a57]"
            onClick={() => {
              setConvertStep(0);
              props.onCancelIdeaConversion();
            }}
          >
            <span className="inline-flex items-center gap-1">
              <LifeIcon name="chevron-left" size={15} />
              Idea
            </span>
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
              <DatePickerField
                label="Deadline (optional)"
                onChange={props.onProjectTargetDateChange}
                value={props.projectTargetDate}
              />
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
                Next step
              </p>
              <p className="text-sm text-[#6c7771]">
                One concrete physical action — the smallest move that starts
                momentum.
              </p>
              <input
                className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                value={props.actionTitle}
                onChange={(e) => props.onActionTitleChange(e.target.value)}
                placeholder="What will you do next?"
              />
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
                Estimate
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["0.25", "15m"],
                    ["0.5", "30m"],
                    ["1", "1h"],
                    ["2", "2h"],
                  ] as const
                ).map(([value, label]) => (
                  <Chip
                    key={value}
                    active={props.actionHours === value}
                    onClick={() => props.onActionHoursChange(value)}
                    label={label}
                  />
                ))}
                <input
                  className="w-20 rounded-full border border-[#dde2dd] px-3 py-1.5 text-xs"
                  value={props.actionHours}
                  onChange={(e) => props.onActionHoursChange(e.target.value)}
                  placeholder="Custom"
                  inputMode="decimal"
                />
              </div>
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
              <p className="text-xs text-[#6c7771]">
                Importance × Urgency place this first next action on the
                Eisenhower matrix (project priority stays High / Med / Low).
              </p>
              {quadrantRequiresScheduledDate(
                quadrantFromLevels(
                  props.actionImportance,
                  props.actionUrgency,
                ),
              ) ? (
                <DatePickerField
                  label="Schedule date (required)"
                  onChange={props.onActionScheduleDateChange}
                  required
                  value={props.actionScheduleDate}
                />
              ) : null}
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
                  className="flex-1 rounded-xl bg-[#14241f] px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
                  disabled={
                    quadrantRequiresScheduledDate(
                      quadrantFromLevels(
                        props.actionImportance,
                        props.actionUrgency,
                      ),
                    ) &&
                    !isValidDateOnly(props.actionScheduleDate)
                  }
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
                {props.actionScheduleDate
                  ? ` · ${props.actionScheduleDate}`
                  : ""}
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
                    void (async () => {
                      try {
                        await props.onSaveProject();
                        setConvertStep(0);
                        setSelectedIdeaId(null);
                      } catch {
                        /* parent surfaces error */
                      }
                    })();
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
      const overall = ideaOverallScore(selectedIdea.body);
      return (
        <section className="space-y-4">
          <button
            type="button"
            className="text-sm font-bold text-[#617a57]"
            onClick={() => setSelectedIdeaId(null)}
          >
            <span className="inline-flex items-center gap-1">
              <LifeIcon name="chevron-left" size={15} />
              Ideas
            </span>
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
          <NotesEditor
            item={selectedIdea}
            label="Idea notes"
            onSave={props.onSaveNotes}
          />
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
            <button
              type="button"
              className="rounded-xl border border-[#dde2dd] bg-white px-4 py-3 text-sm font-bold"
              disabled={busy || selectedIdea.status === "ACTIVE"}
              onClick={() => props.onIdeaLifecycle(selectedIdea, "KEEP")}
            >
              Keep in inbox
            </button>
            <button
              type="button"
              className="rounded-xl border border-[#dde2dd] bg-white px-4 py-3 text-sm font-bold"
              disabled={busy || selectedIdea.status === "PARKED"}
              onClick={() => props.onIdeaLifecycle(selectedIdea, "PARK")}
            >
              Park for later
            </button>
            <button
              type="button"
              className="rounded-xl border border-[#e7b7ad] bg-[#fdf4f1] px-4 py-3 text-sm font-bold text-[#c9634f]"
              disabled={busy}
              onClick={() => setDiscardIdeaId(selectedIdea.id)}
            >
              Discard…
            </button>
          </div>
          <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5 text-sm">
            {(
              [
                ["Area", area?.title ?? "—"],
                ["Related project", "—"],
                [
                  "Status",
                  selectedIdea.status === "EVALUATED"
                    ? "Evaluated"
                    : selectedIdea.status === "PARKED"
                      ? "Parked"
                      : "Inbox",
                ],
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
            <>
              <EvaluationRadar
                label={`${selectedIdea.title} evaluation scores`}
                scores={{
                  impact: num(selectedIdea, "impact", 0),
                  effort: num(selectedIdea, "effort", 0),
                  alignment: num(selectedIdea, "alignment", 0),
                  timing: num(selectedIdea, "timing", 0),
                }}
              />
              <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
                  Overall /10
                </p>
                <p className="mt-1 font-serif text-3xl">
                  {overall.toFixed(1)}
                </p>
                <p className="text-sm text-[#6c7771]">
                  {ideaScoreNarrative(overall)}
                </p>
              </article>
            </>
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
              <div className="mb-4">
                <EvaluationRadar
                  scores={{
                    impact: evalImpact,
                    effort: evalEffort,
                    alignment: evalAlignment,
                    timing: evalTiming,
                  }}
                />
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
          {discardIdeaId === selectedIdea.id ? (
            <Sheet
              title="Discard idea?"
              subtitle="Discard archives this idea. It is hidden from Plan but remains recoverable; nothing is permanently deleted."
              onClose={() => setDiscardIdeaId(null)}
            >
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-[#dde2dd] bg-white px-4 py-3 text-xs font-bold"
                  onClick={() => setDiscardIdeaId(null)}
                >
                  Keep idea
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-[#c9634f] px-4 py-3 text-xs font-bold text-white"
                  onClick={() => {
                    props.onIdeaLifecycle(selectedIdea, "DISCARD");
                    setDiscardIdeaId(null);
                    setSelectedIdeaId(null);
                  }}
                >
                  Archive idea
                </button>
              </div>
            </Sheet>
          ) : null}
        </section>
      );
    }

    const list =
      ideasTab === "inbox"
        ? inboxIdeas
        : ideasTab === "evaluated"
          ? evaluatedIdeas
          : parkedIdeas;
    return (
      <section className="space-y-3">
        <LandscapeHero
          title="Ideas"
          subtitle="Capture now. Clarify later."
          detail="Give promising sparks room to breathe, then compare their Impact, Effort, Alignment, and Timing before committing."
        />
        <div className="flex gap-2">
          {(
            [
              ["inbox", `Inbox (${inboxIdeas.length})`],
              ["evaluated", `Evaluated (${evaluatedIdeas.length})`],
              ["parked", `Parked (${parkedIdeas.length})`],
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
          <EditorialState
            kind="empty"
            compact
            title={
              ideasTab === "inbox"
                ? "Inbox is clear"
                : ideasTab === "evaluated"
                  ? "Nothing evaluated yet"
                  : "Nothing parked"
            }
            description={
              ideasTab === "inbox"
                ? "Capture something rough. Evaluate winners when the signal is clear."
                : ideasTab === "evaluated"
                  ? "Score an idea from Inbox to compare its four dimensions here."
                  : "Parked ideas stay out of the inbox until you keep or convert them."
            }
          />
        ) : (
          list.map((idea, index) => {
            const area = pillars.find((p) => p.id === idea.parentId);
            return (
              <div
                key={idea.id}
                className="flex w-full items-center gap-3 rounded-2xl border border-[#dde2dd] bg-white p-4 text-left"
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => setSelectedIdeaId(idea.id)}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef3ea] text-lg">
                    <LifeIcon
                      name={
                        area
                          ? areaIconName(
                              area,
                              Math.max(
                                pillars.findIndex((pillar) => pillar.id === area.id),
                                index,
                              ),
                            )
                          : "ideas"
                      }
                    />
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
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded-xl bg-[#14241f] px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
                  disabled={busy}
                  onClick={() => {
                    setSelectedIdeaId(idea.id);
                    props.onConvertIdea(idea);
                    setConvertStep(1);
                  }}
                >
                  To project
                </button>
                {ideasTab === "parked" ? (
                  <button
                    type="button"
                    className="shrink-0 rounded-xl border border-[#dde2dd] px-3 py-2 text-[11px] font-bold"
                    disabled={busy}
                    onClick={() => props.onIdeaLifecycle(idea, "KEEP")}
                  >
                    Keep
                  </button>
                ) : (
                  <button
                    type="button"
                    className="shrink-0 rounded-xl border border-[#dde2dd] px-3 py-2 text-[11px] font-bold"
                    disabled={busy}
                    onClick={() => props.onIdeaLifecycle(idea, "PARK")}
                  >
                    Park
                  </button>
                )}
                <button
                  type="button"
                  className="shrink-0 text-[#6c7771]"
                  aria-label={`Open ${idea.title}`}
                  onClick={() => setSelectedIdeaId(idea.id)}
                >
                  <LifeIcon name="chevron-right" size={16} color="#6c7771" />
                </button>
              </div>
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
          onSaveNotes={props.onSaveNotes}
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
            <span className="inline-flex items-center gap-1">
              <LifeIcon name="chevron-left" size={15} />
              Areas
            </span>
          </button>
          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dbe8d7] text-3xl">
              <LifeIcon
                name={areaIconName(selectedArea, Math.max(index, 0))}
                size={28}
              />
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
                  <CapacityRing
                    used={hours}
                    capacity={availableHours}
                    size={96}
                    label={`${selectedArea.title} weekly capacity`}
                  />
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
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-[#14241f]">
                      <LifeIcon name="done" size={15} />
                      Next: {next ? next.title : "Define next action"}
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
      <section className="space-y-3">
        <LandscapeHero
          title="Areas"
          subtitle="Keep every life domain in view."
          detail="Health cues use active projects and protected weekly time, so you can see what is steady, overloaded, or being neglected."
        />
        {pillars.length === 0 ? (
          <EditorialState
            kind="empty"
            compact
            title="No areas yet"
            description="Add a life area to give projects a home and make neglected domains visible."
          />
        ) : (
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
            const health = areaHealth(
              pillarProjects.length,
              hours,
              availableHours,
            );
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
                  <LifeIcon name={areaIconName(pillar, index)} size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif text-xl text-[#14241f]">
                      {pillar.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          health.tone === "danger"
                            ? "bg-[#f8e4df] text-[#c9634f]"
                            : health.tone === "amber"
                              ? "bg-[#fff3e8] text-[#8a5a16]"
                              : "bg-[#dbe8d7] text-[#617a57]"
                        }`}
                      >
                        {health.label}
                      </span>
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
                  </div>
                  <p className="mt-1 text-sm text-[#14241f]">
                    {pillarProjects.length} active project
                    {pillarProjects.length === 1 ? "" : "s"}
                  </p>
                  <p className="text-sm text-[#6c7771]">
                    {hours.toFixed(1)}h this week · {pct}% capacity
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#617a57]">
                    Health signal · {health.provenance}
                  </p>
                  <div className="mt-2">
                    <ProgressBar value={pct} tone={pct > 100 ? "warn" : "sage"} />
                  </div>
                </div>
                <LifeIcon name="chevron-right" size={17} color="#6c7771" />
              </div>
            );
            })}
          </div>
        )}
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
          onSaveNotes={props.onSaveNotes}
          onShowMatrix={openMatrix}
          onOpenAddAction={() => setAddActionOpen(true)}
        />
        {addActionOpen ? (
          <AddActionSheet
            busy={busy}
            title={quickTitle}
            hours={quickHours}
            when={quickWhen}
            scheduledDate={quickScheduledDate}
            importance={quickImportance}
            urgency={quickUrgency}
            projects={projects.filter(
              (project) =>
                project.status !== "DONE" &&
                project.status !== "ARCHIVED" &&
                project.status !== "CONVERTED",
            )}
            projectId={selectedProject.id}
            detailsOpen={false}
            onTitle={setQuickTitle}
            onHours={setQuickHours}
            onWhen={setQuickWhen}
            onScheduledDate={setQuickScheduledDate}
            onImportance={setQuickImportance}
            onUrgency={setQuickUrgency}
            onOpenDetails={() => {}}
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
    <section className="space-y-3">
      {projectsView === "list" ? (
        <LandscapeHero
          title="Projects"
          subtitle="Commit to outcomes, not noise."
          detail="Protect the next action, keep deadlines visible, and match project load to the week you actually have."
        />
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm text-[#6c7771]">
          {projectsView === "list"
            ? "List active work, filter by area, or open the matrix."
            : "Drag actions between quadrants to rebalance priority."}
        </p>
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
              onClick={() => {
                props.onCancelIdeaConversion();
                setComposerOpen((openState) => !openState);
              }}
          >
            + Add project
          </button>
        </div>
      </div>

      {projectsView === "matrix" ? (
        <PriorityMatrixPanel
          actions={openActions}
          projects={projects}
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
              <DatePickerField
                label="Deadline (optional)"
                onChange={props.onProjectTargetDateChange}
                value={props.projectTargetDate}
              />
              <input
                className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                placeholder="Next step"
                value={props.actionTitle}
                onChange={(e) => props.onActionTitleChange(e.target.value)}
              />
              <p className="text-sm text-[#6c7771]">
                One concrete physical action — the smallest move that starts
                momentum.
              </p>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
                Estimate
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["0.25", "15m"],
                    ["0.5", "30m"],
                    ["1", "1h"],
                    ["2", "2h"],
                  ] as const
                ).map(([value, label]) => (
                  <Chip
                    key={value}
                    active={props.actionHours === value}
                    onClick={() => props.onActionHoursChange(value)}
                    label={label}
                  />
                ))}
                <input
                  className="w-20 rounded-full border border-[#dde2dd] px-3 py-1.5 text-xs"
                  value={props.actionHours}
                  onChange={(e) => props.onActionHoursChange(e.target.value)}
                  placeholder="Custom"
                  inputMode="decimal"
                />
              </div>
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
              <p className="text-xs text-[#6c7771]">
                Importance × Urgency place the first next action on the
                Eisenhower matrix (separate from project High / Med / Low).
              </p>
              {quadrantRequiresScheduledDate(
                quadrantFromLevels(
                  props.actionImportance,
                  props.actionUrgency,
                ),
              ) ? (
                <DatePickerField
                  label="Schedule date (required)"
                  onChange={props.onActionScheduleDateChange}
                  required
                  value={props.actionScheduleDate}
                />
              ) : null}
              <button
                className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
                type="button"
                disabled={
                  busy ||
                  (quadrantRequiresScheduledDate(
                    quadrantFromLevels(
                      props.actionImportance,
                      props.actionUrgency,
                    ),
                  ) &&
                    !/^\d{4}-\d{2}-\d{2}$/.test(props.actionScheduleDate))
                }
                onClick={() => {
                  void (async () => {
                    try {
                      await props.onSaveProject();
                      setComposerOpen(false);
                    } catch {
                      /* parent surfaces error */
                    }
                  })();
                }}
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
            <EditorialState
              kind="empty"
              compact
              title="No projects here"
              description="Create a project with a first next action, turn an idea into a project, or clear the active filters."
            />
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
                    <LifeIcon
                      name={
                        area
                          ? areaIconName(
                              area,
                              Math.max(
                                pillars.findIndex((pillar) => pillar.id === area.id),
                                index,
                              ),
                            )
                          : "projects"
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="min-w-0 flex-1 truncate font-serif text-xl text-[#14241f]">
                        {project.title}
                      </h3>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
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
                    <p className="mt-1 truncate text-sm text-[#6c7771]">
                      {projectStatusLabel(project.status)} ·{" "}
                      {area?.title ?? "Unassigned"}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-medium text-[#14241f]">
                      <LifeIcon name="done" size={15} />
                      Next: {next ? next.title : "Define next action"}
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
                  <LifeIcon name="chevron-right" size={17} color="#6c7771" />
                </button>
              );
            })
          )}

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
  scheduledDate,
  importance,
  urgency,
  projects,
  projectId,
  detailsOpen,
  onTitle,
  onHours,
  onWhen,
  onScheduledDate,
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
  scheduledDate: string;
  importance: PriorityLevel;
  urgency: PriorityLevel;
  projects: LifeItem[];
  projectId: string;
  detailsOpen: boolean;
  onTitle: (value: string) => void;
  onHours: (value: string) => void;
  onWhen: (value: "Today" | "This week" | "Later") => void;
  onScheduledDate: (value: string) => void;
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
  const [scheduleError, setScheduleError] = useState("");
  const quadrant =
    PRIORITY_QUADRANT_META[
      actionPriorityQuadrant({ importance, urgency })
    ].label;
  const scheduleRequired = quadrantRequiresScheduledDate(
    quadrantFromLevels(importance, urgency),
  );

  return (
    <Sheet
      title="Add next step"
      subtitle="One concrete physical action — the smallest move that starts momentum."
      onClose={onClose}
    >
      <label className="mb-3 block space-y-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
          Action title
        </span>
        <input
          autoFocus
          className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder="What will you do next?"
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
      <LevelChips
        label="Importance"
        value={importance}
        onChange={onImportance}
      />
      <div className="h-3" />
      <LevelChips label="Urgency" value={urgency} onChange={onUrgency} />
      <p className="mb-2 mt-2 text-xs text-[#6c7771]">
        Matrix preview: {quadrant}
      </p>
      {scheduleRequired ? (
        <div className="mb-4">
          <DatePickerField
            error={scheduleError}
            label="Schedule date (required)"
            onChange={(value) => {
              onScheduledDate(value);
              if (scheduleError && isValidDateOnly(value)) {
                setScheduleError("");
              }
            }}
            required
            value={scheduledDate}
          />
        </div>
      ) : (
        <>
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
        </>
      )}

      <button
        type="button"
        className="w-full rounded-xl bg-[#d6f57a] px-4 py-3 text-xs font-bold text-[#2f431e] disabled:opacity-50"
        disabled={
          busy ||
          !title.trim() ||
          (scheduleRequired && !isValidDateOnly(scheduledDate))
        }
        onClick={() => {
          if (scheduleRequired && !isValidDateOnly(scheduledDate)) {
            setScheduleError("Choose a date for Schedule");
            return;
          }
          onSave();
        }}
      >
        Add next step
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
  onSaveNotes,
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
  onSaveNotes: (
    item: LifeItem,
    body: Record<string, unknown>,
  ) => Promise<LifeItem | void>;
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
      {
      id: "done",
      title: "Done",
      actions: doneActions,
    },
  ];

  return (
    <section className="space-y-4">
      <button
        type="button"
        className="text-sm font-bold text-[#617a57]"
        onClick={onBack}
      >
        <span className="inline-flex items-center gap-1">
          <LifeIcon name="chevron-left" size={15} />
          Projects
        </span>
      </button>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#dbe8d7] text-2xl">
          <LifeIcon name="priority" size={26} />
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
          Next step
        </p>
        {next ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <button
                type="button"
                className="mt-1 flex h-5 w-5 items-center justify-center rounded-full border border-[#617a57] text-[10px] text-[#617a57]"
                disabled={busy}
                onClick={() => onCompleteAction(next)}
                aria-label={
                  next.status === "DONE"
                    ? "Mark next action open"
                    : "Mark next action done"
                }
              >
                <LifeIcon
                  name="done"
                  size={14}
                  weight={next.status === "DONE" ? "fill" : "regular"}
                />
              </button>
              <div>
                <h3
                  className={`font-serif text-2xl ${
                    next.status === "DONE" ? "text-[#6c7771] line-through" : ""
                  }`}
                >
                  {next.title}
                </h3>
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
            {!isDone ? (
              <button
                type="button"
                className="w-full rounded-xl bg-[#d6f57a] px-4 py-3 text-xs font-bold text-[#2f431e]"
                onClick={onOpenAddAction}
              >
                Add next step
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl border border-[#d6f57a] bg-[#eef3ea] p-4">
            <p className="font-serif text-xl text-[#14241f]">
              What is the very next physical action?
            </p>
            <p className="text-sm text-[#6c7771]">
              Name one small move you can do without planning further.
            </p>
            {!isDone ? (
              <button
                type="button"
                className="w-full rounded-xl bg-[#d6f57a] px-4 py-3 text-xs font-bold text-[#2f431e]"
                onClick={onOpenAddAction}
              >
                Add next step
              </button>
            ) : null}
          </div>
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
                  group.actions.map((action) => {
                    const done = action.status === "DONE";
                    return (
                      <div
                        key={action.id}
                        className={`rounded-2xl border border-[#dde2dd] px-4 py-3 ${
                          done ? "bg-[#f7f8f5]" : "bg-white"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#617a57] text-[10px] text-[#617a57]"
                            disabled={busy}
                            onClick={() => onCompleteAction(action)}
                            aria-label={
                              done ? "Mark action open" : "Mark action done"
                            }
                          >
                            <LifeIcon
                              name="done"
                              size={14}
                              weight={done ? "fill" : "regular"}
                            />
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={`font-semibold ${
                                  done
                                    ? "text-[#6c7771] line-through"
                                    : ""
                                }`}
                              >
                                {action.title}
                              </p>
                              <span className="rounded-full bg-[#eef3ea] px-2 py-0.5 text-[10px] font-bold text-[#617a57]">
                                {
                                  PRIORITY_QUADRANT_META[
                                    actionPriorityQuadrant(
                                      action.body,
                                      project.body,
                                    )
                                  ].label
                                }
                              </span>
                            </div>
                            <p className="text-xs text-[#6c7771]">
                              {num(action, "hours", 1)}h
                              {str(action, "day")
                                ? ` · ${str(action, "day")}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ),
          )}
          {!isDone ? (
            <button
              type="button"
              className="w-full rounded-xl border border-[#dde2dd] bg-white px-4 py-3 text-xs font-bold text-[#14241f]"
              onClick={onOpenAddAction}
            >
              Add another action
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
        <NotesEditor
          item={project}
          label="Project notes"
          onSave={onSaveNotes}
        />
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
          <DatePickerField
            disabled={busy || isDone}
            label="Deadline"
            onChange={setDeadlineDraft}
            value={deadlineDraft}
          />
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
