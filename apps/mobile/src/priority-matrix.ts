/** Plan UX: project High/Med/Low + action Eisenhower from Importance × Urgency (L/M/H). */

export const PRIORITY_QUADRANTS = [
  'DO_FIRST',
  'SCHEDULE',
  'DELEGATE',
  'ELIMINATE',
] as const;

export type PriorityQuadrant = (typeof PRIORITY_QUADRANTS)[number];

export const PROJECT_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;

export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

/** Action Importance / Urgency levels (mockup: Low | Medium | High — not yes/no). */
export const PRIORITY_LEVELS = ['HIGH', 'MEDIUM', 'LOW'] as const;

export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export type PriorityQuadrantMeta = {
  id: PriorityQuadrant;
  title: string;
  /** Short badge / list label (Do Now / Schedule / Delegate / Delete). */
  label: string;
  subtitle: string;
  description: string;
  impact: string;
  urgent: boolean;
  important: boolean;
  importance: PriorityLevel;
  urgency: PriorityLevel;
  rank: number;
  number: 1 | 2 | 3 | 4;
};

export const PRIORITY_QUADRANT_META: Record<
  PriorityQuadrant,
  PriorityQuadrantMeta
> = {
  DO_FIRST: {
    id: 'DO_FIRST',
    title: 'Do Now',
    label: 'Do Now',
    subtitle: 'Urgent & Important',
    description:
      'Critical tasks with tight deadlines that need your immediate action.',
    impact: 'High impact',
    urgent: true,
    important: true,
    importance: 'HIGH',
    urgency: 'HIGH',
    rank: 0,
    number: 1,
  },
  SCHEDULE: {
    id: 'SCHEDULE',
    title: 'Schedule',
    label: 'Schedule',
    subtitle: 'Important, Not Urgent',
    description:
      'Long-term goals and planning that you should block time for later.',
    impact: 'Strategic',
    urgent: false,
    important: true,
    importance: 'HIGH',
    urgency: 'LOW',
    rank: 1,
    number: 2,
  },
  DELEGATE: {
    id: 'DELEGATE',
    title: 'Delegate',
    label: 'Delegate',
    subtitle: 'Urgent, Not Important',
    description:
      'Interruptions or minor requests that you can pass to others.',
    impact: 'Low leverage',
    urgent: true,
    important: false,
    importance: 'LOW',
    urgency: 'HIGH',
    rank: 2,
    number: 3,
  },
  ELIMINATE: {
    id: 'ELIMINATE',
    title: 'Delete',
    label: 'Delete',
    subtitle: 'Not Urgent & Not Important',
    description: 'Time-wasters and busywork to drop from your list.',
    impact: 'Noise',
    urgent: false,
    important: false,
    importance: 'LOW',
    urgency: 'LOW',
    rank: 3,
    number: 4,
  },
};

/** Visual grid order: Q1 Do Now | Q2 Schedule / Q3 Delegate | Q4 Delete */
export const PRIORITY_MATRIX_ORDER: PriorityQuadrant[] = [
  'DO_FIRST',
  'SCHEDULE',
  'DELEGATE',
  'ELIMINATE',
];

export const PROJECT_PRIORITY_META: Record<
  ProjectPriority,
  { id: ProjectPriority; title: string; rank: number }
> = {
  HIGH: { id: 'HIGH', title: 'High', rank: 0 },
  MEDIUM: { id: 'MEDIUM', title: 'Medium', rank: 1 },
  LOW: { id: 'LOW', title: 'Low', rank: 2 },
};

export const PRIORITY_LEVEL_META: Record<
  PriorityLevel,
  { id: PriorityLevel; title: string; rank: number }
> = {
  HIGH: { id: 'HIGH', title: 'High', rank: 0 },
  MEDIUM: { id: 'MEDIUM', title: 'Medium', rank: 1 },
  LOW: { id: 'LOW', title: 'Low', rank: 2 },
};

export function isPriorityQuadrant(value: unknown): value is PriorityQuadrant {
  return (
    typeof value === 'string' &&
    (PRIORITY_QUADRANTS as readonly string[]).includes(value)
  );
}

export function isProjectPriority(value: unknown): value is ProjectPriority {
  return (
    typeof value === 'string' &&
    (PROJECT_PRIORITIES as readonly string[]).includes(value)
  );
}

export function isPriorityLevel(value: unknown): value is PriorityLevel {
  return (
    typeof value === 'string' &&
    (PRIORITY_LEVELS as readonly string[]).includes(value)
  );
}

/**
 * Derive Eisenhower from Importance × Urgency (L/M/H).
 * Mapping (mockup fidelity):
 * - High+High → Do Now
 * - High+Low/Med → Schedule
 * - Med+High → Do Now; Med+Low/Med → Schedule
 * - Low+High/Med → Delegate
 * - Low+Low → Delete
 */
export function quadrantFromLevels(
  importance: PriorityLevel,
  urgency: PriorityLevel,
): PriorityQuadrant {
  if (importance === 'HIGH' || importance === 'MEDIUM') {
    if (urgency === 'HIGH') return 'DO_FIRST';
    return 'SCHEDULE';
  }
  // LOW importance
  if (urgency === 'HIGH' || urgency === 'MEDIUM') return 'DELEGATE';
  return 'ELIMINATE';
}

