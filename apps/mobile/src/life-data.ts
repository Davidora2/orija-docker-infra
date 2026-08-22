import {
  createLifeItem,
  listLifeItems,
  type LifeItem,
} from './api';
import {
  actionPriorityQuadrant,
  priorityRank,
  projectPriorityLevel,
  projectPriorityRank,
} from './priority-matrix';

/** Suggested life areas retain legacy keys mapped by LifeIcon on every client. */
export const SUGGESTED_LIFE_AREAS = [
  { title: 'Health', icon: 'fitness-outline' },
  { title: 'Career', icon: 'trending-up-outline' },
  { title: 'Wealth', icon: 'wallet-outline' },
  { title: 'Relationships', icon: 'heart-outline' },
  { title: 'Family', icon: 'home-outline' },
  { title: 'Personal growth', icon: 'sparkles-outline' },
  { title: 'Creative', icon: 'color-palette-outline' },
  { title: 'Product', icon: 'layers-outline' },
  { title: 'Business', icon: 'briefcase-outline' },
  { title: 'Faith', icon: 'leaf-outline' },
  { title: 'Community', icon: 'people-outline' },
  { title: 'Adventure', icon: 'airplane-outline' },
] as const;

export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function bodyNumber(item: LifeItem, key: string, fallback = 0): number {
  const value = item.body[key];
  return typeof value === 'number' ? value : fallback;
}

export function bodyString(item: LifeItem, key: string, fallback = ''): string {
  const value = item.body[key];
  return typeof value === 'string' ? value : fallback;
}

export function isOpen(item: LifeItem): boolean {
  return item.status !== 'DONE' && item.status !== 'ARCHIVED';
}

export function ofKind(items: LifeItem[], kind: LifeItem['kind']): LifeItem[] {
  return items.filter((item) => item.kind === kind);
}

export function childrenOf(items: LifeItem[], parentId: string): LifeItem[] {
  return items.filter((item) => item.parentId === parentId);
}

export function weeklyCapacityHours(items: LifeItem[]): {
  planned: number;
  available: number;
  openActions: LifeItem[];
} {
  const vision = ofKind(items, 'VISION').find((item) =>
    Object.prototype.hasOwnProperty.call(item.body, 'availableHours'),
  );
  const available = vision ? bodyNumber(vision, 'availableHours', 11) : 11;
  const openActions = ofKind(items, 'ACTION').filter(isOpen);
  const planned = openActions.reduce(
    (sum, action) => sum + bodyNumber(action, 'hours', 1),
    0,
  );
  return { planned, available, openActions };
}

export function primaryAction(items: LifeItem[]): LifeItem | null {
  const open = ofKind(items, 'ACTION').filter(isOpen);
  if (open.length === 0) return null;
  const projects = ofKind(items, 'PROJECT');
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const scheduled = open.filter((item) => bodyString(item, 'day'));
  const pool = scheduled.length > 0 ? scheduled : open;
  return [...pool].sort((a, b) => {
    const aProject = projectById.get(a.parentId ?? '');
    const bProject = projectById.get(b.parentId ?? '');
    const aRank = priorityRank(
      actionPriorityQuadrant(a.body, aProject?.body),
    );
    const bRank = priorityRank(
      actionPriorityQuadrant(b.body, bProject?.body),
    );
    const aProjectRank = projectPriorityRank(
      projectPriorityLevel(aProject?.body),
    );
    const bProjectRank = projectPriorityRank(
      projectPriorityLevel(bProject?.body),
    );
    return (
      aRank - bRank ||
      aProjectRank - bProjectRank ||
      bodyNumber(b, 'hours', 0) - bodyNumber(a, 'hours', 0) ||
      a.sortOrder - b.sortOrder
    );
  })[0];
}

export function supportingActions(items: LifeItem[], primaryId?: string): LifeItem[] {
  return ofKind(items, 'ACTION')
    .filter(isOpen)
    .filter((item) => item.id !== primaryId)
    .slice(0, 3);
}

export function projectRisks(items: LifeItem[]): string[] {
  const risks: string[] = [];
  const projects = ofKind(items, 'PROJECT').filter(isOpen);
  for (const project of projects) {
    const actions = childrenOf(items, project.id).filter(
      (item) => item.kind === 'ACTION' && isOpen(item),
    );
    if (actions.length === 0) {
      risks.push(`${project.title} has no next action`);
    }
  }
  const { planned, available } = weeklyCapacityHours(items);
  if (planned > available) {
    risks.push(
      `Week is over capacity (${planned.toFixed(1)}h planned / ${available}h available)`,
    );
  }
  return risks.slice(0, 5);
}

export function ideaScore(item: LifeItem): number {
  const impact = bodyNumber(item, 'impact', 0);
  const effort = bodyNumber(item, 'effort', 0);
  const alignment = bodyNumber(item, 'alignment', 0);
  const timing = bodyNumber(item, 'timing', 0);
  if (!impact && !effort && !alignment && !timing) return 0;
  return impact + alignment + timing - effort;
}

/** Ensure capacity preference exists; do not auto-create life areas. */
export async function ensureCapacityPreference(items: LifeItem[]): Promise<LifeItem[]> {
  const hasCapacity = ofKind(items, 'VISION').some((item) =>
    Object.prototype.hasOwnProperty.call(item.body, 'availableHours'),
  );
  if (hasCapacity) return items;
  const created = await createLifeItem({
    kind: 'VISION',
    title: 'Weekly capacity',
    body: { availableHours: 11 },
    sortOrder: 100,
  });
  return [...items, created];
}

export async function refreshAllItems(): Promise<LifeItem[]> {
  const items = await listLifeItems();
  return ensureCapacityPreference(items);
}
