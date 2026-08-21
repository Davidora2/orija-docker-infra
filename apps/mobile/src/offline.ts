/**
 * Offline cache + outbox for Life OS mobile.
 *
 * Conflict policy: **last-write-wins** (client).
 * Mutating requests are queued FIFO while offline. On reconnect the outbox
 * flushes in order; each successful server write is authoritative. Optimistic
 * local ids (`local-*`) are remapped when creates land on the server.
 *
 * Session tokens stay in AsyncStorage across restarts. Network failures during
 * token refresh do NOT clear the session — the app keeps using the last known
 * valid session and cached data until refresh succeeds.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Account, LifeItem } from './api';

const ACCOUNT_CACHE_KEY = 'life-os-cache-account';
const ITEMS_CACHE_KEY = 'life-os-cache-items';
const CALENDAR_CACHE_KEY = 'life-os-cache-calendar';
const BUDGETS_CACHE_KEY = 'life-os-cache-budgets';
const OUTBOX_KEY = 'life-os-outbox';
const SYNC_META_KEY = 'life-os-sync-meta';

export type SyncPhase = 'online' | 'offline' | 'syncing' | 'synced';

export type OutboxOp =
  | {
      id: string;
      kind: 'createLifeItem';
      createdAt: string;
      optimisticId: string;
      input: {
        kind: LifeItem['kind'];
        title: string;
        visibility?: LifeItem['visibility'];
        status?: string;
        parentId?: string | null;
        body?: Record<string, unknown>;
        sortOrder?: number;
      };
    }
  | {
      id: string;
      kind: 'updateLifeItem';
      createdAt: string;
      itemId: string;
      input: {
        title?: string;
        status?: string;
        visibility?: LifeItem['visibility'];
        parentId?: string | null;
        body?: Record<string, unknown>;
        sortOrder?: number;
      };
    }
  | {
      id: string;
      kind: 'deleteLifeItem';
      createdAt: string;
      itemId: string;
    };

type SyncMeta = {
  lastSyncedAt: string | null;
  pendingCount: number;
};

type SyncListener = (phase: SyncPhase, meta: SyncMeta) => void;

let phase: SyncPhase = 'online';
let listeners = new Set<SyncListener>();
let idMap: Record<string, string> = {};
let flushPromise: Promise<void> | null = null;

function notifyListeners(meta: SyncMeta) {
  for (const listener of listeners) listener(phase, meta);
}

export function subscribeSyncStatus(listener: SyncListener): () => void {
  listeners.add(listener);
  void getSyncMeta().then((meta) => listener(phase, meta));
  return () => {
    listeners.delete(listener);
  };
}

export function getSyncPhase(): SyncPhase {
  return phase;
}

export async function setSyncPhase(next: SyncPhase): Promise<void> {
  phase = next;
  const meta = await getSyncMeta();
  if (next === 'synced') {
    meta.lastSyncedAt = new Date().toISOString();
    await AsyncStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  }
  notifyListeners(meta);
}

export async function getSyncMeta(): Promise<SyncMeta> {
  const raw = await AsyncStorage.getItem(SYNC_META_KEY);
  const outbox = await loadOutbox();
  const base: SyncMeta = raw
    ? (JSON.parse(raw) as SyncMeta)
    : { lastSyncedAt: null, pendingCount: 0 };
  return { ...base, pendingCount: outbox.length };
}

export function isNetworkFailure(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof TypeError) return true;
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'request_timeout'
  ) {
    return true;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status?: number }).status === 408
  ) {
    return true;
  }
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('took too long') ||
    message.includes('aborted')
  );
}

export async function cacheAccount(account: Account | null): Promise<void> {
  if (!account) {
    await AsyncStorage.removeItem(ACCOUNT_CACHE_KEY);
    return;
  }
  await AsyncStorage.setItem(ACCOUNT_CACHE_KEY, JSON.stringify(account));
}

export async function loadCachedAccount(): Promise<Account | null> {
  const raw = await AsyncStorage.getItem(ACCOUNT_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Account;
  } catch {
    return null;
  }
}

export async function cacheItems(items: LifeItem[]): Promise<void> {
  await AsyncStorage.setItem(ITEMS_CACHE_KEY, JSON.stringify(items));
}

export async function loadCachedItems(): Promise<LifeItem[] | null> {
  const raw = await AsyncStorage.getItem(ITEMS_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LifeItem[];
  } catch {
    return null;
  }
}

export async function cacheJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function loadCachedJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const cacheKeys = {
  calendar: CALENDAR_CACHE_KEY,
  budgets: BUDGETS_CACHE_KEY,
};

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeOptimisticId(): string {
  return newId('local');
}

export function isOptimisticId(id: string): boolean {
  return id.startsWith('local-');
}

export function resolveMappedId(id: string): string {
  let current = id;
  const seen = new Set<string>();
  while (idMap[current] && !seen.has(current)) {
    seen.add(current);
    current = idMap[current];
  }
  return current;
}

export function rememberIdMap(optimisticId: string, serverId: string): void {
  idMap[optimisticId] = serverId;
}

export async function loadOutbox(): Promise<OutboxOp[]> {
  const raw = await AsyncStorage.getItem(OUTBOX_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OutboxOp[];
  } catch {
    return [];
  }
}

async function saveOutbox(ops: OutboxOp[]): Promise<void> {
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(ops));
  const meta = await getSyncMeta();
  meta.pendingCount = ops.length;
  await AsyncStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  notifyListeners(meta);
}

export async function enqueueOutbox(
  op:
    | Omit<Extract<OutboxOp, { kind: 'createLifeItem' }>, 'id' | 'createdAt'>
    | Omit<Extract<OutboxOp, { kind: 'updateLifeItem' }>, 'id' | 'createdAt'>
    | Omit<Extract<OutboxOp, { kind: 'deleteLifeItem' }>, 'id' | 'createdAt'>,
): Promise<OutboxOp> {
  const entry = {
    ...op,
    id: newId('outbox'),
    createdAt: new Date().toISOString(),
  } as OutboxOp;
  const ops = await loadOutbox();
  ops.push(entry);
  await saveOutbox(ops);
  await setSyncPhase('offline');
  return entry;
}

export async function clearOutbox(): Promise<void> {
  await saveOutbox([]);
}

export type OutboxFlushHandlers = {
  createLifeItem: (input: {
    kind: LifeItem['kind'];
    title: string;
    visibility?: LifeItem['visibility'];
    status?: string;
    parentId?: string | null;
    body?: Record<string, unknown>;
    sortOrder?: number;
  }) => Promise<LifeItem>;
  updateLifeItem: (
    id: string,
    input: {
      title?: string;
      status?: string;
      visibility?: LifeItem['visibility'];
      parentId?: string | null;
      body?: Record<string, unknown>;
      sortOrder?: number;
    },
  ) => Promise<LifeItem>;
  deleteLifeItem: (id: string) => Promise<void>;
  onItemsChanged?: (items: LifeItem[]) => void;
};

/**
 * Flush queued mutations. Safe to call concurrently — only one flush runs.
 */
