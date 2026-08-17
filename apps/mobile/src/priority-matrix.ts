/** Eisenhower priority matrix for Life OS projects. */

export const PRIORITY_QUADRANTS = [
  'DO_FIRST',
  'SCHEDULE',
  'DELEGATE',
  'ELIMINATE',
] as const;

export type PriorityQuadrant = (typeof PRIORITY_QUADRANTS)[number];

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

export function isPriorityQuadrant(value: unknown): value is PriorityQuadrant {
  return (
    typeof value === 'string' &&
    (PRIORITY_QUADRANTS as readonly string[]).includes(value)
  );
}

export function projectPriorityQuadrant(
  body: Record<string, unknown> | null | undefined,
): PriorityQuadrant {
  const raw = body?.priorityQuadrant ?? body?.eisenhower;
  return isPriorityQuadrant(raw) ? raw : 'SCHEDULE';
}

export function priorityRank(quadrant: PriorityQuadrant): number {
  return PRIORITY_QUADRANT_META[quadrant].rank;
}
