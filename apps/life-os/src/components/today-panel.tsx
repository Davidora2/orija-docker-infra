"use client";

import { useMemo } from "react";
import type { LifeItem } from "../lib/api";
import {
  PRIORITY_QUADRANT_META,
  actionPriorityQuadrant,
  actionScheduledDate,
} from "../lib/priority-matrix";
import { LifeIcon, lifeIconFromLegacy } from "./life-icon";
import { FocusHero, FocusHeroHours } from "./focus-hero";

type Props = {
  primary: LifeItem | null;
  supporting: LifeItem[];
  openActions: LifeItem[];
  projects: LifeItem[];
  pillars: LifeItem[];
  planned: number;
  available: number;
  busy: boolean;
  onToggleAction: (action: LifeItem) => void;
  onOpenPlan: () => void;
  onQuickAdd: () => void;
  onOpenCapacity: () => void;
};

function numberOf(item: LifeItem, key: string, fallback = 0) {
  const value = item.body[key];
  return typeof value === "number" ? value : fallback;
}

function stringOf(item: LifeItem, key: string) {
  const value = item.body[key];
  return typeof value === "string" ? value : "";
}

function hours(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}h`;
}

export function TodayPanel({
  primary,
  supporting,
  openActions,
  projects,
  pillars,
  planned,
  available,
  busy,
  onToggleAction,
  onOpenPlan,
  onQuickAdd,
  onOpenCapacity,
}: Props) {
  const remaining = available - planned;
  const overCapacity = remaining < -0.05;
  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const areaById = useMemo(
    () => new Map(pillars.map((area) => [area.id, area])),
    [pillars],
  );
  const risks = useMemo(() => {
    const rows: string[] = [];
    if (overCapacity) {
      rows.push(`${hours(Math.abs(remaining))} over weekly capacity`);
    }
    const today = new Date().toISOString().slice(0, 10);
    const overdue = openActions.filter((action) => {
      const date = actionScheduledDate(action.body);
      return Boolean(date && date <= today);
    }).length;
    if (overdue > 0) {
      rows.push(
        `${overdue} scheduled action${overdue === 1 ? "" : "s"} due now`,
      );
    }
    const withoutNextAction = projects.filter(
      (project) =>
        project.status !== "DONE" &&
        !openActions.some((action) => action.parentId === project.id),
    );
    if (withoutNextAction[0]) {
      rows.push(`${withoutNextAction[0].title} has no next action`);
    }
    return rows.slice(0, 3);
  }, [openActions, overCapacity, projects, remaining]);

  function context(action: LifeItem) {
    const project = projectById.get(action.parentId ?? "");
    const area = project ? areaById.get(project.parentId ?? "") : undefined;
    return {
      project,
      area,
      label: [area?.title, project?.title].filter(Boolean).join(" · "),
    };
  }

  const formattedDate = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <section className="space-y-5">
      <header className="pb-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#617a57]">
          Command
        </p>
        <h1
          className="mt-2 font-serif text-4xl leading-none tracking-tight text-[#14241f] sm:text-5xl"
          suppressHydrationWarning
        >
          {formattedDate}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[#6c7771]">
          Available, planned, remaining—then the one move that earns your focus.
        </p>
      </header>

      <article
        className={`overflow-hidden rounded-2xl border bg-white ${
          overCapacity ? "border-[#e8c7bd]" : "border-[#dde2dd]"
        }`}
      >
        <div className="grid grid-cols-3 divide-x divide-[#e8ebe7]">
          {[
            ["Available", hours(available), "text-[#14241f]"],
            ["Planned", hours(planned), "text-[#14241f]"],
            [
              "Remaining",
              hours(remaining),
              overCapacity ? "text-[#c9634f]" : "text-[#617a57]",
            ],
          ].map(([label, value, tone]) => (
            <div className="min-w-0 px-3 py-4 text-center sm:px-5" key={label}>
              <p className={`truncate font-serif text-2xl sm:text-3xl ${tone}`}>
                {value}
              </p>
              <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-[#6c7771]">
                {label}
              </p>
            </div>
          ))}
        </div>
        {overCapacity ? (
          <button
            className="flex w-full items-center justify-between gap-3 border-t border-[#efd9d2] bg-[#fdf4f1] px-4 py-3 text-left text-xs font-bold text-[#b75542]"
            onClick={onOpenCapacity}
            type="button"
          >
            <span>Over capacity—rebalance before adding more.</span>
            <LifeIcon color="currentColor" name="chevron-right" size={14} />
          </button>
        ) : null}
      </article>

      {primary ? (
        <FocusHero
          accentDot
          actions={
            <>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#d6f57a] px-4 text-xs font-bold text-[#2f431e] disabled:opacity-50"
                disabled={busy}
                onClick={() => onToggleAction(primary)}
                type="button"
              >
                <LifeIcon color="currentColor" name="done" size={16} />
                {primary.status === "DONE" ? "Undo complete" : "Mark done"}
              </button>
              <button
                className="min-h-10 rounded-xl border border-white/15 px-4 text-xs font-bold text-white/75"
                onClick={onOpenCapacity}
                type="button"
              >
                View capacity
              </button>
            </>
          }
          eyebrow="Primary move"
          meta={(() => {
            const { project, label } = context(primary);
            const quadrant =
              PRIORITY_QUADRANT_META[
                actionPriorityQuadrant(primary.body, project?.body)
              ].title;
            const day = stringOf(primary, "day");
            return [day, label, quadrant, primary.status === "DONE" ? "Done" : ""]
              .filter(Boolean)
              .join(" · ");
          })()}
          title={primary.title}
          trailing={
            <FocusHeroHours>{hours(numberOf(primary, "hours", 1))}</FocusHeroHours>
          }
        />
      ) : (
        <article className="rounded-3xl border border-[#d9e2d5] bg-gradient-to-br from-white to-[#edf3e9] px-6 py-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dbe8d7]">
            <LifeIcon name="today" size={28} />
          </span>
          <h2 className="mt-5 font-serif text-3xl text-[#14241f]">
            Make Today useful.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6c7771]">
            Plan a project and its next action, or capture one concrete move now.
            Your highest-priority action will appear here.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              className="rounded-xl bg-[#14241f] px-4 py-3 text-xs font-bold text-white"
              onClick={onOpenPlan}
              type="button"
            >
              Open Plan
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#c9d6c4] bg-white px-4 py-3 text-xs font-bold text-[#617a57]"
              onClick={onQuickAdd}
              type="button"
            >
              <LifeIcon name="add" size={15} />
              Quick Add
            </button>
          </div>
        </article>
      )}

      {primary ? (
        <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#617a57]">
                Supporting moves
              </p>
              <h2 className="mt-1 font-serif text-2xl">Keep the list short.</h2>
            </div>
            <button
              className="text-xs font-bold text-[#617a57]"
              onClick={onOpenPlan}
              type="button"
            >
              Plan
            </button>
          </div>
          {supporting.length === 0 ? (
            <p className="mt-4 rounded-xl bg-[#f4f5f0] px-4 py-3 text-sm text-[#6c7771]">
              No other open actions this week.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[#edf0ec]">
              {supporting.slice(0, 3).map((action, index) => {
                const { area, label } = context(action);
                return (
                  <li className="flex min-w-0 items-center gap-3 py-3" key={action.id}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef3ea]">
                      <LifeIcon
                        name={lifeIconFromLegacy(area?.body.icon, index)}
                        size={18}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{action.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-[#6c7771]">
                        {hours(numberOf(action, "hours", 1))}
                        {stringOf(action, "day")
                          ? ` · ${stringOf(action, "day")}`
                          : ""}
                        {label ? ` · ${label}` : ""}
                      </p>
                    </div>
                    <button
                      aria-label={`Mark ${action.title} done`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#c9d6c4] text-[#617a57] disabled:opacity-50"
                      disabled={busy}
                      onClick={() => onToggleAction(action)}
                      type="button"
                    >
                      <LifeIcon color="currentColor" name="done" size={17} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      ) : null}

      <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#617a57]">
              Risks
            </p>
            <h2 className="mt-1 font-serif text-2xl">Operational cues</h2>
          </div>
          {risks.length > 0 ? (
            <LifeIcon color="#c9634f" name="warning" size={22} />
          ) : (
            <LifeIcon name="check" size={20} />
          )}
        </div>
        {risks.length === 0 ? (
          <p className="mt-3 text-sm text-[#6c7771]">No active risks detected.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {risks.map((risk) => (
              <li
                className="flex items-center gap-2 rounded-xl bg-[#fdf4f1] px-3 py-2.5 text-sm text-[#9f4937]"
                key={risk}
              >
                <LifeIcon color="currentColor" name="warning" size={16} />
                <span className="min-w-0 flex-1">{risk}</span>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
