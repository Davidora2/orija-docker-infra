/** Plan UX priority helpers: project High/Med/Low + action Eisenhower via Important × Urgent. */

export const PRIORITY_QUADRANTS = [
  'DO_FIRST',
  'SCHEDULE',
  'DELEGATE',
  'ELIMINATE',
] as const;

export type PriorityQuadrant = (typeof PRIORITY_QUADRANTS)[number];

export const PROJECT_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;

export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

export type PriorityQuadrantMeta = {
  id: PriorityQuadrant;
  title: string;
  subtitle: string;
  description: string;
  urgent: boolean;
  important: boolean;
  rank: number;
};

export const PRIORITY_QUADRANT_META: Record<
  PriorityQuadrant,
  PriorityQuadrantMeta
> = {
  DO_FIRST: {
    id: 'DO_FIRST',
    title: 'Do First',
    subtitle: 'Urgent & Important',
    description:
      'Critical tasks with tight deadlines that need your immediate action.',
    urgent: true,
    important: true,
    rank: 0,
  },
  SCHEDULE: {
    id: 'SCHEDULE',
    title: 'Schedule',
    subtitle: 'Important, Not Urgent',
    description:
      'Long-term goals and planning that you should block time for later.',
    urgent: false,
    important: true,
    rank: 1,
  },
  DELEGATE: {
    id: 'DELEGATE',
    title: 'Delegate',
    subtitle: 'Urgent, Not Important',
    description:
      'Interruptions or minor requests that you can pass to others.',
    urgent: true,
    important: false,
    rank: 2,
  },
  ELIMINATE: {
    id: 'ELIMINATE',
    title: 'Eliminate',
    subtitle: 'Not Urgent & Not Important',
    description: 'Time-wasters and busywork to drop from your list.',
    urgent: false,
    important: false,
    rank: 3,
  },
};

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

/** Derive Eisenhower quadrant from Important × Urgent. */
export function quadrantFromFlags(
  important: boolean,
  urgent: boolean,
): PriorityQuadrant {
  if (important && urgent) return 'DO_FIRST';
  if (important && !urgent) return 'SCHEDULE';
  if (!important && urgent) return 'DELEGATE';
  return 'ELIMINATE';
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
 * Do First → High; Schedule → Medium; Delegate/Eliminate → Low.
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

/**
 * Action Eisenhower from Important × Urgent.
 * Falls back to legacy action/project priorityQuadrant, then Schedule.
 */
export function actionPriorityQuadrant(
  actionBody: Record<string, unknown> | null | undefined,
  projectBody?: Record<string, unknown> | null | undefined,
): PriorityQuadrant {
  const important = readBool(actionBody, 'important');
  const urgent = readBool(actionBody, 'urgent');
  if (important !== undefined && urgent !== undefined) {
    return quadrantFromFlags(important, urgent);
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

  if (important !== undefined || urgent !== undefined) {
    return quadrantFromFlags(important ?? true, urgent ?? false);
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
  // Infer a display quadrant from High/Med/Low for legacy callers
  const level = projectPriorityLevel(body);
  if (level === 'HIGH') return 'DO_FIRST';
  if (level === 'LOW') return 'ELIMINATE';
  return 'SCHEDULE';
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

/** Build action body fields from Important × Urgent. */
export function actionBodyWithFlags(
  body: Record<string, unknown>,
  important: boolean,
  urgent: boolean,
): Record<string, unknown> {
  const quadrant = quadrantFromFlags(important, urgent);
  const next: Record<string, unknown> = {
    ...body,
    important,
    urgent,
    priorityQuadrant: quadrant,
  };
  delete next.eisenhower;
  return next;
}

/** Normalize bodies for migration / write paths. */
export function migrateProjectBody(
  body: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const source = { ...(body ?? {}) };
  const priority = projectPriorityLevel(source);
  return projectBodyWithPriority(source, priority);
}

export function migrateActionBody(
  actionBody: Record<string, unknown> | null | undefined,
  projectBody?: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const source = { ...(actionBody ?? {}) };
  const quadrant = actionPriorityQuadrant(source, projectBody);
  const { important, urgent } = flagsFromQuadrant(quadrant);
  return actionBodyWithFlags(source, important, urgent);
}