/** @deprecated Prefer quadrantFromLevels — bool maps High/Low only. */
export function quadrantFromFlags(
  important: boolean,
  urgent: boolean,
): PriorityQuadrant {
  return quadrantFromLevels(
    important ? 'HIGH' : 'LOW',
    urgent ? 'HIGH' : 'LOW',
  );
}

export function levelsFromQuadrant(quadrant: PriorityQuadrant): {
  importance: PriorityLevel;
  urgency: PriorityLevel;
} {
  const meta = PRIORITY_QUADRANT_META[quadrant];
  return { importance: meta.importance, urgency: meta.urgency };
}

export function flagsFromQuadrant(quadrant: PriorityQuadrant): {
  important: boolean;
  urgent: boolean;
} {
  const meta = PRIORITY_QUADRANT_META[quadrant];
  return { important: meta.important, urgent: meta.urgent };
}

/**
 * Map legacy project Eisenhower → project High/Medium/Low.
 * Do First/Now → High; Schedule → Medium; Delegate/Eliminate/Delete → Low.
 */
export function projectPriorityFromLegacyQuadrant(
  quadrant: PriorityQuadrant,
): ProjectPriority {
  switch (quadrant) {
    case 'DO_FIRST':
      return 'HIGH';
    case 'SCHEDULE':
      return 'MEDIUM';
    case 'DELEGATE':
    case 'ELIMINATE':
      return 'LOW';
  }
}

/** Project priority: High / Medium / Low only (not Eisenhower). */
export function projectPriorityLevel(
  body: Record<string, unknown> | null | undefined,
): ProjectPriority {
  const direct = body?.priority;
  if (isProjectPriority(direct)) return direct;

  const legacy = body?.priorityQuadrant ?? body?.eisenhower;
  if (isPriorityQuadrant(legacy)) {
    return projectPriorityFromLegacyQuadrant(legacy);
  }
  return 'MEDIUM';
}

export function projectPriorityRank(priority: ProjectPriority): number {
  return PROJECT_PRIORITY_META[priority].rank;
}

function readBool(
  body: Record<string, unknown> | null | undefined,
  key: string,
): boolean | undefined {
  const value = body?.[key];
  if (typeof value === 'boolean') return value;
  return undefined;
}

function readLevel(
  body: Record<string, unknown> | null | undefined,
  key: string,
): PriorityLevel | undefined {
  const value = body?.[key];
  if (isPriorityLevel(value)) return value;
  return undefined;
}

/**
 * Coerce stored Importance/Urgency: prefer L/M/H strings; fall back to boolean
 * important/urgent (true→HIGH, false→LOW).
 */
export function actionImportanceLevel(
  actionBody: Record<string, unknown> | null | undefined,
): PriorityLevel | undefined {
  const level =
    readLevel(actionBody, 'importance') ??
    readLevel(actionBody, 'importanceLevel');
  if (level) return level;
  const flag = readBool(actionBody, 'important');
  if (flag === undefined) return undefined;
  return flag ? 'HIGH' : 'LOW';
}

export function actionUrgencyLevel(
  actionBody: Record<string, unknown> | null | undefined,
): PriorityLevel | undefined {
  const level =
    readLevel(actionBody, 'urgency') ?? readLevel(actionBody, 'urgencyLevel');
  if (level) return level;
  const flag = readBool(actionBody, 'urgent');
  if (flag === undefined) return undefined;
  return flag ? 'HIGH' : 'LOW';
}

/**
 * Action Eisenhower from Importance × Urgency (L/M/H).
 * Falls back to legacy action/project priorityQuadrant, then Schedule.
 */
export function actionPriorityQuadrant(
  actionBody: Record<string, unknown> | null | undefined,
  projectBody?: Record<string, unknown> | null | undefined,
): PriorityQuadrant {
  const importance = actionImportanceLevel(actionBody);
  const urgency = actionUrgencyLevel(actionBody);
  if (importance !== undefined && urgency !== undefined) {
    return quadrantFromLevels(importance, urgency);
  }

  const actionLegacy =
    actionBody?.priorityQuadrant ?? actionBody?.eisenhower;
  if (isPriorityQuadrant(actionLegacy)) {
    return actionLegacy;
  }

  const projectLegacy =
    projectBody?.priorityQuadrant ?? projectBody?.eisenhower;
  if (isPriorityQuadrant(projectLegacy)) {
    return projectLegacy;
  }

  if (importance !== undefined || urgency !== undefined) {
    return quadrantFromLevels(importance ?? 'HIGH', urgency ?? 'LOW');
  }

  return 'SCHEDULE';
}

export function actionImportant(
  actionBody: Record<string, unknown> | null | undefined,
  projectBody?: Record<string, unknown> | null | undefined,
): boolean {
  return flagsFromQuadrant(actionPriorityQuadrant(actionBody, projectBody))
    .important;
}

