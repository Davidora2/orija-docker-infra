"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SUGGESTED_LIFE_AREAS,
  completeOnboarding,
  createLifeItem,
  getWealthMeta,
  listAreaSuggestions,
  listLifeItems,
  updateLifeItem,
  updateOnboardingStep,
  type Account,
  type AreaSuggestion,
  type LifeItem,
  type OnboardingStep,
} from "../lib/api";
import { actionBodyWithLevels, type PriorityLevel } from "../lib/priority-matrix";
import { LifeIcon, lifeIconFromLegacy } from "./life-icon";

const FLOW: Exclude<OnboardingStep, "deferred">[] = [
  "welcome",
  "areas",
  "capacity",
  "ideas",
  "project",
  "action",
  "payoff",
];

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

type Props = {
  account: Account;
  items: LifeItem[];
  onComplete: (account: Account) => void;
  onDismiss: (account: Account) => void;
  onError: (message: string) => void;
};

function isOpen(item: LifeItem) {
  return !["DONE", "ARCHIVED", "CONVERTED"].includes(item.status);
}

function startStep(account: Account): Exclude<OnboardingStep, "deferred"> {
  const saved = account.user.onboardingStep;
  if (!saved || saved === "deferred") return saved === "deferred" ? "areas" : "welcome";
  return saved;
}