export async function flushOutbox(handlers: OutboxFlushHandlers): Promise<{
  flushed: number;
  remaining: number;
}> {
  if (flushPromise) {
    await flushPromise;
    const remaining = (await loadOutbox()).length;
    return { flushed: 0, remaining };
  }

  flushPromise = (async () => {
    const ops = await loadOutbox();
    if (ops.length === 0) {
      await setSyncPhase('synced');
      return;
    }
    await setSyncPhase('syncing');
    const remaining: OutboxOp[] = [];
    let items = (await loadCachedItems()) ?? [];

    for (const op of ops) {
      try {
        if (op.kind === 'createLifeItem') {
          const parentId = op.input.parentId
            ? resolveMappedId(op.input.parentId)
            : op.input.parentId;
          const created = await handlers.createLifeItem({
            ...op.input,
            parentId,
          });
          rememberIdMap(op.optimisticId, created.id);
          items = items.map((item) => {
            if (item.id === op.optimisticId) return created;
            if (item.parentId === op.optimisticId) {
              return { ...item, parentId: created.id };
            }
            return item;
          });
          if (!items.some((item) => item.id === created.id)) {
            items = [...items, created];
          }
        } else if (op.kind === 'updateLifeItem') {
          const itemId = resolveMappedId(op.itemId);
          if (isOptimisticId(itemId)) {
            // Still waiting on create — keep in outbox
            remaining.push({
              ...op,
              itemId,
              input: {
                ...op.input,
                parentId:
                  op.input.parentId != null
                    ? resolveMappedId(op.input.parentId)
                    : op.input.parentId,
              },
            });
            continue;
          }
          const updated = await handlers.updateLifeItem(itemId, {
            ...op.input,
            parentId:
              op.input.parentId != null
                ? resolveMappedId(op.input.parentId)
                : op.input.parentId,
          });
          items = items.map((item) => (item.id === itemId ? updated : item));
        } else if (op.kind === 'deleteLifeItem') {
          const itemId = resolveMappedId(op.itemId);
          if (isOptimisticId(itemId)) {
            items = items.filter((item) => item.id !== itemId);
            continue;
          }
          await handlers.deleteLifeItem(itemId);
          items = items.filter((item) => item.id !== itemId);
        }
      } catch (error) {
        if (isNetworkFailure(error)) {
          remaining.push(op, ...ops.slice(ops.indexOf(op) + 1));
          await saveOutbox(remaining);
          await cacheItems(items);
          handlers.onItemsChanged?.(items);
          await setSyncPhase('offline');
          return;
        }
        // Drop poison messages after logging — keep going
        console.warn('[offline] dropping failed outbox op', op.kind, error);
      }
    }

    await saveOutbox(remaining);
    await cacheItems(items);
    handlers.onItemsChanged?.(items);
    await setSyncPhase(remaining.length > 0 ? 'offline' : 'synced');
  })().finally(() => {
    flushPromise = null;
  });

  await flushPromise;
  const left = (await loadOutbox()).length;
  return { flushed: left === 0 ? 1 : 0, remaining: left };
}

export function optimisticLifeItem(input: {
  kind: LifeItem['kind'];
  title: string;
  visibility?: LifeItem['visibility'];
  status?: string;
  parentId?: string | null;
  body?: Record<string, unknown>;
  sortOrder?: number;
  ownerUserId?: string;
}): LifeItem {
  const now = new Date().toISOString();
  return {
    id: makeOptimisticId(),
    ownerUserId: input.ownerUserId ?? 'local',
    householdId: null,
    parentId: input.parentId ?? null,
    kind: input.kind,
    visibility: input.visibility ?? 'PRIVATE',
    title: input.title,
    status: input.status ?? 'ACTIVE',
    body: input.body ?? {},
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}