export function actionUrgent(
  actionBody: Record<string, unknown> | null | undefined,
  projectBody?: Record<string, unknown> | null | undefined,
): boolean {
  return flagsFromQuadrant(actionPriorityQuadrant(actionBody, projectBody))
    .urgent;
}

export function priorityRank(quadrant: PriorityQuadrant): number {
  return PRIORITY_QUADRANT_META[quadrant].rank;
}

/** @deprecated Use actionPriorityQuadrant — Eisenhower lives on actions. */
export function projectPriorityQuadrant(
  body: Record<string, unknown> | null | undefined,
): PriorityQuadrant {
  const legacy = body?.priorityQuadrant ?? body?.eisenhower;
  if (isPriorityQuadrant(legacy)) return legacy;
  const level = projectPriorityLevel(body);
  if (level === 'HIGH') return 'DO_FIRST';
  if (level === 'LOW') return 'ELIMINATE';
  return 'SCHEDULE';
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Canonical project deadline from body (`targetDate`, or aliases `deadline` / `dueAt`). */
export function projectTargetDate(
  body: Record<string, unknown> | null | undefined,
): string | null {
  const source = body ?? {};
  for (const key of ['targetDate', 'deadline', 'dueAt'] as const) {
    const value = source[key];
    if (typeof value === 'string') {
      const sliced = value.slice(0, 10);
      if (DATE_ONLY.test(sliced)) return sliced;
    }
  }
  return null;
}

/** Write/clear canonical `targetDate`; drop deadline aliases. */
export function projectBodyWithTargetDate(
  body: Record<string, unknown>,
  targetDate: string | null | undefined,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...body };
  delete next.deadline;
  delete next.dueAt;
  if (typeof targetDate === 'string' && DATE_ONLY.test(targetDate.slice(0, 10))) {
    next.targetDate = targetDate.slice(0, 10);
  } else {
    delete next.targetDate;
  }
  return next;
}

/** Normalize PROJECT body so deadline aliases collapse onto `targetDate`. */
export function normalizeProjectDeadlineBody(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const hasAlias =
    Object.prototype.hasOwnProperty.call(body, 'deadline') ||
    Object.prototype.hasOwnProperty.call(body, 'dueAt') ||
    Object.prototype.hasOwnProperty.call(body, 'targetDate');
  if (!hasAlias) return body;
  const cleared =
    body.targetDate === null ||
    body.deadline === null ||
    body.dueAt === null;
  const due = projectTargetDate(body);
  return projectBodyWithTargetDate(body, cleared && !due ? null : due);
}

export function isProjectDeadlineOverdue(
  body: Record<string, unknown> | null | undefined,
  status: string,
  today = new Date().toISOString().slice(0, 10),
): boolean {
  if (
    status === 'DONE' ||
    status === 'ARCHIVED' ||
    status === 'CANCELLED' ||
    status === 'CONVERTED'
  ) {
    return false;
  }
  const due = projectTargetDate(body);
  return Boolean(due && due < today);
}

/** Build project body fields for High/Med/Low (strips Eisenhower keys). */
export function projectBodyWithPriority(
  body: Record<string, unknown>,
  priority: ProjectPriority,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...body, priority };
  delete next.priorityQuadrant;
  delete next.eisenhower;
  return next;
}

/** Build action body from Importance × Urgency levels (also mirrors bools). */
export function actionBodyWithLevels(
  body: Record<string, unknown>,
  importance: PriorityLevel,
  urgency: PriorityLevel,
): Record<string, unknown> {
  const quadrant = quadrantFromLevels(importance, urgency);
  const next: Record<string, unknown> = {
    ...body,
    importance,
    urgency,
    important: importance === 'HIGH' || importance === 'MEDIUM',
    urgent: urgency === 'HIGH',
    priorityQuadrant: quadrant,
  };
  delete next.eisenhower;
  delete next.importanceLevel;
  delete next.urgencyLevel;
  return next;
}

/** Build action body from boolean Important × Urgent (maps to High/Low). */
export function actionBodyWithFlags(
  body: Record<string, unknown>,
  important: boolean,
  urgent: boolean,
): Record<string, unknown> {
  return actionBodyWithLevels(
    body,
    important ? 'HIGH' : 'LOW',
    urgent ? 'HIGH' : 'LOW',
  );
}

/** Normalize bodies for migration / write paths. */
export function migrateProjectBody(
  body: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const source = normalizeProjectDeadlineBody({ ...(body ?? {}) });
  const priority = projectPriorityLevel(source);
  return projectBodyWithPriority(source, priority);
}

export function migrateActionBody(
  actionBody: Record<string, unknown> | null | undefined,
  projectBody?: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const source = { ...(actionBody ?? {}) };
  const quadrant = actionPriorityQuadrant(source, projectBody);
  const { importance, urgency } = levelsFromQuadrant(quadrant);
  const existingImp = actionImportanceLevel(source);
  const existingUrg = actionUrgencyLevel(source);
  return actionBodyWithLevels(
    source,
    existingImp ?? importance,
    existingUrg ?? urgency,
  );
}
