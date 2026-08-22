"use client";

import { useEffect, useRef, useState } from "react";
import type { LifeItem } from "../lib/api";
import type { PriorityLevel } from "../lib/priority-matrix";
import { FocusHero } from "./focus-hero";
import { LifeIcon, type LifeIconName } from "./life-icon";

export type QuickAddKind = "action" | "idea" | "project" | "spend";

type Props = {
  initialKind: QuickAddKind;
  pillars: LifeItem[];
  projects: LifeItem[];
  busy: boolean;
  onClose: () => void;
  onCreateAction: (input: {
    title: string;
    hours: number;
    parentId: string | null;
    importance: PriorityLevel;
    urgency: PriorityLevel;
  }) => Promise<boolean>;
  onCreateIdea: (input: { title: string; note: string }) => Promise<boolean>;
  onCreateProject: (input: {
    title: string;
    parentId: string | null;
  }) => Promise<boolean>;
  onSpend: () => void;
};

const KINDS: {
  id: QuickAddKind;
  label: string;
  icon: LifeIconName;
}[] = [
  { id: "action", label: "Action", icon: "done" },
  { id: "idea", label: "Idea", icon: "ideas" },
  { id: "project", label: "Project", icon: "projects" },
  { id: "spend", label: "Spend", icon: "spending" },
];

