import { areaHealth } from '@life-os/shared';
import { addLocalDays, localDayKey, parseLocalDayKey } from './dates';

type SummaryItem = {
  id: string;
  parentId: string | null;
  status: string;
  body: Record<string, unknown>;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isOpenItem(item: SummaryItem): boolean {
  return (
    item.status !== 'DONE' &&
    item.status !== 'ARCHIVED' &&
    item.status !== 'CONVERTED'
  );
}

function hoursOf(item: SummaryItem): number {
  const value = item.body.hours;
  return typeof value === 'number' ? value : 1;
}

function projectTargetDate(body: Record<string, unknown>): string | null {
  for (const key of ['targetDate', 'deadline', 'dueAt'] as const) {
    const value = body[key];
    if (typeof value === 'string') {
      const sliced = value.slice(0, 10);
      if (DATE_ONLY.test(sliced)) return sliced;
    }
  }
  return null;
}

function isDueSoon(
  due: string,
  today: string,
  withinDays = 7,
): boolean {
  if (due < today) return false;
  const parsed = parseLocalDayKey(today);
  if (!parsed) return false;
  return due <= localDayKey(addLocalDays(parsed, withinDays));
}

function projectHours(actions: SummaryItem[], projectId: string): number {
  return actions
    .filter((item) => item.parentId === projectId && isOpenItem(item))
    .reduce((sum, action) => sum + hoursOf(action), 0);
}

function hasOpenAction(actions: SummaryItem[], projectId: string): boolean {
  return actions.some(
    (item) => item.parentId === projectId && isOpenItem(item),
  );
}

export type AreasPlanSummary = {
  areaCount: number;
  activeProjectCount: number;
  needsAttentionCount: number;
  plannedHours: number;
  availableHours: number;
  capacityPct: number;
  line: string;
  stateLabel: string;
};

export type ProjectsPlanSummary = {
  activeProjectCount: number;
  plannedHours: number;
  availableHours: number;
  dueSoonCount: number;
  missingNextActionCount: number;
  line: string;
  stateLabel: string;
};

export type IdeasPlanSummary = {
  inboxCount: number;
  evaluatedCount: number;
  parkedCount: number;
  line: string;
  stateLabel: string;
};

export function summarizeAreasPlan(input: {
  pillars: SummaryItem[];
  projects: SummaryItem[];
  actions: SummaryItem[];
  availableHours: number;
}): AreasPlanSummary {
  const { pillars, projects, actions, availableHours } = input;
  const openProjects = projects.filter(isOpenItem);
  let needsAttentionCount = 0;

  for (const pillar of pillars) {
    const pillarProjects = openProjects.filter(
      (project) => project.parentId === pillar.id,
    );
    const hours = pillarProjects.reduce(
      (sum, project) => sum + projectHours(actions, project.id),
      0,
    );
    const health = areaHealth(
      pillarProjects.length,
      hours,
      availableHours,
    );
    if (health.label !== 'On track') needsAttentionCount += 1;
  }

  const plannedHours = actions
    .filter((item) => isOpenItem(item))
    .reduce((sum, action) => sum + hoursOf(action), 0);
  const capacityPct =
    availableHours > 0
      ? Math.round((plannedHours / availableHours) * 100)
      : 0;

  const parts = [
    `${pillars.length} area${pillars.length === 1 ? '' : 's'}`,
    `${openProjects.length} active project${openProjects.length === 1 ? '' : 's'}`,
  ];
  if (needsAttentionCount > 0) {
    parts.push(
      `${needsAttentionCount} need${needsAttentionCount === 1 ? 's' : ''} attention`,
    );
  }

  const stateLabel =
    needsAttentionCount > 0
      ? `${needsAttentionCount} need${needsAttentionCount === 1 ? 's' : ''} attention`
      : plannedHours > availableHours
        ? 'Over capacity'
        : 'On track';

  return {
    areaCount: pillars.length,
    activeProjectCount: openProjects.length,
    needsAttentionCount,
    plannedHours,
    availableHours,
    capacityPct,
    line: parts.join(' · '),
    stateLabel,
  };
}

export function summarizeProjectsPlan(input: {
  projects: SummaryItem[];
  actions: SummaryItem[];
  availableHours: number;
  now?: Date;
}): ProjectsPlanSummary {
  const { projects, actions, availableHours, now = new Date() } = input;
  const today = localDayKey(now);
  const openProjects = projects.filter(isOpenItem);

  let dueSoonCount = 0;
  let missingNextActionCount = 0;

  for (const project of openProjects) {
    const due = projectTargetDate(project.body);
    if (due && isDueSoon(due, today)) dueSoonCount += 1;
    if (!hasOpenAction(actions, project.id)) missingNextActionCount += 1;
  }

  const plannedHours = actions
    .filter((item) => isOpenItem(item))
    .reduce((sum, action) => sum + hoursOf(action), 0);

  const parts = [
    `${openProjects.length} active`,
    `${plannedHours.toFixed(plannedHours % 1 === 0 ? 0 : 1)}h / ${availableHours}h`,
  ];
  if (dueSoonCount > 0) {
    parts.push(`${dueSoonCount} due soon`);
  }
  if (missingNextActionCount > 0) {
    parts.push(
      `${missingNextActionCount} missing next step${missingNextActionCount === 1 ? '' : 's'}`,
    );
  }

  const stateLabel =
    missingNextActionCount > 0
      ? `${missingNextActionCount} missing next step${missingNextActionCount === 1 ? '' : 's'}`
      : dueSoonCount > 0
        ? `${dueSoonCount} due soon`
        : plannedHours > availableHours
          ? 'Over capacity'
          : 'On track';

  return {
    activeProjectCount: openProjects.length,
    plannedHours,
    availableHours,
    dueSoonCount,
    missingNextActionCount,
    line: parts.join(' · '),
    stateLabel,
  };
}

export function summarizeIdeasPlan(ideas: SummaryItem[]): IdeasPlanSummary {
  const inboxCount = ideas.filter(
    (idea) =>
      idea.status !== 'EVALUATED' &&
      idea.status !== 'PARKED' &&
      idea.status !== 'CONVERTED' &&
      idea.status !== 'ARCHIVED' &&
      idea.status !== 'DONE',
  ).length;
  const evaluatedCount = ideas.filter(
    (idea) => idea.status === 'EVALUATED',
  ).length;
  const parkedCount = ideas.filter((idea) => idea.status === 'PARKED').length;

  const parts = [
    `${inboxCount} inbox`,
    `${evaluatedCount} evaluated`,
    `${parkedCount} parked`,
  ];

  const stateLabel =
    inboxCount > 0
      ? `${inboxCount} to review`
      : evaluatedCount > 0
        ? `${evaluatedCount} evaluated`
        : 'Inbox clear';

  return {
    inboxCount,
    evaluatedCount,
    parkedCount,
    line: parts.join(' · '),
    stateLabel,
  };
}
