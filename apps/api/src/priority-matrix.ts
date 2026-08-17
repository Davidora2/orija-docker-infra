/** Eisenhower priority matrix helpers (mirrors web/mobile client convention). */

export const PRIORITY_QUADRANTS = [
  'DO_FIRST',
  'SCHEDULE',
  'DELEGATE',
  'ELIMINATE',
] as const;

export type PriorityQuadrant = (typeof PRIORITY_QUADRANTS)[number];

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
  switch (quadrant) {
    case 'DO_FIRST':
      return 0;
    case 'SCHEDULE':
      return 1;
    case 'DELEGATE':
      return 2;
    case 'ELIMINATE':
      return 3;
  }
}