export function QuickAddSheet({
  initialKind,
  pillars,
  projects,
  busy,
  onClose,
  onCreateAction,
  onCreateIdea,
  onCreateProject,
  onSpend,
}: Props) {
  const [kind, setKind] = useState<QuickAddKind>(initialKind);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [hours, setHours] = useState("1");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [areaId, setAreaId] = useState(pillars[0]?.id ?? "");
  const [importance, setImportance] = useState<PriorityLevel>("HIGH");
  const [urgency, setUrgency] = useState<PriorityLevel>("HIGH");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => titleRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  async function submit() {
    let saved = false;
    if (kind === "action") {
      const estimate = Number(hours);
      if (!title.trim() || !Number.isFinite(estimate) || estimate <= 0) return;
      saved = await onCreateAction({
        title: title.trim(),
        hours: estimate,
        parentId: projectId || null,
        importance,
        urgency,
      });
    } else if (kind === "idea") {
      if (!title.trim()) return;
      saved = await onCreateIdea({ title: title.trim(), note: note.trim() });
    } else if (kind === "project") {
      if (!title.trim()) return;
      saved = await onCreateProject({
        title: title.trim(),
        parentId: areaId || null,
      });
    }
    if (saved) onClose();
  }

  const valid =
    kind === "spend" ||
    (Boolean(title.trim()) &&
      (kind !== "action" || (Number.isFinite(Number(hours)) && Number(hours) > 0)));

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-[#14241f]/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="quick-add-title"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[#f4f5f0] p-5 shadow-xl sm:rounded-3xl sm:p-6"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <FocusHero
            accentDot
            className="flex-1"
            eyebrow="Quick Add"
            title="Capture without breaking focus."
            titleId="quick-add-title"
          />
          <button
            aria-label="Close Quick Add"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#dde2dd] bg-white"
            onClick={onClose}
            type="button"
          >
            <LifeIcon name="close" size={17} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2" role="tablist">
          {KINDS.map((item) => (
            <button
              aria-selected={kind === item.id}
              className={`flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-[11px] font-bold ${
                kind === item.id
                  ? "bg-[#14241f] text-[#d6f57a]"
                  : "border border-[#dde2dd] bg-white text-[#14241f]"
              }`}
              key={item.id}
              onClick={() => {
                setKind(item.id);
                window.setTimeout(() => titleRef.current?.focus(), 0);
              }}
              role="tab"
              type="button"
            >
              <LifeIcon
                color={kind === item.id ? "#d6f57a" : "#617a57"}
                name={item.icon}
                size={18}
              />
              {item.label}
            </button>
          ))}
        </div>

        {kind === "spend" ? (
          <div className="mt-6 rounded-2xl border border-[#d6e0d2] bg-white p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef3ea]">
              <LifeIcon name="spending" size={22} />
            </span>
            <h3 className="mt-4 font-serif text-2xl">Record a spend.</h3>
            <p className="mt-2 text-sm leading-6 text-[#6c7771]">
              Open the real Money → Spending capture with today&apos;s date and
              your budget categories ready.
            </p>
            <button
              autoFocus
              className="mt-5 w-full rounded-xl bg-[#14241f] px-4 py-3 text-sm font-bold text-white"
              onClick={onSpend}
              type="button"
            >
              Open Spending capture
            </button>
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <label className="block text-[10px] font-bold uppercase tracking-wide text-[#617a57]">
              {kind === "action"
                ? "What will you do?"
                : kind === "idea"
                  ? "What showed up?"
                  : "Project title"}
              <input
                className="mt-2 w-full rounded-xl border border-[#dde2dd] bg-white px-3 py-3 text-sm font-normal normal-case tracking-normal text-[#14241f]"
                onChange={(event) => setTitle(event.target.value)}
                placeholder={
                  kind === "action"
                    ? "Draft the proposal"
                    : kind === "idea"
                      ? "A thought worth keeping"
                      : "Launch the new site"
                }
                ref={titleRef}
                value={title}
              />
            </label>

            {kind === "idea" ? (
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[#617a57]">
                Note <span className="font-normal normal-case">(optional)</span>
                <textarea
                  className="mt-2 min-h-24 w-full resize-y rounded-xl border border-[#dde2dd] bg-white px-3 py-3 text-sm font-normal normal-case tracking-normal text-[#14241f]"
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Context can wait, but it does not have to."
                  value={note}
                />
              </label>
            ) : null}

            {kind === "action" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-[#617a57]">
                    Hours
                    <input
                      className="mt-2 w-full rounded-xl border border-[#dde2dd] bg-white px-3 py-3 text-sm font-normal text-[#14241f]"
                      min="0.25"
                      onChange={(event) => setHours(event.target.value)}
                      step="0.25"
                      type="number"
                      value={hours}
                    />
                  </label>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-[#617a57]">
                    Project
                    <select
                      className="mt-2 w-full rounded-xl border border-[#dde2dd] bg-white px-3 py-3 text-sm font-normal normal-case text-[#14241f]"
                      onChange={(event) => setProjectId(event.target.value)}
                      value={projectId}
                    >
                      <option value="">Inbox</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-[#617a57]">
                    Importance
                    <select
                      className="mt-2 w-full rounded-xl border border-[#dde2dd] bg-white px-3 py-3 text-sm font-normal normal-case text-[#14241f]"
                      onChange={(event) =>
                        setImportance(event.target.value as PriorityLevel)
                      }
                      value={importance}
                    >
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </label>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-[#617a57]">
                    Urgency
                    <select
                      className="mt-2 w-full rounded-xl border border-[#dde2dd] bg-white px-3 py-3 text-sm font-normal normal-case text-[#14241f]"
                      onChange={(event) =>
                        setUrgency(event.target.value as PriorityLevel)
                      }
                      value={urgency}
                    >
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </label>
                </div>
              </>
            ) : null}

            {kind === "project" ? (
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[#617a57]">
                Area <span className="font-normal normal-case">(optional)</span>
                <select
                  className="mt-2 w-full rounded-xl border border-[#dde2dd] bg-white px-3 py-3 text-sm font-normal normal-case text-[#14241f]"
                  onChange={(event) => setAreaId(event.target.value)}
                  value={areaId}
                >
                  <option value="">Unassigned</option>
                  {pillars.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="flex gap-2 pt-2">
              <button
                className="flex-1 rounded-xl border border-[#dde2dd] bg-white px-4 py-3 text-xs font-bold"
                onClick={onClose}
                type="button"
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-xl bg-[#14241f] px-4 py-3 text-xs font-bold text-white disabled:opacity-45"
                disabled={busy || !valid}
                type="submit"
              >
                {busy
                  ? "Saving…"
                  : `Save ${kind === "action" ? "action" : kind}`}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
