import {
  createLifeItem,
  listLifeItems,
  type LifeItem,
} from './api';

export const DEFAULT_PILLARS = [
  { title: 'Product', icon: 'layers-outline', sortOrder: 0 },
  { title: 'Business', icon: 'briefcase-outline', sortOrder: 1 },
  { title: 'Wealth', icon: 'wallet-outline', sortOrder: 2 },
  { title: 'Career', icon: 'trending-up-outline', sortOrder: 3 },
  { title: 'Personal', icon: 'heart-outline', sortOrder: 4 },
  { title: 'Creative', icon: 'sparkles-outline', sortOrder: 5 },
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
  const available =
    ofKind(items, 'VISION').find((item) => bodyNumber(item, 'availableHours')) !=
    null
      ? bodyNumber(
          ofKind(items, 'VISION').find((item) =>
            Object.prototype.hasOwnProperty.call(item.body, 'availableHours'),
          )!,
          'availableHours',
          11,
        )
      : 11;

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
  const scheduled = open.filter((item) => bodyString(item, 'day'));
  const pool = scheduled.length > 0 ? scheduled : open;
  return [...pool].sort(
    (a, b) =>
      bodyNumber(b, 'hours', 0) - bodyNumber(a, 'hours', 0) ||
      a.sortOrder - b.sortOrder,
  )[0];
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

export async function ensureStarterPillars(items: LifeItem[]): Promise<LifeItem[]> {
  if (ofKind(items, 'PILLAR').length > 0) return items;
  const created: LifeItem[] = [];
  for (const pillar of DEFAULT_PILLARS) {
    created.push(
      await createLifeItem({
        kind: 'PILLAR',
        title: pillar.title,
        body: { icon: pillar.icon },
        sortOrder: pillar.sortOrder,
      }),
    );
  }
  // Capacity preference as a VISION settings record
  created.push(
    await createLifeItem({
      kind: 'VISION',
      title: 'Weekly capacity',
      body: { availableHours: 11 },
      sortOrder: 100,
    }),
  );
  return [...items, ...created];
}

export async function refreshAllItems(): Promise<LifeItem[]> {
  const items = await listLifeItems();
  return ensureStarterPillars(items);
}
