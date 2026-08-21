/**
 * Offline sync — conflict policy
 *
 * **Policy: last-write-wins (client outbox FIFO).**
 *
 * While the API is unreachable the mobile app:
 * 1. Keeps the AsyncStorage session (no forced logout on network errors).
 * 2. Serves last-known account, life items, calendar, and budgets from cache.
 * 3. Queues life-item create/update/delete ops in `life-os-outbox`.
 * 4. Flushes the outbox when connectivity returns; each successful write is
 *    authoritative. Optimistic `local-*` ids are remapped to server ids.
 *
 * See `apps/mobile/src/OFFLINE.md` and `apps/mobile/src/offline.ts`.
 */
export {};