export function OnboardingPanel({
  account,
  items,
  onComplete,
  onDismiss,
  onError,
}: Props) {
  const [step, setStep] = useState<Exclude<OnboardingStep, "deferred">>(() =>
    startStep(account),
  );
  const [suggestions, setSuggestions] =
    useState<AreaSuggestion[]>(SUGGESTED_LIFE_AREAS);
  const [selected, setSelected] = useState<Record<string, AreaSuggestion>>(() =>
    Object.fromEntries(
      items
        .filter((item) => item.kind === "PILLAR" && isOpen(item))
        .map((item) => [
          item.title,
          {
            title: item.title,
            icon:
              typeof item.body.icon === "string"
                ? item.body.icon
                : "compass-outline",
          },
        ]),
    ),
  );
  const [customTitle, setCustomTitle] = useState("");
  const [currencies, setCurrencies] = useState<string[]>([
    "GBP",
    "USD",
    "CAD",
    "EUR",
  ]);
  const [currency, setCurrency] = useState(
    account.user.preferredCurrency || "GBP",
  );
  const [capacityHours, setCapacityHours] = useState(() => {
    const vision = items.find(
      (item) => item.kind === "VISION" && "availableHours" in item.body,
    );
    return String(
      typeof vision?.body.availableHours === "number"
        ? vision.body.availableHours
        : 11,
    );
  });
  const [ideaDump, setIdeaDump] = useState("");
  const onboardingProject = items.find(
    (item) =>
      item.kind === "PROJECT" &&
      isOpen(item) &&
      item.body.onboardingDraft === true,
  );
  const firstIdea = items.find((item) => item.kind === "IDEA" && isOpen(item));
  const [projectId, setProjectId] = useState(onboardingProject?.id ?? "");
  const [projectTitle, setProjectTitle] = useState(
    onboardingProject?.title ?? firstIdea?.title ?? "",
  );
  const [actionTitle, setActionTitle] = useState(
    projectTitle ? `Advance: ${projectTitle}` : "",
  );
  const [actionHours, setActionHours] = useState("2");
  const [actionDay, setActionDay] =
    useState<(typeof WEEK_DAYS)[number]>("Fri");
  const [actionImportance, setActionImportance] =
    useState<PriorityLevel>("HIGH");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listAreaSuggestions().then(setSuggestions).catch(() => undefined);
    void getWealthMeta()
      .then((meta) => {
        if (meta.currencies?.length) setCurrencies(meta.currencies);
      })
      .catch(() => undefined);
  }, []);

  const selectedList = useMemo(() => Object.values(selected), [selected]);
  const progress = (FLOW.indexOf(step) + 1) / FLOW.length;

  function report(error: unknown, fallback: string) {
    onError(error instanceof Error ? error.message : fallback);
  }

  async function transition(next: Exclude<OnboardingStep, "deferred">) {
    setBusy(true);
    try {
      await updateOnboardingStep(next);
      setStep(next);
    } catch (error) {
      report(error, "Could not save onboarding progress.");
    } finally {
      setBusy(false);
    }
  }

  async function pause() {
    setBusy(true);
    try {
      const next = await updateOnboardingStep(
        step === "welcome" ? "deferred" : step,
      );
      onDismiss(next);
    } catch (error) {
      report(error, "Could not save onboarding progress.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(area: AreaSuggestion) {
    setSelected((current) => {
      const next = { ...current };
      if (next[area.title]) delete next[area.title];
      else next[area.title] = area;
      return next;
    });
  }

  function addCustom() {
    const title = customTitle.trim();
    if (!title) return;
    setSelected((current) => ({
      ...current,
      [title]: { title, icon: "compass-outline" },
    }));
    setCustomTitle("");
  }

  async function saveAreas() {
    if (selectedList.length === 0) {
      onError("Pick at least one life area to track.");
      return;
    }
    if (selectedList.length >= 8) {
      onError("Eight or more areas can feel noisy — 3–5 is a calm start.");
    }
    setBusy(true);
    try {
      await completeOnboarding(selectedList, currency, {
        complete: false,
        nextStep: "capacity",
      });
      setStep("capacity");
    } catch (error) {
      report(error, "Could not save areas.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCapacity() {
    const hours = Number(capacityHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      onError("Weekly capacity must be a positive number.");
      return;
    }
    setBusy(true);
    try {
      const latest = await listLifeItems();
      const vision = latest.find(
        (item) => item.kind === "VISION" && "availableHours" in item.body,
      );
      if (vision) {
        await updateLifeItem(vision.id, {
          body: { ...vision.body, availableHours: hours },
        });
      } else {
        await createLifeItem({
          kind: "VISION",
          title: "Weekly capacity",
          body: { availableHours: hours },
          sortOrder: 100,
        });
      }
      await updateOnboardingStep("ideas");
      setStep("ideas");
    } catch (error) {
      report(error, "Could not save capacity.");
    } finally {
      setBusy(false);
    }
  }

  async function saveIdeas(skip = false) {
    const titles = skip
      ? []
      : ideaDump
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 8);
    setBusy(true);
    try {
      if (titles.length > 0) {
        const latest = await listLifeItems();
        const existing = new Set(
          latest
            .filter((item) => item.kind === "IDEA" && isOpen(item))
            .map((item) => item.title.toLocaleLowerCase()),
        );
        for (const title of titles) {
          if (existing.has(title.toLocaleLowerCase())) continue;
          await createLifeItem({
            kind: "IDEA",
            title,
            body: { impact: 0, effort: 0, alignment: 0, timing: 0 },
          });
        }
        if (!projectTitle && titles[0]) {
          setProjectTitle(titles[0]);
          setActionTitle(`Advance: ${titles[0]}`);
        }
      }
      await updateOnboardingStep("project");
      setStep("project");
    } catch (error) {
      report(error, "Could not save ideas.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProject(skip = false) {
    if (skip) {
      await transition("payoff");
      return;
    }
    const title = projectTitle.trim();
    if (!title) {
      onError("Name the project, or skip for now.");
      return;
    }
    setBusy(true);
    try {
      let id = projectId;
      if (!id) {
        const project = await createLifeItem({
          kind: "PROJECT",
          title,
          body: {
            outcome: "Started in onboarding",
            priority: "MEDIUM",
            onboardingDraft: true,
          },
        });
        id = project.id;
        setProjectId(project.id);
      }
      setActionTitle((current) => current || `Advance: ${title}`);
      await updateOnboardingStep("action");
      setStep("action");
    } catch (error) {
      report(error, "Could not save the project.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAction(skip = false) {
    if (skip) {
      await transition("payoff");
      return;
    }
    const title = actionTitle.trim();
    const hours = Number(actionHours);
    if (!title) {
      onError("Add a first action, or skip for now.");
      return;
    }
    if (!Number.isFinite(hours) || hours <= 0) {
      onError("Estimated hours must be a positive number.");
      return;
    }
    setBusy(true);
    try {
      let parentId = projectId;
      if (!parentId) {
        const project = await createLifeItem({
          kind: "PROJECT",
          title: projectTitle.trim() || title,
          body: { outcome: "Started in onboarding", priority: "MEDIUM" },
        });
        parentId = project.id;
        setProjectId(parentId);
      }
      await createLifeItem({
        kind: "ACTION",
        title,
        parentId,
        body: actionBodyWithLevels(
          { hours, day: actionDay },
          actionImportance,
          "LOW",
        ),
      });
      const latestProject = (await listLifeItems()).find(
        (item) => item.id === parentId,
      );
      if (latestProject?.body.onboardingDraft) {
        await updateLifeItem(parentId, {
          body: { ...latestProject.body, onboardingDraft: false },
        });
      }
      await updateOnboardingStep("payoff");
      setStep("payoff");
    } catch (error) {
      report(error, "Could not save the first action.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (selectedList.length === 0) {
      onError("Choose at least one area before finishing setup.");
      setStep("areas");
      return;
    }
    setBusy(true);
    try {
      const next = await completeOnboarding(selectedList, currency, {
        complete: true,
      });
      onComplete(next);
    } catch (error) {
      report(error, "Could not finish onboarding.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#14241f]/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <section
        aria-labelledby="onboarding-title"
        aria-modal="true"
        className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-[#f4f5f0] p-6 text-[#14241f] shadow-xl sm:rounded-3xl"
        role="dialog"
      >
        <div
          aria-label={`Onboarding step ${FLOW.indexOf(step) + 1} of ${FLOW.length}`}
          className="h-1 overflow-hidden rounded-full bg-[#dde2dd]"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={FLOW.length}
          aria-valuenow={FLOW.indexOf(step) + 1}
        >
          <div
            className="h-full rounded-full bg-[#617a57] transition-[width]"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#617a57]">
            {step === "ideas"
              ? "Capture"
              : step === "action"
                ? "First action"
                : step}
          </p>
          <button
            aria-label="Save onboarding and continue later"
            className="rounded-full border border-[#dde2dd] bg-white px-3 py-1.5 text-xs font-bold text-[#617a57]"
            disabled={busy}
            onClick={() => void pause()}
            type="button"
          >
            Continue later
          </button>
        </div>

        {step === "welcome" ? (
          <div className="py-5">
            <h2 id="onboarding-title" className="font-serif text-4xl leading-tight">
              About two minutes to a usable Today.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#6c7771]">
              Choose a few life areas, set weekly capacity, capture ideas, and
              land on your primary move.
            </p>
            <button
              className="mt-7 w-full rounded-xl bg-[#14241f] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              disabled={busy}
              onClick={() => void transition("areas")}
              type="button"
            >
              Get started
            </button>
            <button
              className="mt-2 w-full rounded-xl px-4 py-3 text-sm font-bold text-[#617a57] disabled:opacity-50"
              disabled={busy}
              onClick={() => void pause()}
              type="button"
            >
              I&apos;ll set this up later
            </button>
          </div>
        ) : null}

        {step === "areas" ? (
          <div className="py-5">
            <h2 id="onboarding-title" className="font-serif text-3xl">
              What do you want to track?
            </h2>
            <p className="mt-2 text-sm text-[#6c7771]">
              Choose 3–5 life areas for a calm start. At least one is required.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {suggestions.map((area, index) => {
                const active = Boolean(selected[area.title]);
                return (
                  <button
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold ${
                      active
                        ? "bg-[#14241f] text-[#d6f57a]"
                        : "border border-[#dde2dd] bg-white"
                    }`}
                    key={area.title}
                    onClick={() => toggle(area)}
                    type="button"
                  >
                    <LifeIcon
                      color={active ? "#d6f57a" : "#617a57"}
                      name={lifeIconFromLegacy(area.icon, index)}
                      size={15}
                    />
                    {area.title}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                aria-label="Custom life area"
                className="min-w-0 flex-1 rounded-xl border border-[#dde2dd] bg-white px-3 py-3"
                onChange={(event) => setCustomTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addCustom();
                }}
                placeholder="Add your own area"
                value={customTitle}
              />
              <button
                className="rounded-xl bg-[#dbe8d7] px-4 text-xs font-bold text-[#617a57]"
                onClick={addCustom}
                type="button"
              >
                Add
              </button>
            </div>
            <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-[#617a57]">
              Currency
              <select
                className="mt-2 w-full rounded-xl border border-[#dde2dd] bg-white px-3 py-3 text-sm text-[#14241f]"
                onChange={(event) => setCurrency(event.target.value)}
                value={currency}
              >
                {currencies.map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
            </label>
            <button
              className="mt-6 w-full rounded-xl bg-[#14241f] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              disabled={busy}
              onClick={() => void saveAreas()}
              type="button"
            >
              {busy ? "Saving…" : "Continue"}
            </button>
          </div>
        ) : null}

        {step === "capacity" ? (
          <div className="py-5">
            <h2 id="onboarding-title" className="font-serif text-3xl">
              How many hours can you give this week?
            </h2>
            <p className="mt-2 text-sm text-[#6c7771]">
              A sensible default is fine. You can edit this later under You →
              Capacity.
            </p>
            <label className="mt-6 block text-xs font-bold uppercase tracking-wide text-[#617a57]">
              Available hours
              <input
                autoFocus
                className="mt-2 w-full rounded-xl border border-[#dde2dd] bg-white px-3 py-3 text-lg text-[#14241f]"
                min="0.5"
                onChange={(event) => setCapacityHours(event.target.value)}
                step="0.5"
                type="number"
                value={capacityHours}
              />
            </label>
            <button
              className="mt-6 w-full rounded-xl bg-[#14241f] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              disabled={busy}
              onClick={() => void saveCapacity()}
              type="button"
            >
              {busy ? "Saving…" : "Set capacity"}
            </button>
          </div>
        ) : null}

        {step === "ideas" ? (
          <div className="py-5">
            <h2 id="onboarding-title" className="font-serif text-3xl">
              Dump a few ideas.
            </h2>
            <p className="mt-2 text-sm text-[#6c7771]">
              One per line. No classification needed—you can evaluate later.
            </p>
            <textarea
              autoFocus
              className="mt-5 min-h-36 w-full resize-y rounded-xl border border-[#dde2dd] bg-white px-3 py-3"
              onChange={(event) => setIdeaDump(event.target.value)}
              placeholder={"Learn Spanish\nFix evening routine\nShip side project"}
              value={ideaDump}
            />
            <button
              className="mt-4 w-full rounded-xl bg-[#14241f] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              disabled={busy}
              onClick={() => void saveIdeas()}
              type="button"
            >
              {busy ? "Saving…" : "Save ideas"}
            </button>
            <button
              className="mt-2 w-full px-4 py-3 text-sm font-bold text-[#617a57]"
              disabled={busy}
              onClick={() => void saveIdeas(true)}
              type="button"
            >
              Skip for now
            </button>
          </div>
        ) : null}

        {step === "project" ? (
          <div className="py-5">
            <h2 id="onboarding-title" className="font-serif text-3xl">
              Turn one idea into a project.
            </h2>
            <p className="mt-2 text-sm text-[#6c7771]">
              A project needs several steps. A single next move can stay as an
              action.
            </p>
            <label className="mt-6 block text-xs font-bold uppercase tracking-wide text-[#617a57]">
              Project title
              <input
                autoFocus
                className="mt-2 w-full rounded-xl border border-[#dde2dd] bg-white px-3 py-3 text-sm text-[#14241f]"
                onChange={(event) => setProjectTitle(event.target.value)}
                placeholder="Launch the side project"
                value={projectTitle}
              />
            </label>
            <button
              className="mt-6 w-full rounded-xl bg-[#14241f] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              disabled={busy}
              onClick={() => void saveProject()}
              type="button"
            >
              Create project
            </button>
            <button
              className="mt-2 w-full px-4 py-3 text-sm font-bold text-[#617a57]"
              disabled={busy}
              onClick={() => void saveProject(true)}
              type="button"
            >
              Skip
            </button>
          </div>
        ) : null}

        {step === "action" ? (
          <div className="py-5">
            <h2 id="onboarding-title" className="font-serif text-3xl">
              What is the next concrete move?
            </h2>
            <p className="mt-2 text-sm text-[#6c7771]">
              Estimate the effort, choose a day, and keep the first move light.
            </p>
            <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-[#617a57]">
              First action
              <input
                autoFocus
                className="mt-2 w-full rounded-xl border border-[#dde2dd] bg-white px-3 py-3 text-sm text-[#14241f]"
                onChange={(event) => setActionTitle(event.target.value)}
                placeholder="Draft the first page"
                value={actionTitle}
              />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-xs font-bold uppercase tracking-wide text-[#617a57]">
                Hours
                <input
                  className="mt-2 w-full rounded-xl border border-[#dde2dd] bg-white px-3 py-3 text-sm text-[#14241f]"
                  min="0.5"
                  onChange={(event) => setActionHours(event.target.value)}
                  step="0.5"
                  type="number"
                  value={actionHours}
                />
              </label>
              <label className="text-xs font-bold uppercase tracking-wide text-[#617a57]">
                Importance
                <select
                  className="mt-2 w-full rounded-xl border border-[#dde2dd] bg-white px-3 py-3 text-sm text-[#14241f]"
                  onChange={(event) =>
                    setActionImportance(event.target.value as PriorityLevel)
                  }
                  value={actionImportance}
                >
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Action day">
              {WEEK_DAYS.map((day) => (
                <button
                  aria-pressed={actionDay === day}
                  className={`rounded-full px-3 py-2 text-xs font-bold ${
                    actionDay === day
                      ? "bg-[#14241f] text-[#d6f57a]"
                      : "border border-[#dde2dd] bg-white"
                  }`}
                  key={day}
                  onClick={() => setActionDay(day)}
                  type="button"
                >
                  {day}
                </button>
              ))}
            </div>
            <button
              className="mt-6 w-full rounded-xl bg-[#14241f] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              disabled={busy}
              onClick={() => void saveAction()}
              type="button"
            >
              {busy ? "Saving…" : "Create first action"}
            </button>
            <button
              className="mt-2 w-full px-4 py-3 text-sm font-bold text-[#617a57]"
              disabled={busy}
              onClick={() => void saveAction(true)}
              type="button"
            >
              Skip
            </button>
          </div>
        ) : null}

        {step === "payoff" ? (
          <div className="py-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dbe8d7]">
              <LifeIcon name="today" size={28} />
            </span>
            <h2 id="onboarding-title" className="mt-5 font-serif text-4xl">
              You are set for Today.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#6c7771]">
              Available, planned, and remaining hours will sit beside your
              primary move. Add more only when it earns your attention.
            </p>
            <button
              className="mt-7 w-full rounded-xl bg-[#14241f] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              disabled={busy}
              onClick={() => void finish()}
              type="button"
            >
              {busy ? "Finishing…" : "Open Today"}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
