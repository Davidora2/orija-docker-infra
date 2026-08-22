export type PlanItemLike = {
  id: string;
  parentId: string | null;
  title: string;
  status: string;
  body: Record<string, unknown>;
};

export type PriorityQuadrant =
  | 'DO_FIRST'
  | 'SCHEDULE'
  | 'DELEGATE'
  | 'ELIMINATE';

export type PriorityWindow =
  | 'THIS_WEEK'
  | 'TODAY'
  | 'NEXT_7_DAYS'
  | 'OVERDUE'
  | 'UNSCHEDULED'
  | 'ALL';

export type PriorityActionStatus = 'OPEN' | 'DONE' | 'ANY';

export type PriorityFilters = {
  query: string;
  areaId: string;
  projectId: string;
  projectPriority: string;
  actionStatus: PriorityActionStatus;
  quadrant: PriorityQuadrant | '';
  window: PriorityWindow;
};

export const DEFAULT_PRIORITY_FILTERS: PriorityFilters = {
  query: '',
  areaId: '',
  projectId: '',
  projectPriority: '',
  actionStatus: 'OPEN',
  quadrant: '',
  window: 'THIS_WEEK',
};

export function resetPriorityFilters(): PriorityFilters {
  return { ...DEFAULT_PRIORITY_FILTERS };
}

function text(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === 'string' ? value : '';
}

function level(body: Record<string, unknown>, key: string): number {
  const value = text(body, key).toUpperCase();
  if (value === 'HIGH') return 2;
  if (value === 'MEDIUM') return 1;
  if (value === 'LOW') return 0;
  return -1;
}

export function actionQuadrant(
  actionBody: Record<string, unknown>,
  projectBody: Record<string, unknown> = {},
): PriorityQuadrant {
  const explicit = text(actionBody, 'priorityQuadrant');
  if (
    explicit === 'DO_FIRST' ||
    explicit === 'SCHEDULE' ||
    explicit === 'DELEGATE' ||
    explicit === 'ELIMINATE'
  ) {
    return explicit;
  }

  const importance =
    level(actionBody, 'importance') >= 0
      ? level(actionBody, 'importance')
      : level(projectBody, 'importance');
  const urgency = level(actionBody, 'urgency');
  const important =
    importance >= 0
      ? importance >= 1
      : typeof actionBody.important === 'boolean'
        ? actionBody.important
        : typeof projectBody.important === 'boolean'
          ? projectBody.important
          : false;
  const urgent =
    urgency >= 0
      ? urgency >= 1
      : typeof actionBody.urgent === 'boolean'
        ? actionBody.urgent
        : false;
  if (important && urgency >= 2) return 'DO_FIRST';
  if (important) return 'SCHEDULE';
  if (urgent) return 'DELEGATE';
  return 'ELIMINATE';
}

export function scheduledDate(item: PlanItemLike): string | null {
  for (const key of ['scheduledDate', 'dueDate', 'date']) {
    const value = text(item.body, key);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  }
  return null;
}

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function matchesWindow(
  item: PlanItemLike,
  window: PriorityWindow,
  now: Date,
): boolean {
  if (window === 'ALL') return true;
  const date = scheduledDate(item);
  const day = text(item.body, 'day');
  if (window === 'UNSCHEDULED') return !date && !day;

  const today = dayKey(now);
  if (window === 'TODAY') return date === today || day === 'Today';
  if (window === 'OVERDUE') return Boolean(date && date < today);

  if (date) {
    const limit = new Date(now);
    limit.setHours(12, 0, 0, 0);
    limit.setDate(limit.getDate() + 7);
    return date >= today && date <= dayKey(limit);
  }

  if (window === 'NEXT_7_DAYS') {
    return day === 'Today' || day === 'This week';
  }
  return day !== 'Later' && day !== 'Someday';
}

export function filterPriorityActions<T extends PlanItemLike>(
  actions: T[],
  projects: PlanItemLike[],
  filters: PriorityFilters,
  now = new Date(),
): T[] {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const query = filters.query.trim().toLocaleLowerCase();
  return actions.filter((action) => {
    const project = projectById.get(action.parentId ?? '');
    const done = action.status === 'DONE';
    if (query && !action.title.toLocaleLowerCase().includes(query)) return false;
    if (filters.areaId && project?.parentId !== filters.areaId) return false;
    if (filters.projectId && action.parentId !== filters.projectId) return false;
    if (
      filters.projectPriority &&
      text(project?.body ?? {}, 'priority') !== filters.projectPriority
    ) {
      return false;
    }
    if (filters.actionStatus === 'OPEN' && done) return false;
    if (filters.actionStatus === 'DONE' && !done) return false;
    if (
      filters.quadrant &&
      actionQuadrant(action.body, project?.body) !== filters.quadrant
    ) {
      return false;
    }
    return matchesWindow(action, filters.window, now);
  });
}

export type IdeaLifecycleAction = 'KEEP' | 'PARK' | 'CONVERT' | 'DISCARD';

export function ideaStatusForAction(action: IdeaLifecycleAction): string {
  if (action === 'PARK') return 'PARKED';
  if (action === 'CONVERT') return 'CONVERTED';
  if (action === 'DISCARD') return 'ARCHIVED';
  return 'ACTIVE';
}

export function ideaOverallScore(body: Record<string, unknown>): number {
  const number = (key: string) => {
    const value = body[key];
    return typeof value === 'number' ? value : 0;
  };
  return (
    (number('impact') +
      number('alignment') +
      number('timing') +
      (10 - number('effort'))) /
    4
  );
}

export function ideaScoreNarrative(score: number): string {
  if (score >= 7) return 'Strong candidate — consider turning it into a project.';
  if (score >= 5) return 'Promising — refine it or park it for later.';
  return 'Light signal — keep it in the inbox or discard it.';
}

export {
  DATE_ONLY,
  addLocalDays,
  canonicalDateOnly,
  formatFriendlyDate,
  isValidDateOnly,
  localDayKey,
  parseLocalDayKey,
  quickDateNextWeek,
  quickDateToday,
  quickDateTomorrow,
} from './dates';

export {
  summarizeAreasPlan,
  summarizeIdeasPlan,
  summarizeProjectsPlan,
  type AreasPlanSummary,
  type IdeasPlanSummary,
  type ProjectsPlanSummary,
} from './summaries';

export function ideaConversionMetadata(ideaId: string): {
  projectBody: { fromIdeaId: string };
  sourceIdeaStatus: 'CONVERTED';
} {
  if (!ideaId.trim()) throw new Error('A source idea is required for conversion.');
  return {
    projectBody: { fromIdeaId: ideaId },
    sourceIdeaStatus: 'CONVERTED',
  };
}
